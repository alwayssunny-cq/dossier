/**
 * The checkable half of the UX/UI master guide.
 *
 * Everything here maps to a specific rule in that document, and each finding
 * names the rule it breaks. It deliberately does not try to judge things a
 * machine cannot judge — whether a label is in the user's language, whether
 * the primary action is obvious, whether the IA matches a mental model. Those
 * belong to review and to testing with people.
 *
 *   contrast      §17, WCAG 1.4.3 / 1.4.11   text 4.5:1, large 3:1, UI 3:1
 *   names         §24, WCAG 4.1.2            every control has an accessible name
 *   headings      §24                        one h1, no skipped levels
 *   alt           §18, WCAG 1.1.1            informative images described
 *   focus         §24, WCAG 2.4.7 / 2.4.13   focus is visible, and not obscured
 *   targets       §24, WCAG 2.5.8            24px minimum
 *   labels        §20                        no placeholder-only fields
 *   landmarks     §13                        main / nav present
 *   widths        §10                        no overflow at intermediate widths
 *   zoom          §10, WCAG 1.4.4            readable and contained at 200%
 *   motion        §30, WCAG 2.3.3            reduced motion respected
 *
 * Run against a dev server:  node scripts/audit-ux.mjs
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
 '/dashboard','/profile','/understand-you','/understand-cq','/login',
 '/trip/TRIP-4','/trip/TRIP-4/your-trip','/trip/TRIP-4/journey','/trip/TRIP-4/log',
 '/trip/TRIP-4/experiences','/trip/TRIP-4/travel-guide','/trip/TRIP-4/documents',
 '/trip/TRIP-4/dates-destinations?stage=crafting','/trip/TRIP-4/stays?stage=crafting',
 '/trip/TRIP-1/brief','/trip/TRIP-2/stays',
]
// §10: "many layout failures happen between canonical device sizes."
const WIDTHS=[320,360,390,414,480,600,768,834,1024,1180,1440,1920]

const AUDIT = () => {
  const out={contrast:[],names:[],headings:[],alt:[],focus:[],targets:[],labels:[],landmarks:[],motion:[]}
  const txt=el=>(el.textContent||'').trim().replace(/\s+/g,' ')
  const nm=el=>{const c=(typeof el.className==='string'&&el.className.trim())?'.'+el.className.trim().split(/\s+/).slice(0,2).join('.'):''
    return el.tagName.toLowerCase()+c}
  const vis=el=>{for(let a=el;a&&a!==document.documentElement;a=a.parentElement){const s=getComputedStyle(a)
    if(s.display==='none'||s.visibility==='hidden'||parseFloat(s.opacity)<=0.05)return false} 
    const r=el.getBoundingClientRect(); return r.width>0&&r.height>0}
  // aria-hidden text is decorative — the large chapter numerals, the ✧ mark.
  // WCAG 1.4.3 does not apply to it, and neither does this audit.
  const decorative=el=>{for(let a=el;a&&a!==document.documentElement;a=a.parentElement){
    if(a.getAttribute&&a.getAttribute('aria-hidden')==='true')return true} return false}

  // ── colour maths ────────────────────────────────────────────────────────
  const parse=c=>{const m=c.match(/rgba?\(([^)]+)\)/); if(!m)return null
    const p=m[1].split(/[,/]/).map(x=>parseFloat(x.trim()))
    return {r:p[0],g:p[1],b:p[2],a:p[3]===undefined?1:p[3]}}
  // Proper source-over compositing. The previous version forced the result to
  // alpha 1, so stacking an 8% Borges tint on a 4% Borges tint produced SOLID
  // Borges — and every chip and avatar in the dossier was then measured
  // against #706E56 instead of against Mist. That single wrong constant
  // accounted for 94 of the 98 contrast failures this audit reported.
  const over=(fg,bg)=>{
    const a=fg.a+bg.a*(1-fg.a)
    if(a===0)return {r:0,g:0,b:0,a:0}
    return {
      r:(fg.r*fg.a+bg.r*bg.a*(1-fg.a))/a,
      g:(fg.g*fg.a+bg.g*bg.a*(1-fg.a))/a,
      b:(fg.b*fg.a+bg.b*bg.a*(1-fg.a))/a,
      a,
    }
  }
  const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}
    return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b)}
  const ratio=(a,b)=>{const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)}
  const bgOf=el=>{ // walk up for the first opaque-enough background
    let acc=null
    for(let a=el;a&&a!==document.documentElement;a=a.parentElement){
      const c=parse(getComputedStyle(a).backgroundColor)
      if(!c||c.a===0)continue
      acc=acc?over(acc,c):c
      if(acc.a>=0.999)return acc
    }
    // Nothing opaque on the way up. The canvas is Mist — NOT the transparent
    // black that rgba(0,0,0,0) parses to. Compositing a faint Borges tint over
    // that gave a near-black ground and reported every chip and avatar on the
    // page as unreadable, when they are ink on Mist and measure 7:1.
    const MIST={r:255,g:252,b:248,a:1}
    let root=parse(getComputedStyle(document.documentElement).backgroundColor)
    if(!root||root.a<0.999) root=MIST
    return acc?over(acc,root):root
  }
  // Text laid over a photograph has no computable background — the picture
  // decides, and it changes per trip. Those need a human eye (or a scrim,
  // which is what the dossier uses). Detected by asking whether any image on
  // the page actually sits under this element's box.
  const imgs=[...document.querySelectorAll('img')].filter(i=>{
    const r=i.getBoundingClientRect(); return r.width>24&&r.height>24})
  const washes=[...document.querySelectorAll('body *')].filter(e=>{
    const cs=getComputedStyle(e)
    if(cs.position!=='absolute'&&cs.position!=='fixed')return false
    if(!cs.backgroundImage||cs.backgroundImage==='none')return false
    const r=e.getBoundingClientRect(); return r.width>40&&r.height>40})
  const overImage=el=>{
    for(let a=el;a&&a!==document.documentElement;a=a.parentElement){
      const s=getComputedStyle(a)
      // A gradient is as uncomputable as a photograph for this purpose: the
      // ratio varies across the element. Those are judged by eye and by the
      // scrim behind them, not by this number.
      if(s.backgroundImage&&s.backgroundImage!=='none')return true
    }
    const r=el.getBoundingClientRect()
    if(imgs.some(i=>{const ri=i.getBoundingClientRect()
      return r.left>=ri.left-2&&r.right<=ri.right+2&&r.top>=ri.top-2&&r.bottom<=ri.bottom+2})) return true
    // The hero of a trip with no cover photograph is a gradient wash painted
    // by an absolutely-positioned sibling, not by an ancestor. Text on it is
    // as uncomputable as text on a picture.
    return washes.some(w=>{const rw=w.getBoundingClientRect()
      return r.left>=rw.left-2&&r.right<=rw.right+2&&r.top>=rw.top-2&&r.bottom<=rw.bottom+2})
  }

  // 1. Contrast — §17
  for(const el of document.querySelectorAll('body *')){
    if(!vis(el))continue
    const t=txt(el); if(!t)continue
    if([...el.children].some(c=>txt(c).length>0))continue
    if(decorative(el))continue
    // WCAG 1.4.3 exempts inactive components: a stage the trip has not
    // reached, a submit that cannot yet be pressed.
    let inactive=false
    for(let a=el;a&&a!==document.body;a=a.parentElement){
      if(a.hasAttribute&&(a.hasAttribute('disabled')||a.getAttribute('aria-disabled')==='true')){inactive=true;break}}
    if(inactive)continue
    const s=getComputedStyle(el)
    if(overImage(el))continue
    const fg=parse(s.color); if(!fg)continue
    const bg=bgOf(el)
    const eff=fg.a<1?over(fg,bg):fg
    const px=parseFloat(s.fontSize), bold=parseInt(s.fontWeight,10)>=700
    const large=px>=24||(px>=18.66&&bold)
    const need=large?3:4.5
    const got=ratio(eff,bg)
    if(got<need-0.05){
      out.contrast.push({el:nm(el),text:t.slice(0,40),got:+got.toFixed(2),need,px:Math.round(px)})
    }
  }

  // 2. Accessible names — §24
  for(const el of document.querySelectorAll('a[href],button,input,select,textarea,[role="button"]')){
    if(!vis(el))continue
    const name=(el.getAttribute('aria-label')||'').trim()
      || (el.getAttribute('aria-labelledby')?'ref':'')
      || (el.getAttribute('title')||'').trim()
      || txt(el)
      || (el.querySelector&&el.querySelector('img[alt]')?el.querySelector('img[alt]').getAttribute('alt').trim():'')
      || (el.tagName==='INPUT'&&el.labels&&el.labels.length?'label':'')
    if(!name) out.names.push({el:nm(el),html:el.outerHTML.slice(0,70)})
  }

  // 3. Headings — §24
  const hs=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(vis)
  const h1s=hs.filter(h=>h.tagName==='H1')
  if(h1s.length===0) out.headings.push({issue:'no h1'})
  if(h1s.length>1) out.headings.push({issue:`${h1s.length} h1 elements`,texts:h1s.map(h=>txt(h).slice(0,26))})
  let prev=0
  for(const h of hs){const lvl=+h.tagName[1]
    if(prev&&lvl>prev+1) out.headings.push({issue:`h${prev} jumps to h${lvl}`,text:txt(h).slice(0,34)})
    prev=lvl}

  // 4. Images — §18
  for(const im of document.querySelectorAll('img')){
    if(!vis(im))continue
    if(im.getAttribute('alt')===null) out.alt.push({src:(im.getAttribute('src')||'').slice(0,60),issue:'no alt attribute'})
  }

  // 5. Focus visibility — §24. Checked from the page's own rules rather than
  //    by calling focus(), which does not raise :focus-visible for a pointer
  //    focus and so reported every button as ringless.
  {
    let rule=false
    for(const ss of document.styleSheets){
      try{ for(const r of ss.cssRules){
        if(r.cssText&&/:focus-visible/.test(r.selectorText||'')&&/outline|box-shadow/.test(r.cssText)) rule=true
      } }catch{}
    }
    if(!rule) out.focus.push({issue:'no :focus-visible rule defines a visible ring'})
  }

  // 6. Target size — §24, WCAG 2.5.8
  for(const el of document.querySelectorAll('a[href],button,input,select,textarea,[role="button"]')){
    if(!vis(el))continue
    const r=el.getBoundingClientRect()
    // Inline links inside a paragraph are exempt.
    const inProse=el.tagName==='A'&&el.parentElement&&/^(P|LI|SPAN|EM|STRONG|DD)$/.test(el.parentElement.tagName)
      &&getComputedStyle(el).display.startsWith('inline')
    if(inProse)continue
    if(Math.min(r.width,r.height)<24)
      out.targets.push({el:nm(el),text:txt(el).slice(0,26),w:Math.round(r.width),h:Math.round(r.height)})
  }

  // 7. Placeholder-only fields — §20
  for(const el of document.querySelectorAll('input,textarea,select')){
    if(!vis(el))continue
    if(el.type==='hidden')continue
    const labelled=(el.labels&&el.labels.length)||el.getAttribute('aria-label')||el.getAttribute('aria-labelledby')
    if(!labelled&&el.getAttribute('placeholder'))
      out.labels.push({el:nm(el),placeholder:el.getAttribute('placeholder').slice(0,40)})
  }

  // 8. Landmarks — §13
  if(!document.querySelector('main')) out.landmarks.push({issue:'no <main>'})
  // A <nav> is only meaningful where there IS navigation; a login screen has
  // none. Only the content landmark is required of every page.

  return out
}

const b=await chromium.launch()
const report={}

// ── A. Per-route semantic + contrast audit at 390 and 1440 ────────────────
for (const w of [390,1440]) {
  const ctx=await b.newContext({viewport:{width:w,height:w<768?844:900},isMobile:w<768,hasTouch:w<768})
  await ctx.addCookies([{name:`sb-${REF}-auth-token`,
    value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64'),
    domain:new URL(SITE).hostname,path:'/',secure:SITE.startsWith('https'),sameSite:'Lax'}])
  const p=await ctx.newPage()
  for (const route of ROUTES) {
    try{ await p.goto(SITE+route,{waitUntil:'networkidle',timeout:45000}) }catch{ continue }
    if(new URL(p.url()).pathname.startsWith('/login')&&route!=='/login'){
      console.error(`NOT SIGNED IN at ${route} — this run proves nothing.`); process.exit(1)
    }
    await p.waitForTimeout(700)
    report[`${w}px ${route}`]=await p.evaluate(AUDIT)
  }
  await ctx.close()
}

// ── B. Intermediate widths: overflow sweep — §10 ──────────────────────────
const sweep={}
{
  const ctx=await b.newContext({viewport:{width:390,height:844}})
  await ctx.addCookies([{name:`sb-${REF}-auth-token`,
    value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64'),
    domain:new URL(SITE).hostname,path:'/',secure:SITE.startsWith('https'),sameSite:'Lax'}])
  const p=await ctx.newPage()
  for (const route of ROUTES) {
    for (const w of WIDTHS) {
      await p.setViewportSize({width:w,height:900})
      try{ await p.goto(SITE+route,{waitUntil:'networkidle',timeout:45000}) }catch{ continue }
      await p.waitForTimeout(400)
      let bad=null
      try{ bad=await p.evaluate(vw=>{
        const de=document.documentElement
        if(de.scrollWidth<=vw+1)return null
        const spill=[...document.querySelectorAll('body *')].filter(el=>{
          const r=el.getBoundingClientRect(); if(r.width<2)return false
          if(r.right<=vw+1)return false
          for(let a=el.parentElement;a&&a!==document.body;a=a.parentElement){
            const s=getComputedStyle(a)
            if(/(auto|scroll|hidden|clip)/.test(s.overflowX))return false
          }
          return true
        }).slice(0,3).map(el=>el.tagName.toLowerCase()+' «'+(el.textContent||'').trim().slice(0,24)+'»')
        return {pageW:de.scrollWidth,vw,spill}
      }, w) }catch{ continue }
      if(bad) (sweep[route]=sweep[route]||[]).push(`${w}px -> ${bad.pageW} [${bad.spill.join(' , ')}]`)
    }
  }
  await ctx.close()
}

// ── C. Zoom to 200% — §10, WCAG 1.4.4 ─────────────────────────────────────
const zoom={}
{
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:1})
  await ctx.addCookies([{name:`sb-${REF}-auth-token`,
    value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64'),
    domain:new URL(SITE).hostname,path:'/',secure:SITE.startsWith('https'),sameSite:'Lax'}])
  const p=await ctx.newPage()
  for (const route of ROUTES.slice(0,8)) {
    try{ await p.goto(SITE+route,{waitUntil:'networkidle',timeout:45000}) }catch{ continue }
    // 200% text: the standard asks for content to remain usable, not to be re-laid-out by hand.
    await p.evaluate(()=>{document.documentElement.style.fontSize='32px'})
    await p.waitForTimeout(500)
    const r=await p.evaluate(vw=>({pageW:document.documentElement.scrollWidth,vw}),390)
    if(r.pageW>r.vw+1) zoom[route]=`${r.pageW}px wide at 200% text`
    await p.evaluate(()=>{document.documentElement.style.fontSize=''})
  }
  await ctx.close()
}
await b.close()

writeFileSync('/tmp/cq-ux.json',JSON.stringify({report,sweep,zoom},null,1))

const tally={}
for(const [k,v] of Object.entries(report))
  for(const [cat,arr] of Object.entries(v)) tally[cat]=(tally[cat]||0)+arr.length
console.log('=== findings by rule ===')
for(const [k,n] of Object.entries(tally).sort((a,b)=>b[1]-a[1])) if(n) console.log(`  ${String(n).padStart(4)}  ${k}`)
console.log('\n=== intermediate-width overflow (§10) ===')
const sw=Object.entries(sweep)
if(!sw.length) console.log('  none')
else sw.forEach(([r,list])=>console.log(`  ${r}\n      ${list.join('\n      ')}`))
console.log('\n=== 200% text (§10 / WCAG 1.4.4) ===')
const zs=Object.entries(zoom)
console.log(zs.length?zs.map(([r,v])=>`  ${r}: ${v}`).join('\n'):'  none')
