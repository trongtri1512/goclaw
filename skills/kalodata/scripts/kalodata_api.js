#!/usr/bin/env node

/**
 * Kalodata API Client
 * 
 * Calls Kalodata.com internal API endpoints using stored session cookies.
 * Uses Node.js native fetch with cookie headers.
 * 
 * Usage: node kalodata_api.js <command> [options]
 * 
 * Commands: creator-rank, product-rank, shop-rank, category, video-rank, live-rank, search
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COOKIES_FILE = join(__dirname, 'cookies.json');
const BASE_URL = 'https://www.kalodata.com';

// ─── Cookie Management ─────────────────────────────────────────

function loadCookies() {
  if (!existsSync(COOKIES_FILE)) {
    console.error(JSON.stringify({ error: 'cookies.json not found. Please login first or provide cookies.' }));
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(COOKIES_FILE, 'utf8'));
  // Support both formats: {cookies: [...]} or {url, cookies: [...]}
  const cookies = raw.cookies || raw;
  return cookies;
}

function buildCookieHeader(cookies) {
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

function getSessionToken(cookies) {
  const session = cookies.find(c => c.name === 'SESSION');
  return session ? session.value : null;
}

// ─── API Caller ─────────────────────────────────────────────────

async function callKalodataAPI(endpoint, body = {}, method = 'POST') {
  const cookies = loadCookies();
  const cookieHeader = buildCookieHeader(cookies);
  const session = getSessionToken(cookies);

  const headers = {
    'Content-Type': 'application/json',
    'Cookie': cookieHeader,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
    'Origin': BASE_URL,
    'Referer': `${BASE_URL}/`,
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
  };

  if (session) {
    headers['Authorization'] = `Bearer ${session}`;
  }

  const url = `${BASE_URL}${endpoint}`;
  
  try {
    const opts = { method, headers };
    if (method === 'POST') {
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(url, opts);
    const text = await res.text();

    // Check for Cloudflare challenge
    if (text.includes('Just a moment') || text.includes('cf_chl_opt')) {
      return {
        error: 'CLOUDFLARE_CHALLENGE',
        message: 'Cookies expired or Cloudflare challenge detected. Please refresh cookies by logging in again.',
        status: res.status,
      };
    }

    try {
      return JSON.parse(text);
    } catch {
      return { error: 'INVALID_JSON', raw: text.substring(0, 500), status: res.status };
    }
  } catch (err) {
    return { error: 'NETWORK_ERROR', message: err.message };
  }
}

// ─── Date Range Helper ──────────────────────────────────────────

function getDateRange(days = 7) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return [
    start.toISOString().split('T')[0],
    end.toISOString().split('T')[0],
  ];
}

// ─── Commands ───────────────────────────────────────────────────

async function creatorRank(opts) {
  const [startDate, endDate] = getDateRange(opts.days || 7);
  const body = {
    region: opts.region || 'VN',
    date_range: [startDate, endDate],
    page: parseInt(opts.page) || 1,
    size: parseInt(opts.size) || 20,
    language: opts.language || 'vi-VN',
    currency: opts.currency || 'VND',
  };
  if (opts.sort) body.sort_by = opts.sort;
  if (opts.category) body.category_id = opts.category;

  return callKalodataAPI('/api/creatorRank', body);
}

async function productRank(opts) {
  const [startDate, endDate] = getDateRange(opts.days || 7);
  const body = {
    region: opts.region || 'VN',
    date_range: [startDate, endDate],
    page: parseInt(opts.page) || 1,
    size: parseInt(opts.size) || 20,
    language: opts.language || 'vi-VN',
    currency: opts.currency || 'VND',
  };
  if (opts.sort) body.sort_by = opts.sort;
  if (opts.category) body.category_id = opts.category;
  if (opts['price-min']) body.price_min = parseFloat(opts['price-min']);
  if (opts['price-max']) body.price_max = parseFloat(opts['price-max']);

  return callKalodataAPI('/api/productRank', body);
}

async function shopRank(opts) {
  const [startDate, endDate] = getDateRange(opts.days || 7);
  const body = {
    region: opts.region || 'VN',
    date_range: [startDate, endDate],
    page: parseInt(opts.page) || 1,
    size: parseInt(opts.size) || 20,
    language: opts.language || 'vi-VN',
    currency: opts.currency || 'VND',
  };
  if (opts.sort) body.sort_by = opts.sort;
  if (opts.category) body.category_id = opts.category;

  return callKalodataAPI('/api/shopRank', body);
}

async function categoryList(opts) {
  const body = {
    region: opts.region || 'VN',
    language: opts.language || 'vi-VN',
    currency: opts.currency || 'VND',
  };

  if (opts.id) {
    // Category detail
    const [startDate, endDate] = getDateRange(opts.days || 30);
    body.date_range = [startDate, endDate];
    return callKalodataAPI(`/api/category/detail`, { ...body, id: opts.id });
  }

  return callKalodataAPI('/api/category/list', body);
}

async function videoRank(opts) {
  const [startDate, endDate] = getDateRange(opts.days || 7);
  const body = {
    region: opts.region || 'VN',
    date_range: [startDate, endDate],
    page: parseInt(opts.page) || 1,
    size: parseInt(opts.size) || 20,
    language: opts.language || 'vi-VN',
    currency: opts.currency || 'VND',
  };
  if (opts.sort) body.sort_by = opts.sort;
  if (opts.category) body.category_id = opts.category;

  return callKalodataAPI('/api/videoRank', body);
}

async function liveRank(opts) {
  const [startDate, endDate] = getDateRange(opts.days || 7);
  const body = {
    region: opts.region || 'VN',
    date_range: [startDate, endDate],
    page: parseInt(opts.page) || 1,
    size: parseInt(opts.size) || 20,
    language: opts.language || 'vi-VN',
    currency: opts.currency || 'VND',
  };
  if (opts.sort) body.sort_by = opts.sort;

  return callKalodataAPI('/api/liveRank', body);
}

async function search(opts) {
  const body = {
    region: opts.region || 'VN',
    keyword: opts.query || '',
    type: opts.type || 'creator', // creator, product, shop
    page: parseInt(opts.page) || 1,
    size: parseInt(opts.size) || 20,
    language: opts.language || 'vi-VN',
    currency: opts.currency || 'VND',
  };

  const endpoint = opts.type === 'product' ? '/api/product/search' :
                   opts.type === 'shop' ? '/api/shop/search' :
                   '/api/creator/search';

  return callKalodataAPI(endpoint, body);
}

// ─── CLI Parsing ────────────────────────────────────────────────

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

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const opts = parseArgs(args.slice(1));

  if (!command) {
    console.log(JSON.stringify({
      error: 'No command specified',
      usage: 'node kalodata_api.js <command> [options]',
      commands: ['creator-rank', 'product-rank', 'shop-rank', 'category', 'video-rank', 'live-rank', 'search'],
    }, null, 2));
    process.exit(1);
  }

  let result;
  switch (command) {
    case 'creator-rank': result = await creatorRank(opts); break;
    case 'product-rank': result = await productRank(opts); break;
    case 'shop-rank':    result = await shopRank(opts); break;
    case 'category':     result = await categoryList(opts); break;
    case 'video-rank':   result = await videoRank(opts); break;
    case 'live-rank':    result = await liveRank(opts); break;
    case 'search':       result = await search(opts); break;
    default:
      result = { error: `Unknown command: ${command}`, commands: ['creator-rank', 'product-rank', 'shop-rank', 'category', 'video-rank', 'live-rank', 'search'] };
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
