#!/usr/bin/env node

/**
 * Kalodata Login & Cookie Refresh
 * 
 * Uses Playwright to login to Kalodata and save fresh cookies.
 * Requires: KALODATA_EMAIL and KALODATA_PASSWORD env vars
 * 
 * Usage: 
 *   KALODATA_EMAIL=xxx KALODATA_PASSWORD=xxx node kalodata_login.js
 *   
 * Or provide credentials via CLI:
 *   node kalodata_login.js --email xxx --password xxx
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COOKIES_FILE = join(__dirname, 'cookies.json');
const LOGIN_URL = 'https://www.kalodata.com/login';

// Parse CLI args
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
  const opts = parseArgs(process.argv.slice(2));
  const email = opts.email || process.env.KALODATA_EMAIL;
  const password = opts.password || process.env.KALODATA_PASSWORD;

  if (!email || !password) {
    console.error(JSON.stringify({
      error: 'Credentials required',
      usage: 'KALODATA_EMAIL=xxx KALODATA_PASSWORD=xxx node kalodata_login.js',
      alt: 'node kalodata_login.js --email xxx --password xxx',
    }));
    process.exit(1);
  }

  // Try to import playwright
  let chromium;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch {
    console.error(JSON.stringify({
      error: 'Playwright not available. Install with: npm install -g playwright',
      fallback: 'Alternatively, login manually in browser and export cookies to cookies.json',
    }));
    process.exit(1);
  }

  console.error('[Login] Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  // If existing cookies exist, inject them first (helps pass Cloudflare)
  if (existsSync(COOKIES_FILE)) {
    try {
      const raw = JSON.parse(readFileSync(COOKIES_FILE, 'utf8'));
      const existing = raw.cookies || raw;
      const playwrightCookies = existing.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || '/',
        expires: c.expirationDate || Math.floor(Date.now() / 1000) + 3600,
        httpOnly: c.httpOnly || false,
        secure: c.secure || false,
        sameSite: normalizeSameSite(c.sameSite),
      }));
      await context.addCookies(playwrightCookies);
      console.error('[Login] Injected existing cookies');
    } catch (e) {
      console.error(`[Login] Warning: Could not load existing cookies: ${e.message}`);
    }
  }

  const page = await context.newPage();

  try {
    console.error('[Login] Navigating to login page...');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Check if Cloudflare challenge
    const title = await page.title();
    if (title.includes('Just a moment')) {
      console.error('[Login] Cloudflare challenge detected, waiting...');
      await page.waitForTimeout(10000);
    }

    // Fill login form
    console.error('[Login] Filling login form...');
    
    // Try different selectors for email/password fields
    const emailSelectors = ['input[type="email"]', 'input[name="email"]', 'input[placeholder*="email"]', 'input[placeholder*="Email"]', '#email'];
    const passwordSelectors = ['input[type="password"]', 'input[name="password"]', '#password'];

    let emailFilled = false;
    for (const sel of emailSelectors) {
      try {
        await page.fill(sel, email, { timeout: 3000 });
        emailFilled = true;
        console.error(`[Login] Email filled via ${sel}`);
        break;
      } catch {}
    }

    let passwordFilled = false;
    for (const sel of passwordSelectors) {
      try {
        await page.fill(sel, password, { timeout: 3000 });
        passwordFilled = true;
        console.error(`[Login] Password filled via ${sel}`);
        break;
      } catch {}
    }

    if (!emailFilled || !passwordFilled) {
      const html = await page.content();
      console.error(JSON.stringify({
        error: 'Could not find login form fields',
        pageTitle: title,
        hint: 'Login page structure may have changed. Try exporting cookies manually.',
      }));
      await browser.close();
      process.exit(1);
    }

    // Click login button
    const loginSelectors = ['button[type="submit"]', 'button:has-text("Login")', 'button:has-text("Sign in")', 'button:has-text("Đăng nhập")'];
    for (const sel of loginSelectors) {
      try {
        await page.click(sel, { timeout: 3000 });
        console.error(`[Login] Clicked login button via ${sel}`);
        break;
      } catch {}
    }

    // Wait for navigation after login
    console.error('[Login] Waiting for login to complete...');
    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle').catch(() => {});

    // Check login success by looking for SESSION cookie
    const allCookies = await context.cookies();
    const sessionCookie = allCookies.find(c => c.name === 'SESSION');

    if (!sessionCookie) {
      console.error(JSON.stringify({
        error: 'Login may have failed — no SESSION cookie found',
        cookieNames: allCookies.map(c => c.name),
        currentUrl: page.url(),
      }));
    } else {
      console.error('[Login] SESSION cookie found, login successful!');
    }

    // Save cookies in the standard format
    const cookieData = {
      url: 'https://www.kalodata.com',
      cookies: allCookies.map(c => ({
        domain: c.domain,
        expirationDate: c.expires,
        hostOnly: !c.domain.startsWith('.'),
        httpOnly: c.httpOnly,
        name: c.name,
        path: c.path,
        sameSite: c.sameSite || 'unspecified',
        secure: c.secure,
        session: c.expires === -1,
        value: c.value,
      })),
      updatedAt: new Date().toISOString(),
    };

    writeFileSync(COOKIES_FILE, JSON.stringify(cookieData, null, 2));
    console.log(JSON.stringify({
      success: true,
      message: 'Cookies saved successfully',
      cookieCount: allCookies.length,
      hasSession: !!sessionCookie,
      savedTo: COOKIES_FILE,
    }));

  } catch (err) {
    console.error(JSON.stringify({ error: `Login failed: ${err.message}` }));
  } finally {
    await browser.close();
  }
}

function normalizeSameSite(val) {
  if (!val || val === 'unspecified' || val === 'no_restriction') return 'None';
  return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
