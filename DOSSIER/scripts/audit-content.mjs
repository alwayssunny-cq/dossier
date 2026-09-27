/**
 * What the words actually say, and whether a list looks like a list.
 *
 * The other audits measure geometry and accessibility. Neither notices that a
 * page says "In Motion" as an eyebrow and then "in motion" again in the line
 * beneath it, or that eight recommendations run together with nothing between
 * them. Both are basic and both shipped.
 *
 *   repeats    the same words shown twice near each other
 *   echoes     one label wholly contained in its neighbour
 *   runs       sibling items with no rule, no panel and no gap between them
 *
 * Run against a dev server:  node scripts/audit-content.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { chromium } from 'playwright'

const env={}; readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.trim().match(/^([A-Z_]+)=(.*)$/); if(m) env[m[1]]=m[2].trim()})
if(!env.AUDIT_PHONE||!env.AUDIT_PASSWORD){console.error('Set AUDIT_PHONE and AUDIT_PASSWORD in .env.local (a test login for the audit).');process.exit(1)}
const URL_=env.NEXT_PUBLIC_SUPABASE_URL, REF=URL_.replace('https://','').split('.')[0]
const SITE=process.env.TARGET||'http://localhost:3000'
const session=await fetch(`${URL_}/auth/v1/token?grant_type=password`,{method:'POST',
  headers:{apikey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({phone:env.AUDIT_PHONE,password:env.AUDIT_PASSWORD})}).then(r=>r.json())
if(!session.access_token){console.error('no session');process.exit(1)}

const ROUTES=[
 '/dashboard','/profile','/understand-you','/understand-cq',
 '/trip/TRIP-4','/trip/TRIP-4/your-trip','/trip/TRIP-4/journey','/trip/TRIP-4/travel-guide',
 '/trip/TRIP-4/experiences','/trip/TRIP-4/documents','/trip/TRIP-4/log',
 '/trip/TRIP-4/dates-destinations?stage=crafting','/trip/TRIP-4/stays?stage=crafting',
 '/trip/TRIP-1/brief',
]

const SCAN = () => {
  const out={repeats:[],echoes:[],runs:[]}
  const norm=t=>t.trim().replace(/\s+/g,' ').toLowerCase().replace(/[.,·—–-]+$/,'').trim()
  const vis=el=>{for(let a=el;a&&a!==document.documentElement;a=a.parentElement){const s=getComputedStyle(a)
    if(s.display==='none'||s.visibility==='hidden'||parseFloat(s.opacity)<=0.05)return false}
    const r=el.getBoundingClientRect(); return r.width>1&&r.height>1}

  // Leaf text: elements whose text is not split across element children.
  const leaves=[...document.querySelectorAll('body *')].filter(el=>{
    if(!vis(el))return false
    const t=(el.textContent||'').trim(); if(!t||t.length<3)return false
    if([...el.children].some(c=>(c.textContent||'').trim()))return false
    return true
  }).map(el=>({el,t:(el.textContent||'').trim(),n:norm(el.textContent||''),
               y:el.getBoundingClientRect().top+window.scrollY}))

  const label=el=>{const c=(typeof el.className==='string'&&el.className.trim())?'.'+el.className.trim().split(/\s+/)[0]:''
    return el.tagName.toLowerCase()+c}

  // A label that appears once per item in a list — "Map" under every place,
  // "Daytime" under every opening time — repeats by design. Two elements
  // count as repetition only when they are NOT the same slot in a repeated
  // structure. Compared by the shape of their path rather than by their text.
  const path=el=>{const q=[]; for(let a=el;a&&a!==document.body;a=a.parentElement)
    q.unshift(a.tagName+'.'+(typeof a.className==='string'?a.className.trim().split(/\s+/)[0]:''))
    return q.join('>')}
  for(const l of leaves) l.p=path(l.el)

  // 1. The same words twice, close together. Far apart is navigation; close
  //    together is the page saying one thing twice.
  for(let i=0;i<leaves.length;i++){
    for(let j=i+1;j<leaves.length;j++){
      const a=leaves[i],b=leaves[j]
      if(a.n!==b.n)continue
      if(a.p===b.p)continue                      // same slot in a repeated list
      if(a.n.length<6)continue                   // "map", "all", "other"
      if(Math.abs(a.y-b.y)>420)continue
      out.repeats.push({text:a.t.slice(0,44),gap:Math.round(Math.abs(a.y-b.y)),
                        a:label(a.el),b:label(b.el)})
    }
  }

  // 2. One label wholly inside its neighbour — "Bon Voyage" above
  //    "Bon Voyage, John." Same information, said twice.
  for(let i=0;i<leaves.length;i++){
    for(let j=0;j<leaves.length;j++){
      if(i===j)continue
      const a=leaves[i],b=leaves[j]
      if(a.n.length<4||a.n.length>40)continue
      if(!b.n.includes(a.n))continue
      if(a.n===b.n)continue
      if(Math.abs(a.y-b.y)>240)continue
      if(b.n.length>110)continue          // a mention inside prose is not a repeat
      if(a.p===b.p)continue               // same slot in a repeated list
      if(/^\d/.test(a.n))continue         // a year or a count inside a sentence
      out.echoes.push({small:a.t.slice(0,40),inside:b.t.slice(0,54),
                       gap:Math.round(Math.abs(a.y-b.y)),a:label(a.el),b:label(b.el)})
    }
  }

  // 3. A run of sibling items with nothing dividing them.
  for(const parent of document.querySelectorAll('body *')){
    const kids=[...parent.children].filter(vis)
    if(kids.length<3)continue
    // Only look at genuinely repeated structures.
    const sig=k=>k.tagName+':'+(typeof k.className==='string'?k.className.trim().split(/\s+/)[0]:'')
    const sigs=new Set(kids.map(sig))
    if(sigs.size>1)continue
    if(kids.every(k=>(k.textContent||'').trim().length<3))continue
    const pcs=getComputedStyle(parent)
    const rowGap=parseFloat(pcs.rowGap)||0
    const colGap=parseFloat(pcs.columnGap)||0
    const stacked=kids[1].getBoundingClientRect().top-kids[0].getBoundingClientRect().top>4
    let divided=false, spaced=false
    const drawsALine=el=>{
      const cs=getComputedStyle(el)
      const bt=parseFloat(cs.borderTopWidth)||0, bb=parseFloat(cs.borderBottomWidth)||0
      const bg=cs.backgroundColor
      const hasBg=bg&&bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent'
      return bt>0||bb>0||hasBg||cs.borderRadius!=='0px'
    }
    for(const k of kids.slice(1)){
      // The divider often sits on the item's own header rather than on the
      // item — a collapsible section draws its rule under the button inside
      // it. Looking only at the item itself called those lists undivided.
      if(drawsALine(k)||[...k.children].some(drawsALine)) divided=true
      // Like the divider, the breathing room often sits on a child: a
      // timeline entry pads the column beside its spine, not the row.
      const breathes=el=>{const c=getComputedStyle(el)
        return (parseFloat(c.marginTop)||0)>=12||(parseFloat(c.paddingBottom)||0)>=12
            ||(parseFloat(c.paddingTop)||0)>=12}
      if(breathes(k)||[...k.children].some(breathes)||(stacked?rowGap:colGap)>=12) spaced=true
    }
    if(!divided&&!spaced){
      const r=kids[0].getBoundingClientRect()
      out.runs.push({parent:label(parent),count:kids.length,
        item:sig(kids[0]),
        gap:Math.round(stacked?rowGap:colGap),
        first:(kids[0].textContent||'').trim().slice(0,44),
        y:Math.round(r.top+window.scrollY)})
    }
  }
  return out
}

const b=await chromium.launch()
const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
await ctx.addCookies([{name:`sb-${REF}-auth-token`,
  value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64'),
  domain:new URL(SITE).hostname,path:'/',secure:SITE.startsWith('https'),sameSite:'Lax'}])
const p=await ctx.newPage()
const report={}
for(const route of ROUTES){
  try{ await p.goto(SITE+route,{waitUntil:'networkidle',timeout:45000}) }catch{ continue }
  if(new URL(p.url()).pathname.startsWith('/login')){console.error('NOT SIGNED IN');process.exit(1)}
  await p.waitForTimeout(700)
  // Open every door so the audit sees the whole page, not just its lids.
  await p.evaluate(()=>{document.querySelectorAll('[aria-expanded="false"]').forEach(b=>b.click())})
  await p.waitForTimeout(900)
  report[route]=await p.evaluate(SCAN)
}
await b.close()
writeFileSync('/tmp/cq-content.json',JSON.stringify(report,null,1))

let R=0,E=0,U=0
for(const v of Object.values(report)){R+=v.repeats.length;E+=v.echoes.length;U+=v.runs.length}
console.log(`repeated text: ${R}   echoed labels: ${E}   undivided runs: ${U}\n`)
for(const [route,v] of Object.entries(report)){
  const n=v.repeats.length+v.echoes.length+v.runs.length
  if(!n)continue
  console.log(route)
  const seen=new Set()
  v.repeats.slice(0,4).forEach(x=>{const k='r'+x.text; if(seen.has(k))return; seen.add(k)
    console.log(`   REPEAT  «${x.text}»  ${x.gap}px apart  (${x.a} / ${x.b})`)})
  v.echoes.slice(0,4).forEach(x=>{const k='e'+x.small+x.inside; if(seen.has(k))return; seen.add(k)
    console.log(`   ECHO    «${x.small}» inside «${x.inside}»  ${x.gap}px  (${x.a} / ${x.b})`)})
  v.runs.slice(0,4).forEach(x=>
    console.log(`   RUN     ${x.count}x ${x.item} in ${x.parent}, gap ${x.gap}px  «${x.first}»`))
}
