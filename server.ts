import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Supabase Admin Client for Cron
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// --- Scraping Engines ---

function parsePrice(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[€$£¥\s]/g, '')
    .replace(/\.(?=\d{3})/g, '')
    .replace(',', '.')
    .trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

async function fetchParser(url: string, selector?: string): Promise<any> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);

    let priceRaw = '';
    if (selector) {
      priceRaw = $(selector).first().text() || $(selector).first().attr('content') || $(selector).first().attr('data-price') || '';
    }

    if (!priceRaw) {
      const priceSelectors = ['[itemprop="price"]', '[class*="price"]:not([class*="was"])', '.a-price-whole', 'meta[property="product:price:amount"]'];
      for (const sel of priceSelectors) {
        const el = $(sel).first();
        if (el.length) {
          priceRaw = el.attr('content') ?? el.attr('data-price') ?? el.text();
          if (priceRaw) break;
        }
      }
    }

    const price = parsePrice(priceRaw);
    const productName = $('h1[itemprop="name"]').first().text().trim() || $('#productTitle').text().trim() || $('h1').first().text().trim() || $('title').text().trim();
    
    const bodyText = $('body').text().toLowerCase();
    const inStock = !bodyText.includes('agotado') && !bodyText.includes('out of stock') && !bodyText.includes('no disponible');

    return {
      success: true,
      url,
      method: 'fetch-light',
      price,
      productName,
      inStock,
      durationMs: Date.now() - t0
    };
  } catch (e: any) {
    return { success: false, error: e.message, method: 'fetch-light' };
  }
}

async function browserlessScraper(url: string, selector?: string): Promise<any> {
  const t0 = Date.now();
  const apiKey = process.env.BROWSERLESS_API_KEY;
  if (!apiKey) throw new Error('BROWSERLESS_API_KEY missing');

  const BROWSER_FN = `
    export default async function({ page, context }) {
      const { url, selector } = context;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      
      const priceSelectors = [selector, '[itemprop="price"]', 'meta[property="product:price:amount"]', '.a-price-whole', '[class*="price"]:not([class*="was"])'].filter(Boolean);
      let priceText = '';
      for (const sel of priceSelectors) {
        try {
          const el = await page.$(sel);
          if (!el) continue;
          priceText = await page.evaluate(el => el.getAttribute('content') ?? el.getAttribute('data-price') ?? el.innerText, el);
          if (priceText) break;
        } catch {}
      }

      const productName = await page.$eval('h1[itemprop="name"], #productTitle, h1', el => el.innerText.trim()).catch(() => '');
      const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
      const inStock = !bodyText.includes('agotado') && !bodyText.includes('out of stock');

      return { priceText, productName, inStock };
    }
  `;

  try {
    const res = await fetch(`https://production-sfo.browserless.io/chrome/function?token=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: BROWSER_FN,
        context: { url, selector }
      }),
      signal: AbortSignal.timeout(25000)
    });

    if (!res.ok) throw new Error(`Browserless ${res.status}`);
    const json: any = await res.json();
    const data = json?.data ?? json;

    return {
      success: true,
      url,
      method: 'browserless',
      price: parsePrice(data.priceText),
      productName: data.productName,
      inStock: data.inStock,
      durationMs: Date.now() - t0
    };
  } catch (e: any) {
    return { success: false, error: e.message, method: 'browserless' };
  }
}

async function geminiScraper(url: string, instruction?: string): Promise<any> {
  const t0 = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  const browserlessKey = process.env.BROWSERLESS_API_KEY;
  if (!apiKey || !browserlessKey) throw new Error('Keys missing');

  try {
    const screenshotRes = await fetch(`https://chrome.browserless.io/screenshot?token=${browserlessKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        options: { fullPage: false, type: 'jpeg', quality: 80 },
        gotoOptions: { waitUntil: 'networkidle2', timeout: 25000 }
      })
    });
    
    if (!screenshotRes.ok) throw new Error('Screenshot failed');
    const buffer = await screenshotRes.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString('base64');

    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = instruction || `
      Analiza esta página web de producto y extrae en formato JSON estricto:
      {
        "productName": "nombre completo del producto",
        "price": número decimal (solo el número, sin símbolo de moneda),
        "currency": "EUR" | "USD" | "GBP",
        "inStock": true | false
      }
      Responde SOLO con el JSON, sin explicaciones ni markdown.
    `;
    
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
          },
        },
      ],
    });

    const text = response.text.trim().replace(/```json\n?|```/g, '');
    const parsed = JSON.parse(text);

    return {
      success: true,
      url,
      method: 'gemini',
      price: parsed.price,
      productName: parsed.productName,
      inStock: parsed.inStock,
      currency: parsed.currency || 'EUR',
      durationMs: Date.now() - t0
    };
  } catch (e: any) {
    return { success: false, error: e.message, method: 'gemini' };
  }
}

async function hybridScraper(url: string, selector?: string, instruction?: string) {
  const errors: string[] = [];

  // 1. Fetch Light
  const f = await fetchParser(url, selector);
  if (f.success && f.price !== null) return f;
  errors.push(`fetch: ${f.error || 'no price'}`);

  // 2. Browserless
  const b = await browserlessScraper(url, selector);
  if (b.success && b.price !== null) return b;
  errors.push(`browserless: ${b.error || 'no price'}`);

  // 3. Gemini
  const g = await geminiScraper(url, instruction);
  if (g.success && g.price !== null) return g;
  errors.push(`gemini: ${g.error || 'no price'}`);

  return { success: false, error: errors.join(' | '), method: 'hybrid' };
}

function suggestMethod(url: string): string {
  const u = url.toLowerCase();
  const jsRequired = ['amazon.', 'zara.com', 'mango.com', 'zalando.', 'mediamarkt.', 'pccomponentes.', 'elcorteingles.'];
  return jsRequired.some(d => u.includes(d)) ? 'browserless' : 'fetch-light';
}

// --- API Routes ---

app.post('/api/scrape', async (req, res) => {
  const { url, method, selector, instruction } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    let result;
    switch (method) {
      case 'fetch-light': result = await fetchParser(url, selector); break;
      case 'browserless': result = await browserlessScraper(url, selector); break;
      case 'gemini': result = await geminiScraper(url, instruction); break;
      default: result = await hybridScraper(url, selector, instruction);
    }

    if (result.success) {
      res.json({ ...result, suggestedMethod: suggestMethod(url) });
    } else {
      res.status(422).json({ error: result.error || 'Extraction failed' });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/cron', async (req, res) => {
  // Simple auth for cron (in production use a secret header)
  const authHeader = req.headers.authorization;
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data: items, error } = await supabaseAdmin
      .from('monitored_items')
      .select('*')
      .eq('active', true)
      .lte('next_check', new Date().toISOString());

    if (error) throw error;

    let checked = 0;
    let alerts = 0;

    for (const item of items) {
      const result = await hybridScraper(item.url);
      if (result) {
        checked++;
        const oldPrice = item.current_price;
        const newPrice = result.price;

        // Update item
        const nextCheckDate = new Date();
        const hours = parseInt(item.frequency);
        nextCheckDate.setHours(nextCheckDate.getHours() + hours);

        await supabaseAdmin
          .from('monitored_items')
          .update({
            current_price: newPrice,
            previous_price: oldPrice,
            last_check: new Date().toISOString(),
            next_check: nextCheckDate.toISOString()
          })
          .eq('id', item.id);

        // Record history
        await supabaseAdmin.from('price_history').insert({
          item_id: item.id,
          price: newPrice,
          method: result.method
        });

        // Check for alerts
        if (newPrice < oldPrice || newPrice <= item.target_price) {
          alerts++;
          const message = `🚨 Price Drop! ${item.name} is now ${newPrice} (Target: ${item.target_price})`;
          
          await supabaseAdmin.from('alerts').insert({
            user_id: item.user_id,
            item_id: item.id,
            message,
            type: newPrice <= item.target_price ? 'target_reached' : 'price_drop'
          });

          // Send Telegram if configured
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('telegram_chat_id')
            .eq('id', item.user_id)
            .single();

          if (profile?.telegram_chat_id && process.env.TELEGRAM_BOT_TOKEN) {
            await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: profile.telegram_chat_id,
                text: message + `\nURL: ${item.url}`
              })
            });
          }
        }
      }
    }

    res.json({ checked, alerts });
  } catch (e) {
    console.error('Cron error:', e);
    res.status(500).json({ error: 'Cron failed' });
  }
});

// --- Vite Middleware ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
