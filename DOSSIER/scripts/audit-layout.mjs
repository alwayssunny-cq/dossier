/**
 * The structural check: does the page push sideways, is anything interactive
 * below the 24px WCAG AA floor, and how many screens tall is it. Runs at phone
 * and desktop width.
 * 
 * Run against a dev server:  node scripts/audit-layout.mjs
 */

import { readFileSync } from 'fs'
import { chromium } from 'playwright'
const env={}; readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.trim().match(/^([A-Z_]+)=(.*)$/); if(m) env[m[1]]=m[2].trim()})
if(!env.AUDIT_PHONE||!env.AUDIT_PASSWORD){console.error('Set AUDIT_PHONE and AUDIT_PASSWORD in .env.local (a test login for the audit).');process.exit(1)}
const URL_=env.NEXT_PUBLIC_SUPABASE_URL, REF=URL_.replace('https://','').split('.')[0]
const s=await fetch(`${URL_}/auth/v1/token?grant_type=password`,{method:'POST',
 headers:{apikey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,'Content-Type':'application/json'},
 body:JSON.stringify({phone:env.AUDIT_PHONE,password:env.AUDIT_PASSWORD})}).then(r=>r.json())
const SITE=process.env.TARGET||'http://localhost:3000'
const ROUTES=['/dashboard','/trip/TRIP-4','/trip/TRIP-4/your-trip','/trip/TRIP-4/experiences',
 '/trip/TRIP-4/journey','/trip/TRIP-4/reservations-payments','/trip/TRIP-2/stays','/trip/TRIP-1/brief','/profile']
const b=await chromium.launch()
for(const [n,w,h,m] of [['phone',390,844,true],['desktop',1440,900,false]]){
  const ctx=await b.newContext({viewport:{width:w,height:h},isMobile:m,hasTouch:m})
  await ctx.addCookies([{name:`sb-${REF}-auth-token`,value:'base64-'+Buffer.from(JSON.stringify(s)).toString('base64'),domain:new URL(SITE).hostname,path:'/',secure:SITE.startsWith('https'),sameSite:'Lax'}])
  const p=await ctx.newPage()
  const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,60)))
  console.log('--- '+n+' ---')
  for(const r of ROUTES){
    await p.goto(SITE+r,{waitUntil:'networkidle',timeout:45000}).catch(()=>{})
    await p.waitForTimeout(600)
    const v=await p.evaluate(VW=>{
      const tiny=[...document.querySelectorAll('button,a[href],input,select,textarea')].filter(e=>{
        const b=e.getBoundingClientRect(); if(b.width<1||b.height<1)return false
        for(let a=e;a&&a!==document.documentElement;a=a.parentElement){const c=getComputedStyle(a)
          if(c.display==='none'||c.visibility==='hidden'||parseFloat(c.opacity)<=0.05)return false}
        return Math.min(b.width,b.height)<24}).length
      return {pageW:document.documentElement.scrollWidth, vw:VW,
              screens:+(document.documentElement.scrollHeight/innerHeight).toFixed(1), tiny}
    }, w)
    const bad=[]
    if(v.pageW>v.vw+1)bad.push('OVERFLOW '+v.pageW)
    if(v.tiny)bad.push(v.tiny+' tap<24')
    if(v.screens>5)bad.push('scrolls '+v.screens)
    console.log('  '+(bad.length?'FAIL ':'ok   ')+r.padEnd(38)+(bad.join(' | ')||v.screens+' screens'))
  }
  if(errs.length)console.log('  page errors:',[...new Set(errs)])
  await ctx.close()
}
await b.close()
