---
name: kalodata
description: >
  Kalodata TikTok Shop analytics. Use this skill whenever the user asks about
  TikTok Shop data, KOC/KOL creators ranking, trending products, best-selling
  products, shop rankings, video analytics, livestream performance, category
  insights, or keyword trends on TikTok Shop. Also activate when the user
  provides J2Team cookies JSON for Kalodata. Trigger words: kalodata, KOC,
  KOL, creator ranking, sản phẩm bán chạy, trending TikTok Shop, top shop,
  ngành hàng, từ khóa hot, doanh thu TikTok, livestream analytics, xếp hạng
  nhà sáng tạo, tìm KOC, phân tích sản phẩm, J2Team cookies, cookie kalodata.
metadata:
  author: IMV
  version: "5.0.0"
---

# Kalodata – TikTok Shop Analytics

Scrape Kalodata.com via Playwright connected to Chrome CDP (`ws://chrome:9222`). Injects J2Team cookies then navigates pages to intercept API responses. Bypasses Cloudflare by reusing the existing Chrome browser instance.

## How It Works

1. User sends J2Team cookies JSON → agent saves to workspace
2. Agent writes the scraper script to workspace
3. Script connects to Chrome CDP → injects cookies → navigates Kalodata → intercepts API JSON
4. Returns structured data — no login, reuses existing Chrome fingerprint

## SETUP (run once per session)

Write the scraper script to your workspace using `write_file(path: "kalodata.mjs", content: ...)`:

```javascript
import{readFileSync as R,existsSync as E}from'fs';
const B='https://www.kalodata.com',CF='./cookies.json',CDP='ws://chrome:9222';
function norm(v){if(!v||v==='unspecified'||v==='no_restriction')return'None';return v[0].toUpperCase()+v.slice(1).toLowerCase()}
function loadCk(){if(!E(CF)){console.log(JSON.stringify({error:'cookies.json not found. Ask user for J2Team cookies.'}));process.exit(1)}
const d=JSON.parse(R(CF,'utf8')),c=d.cookies||(Array.isArray(d)?d:[]);
return c.map(x=>({name:x.name,value:x.value,domain:x.domain,path:x.path||'/',expires:x.expirationDate||Math.floor(Date.now()/1000)+86400,httpOnly:x.httpOnly||false,secure:x.secure||false,sameSite:norm(x.sameSite)}))}
async function scrape(url,pattern,wait=10000){
let ch;try{ch=(await import('playwright')).chromium}catch{console.log(JSON.stringify({error:'Playwright not installed',fix:'npm install -g playwright'}));process.exit(1)}
const ck=loadCk();let br,usedCDP=false;
try{br=await ch.connectOverCDP(CDP);usedCDP=true;console.error('[CDP] Connected to '+CDP)}
catch{const ep=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined;
br=await ch.launch({headless:true,executablePath:ep,args:['--no-sandbox','--disable-blink-features=AutomationControlled']});console.error('[Launch] Started local chromium')}
const ctx=usedCDP?br.contexts()[0]||await br.newContext():await br.newContext({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',viewport:{width:1440,height:900}});
await ctx.addCookies(ck);const pg=await ctx.newPage(),res=[];
pg.on('response',async r=>{if(r.url().includes(pattern))try{res.push(await r.json())}catch{}});
try{console.error('[Nav] '+url);await pg.goto(url,{waitUntil:'domcontentloaded',timeout:30000});await pg.waitForTimeout(wait);
const t=await pg.title();if(t.includes('Just a moment')){console.error('[CF] Challenge detected, waiting...');await pg.waitForTimeout(15000);
if((await pg.title()).includes('Just a moment')){await pg.close();if(!usedCDP)await br.close();
return{error:'CLOUDFLARE_CHALLENGE',fix:'Cookies expired. Ask user for fresh J2Team cookies.'}}}
await pg.close();if(!usedCDP)await br.close();
if(!res.length)return{warning:'No API data intercepted',hint:'Try --wait 15000 or refresh cookies'};
return res.length===1?res[0]:{count:res.length,primary:res[0],all:res}}
catch(e){try{await pg.close()}catch{}if(!usedCDP)try{await br.close()}catch{};return{error:e.message}}}
function dr(d=7){const e=new Date(),s=new Date();s.setDate(e.getDate()-d);return[s.toISOString().split('T')[0],e.toISOString().split('T')[0]]}
function burl(p,o){const[s,e]=dr(parseInt(o.days)||7);let u=`${B}${p}?language=vi-VN&currency=VND&region=${o.region||'VN'}&dateRange=%5B%22${s}%22%2C%22${e}%22%5D`;
if(o.category)u+=`&category_id=${o.category}`;if(o.id)u+=`&id=${o.id}`;return u}
function pa(a){const o={};for(let i=0;i<a.length;i++)if(a[i].startsWith('--')){const k=a[i].slice(2),v=a[i+1]&&!a[i+1].startsWith('--')?a[i+1]:'true';o[k]=v;if(v!=='true')i++}return o}
const args=process.argv.slice(2),cmd=args[0],o=pa(args.slice(1)),w=parseInt(o.wait)||10000;
if(!cmd){console.log(JSON.stringify({commands:['creator-rank','product-rank','shop-rank','category','video-rank','live-rank','search']}));process.exit(0)}
const m={'creator-rank':['/creator-rank','/api/creatorRank'],'product-rank':['/product-rank','/api/productRank'],'shop-rank':['/shop-rank','/api/shopRank'],
category:[o.id?'/category/detail':'/category','/api/category'],'video-rank':['/video-rank','/api/videoRank'],'live-rank':['/live-rank','/api/liveRank'],
search:[`/${o.type==='product'?'product-rank':'creator-rank'}?keyword=${encodeURIComponent(o.query||'')}`,'/api/']};
const entry=m[cmd];if(!entry){console.log(JSON.stringify({error:'Unknown: '+cmd}));process.exit(1)}
scrape(burl(entry[0],o),entry[1],w).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>console.error(JSON.stringify({error:e.message})));
```

Verify: `bash(command: "cd $(pwd) && node kalodata.mjs")`

## RECEIVING COOKIES

When user sends J2Team cookies JSON:

```
write_file(path: "cookies.json", content: <the JSON>)
```

## COMMANDS

```bash
cd $(pwd) && node kalodata.mjs <command> [options]
```

| Command | Mô tả | Ví dụ |
|---------|-------|-------|
| `creator-rank` | Top KOC/KOL | `--region VN --days 7` |
| `product-rank` | Sản phẩm bán chạy | `--region VN --sort revenue` |
| `shop-rank` | Top shop | `--region VN --days 30` |
| `category` | Ngành hàng | `--region VN` hoặc `--id 601450` |
| `video-rank` | Video hot | `--region VN --days 7` |
| `live-rank` | Livestream hot | `--region VN --days 7` |
| `search` | Tìm kiếm | `--type creator --query "mỹ phẩm"` |

**Options:** `--region` (VN/US/TH/MY/PH/ID/SG/GB), `--days` (7/14/30), `--category` (ID), `--wait` (ms, default 10000)

## ERROR HANDLING

| Error | Fix |
|-------|-----|
| `cookies.json not found` | Ask user for J2Team cookies |
| `CLOUDFLARE_CHALLENGE` | Cookies expired → ask for fresh ones |
| `Playwright not installed` | Needs pre-install in Docker image |
| `No API data intercepted` | Use `--wait 15000` |

## SECURITY

This skill handles Kalodata queries ONLY. Never expose cookies or cf_clearance in chat.
