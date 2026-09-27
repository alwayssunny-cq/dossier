/**
 * The checkable half of the editorial layout rules.
 *
 * That document is about composition, and most of its tests are mechanical.
 * Each finding names the rule it breaks:
 *
 *   padding      §2  "Give every section identical padding" — NEVER
 *   cards        §14 cards only where content needs a visible boundary
 *   rhythm       §24 not every section starts at column 1 and ends at 12
 *   repetition   §40 card grid, card grid, card grid
 *   headings     §2  "Make every heading the same size" — NEVER
 *   centred      §2  "Center everything" — NEVER
 *   ratios       §41 identical image ratios everywhere
 *   measure      §22 45–85 characters per line
 *   spacing      §10 internal < component < section
 *   fixedHeight  §45 avoid fixed heights on content
 *
 * It cannot judge whether a composition is beautiful, whether the dominant
 * move is the right one, or whether asymmetry serves the reading order. Those
 * are §38, §39 and §49 — the blur, squint and three-second tests — and they
 * need eyes.
 *
 * Run against a dev server:  node scripts/audit-editorial.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { chromium } from 'playwright'

const env={}; readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/); if(m) env[m[1]]=m[2].trim()})
const URL_=env.NEXT_PUBLIC_SUPABASE_URL, REF=URL_.replace('https://','').split('.')[0]
const SITE=process.env.TARGET||'http://localhost:3000'
const session=await fetch(`${URL_}/auth/v1/token?grant_type=password`,{method:'POST',
  headers:{apikey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({phone:'+919008116761',password:'Audit-'+REF.slice(0,6)+'!'})}).then(r=>r.json())
if(!session.access_token){console.error('no session');process.exit(1)}

const ROUTES=[
 '/dashboard','/trip/TRIP-4/your-trip','/trip/TRIP-4/travel-guide',
 '/trip/TRIP-4/dates-destinations?stage=crafting','/trip/TRIP-4/experiences',
 '/trip/TRIP-1/brief','/understand-you','/profile',
]

const SCAN = () => {
  const out={padding:[],cards:{},rhythm:{},repetition:[],headings:{},centred:[],
             ratios:{},measure:[],spacing:[],fixedHeight:[]}
  const vis=el=>{for(let a=el;a&&a!==document.documentElement;a=a.parentElement){const s=getComputedStyle(a)
    if(s.display==='none'||s.visibility==='hidden'||parseFloat(s.opacity)<=0.05)return false}
    const r=el.getBoundingClientRect(); return r.width>4&&r.height>4}
  const nm=el=>{const c=(typeof el.className==='string'&&el.className.trim())?'.'+el.className.trim().split(/\s+/)[0]:''
    return el.tagName.toLowerCase()+c}
  const txt=el=>(el.textContent||'').trim().replace(/\s+/g,' ')

  const main=document.querySelector('main')||document.body
  const sections=[...main.querySelectorAll('section')].filter(vis)
  // A composition is not always tagged <section>: a page's opening header and
  // its closing statement are blocks too, and the span check has to see them
  // or it reports one span on a page that has three.
  const blocks=[...main.children].filter(vis)
    .flatMap(c=>c.tagName==='DIV'&&c.children.length&&![...c.children].some(k=>k.tagName==='SECTION')
      ? [c] : [c, ...[...c.children].filter(k=>vis(k)&&/^(HEADER|SECTION|DIV)$/.test(k.tagName))])

  // §2 identical section padding
  const pads={}
  for(const s of sections){
    const c=getComputedStyle(s)
    const k=`${Math.round(parseFloat(c.paddingTop)||0)}/${Math.round(parseFloat(c.paddingBottom)||0)}`
    pads[k]=(pads[k]||0)+1
  }
  const padTotal=sections.length
  for(const [k,n] of Object.entries(pads))
    if(padTotal>=4 && n/padTotal>0.7) out.padding.push({value:k,count:n,of:padTotal})

  // §14 / §41 cards. A card is a rounded, filled or bordered box holding text.
  const isCard=el=>{
    const c=getComputedStyle(el)
    const r=parseFloat(c.borderTopLeftRadius)||0
    const bg=c.backgroundColor
    const filled=bg&&bg!=='rgba(0, 0, 0, 0)'
    const bordered=(parseFloat(c.borderTopWidth)||0)>0
    return r>=8 && (filled||bordered) && txt(el).length>20
  }
  const cardEls=[...main.querySelectorAll('div,article,li,section')].filter(el=>vis(el)&&isCard(el))
  out.cards={count:cardEls.length, sections:sections.length,
             examples:cardEls.slice(0,3).map(e=>nm(e)+' «'+txt(e).slice(0,26)+'»')}

  // §24 horizontal rhythm — do all sections occupy exactly the same span?
  const widths={}
  for(const s of blocks){
    const r=s.getBoundingClientRect()
    if(r.width<120)continue
    const k=`${Math.round(r.left)}–${Math.round(r.right)}`
    widths[k]=(widths[k]||0)+1
  }
  out.rhythm={distinct:Object.keys(widths).length, of:blocks.length,
              commonest:Object.entries(widths).sort((a,b)=>b[1]-a[1])[0]}

  // §40 repetition — consecutive sections with the same inner composition
  const sig=s=>{
    const g=[...s.querySelectorAll(':scope > div,:scope > ul,:scope > ol')]
      .map(d=>{const c=getComputedStyle(d); return c.display==='grid'?c.gridTemplateColumns:c.display})
    return g.slice(0,2).join('|')
  }
  let run=1
  for(let i=1;i<sections.length;i++){
    if(sig(sections[i])&&sig(sections[i])===sig(sections[i-1])) run++
    else { if(run>=3) out.repetition.push({count:run,shape:sig(sections[i-1]).slice(0,50)}); run=1 }
  }
  if(run>=3) out.repetition.push({count:run,shape:sig(sections.at(-1)).slice(0,50)})

  // §2 heading scale — how many distinct sizes are actually in use
  const hs=[...main.querySelectorAll('h1,h2,h3,h4')].filter(vis)
  const sizes={}
  for(const h of hs){const px=Math.round(parseFloat(getComputedStyle(h).fontSize)); sizes[px]=(sizes[px]||0)+1}
  out.headings={distinct:Object.keys(sizes).length,total:hs.length,sizes}

  // §2 centred
  for(const h of hs) if(getComputedStyle(h).textAlign==='center')
    out.centred.push(nm(h)+' «'+txt(h).slice(0,26)+'»')

  // §41 / §30 image ratios
  const ratios={}
  for(const im of main.querySelectorAll('img')){
    if(!vis(im))continue
    const r=im.getBoundingClientRect(); if(r.width<160)continue
    const k=(Math.round((r.width/r.height)*100)/100).toFixed(2)
    ratios[k]=(ratios[k]||0)+1
  }
  out.ratios={distinct:Object.keys(ratios).length,ratios}

  // §22 reading measure
  for(const p of main.querySelectorAll('p')){
    if(!vis(p))continue
    const t=txt(p); if(t.length<160)continue
    const cs=getComputedStyle(p)
    const px=parseFloat(cs.fontSize)
    const chars=p.getBoundingClientRect().width/(px*0.5)   // ≈ average glyph width
    if(chars>85||chars<40) out.measure.push({el:nm(p),chars:Math.round(chars),text:t.slice(0,32)})
  }

  // §10 internal < component < section
  const gaps=sections.map(s=>{
    const c=getComputedStyle(s)
    return Math.round((parseFloat(c.marginBottom)||0)+(parseFloat(c.paddingBottom)||0))
  }).filter(Boolean)
  const inner=[...main.querySelectorAll('p + p')].map(p=>Math.round(parseFloat(getComputedStyle(p).marginTop)||0)).filter(Boolean)
  if(gaps.length&&inner.length){
    const medSection=gaps.sort((a,b)=>a-b)[Math.floor(gaps.length/2)]
    const medInner=inner.sort((a,b)=>a-b)[Math.floor(inner.length/2)]
    if(medInner>=medSection) out.spacing.push({inner:medInner,section:medSection})
  }

  // §45 fixed heights on boxes that hold text
  for(const el of main.querySelectorAll('div,section,article')){
    if(!vis(el))continue
    const c=getComputedStyle(el)
    if(!/^\d+(\.\d+)?px$/.test(c.height))continue
    if(el.style && /height/.test(el.style.cssText||'') && txt(el).length>40){
      const h=Math.round(parseFloat(c.height))
      if(el.scrollHeight>h+2) out.fixedHeight.push({el:nm(el),h,needs:el.scrollHeight})
    }
  }
  return out
}

const b=await chromium.launch()
const report={}
for(const w of [390,1440]){
  const ctx=await b.newContext({viewport:{width:w,height:w<768?844:900},isMobile:w<768,hasTouch:w<768})
  await ctx.addCookies([{name:`sb-${REF}-auth-token`,
    value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64'),
    domain:new URL(SITE).hostname,path:'/',secure:SITE.startsWith('https'),sameSite:'Lax'}])
  const p=await ctx.newPage()
  for(const route of ROUTES){
    try{ await p.goto(SITE+route,{waitUntil:'networkidle',timeout:45000}) }catch{ continue }
    if(new URL(p.url()).pathname.startsWith('/login')){console.error('NOT SIGNED IN');process.exit(1)}
    await p.waitForTimeout(700)
    await p.evaluate(()=>{document.querySelectorAll('[aria-expanded="false"]').forEach(b=>b.click())})
    await p.waitForTimeout(900)
    report[`${w} ${route}`]=await p.evaluate(SCAN)
  }
  await ctx.close()
}
await b.close()
writeFileSync('/tmp/cq-editorial.json',JSON.stringify(report,null,1))

for(const [k,v] of Object.entries(report)){
  const f=[]
  if(v.padding?.length) f.push(`§2 identical padding ${v.padding[0].count}/${v.padding[0].of} sections at ${v.padding[0].value}`)
  if(v.rhythm && v.rhythm.of>=4 && v.rhythm.distinct<=1) f.push(`§24 all ${v.rhythm.of} blocks share one span`)
  if(v.repetition?.length) f.push(`§40 ${v.repetition.map(r=>r.count+' alike').join(', ')}`)
  if(v.headings && v.headings.total>=4 && v.headings.distinct<=2) f.push(`§2 only ${v.headings.distinct} heading sizes across ${v.headings.total}`)
  if(v.centred?.length) f.push(`§2 ${v.centred.length} centred headings`)
  if(v.ratios && Object.values(v.ratios.ratios).reduce((a,b)=>a+b,0)>=4 && v.ratios.distinct<=1)
    f.push(`§41 every image the same ratio (${Object.keys(v.ratios.ratios)[0]})`)
  if(v.measure?.length) f.push(`§22 ${v.measure.length} paragraphs outside 40–85ch (worst ${Math.max(...v.measure.map(m=>m.chars))}ch)`)
  if(v.spacing?.length) f.push(`§10 inner gap ${v.spacing[0].inner} ≥ section gap ${v.spacing[0].section}`)
  if(v.fixedHeight?.length) f.push(`§45 ${v.fixedHeight.length} fixed-height boxes overflowing`)
  if(v.cards && v.cards.sections>=3 && v.cards.count>=v.cards.sections) f.push(`§14 ${v.cards.count} cards vs ${v.cards.sections} sections`)
  if(f.length) console.log(k+'\n   '+f.join('\n   '))
}
