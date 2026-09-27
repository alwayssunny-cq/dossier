/**
 * Finds what a phone screen actually does wrong: text cut off inside its own
 * box, two pieces of text sitting on top of each other, content buried under a
 * floating control, a horizontal rail with an entry half off the edge, and
 * images that resolved to nothing. Checks at four scroll positions, because a
 * sticky bar can only collide once the page has moved.
 * 
 * Run against a dev server:  node scripts/audit-mobile.mjs
 * Needs .env.local for a Supabase session; reads nothing else.
 */

import { readFileSync, writeFileSync } from 'fs'
import { chromium } from 'playwright'

const SHOTS='/private/tmp/claude-501/-Users-jensojose-cq-client-portal/87e00246-c238-4bc1-b48c-d6dbcd2f31b6/scratchpad/shots2'
const env={}; readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.trim().match(/^([A-Z_]+)=(.*)$/); if(m) env[m[1]]=m[2].trim()})
if(!env.AUDIT_PHONE||!env.AUDIT_PASSWORD){console.error('Set AUDIT_PHONE and AUDIT_PASSWORD in .env.local (a test login for the audit).');process.exit(1)}
const URL_=env.NEXT_PUBLIC_SUPABASE_URL, REF=URL_.replace('https://','').split('.')[0]
const SITE=process.env.TARGET||'http://localhost:3000'
const session=await fetch(`${URL_}/auth/v1/token?grant_type=password`,{method:'POST',
  headers:{apikey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({phone:env.AUDIT_PHONE,password:env.AUDIT_PASSWORD})}).then(r=>r.json())
if(!session.access_token){console.error('no session',session);process.exit(1)}

const ROUTES=(process.env.ROUTES||[
 '/dashboard','/trip/TRIP-4','/trip/TRIP-4/your-trip','/trip/TRIP-4/journey',
 '/trip/TRIP-4/experiences','/trip/TRIP-4/travel-guide','/trip/TRIP-4/log',
 '/trip/TRIP-2','/trip/TRIP-2/dates-destinations','/trip/TRIP-2/stays','/trip/TRIP-2/experiences',
 '/trip/TRIP-1','/trip/TRIP-1/brief','/profile','/understand-you','/understand-cq',
 '/trip/TRIP-4/reservations-payments','/trip/TRIP-4/financials','/trip/TRIP-4/itinerary',
 '/trip/TRIP-4/dates-destinations?stage=crafting','/trip/TRIP-4/stays?stage=crafting',
 '/trip/TRIP-4/experiences?stage=crafting','/trip/TRIP-4/log?stage=crafting',
 '/trip/TRIP-4/brief?stage=first-steps','/trip/TRIP-3/dates-destinations','/trip/TRIP-3/experiences',
 '/trip/TRIP-4/today','/trip/TRIP-4/documents','/trip/TRIP-2/journey',
].join(',')).split(',')

const SCAN = () => {
  const VW=innerWidth, VH=innerHeight
  const out={truncated:[],overlap:[],occluded:[],clipped:[],badImg:[]}
  const txt=el=>(el.textContent||'').trim().replace(/\s+/g,' ')
  const name=el=>{const c=(typeof el.className==='string'&&el.className.trim())?'.'+el.className.trim().split(/\s+/).slice(0,2).join('.'):''
    return el.tagName.toLowerCase()+c}
  const vis=el=>{
    for(let a=el;a&&a!==document.documentElement;a=a.parentElement){
      const s=getComputedStyle(a)
      if(s.visibility==='hidden'||s.display==='none'||parseFloat(s.opacity)<=0.05)return false
    }
    return true}
  // Sticky behaves like fixed while pinned: it paints over what it passes,
  // with its own ground. Counting that as two elements colliding reported the
  // pinned chapter head against every day heading it slid over.
  const inFixed=el=>{for(let a=el;a&&a!==document.body;a=a.parentElement){
    const pos=getComputedStyle(a).position
    if(pos==='fixed'||pos==='sticky')return true} return false}

  // Leaf text nodes: elements whose own text is not split across element children.
  const leaves=[...document.querySelectorAll('body *')].filter(el=>{
    if(!vis(el))return false
    const t=txt(el); if(!t||t.length<2)return false
    if([...el.children].some(c=>txt(c).length>0))return false
    const r=el.getBoundingClientRect()
    return r.width>1&&r.height>1
  })

  // 1. Text clipped by its own box.
  for(const el of leaves){
    const s=getComputedStyle(el)
    const clipsX=el.scrollWidth>el.clientWidth+1 && /hidden|clip/.test(s.overflowX)
    const clamp=s.webkitLineClamp&&s.webkitLineClamp!=='none'&&el.scrollHeight>el.clientHeight+1
    const clipsY=el.scrollHeight>el.clientHeight+2 && /hidden|clip/.test(s.overflowY) && !clamp
    if(clipsX||clipsY){
      out.truncated.push({el:name(el),text:txt(el).slice(0,52),
        how:clipsX?'cut horizontally':clamp?'line-clamped':'cut vertically',
        shown:Math.round(el.clientWidth),needs:Math.round(el.scrollWidth)})
    }
  }

  // 2. Two pieces of visible text sitting on top of each other.
  const area=r=>r.width*r.height
  for(let i=0;i<leaves.length;i++){
    for(let j=i+1;j<leaves.length;j++){
      const a=leaves[i],b=leaves[j]
      if(a.contains(b)||b.contains(a))continue
      // One of them floating over the page is occlusion, counted elsewhere.
      if(inFixed(a)||inFixed(b))continue
      const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect()
      const ov=Math.max(0,Math.min(ra.right,rb.right)-Math.max(ra.left,rb.left))
              *Math.max(0,Math.min(ra.bottom,rb.bottom)-Math.max(ra.top,rb.top))
      if(ov<=0)continue
      if(ov/Math.min(area(ra),area(rb))>0.30){
        out.overlap.push({a:name(a)+' «'+txt(a).slice(0,26)+'»',b:name(b)+' «'+txt(b).slice(0,26)+'»',
          pct:Math.round(100*ov/Math.min(area(ra),area(rb)))})
      }
    }
  }

  // 3. Text hidden under something fixed on top of it.
  const fixed=[...document.querySelectorAll('body *')].filter(el=>{
    if(!vis(el))return false
    if(getComputedStyle(el).position!=='fixed')return false
    const r=el.getBoundingClientRect()
    return r.width>8&&r.height>8&&r.top<VH&&r.bottom>0
  })
  for(const f of fixed){
    const rf=f.getBoundingClientRect()
    for(const el of leaves){
      if(f.contains(el))continue
      const r=el.getBoundingClientRect()
      if(r.bottom<0||r.top>VH)continue
      const ov=Math.max(0,Math.min(rf.right,r.right)-Math.max(rf.left,r.left))
              *Math.max(0,Math.min(rf.bottom,r.bottom)-Math.max(rf.top,r.top))
      if(ov/area(r)>0.18){
        out.occluded.push({covered:name(el)+' «'+txt(el).slice(0,34)+'»',
          by:name(f),anchor:rf.top<64?'top':'bottom',pct:Math.round(100*ov/area(r))})
      }
    }
  }

  // 4. A horizontal scroller with content cut at an edge and no way to tell.
  for(const el of document.querySelectorAll('body *')){
    if(!vis(el))continue
    const s=getComputedStyle(el)
    if(!/(auto|scroll)/.test(s.overflowX))continue
    if(el.scrollWidth<=el.clientWidth+2)continue
    const r=el.getBoundingClientRect()
    const cutStart=el.scrollLeft>2
    const cutEnd=el.scrollLeft<el.scrollWidth-el.clientWidth-2
    // A child straddling an edge is a half-visible word.
    let straddles=0
    for(const c of el.children){
      const rc=c.getBoundingClientRect()
      if((rc.left<r.left-1&&rc.right>r.left+1)||(rc.left<r.right-1&&rc.right>r.right+1))straddles++
    }
    // A scroller that fades at the edge is telling the reader there is more.
    // That is the teaser NN/g describes, not a fault. Only a hard cut with no
    // affordance leaves content that looks like it simply ends.
    const cs2=getComputedStyle(el)
    const hasFade=(cs2.maskImage&&cs2.maskImage!=='none')||(cs2.webkitMaskImage&&cs2.webkitMaskImage!=='none')
    if(!hasFade&&(straddles>0||cutStart||cutEnd)){
      out.clipped.push({el:name(el),straddling:straddles,cutStart,cutEnd,
        shown:Math.round(el.clientWidth),total:Math.round(el.scrollWidth),
        text:txt(el).slice(0,50)})
    }
  }

  // 5. Images that resolved to nothing.
  for(const im of document.querySelectorAll('img')){
    const r=im.getBoundingClientRect(); if(r.width<2)continue
    if(im.complete&&im.naturalWidth===0) out.badImg.push({src:(im.getAttribute('src')||'(none)').slice(0,80),why:'failed'})
    else if(!im.getAttribute('src')) out.badImg.push({src:'(empty src)',why:'no src'})
  }
  return out
}

const b=await chromium.launch()
const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3})
await ctx.addCookies([{name:`sb-${REF}-auth-token`,
  value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64'),
  domain:new URL(SITE).hostname,path:'/',secure:SITE.startsWith('https'),sameSite:'Lax'}])
const p=await ctx.newPage()
const report={}
for(const route of ROUTES){
  try{ await p.goto(SITE+route,{waitUntil:'networkidle',timeout:45000}) }
  catch(e){ report[route]={fatal:e.message.slice(0,70)}; continue }
  if(new URL(p.url()).pathname.startsWith('/login') && !route.startsWith('/login')){
    console.error(`NOT SIGNED IN: ${route} redirected to /login — this run proves nothing.`)
    process.exitCode=1
    report[route]={fatal:'redirected to /login'}
    continue
  }
  await p.waitForTimeout(900)
  const merged={truncated:[],overlap:[],occluded:[],clipped:[],badImg:[]}
  const H=await p.evaluate(()=>document.documentElement.scrollHeight)
  // Sticky bars only collide once the page has moved.
  for(const frac of [0,0.25,0.5,0.8,1]){
    await p.evaluate(y=>scrollTo(0,y), Math.round((H-844)*frac))
    await p.waitForTimeout(500)
    const r=await p.evaluate(SCAN)
    // Occlusion by the page-level bar counts only at the very bottom, where
    // there is no more scrolling to do. A floating button counts anywhere.
    r.occluded=r.occluded.filter(o=>{
      if(/fixed\.right|dock/.test(o.by))return true          // floats over content
      if(frac!==1)return false                                 // scrollable away
      return o.anchor!=='top'                                  // a header is not a fault
    })
    for(const k of Object.keys(merged)) merged[k].push(...r[k])
  }
  const uniq=(arr,key)=>{const s=new Set();return arr.filter(x=>{const k=key(x);return s.has(k)?false:(s.add(k),true)})}
  report[route]={
    truncated:uniq(merged.truncated,x=>x.el+x.text),
    overlap:  uniq(merged.overlap,  x=>x.a+x.b),
    occluded: uniq(merged.occluded, x=>x.covered+x.by),
    clipped:  uniq(merged.clipped,  x=>x.el+x.text),
    badImg:   uniq(merged.badImg,   x=>x.src),
  }
}
await b.close()
writeFileSync('/tmp/cq-audit2.json',JSON.stringify(report,null,1))
let tot=0
for(const [r,v] of Object.entries(report)){
  if(v.fatal){console.log(r.padEnd(34),'FATAL',v.fatal);continue}
  const n=v.truncated.length+v.overlap.length+v.occluded.length+v.clipped.length+v.badImg.length
  tot+=n
  if(!n)continue
  const f=[]
  if(v.truncated.length)f.push(`${v.truncated.length} truncated`)
  if(v.overlap.length)  f.push(`${v.overlap.length} OVERLAP`)
  if(v.occluded.length) f.push(`${v.occluded.length} covered`)
  if(v.clipped.length)  f.push(`${v.clipped.length} clipped rail`)
  if(v.badImg.length)   f.push(`${v.badImg.length} broken img`)
  console.log(r.padEnd(34), f.join(' | '))
}
console.log('\nTOTAL DEFECTS:',tot)
