#!/usr/bin/env node

/**
 * Kalodata Browser Scraper
 * 
 * Uses Playwright to navigate Kalodata.com with J2Team cookies injected,
 * intercepting API responses to extract structured data.
 * This bypasses Cloudflare because the cookies include cf_clearance.
 * 
 * Usage:
 *   node kalodata_browser.js <command> [options]
 * 
 * Commands:
 *   save-cookies <file|->    Save J2Team cookies JSON (from file or stdin)
 *   creator-rank             Scrape creator ranking page
 *   product-rank             Scrape product ranking page
 *   shop-rank                Scrape shop ranking page
 *   category                 Scrape categories
 *   video-rank               Scrape video ranking page
 *   live-rank                Scrape livestream ranking page
 *   search                   Search creators/products
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COOKIES_FILE = join(__dirname, 'cookies.json');
const BASE_URL = 'https://www.kalodata.com';

// ─── Cookie Helpers ─────────────────────────────────────────────

function normalizeSameSite(val) {
  if (!val || val === 'unspecified' || val === 'no_restriction') return 'None';
  if (val === 'lax') return 'Lax';
  if (val === 'strict') return 'Strict';
  return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
}

/**
 * Convert J2Team cookie JSON to Playwright format.
 * J2Team format: { url, cookies: [{ domain, name, value, path, expirationDate, ... }] }
 * Also supports raw cookie array.
 */
function j2teamToPlaywright(j2data) {
  const cookies = j2data.cookies || (Array.isArray(j2data) ? j2data : []);
  return cookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || '/',
    expires: c.expirationDate || Math.floor(Date.now() / 1000) + 86400,
    httpOnly: c.httpOnly || false,
    secure: c.secure || false,
    sameSite: normalizeSameSite(c.sameSite),
  }));
}

function loadCookies() {
  if (!existsSync(COOKIES_FILE)) {
    console.error(JSON.stringify({
      error: 'cookies.json not found',
      hint: 'Use "save-cookies" command first, or ask the user to provide J2Team cookies JSON.',
    }));
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(COOKIES_FILE, 'utf8'));
  return j2teamToPlaywright(raw);
}

// ─── Save Cookies Command ───────────────────────────────────────

function saveCookies(input) {
  let jsonStr;

  if (input === '-' || !input) {
    // Read from stdin
    jsonStr = readFileSync('/dev/stdin', 'utf8');
  } else if (existsSync(input)) {
    jsonStr = readFileSync(input, 'utf8');
  } else {
    // Treat input as raw JSON string
    jsonStr = input;
  }

  try {
    const data = JSON.parse(jsonStr);
    // Validate it has cookies
    const cookies = data.cookies || (Array.isArray(data) ? data : null);
    if (!cookies || cookies.length === 0) {
      console.log(JSON.stringify({ error: 'No cookies found in JSON', hint: 'Expected J2Team format: { cookies: [...] }' }));
      process.exit(1);
    }

    // Save in J2Team format
    const toSave = Array.isArray(data) ? { url: BASE_URL, cookies: data } : data;
    toSave.updatedAt = new Date().toISOString();
    writeFileSync(COOKIES_FILE, JSON.stringify(toSave, null, 2));

    const sessionCookie = cookies.find(c => c.name === 'SESSION');
    const cfCookie = cookies.find(c => c.name === 'cf_clearance' || c.name === '_cfuvid');

    console.log(JSON.stringify({
      success: true,
      message: 'Cookies saved successfully',
      cookieCount: cookies.length,
      hasSession: !!sessionCookie,
      hasCloudflare: !!cfCookie,
      savedTo: COOKIES_FILE,
    }));
  } catch (e) {
    console.log(JSON.stringify({ error: `Invalid JSON: ${e.message}` }));
    process.exit(1);
  }
}

// ─── Browser Scraper ────────────────────────────────────────────

/**
 * Navigate to a Kalodata page with cookies and intercept API responses.
 * Returns the intercepted API data.
 */
async function scrapeWithBrowser(pageUrl, apiPattern, opts = {}) {
  let chromium;
  try {
    const pwExtra = await import('playwright-extra');
    chromium = pwExtra.chromium;
    const stealth = (await import('puppeteer-extra-plugin-stealth')).default();
    chromium.use(stealth);
    console.error('[Browser] Loaded Stealth mode plugins successfully.');
  } catch {
    console.warn('[Browser] Stealth plugin not found, falling back to standard Playwright...');
    try {
      const pw = await import('playwright');
      chromium = pw.chromium;
    } catch {
      console.log(JSON.stringify({
        error: 'Playwright not installed',
        fix: 'Run: npm install -g playwright playwright-extra puppeteer-extra-plugin-stealth',
      }));
      process.exit(1);
    }
  }

  const cookies = loadCookies();
  const waitTime = parseInt(opts.wait) || 8000;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies(cookies);
  const page = await context.newPage();

  // Collect intercepted API responses
  const apiResponses = [];

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes(apiPattern)) {
      try {
        const body = await response.json();
        apiResponses.push({
          url: url,
          status: response.status(),
          data: body,
        });
      } catch {
        // Skip non-JSON responses
      }
    }
  });

  try {
    console.error(`[Browser] Navigating to ${pageUrl}...`);
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for API calls to complete
    console.error(`[Browser] Waiting ${waitTime}ms for API responses...`);
    await page.waitForTimeout(waitTime);

    // Check for Cloudflare
    const title = await page.title();
    if (title.includes('Just a moment')) {
      console.error('[Browser] Cloudflare challenge detected, waiting longer...');
      await page.waitForTimeout(10000);
      // Check again
      const title2 = await page.title();
      if (title2.includes('Just a moment')) {
        await browser.close();
        return {
          error: 'CLOUDFLARE_CHALLENGE',
          message: 'Cookies may be expired. Ask user to re-export J2Team cookies from browser after logging in.',
        };
      }
    }

    await browser.close();

    if (apiResponses.length === 0) {
      return {
        warning: 'No API responses intercepted',
        pageTitle: title,
        hint: 'The page may have loaded from cache or cookies may be invalid. Try refreshing cookies.',
      };
    }

    // Return the primary API response (usually the first matching one)
    if (apiResponses.length === 1) {
      return apiResponses[0].data;
    }

    return {
      intercepted: apiResponses.length,
      primary: apiResponses[0].data,
      all: apiResponses.map(r => ({ url: r.url, data: r.data })),
    };

  } catch (err) {
    await browser.close();
    return { error: err.message };
  }
}

// ─── Date Range Helper ──────────────────────────────────────────

function getDateRange(days = 7) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return [start.toISOString().split('T')[0], end.toISOString().split('T')[0]];
}

function buildDateParams(days) {
  const [s, e] = getDateRange(days);
  return `dateRange=%5B%22${s}%22%2C%22${e}%22%5D`;
}

// ─── Command Builders ───────────────────────────────────────────

function buildPageUrl(path, opts) {
  const region = opts.region || 'VN';
  const lang = opts.language || 'vi-VN';
  const currency = opts.currency || 'VND';
  const days = parseInt(opts.days) || 7;
  const dateParams = buildDateParams(days);

  let url = `${BASE_URL}${path}?language=${lang}&currency=${currency}&region=${region}&${dateParams}`;

  if (opts.category) url += `&category_id=${opts.category}`;
  if (opts.id) url += `&id=${opts.id}`;
  if (opts.sort) url += `&sort_by=${opts.sort}`;
  if (opts.page) url += `&page=${opts.page}`;

  return url;
}

// ─── CLI ────────────────────────────────────────────────────────

function parseArgs(args) {
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
      opts[key] = val;
      if (val !== 'true') i++;
    }
  }
  return opts;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const opts = parseArgs(args.slice(1));

  if (!command) {
    console.log(JSON.stringify({
      usage: 'node kalodata_browser.js <command> [options]',
      commands: {
        'save-cookies': 'Save J2Team cookies: node kalodata_browser.js save-cookies <file|->',
        'creator-rank': 'Top KOC/KOL creators',
        'product-rank': 'Best-selling products',
        'shop-rank': 'Top shops',
        'category': 'Category list or detail (use --id for detail)',
        'video-rank': 'Top videos',
        'live-rank': 'Top livestreams',
        'search': 'Search (use --type creator|product --query "...")',
      },
      options: '--region VN --days 7 --category ID --sort revenue --wait 8000',
    }, null, 2));
    process.exit(0);
  }

  // Special command: save-cookies
  if (command === 'save-cookies') {
    saveCookies(args[1]);
    return;
  }

  let result;
  switch (command) {
    case 'creator-rank':
      result = await scrapeWithBrowser(
        buildPageUrl('/creator-rank', opts),
        '/api/creatorRank', opts
      );
      break;

    case 'product-rank':
      result = await scrapeWithBrowser(
        buildPageUrl('/product-rank', opts),
        '/api/productRank', opts
      );
      break;

    case 'shop-rank':
      result = await scrapeWithBrowser(
        buildPageUrl('/shop-rank', opts),
        '/api/shopRank', opts
      );
      break;

    case 'category':
      if (opts.id) {
        result = await scrapeWithBrowser(
          buildPageUrl('/category/detail', opts),
          '/api/category', opts
        );
      } else {
        result = await scrapeWithBrowser(
          buildPageUrl('/category', opts),
          '/api/category', opts
        );
      }
      break;

    case 'video-rank':
      result = await scrapeWithBrowser(
        buildPageUrl('/video-rank', opts),
        '/api/videoRank', opts
      );
      break;

    case 'live-rank':
      result = await scrapeWithBrowser(
        buildPageUrl('/live-rank', opts),
        '/api/liveRank', opts
      );
      break;

    case 'search': {
      const type = opts.type || 'creator';
      const query = opts.query || '';
      const searchPath = type === 'product' ? '/product-rank' : '/creator-rank';
      result = await scrapeWithBrowser(
        `${BASE_URL}${searchPath}?keyword=${encodeURIComponent(query)}&region=${opts.region || 'VN'}&language=${opts.language || 'vi-VN'}&currency=${opts.currency || 'VND'}`,
        '/api/', opts
      );
      break;
    }

    default:
      result = { error: `Unknown command: ${command}` };
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
