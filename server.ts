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

async function fetchParser(url: string): Promise<{ price: number; name: string } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    // Heuristics for price
    let priceText = '';
    
    // Common price selectors
    const priceSelectors = [
      '[class*="price"]', '[id*="price"]', '.a-price-whole', '.product-price',
      'meta[property="product:price:amount"]', 'meta[name="twitter:data1"]'
    ];

    for (const selector of priceSelectors) {
      const el = $(selector);
      if (el.length) {
        if (selector.startsWith('meta')) {
          priceText = el.attr('content') || '';
        } else {
          priceText = el.first().text();
        }
        if (priceText) break;
      }
    }

    const name = $('title').text().split('|')[0].trim() || $('h1').first().text().trim();
    const price = parseFloat(priceText.replace(/[^0-9.,]/g, '').replace(',', '.'));

    if (!isNaN(price)) return { price, name };
    return null;
  } catch (e) {
    console.error('fetchParser error:', e);
    return null;
  }
}

async function browserlessScraper(url: string): Promise<{ price: number; name: string } | null> {
  const apiKey = process.env.BROWSERLESS_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(`https://chrome.browserless.io/content?token=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        waitFor: 3000,
        stealth: true
      })
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    // Similar heuristics as fetchParser but on rendered HTML
    let priceText = '';
    const priceSelectors = ['.a-price-whole', '.price', '[class*="price"]', '.current-price'];
    for (const selector of priceSelectors) {
      const el = $(selector);
      if (el.length) {
        priceText = el.first().text();
        if (priceText) break;
      }
    }

    const name = $('h1').first().text().trim() || $('title').text().trim();
    const price = parseFloat(priceText.replace(/[^0-9.,]/g, '').replace(',', '.'));

    if (!isNaN(price)) return { price, name };
    return null;
  } catch (e) {
    console.error('browserless error:', e);
    return null;
  }
}

async function geminiScraper(url: string): Promise<{ price: number; name: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  const browserlessKey = process.env.BROWSERLESS_API_KEY;
  if (!apiKey || !browserlessKey) return null;

  try {
    // Get screenshot via browserless
    const screenshotRes = await fetch(`https://chrome.browserless.io/screenshot?token=${browserlessKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        options: { fullPage: false, type: 'jpeg', quality: 80 }
      })
    });
    const buffer = await screenshotRes.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString('base64');

    const genAI = new GoogleGenAI({ apiKey });
    
    const prompt = "Analyze this screenshot of a product page. Extract the product name and its current price. Return ONLY a JSON object like {\"name\": \"...\", \"price\": 123.45}. If you can't find it, return null.";
    
    const result = await genAI.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [{
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Image,
              mimeType: 'image/jpeg'
            }
          }
        ]
      }]
    });

    const text = result.text;
    const jsonMatch = text.match(/\{.*\}/s);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      if (data && data.price) return data;
    }
    return null;
  } catch (e) {
    console.error('geminiScraper error:', e);
    return null;
  }
}

async function hybridScraper(url: string) {
  let result = await fetchParser(url);
  if (result) return { ...result, method: 'fetch' };

  result = await browserlessScraper(url);
  if (result) return { ...result, method: 'browserless' };

  result = await geminiScraper(url);
  if (result) return { ...result, method: 'gemini' };

  return null;
}

// --- API Routes ---

app.post('/api/scrape', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const result = await hybridScraper(url);
  if (result) {
    res.json(result);
  } else {
    res.status(500).json({ error: 'Failed to scrape price' });
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
