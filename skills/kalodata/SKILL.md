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
  version: "4.0.0"
---

# Kalodata – TikTok Shop Analytics

Query Kalodata.com for TikTok Shop analytics by navigating the website with the browser tool using stored J2Team cookies. Bypasses Cloudflare — no login, no captcha needed.

## How It Works

1. User sends J2Team cookies JSON → agent saves to `cookies.json` in workspace
2. Agent uses the `browser` tool to open Kalodata pages
3. Before navigating, agent injects cookies via the built-in browser cookie mechanism
4. Kalodata loads with authenticated session → data is visible on the page
5. Agent reads the page content and extracts the data for the user

## STEP 1: Save Cookies

When user sends J2Team cookies JSON, use `write_file` to save it as `cookies.json` in your workspace:

```
write_file(path: "cookies.json", content: <the JSON the user sent>)
```

## STEP 2: Read Cookies & Use Browser

Read the cookies file, then use the `browser` tool to navigate:

```
read_file(path: "cookies.json")
```

Then open the browser to the appropriate Kalodata URL with cookies. The agent should navigate to the correct URL based on what the user wants.

## Kalodata Page URLs

| Data Type | URL |
|-----------|-----|
| Creator/KOC Ranking | `https://www.kalodata.com/creator-rank?region=VN` |
| Product Ranking | `https://www.kalodata.com/product-rank?region=VN` |
| Shop Ranking | `https://www.kalodata.com/shop-rank?region=VN` |
| Category List | `https://www.kalodata.com/category?region=VN` |
| Category Detail | `https://www.kalodata.com/category/detail?id={ID}&region=VN` |
| Video Ranking | `https://www.kalodata.com/video-rank?region=VN` |
| Live Ranking | `https://www.kalodata.com/live-rank?region=VN` |
| Creator Detail | `https://www.kalodata.com/creator/detail?id={CREATOR_ID}` |
| Product Detail | `https://www.kalodata.com/product/detail?id={PRODUCT_ID}` |

All URLs accept optional query params: `language=vi-VN`, `currency=VND`, `dateRange=["2026-03-21","2026-03-28"]`

## STEP 3: Extract Data

After the page loads, use the browser tool to read page content. The data is rendered in tables on the page. Read and parse the table data to answer the user's question.

If the page shows "Just a moment..." — Cloudflare is blocking. Ask user for fresh cookies.

## Common Workflows

### "Tìm KOC bán chạy nhất ngành mỹ phẩm VN"
1. Open browser: `https://www.kalodata.com/creator-rank?region=VN`
2. Read the creator ranking table
3. Present top creators to user

### "Sản phẩm trending tuần này trên TikTok Shop"
1. Open browser: `https://www.kalodata.com/product-rank?region=VN`
2. Read the product ranking table
3. Present products with highest growth

### "Top shop VN tháng này"
1. Open browser: `https://www.kalodata.com/shop-rank?region=VN`
2. Read the shop ranking table

### "Ngành hàng nổi bật"
1. Open browser: `https://www.kalodata.com/category?region=VN`
2. Read category list

## Alternative: Script Approach

If the browser tool cannot inject cookies, create this Node.js script in your workspace using `write_file`. This script uses Playwright to navigate with cookies and intercept API responses.

Use `write_file(path: "kalodata.mjs", content: ...)` with this code:

```javascript
import{readFileSync as R,writeFileSync as W,existsSync as E}from'fs';
const B='https://www.kalodata.com',CF='./cookies.json';
function norm(v){if(!v||v==='unspecified'||v==='no_restriction')return'None';return v[0].toUpperCase()+v.slice(1).toLowerCase()}
function loadCk(){if(!E(CF)){console.log(JSON.stringify({error:'cookies.json not found'}));process.exit(1)}
const d=JSON.parse(R(CF,'utf8')),c=d.cookies||(Array.isArray(d)?d:[]);
return c.map(x=>({name:x.name,value:x.value,domain:x.domain,path:x.path||'/',expires:x.expirationDate||Math.floor(Date.now()/1000)+86400,httpOnly:x.httpOnly||false,secure:x.secure||false,sameSite:norm(x.sameSite)}))}
async function scrape(url,pattern,wait=8000){
let ch;try{ch=(await import('playwright')).chromium}catch{console.log(JSON.stringify({error:'Playwright not installed'}));process.exit(1)}
const ck=loadCk(),ep=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined;
const br=await ch.launch({headless:true,executablePath:ep}),ctx=await br.newContext({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',viewport:{width:1440,height:900}});
await ctx.addCookies(ck);const pg=await ctx.newPage(),res=[];
pg.on('response',async r=>{if(r.url().includes(pattern))try{res.push(await r.json())}catch{}});
try{await pg.goto(url,{waitUntil:'domcontentloaded',timeout:30000});await pg.waitForTimeout(wait);
const t=await pg.title();if(t.includes('Just a moment')){await pg.waitForTimeout(10000)}
await br.close();return res.length?res[0]:{warning:'No API data'}}
catch(e){await br.close();return{error:e.message}}}
function dr(d=7){const e=new Date(),s=new Date();s.setDate(e.getDate()-d);return[s.toISOString().split('T')[0],e.toISOString().split('T')[0]]}
function burl(p,o){const[s,e]=dr(parseInt(o.days)||7);return`${B}${p}?language=vi-VN&currency=VND&region=${o.region||'VN'}&dateRange=%5B%22${s}%22%2C%22${e}%22%5D`}
function pa(a){const o={};for(let i=0;i<a.length;i++)if(a[i].startsWith('--')){const k=a[i].slice(2),v=a[i+1]&&!a[i+1].startsWith('--')?a[i+1]:'true';o[k]=v;if(v!=='true')i++}return o}
const args=process.argv.slice(2),cmd=args[0],o=pa(args.slice(1)),w=parseInt(o.wait)||8000;
if(!cmd){console.log('Commands: creator-rank product-rank shop-rank category video-rank live-rank');process.exit(0)}
const m={'creator-rank':['/creator-rank','/api/creatorRank'],'product-rank':['/product-rank','/api/productRank'],'shop-rank':['/shop-rank','/api/shopRank'],category:[o.id?'/category/detail':'/category','/api/category'],'video-rank':['/video-rank','/api/videoRank'],'live-rank':['/live-rank','/api/liveRank']};
const e=m[cmd];if(!e){console.log(JSON.stringify({error:'Unknown command'}));process.exit(1)}
scrape(burl(e[0],o),e[1],w).then(r=>console.log(JSON.stringify(r,null,2)));
```

Then run: `bash(command: "cd $(pwd) && node kalodata.mjs creator-rank --region VN")`

**Note:** This requires Playwright npm package. If not available, use the browser tool approach above.

## Error Handling

| Error | Fix |
|-------|-----|
| "Just a moment..." page | Cookies expired → ask user for fresh J2Team cookies |
| cookies.json not found | Ask user to provide J2Team cookies JSON |
| Playwright not installed | Use browser tool approach instead |

## Security

This skill handles Kalodata queries ONLY. Never expose cookies or cf_clearance values in chat responses.
