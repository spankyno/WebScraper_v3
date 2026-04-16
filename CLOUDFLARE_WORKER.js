/**
 * CLOUDFLARE WORKER: Advanced WebScraper Proxy
 */

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    try {
      const { url, method, selector, instruction } = await request.json();
      if (!url) return json({ error: 'URL is required' }, 400);

      console.log(`[Worker] Scraping: ${url} with method: ${method || 'hybrid'}`);

      let result;
      if (method === 'fetch-light') {
        result = await smartFetchParser(url, selector);
      } else if (method === 'browserless') {
        result = await browserlessAdvanced(url, selector, env.BROWSERLESS_API_KEY);
      } else if (method === 'gemini') {
        result = await geminiScraper(url, instruction, env.GEMINI_API_KEY, env.BROWSERLESS_API_KEY);
      } else {
        // Hybrid logic
        result = await smartFetchParser(url, selector);
        if (!result.success || result.price === null) {
          result = await browserlessAdvanced(url, selector, env.BROWSERLESS_API_KEY);
        }
        if (!result.success || result.price === null) {
          result = await geminiScraper(url, instruction, env.GEMINI_API_KEY, env.BROWSERLESS_API_KEY);
        }
      }

      return json(result);

    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    console.log('[Worker] Scheduled cron trigger');
    const vercelUrl = env.APP_URL || 'https://ais-dev-32qlw4os74irqunc55yi5h-73893629377.europe-west2.run.app';
    const cronSecret = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!cronSecret) {
      console.error('[Worker] SUPABASE_SERVICE_ROLE_KEY missing in Worker secrets');
      return;
    }

    try {
      const res = await fetch(`${vercelUrl}/api/cron`, {
        headers: {
          'Authorization': `Bearer ${cronSecret}`
        }
      });
      const data = await res.json();
      console.log('[Worker] Cron result:', data);
    } catch (e) {
      console.error('[Worker] Cron trigger failed:', e.message);
    }
  }
};

// --- Utils ---

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function parsePrice(raw) {
  if (!raw) return null;
  const cleaned = raw
    .toString()
    .replace(/[€$£¥\s]/g, '')
    .replace(/\.(?=\d{3})/g, '')
    .replace(',', '.')
    .trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function deepFindPrice(obj) {
  if (!obj || typeof obj !== 'object') return null;
  
  // Priority keys first
  const priorityKeys = ['price', 'unitPrice', 'currentPrice', 'amount', 'value'];
  for (const key of priorityKeys) {
    if (obj[key] !== undefined && (typeof obj[key] === 'number' || typeof obj[key] === 'string')) {
      const p = parsePrice(obj[key]);
      if (p !== null) return p;
    }
  }

  for (const key in obj) {
    const value = obj[key];
    if (
      key.toLowerCase().includes('price') &&
      (typeof value === 'number' || typeof value === 'string')
    ) {
      const p = parsePrice(value);
      if (p !== null) return p;
    }
    const found = deepFindPrice(value);
    if (found) return found;
  }
  return null;
}

function extractAllJSON(html) {
  const matches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
  if (!matches) return [];
  const results = [];
  for (const m of matches) {
    try {
      const content = m.replace(/<script[^>]*>|<\/script>/g, '').trim();
      if (content.startsWith('{') || content.startsWith('[')) {
        const json = JSON.parse(content);
        results.push(json);
      }
    } catch {}
  }
  return results;
}

// --- Scraper Engines ---

async function smartFetchParser(url, selector) {
  try {
    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Cache-Control': 'no-cache'
      },
      signal: AbortSignal.timeout(8000)
    });
    const html = await res.text();
    
    let priceRaw = null;
    
    // 1. Universal JSON Extraction
    const allJSON = extractAllJSON(html);
    for (const j of allJSON) {
      const p = deepFindPrice(j);
      if (p !== null) {
        priceRaw = p;
        break;
      }
    }

    // 2. Meta tags fallback
    if (priceRaw === null) {
      const metaMatch = html.match(/itemprop="price"[^>]*content="([^"]+)"/) || 
                         html.match(/property="product:price:amount"[^>]*content="([^"]+)"/) ||
                         html.match(/name="twitter:data1"[^>]*content="([^"]+)"/);
      if (metaMatch) priceRaw = metaMatch[1];
    }

    return {
      success: true,
      url,
      method: 'fetch-v2-universal',
      price: typeof priceRaw === 'number' ? priceRaw : parsePrice(priceRaw),
      productName: 'Extracted via Worker V2'
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function browserlessAdvanced(url, selector, apiKey) {
  if (!apiKey) return { success: false, error: 'BROWSERLESS_API_KEY missing' };
  
  const BROWSER_FN = `
    export default async function({ page, context }) {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
      
      let apiData = [];
      await page.setRequestInterception(true);
      page.on('request', request => request.continue());
      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/') || url.includes('graphql') || url.includes('/v1/')) {
          try {
            const json = await response.json();
            if (json) apiData.push(json);
          } catch {}
        }
      });

      // Robust rendering waits
      try {
        await page.goto(context.url, { waitUntil: 'networkidle2', timeout: 20000 });
      } catch (e) {
        await page.goto(context.url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      }
      
      // Wait extra for lazy loading
      await new Promise(r => setTimeout(r, 3000));
      
      const data = await page.evaluate(() => {
        const deepFindPrice = (obj) => {
          if (!obj || typeof obj !== 'object') return null;
          const priorityKeys = ['price', 'unitPrice', 'currentPrice', 'amount', 'value'];
          for (const key of priorityKeys) {
            if (obj[key] !== undefined && (typeof obj[key] === 'number' || typeof obj[key] === 'string')) return obj[key];
          }
          for (const key in obj) {
            if (key.toLowerCase().includes('price') && (typeof obj[key] === 'number' || typeof obj[key] === 'string')) return obj[key];
            const found = deepFindPrice(obj[key]);
            if (found) return found;
          }
          return null;
        };

        const getPrice = () => {
          // 1. All JSON from scripts
          const scripts = document.querySelectorAll('script');
          for (const s of scripts) {
            try {
              const content = s.innerText.trim();
              if (content.startsWith('{') || content.startsWith('[')) {
                const json = JSON.parse(content);
                const p = deepFindPrice(json);
                if (p) return p.toString();
              }
            } catch(e) {}
          }
          // 2. Selectors
          const sel = [
            '[data-testid*="price"]',
            '[class*="price"]:not([class*="was"]):not([class*="old"])',
            '[id*="price"]',
            '[itemprop="price"]', 
            '.buy-box__price', 
            '.a-price-whole'
          ];
          for (const s of sel) {
            const el = document.querySelector(s);
            if (el) return el.getAttribute('content') || el.getAttribute('data-price') || el.innerText;
          }
          return null;
        };

        const getName = () => {
          const el = document.querySelector('h1[itemprop="name"]') || document.querySelector('h1') || document.querySelector('title');
          return el ? el.innerText.trim() : 'Unknown';
        };

        return { priceText: getPrice(), productName: getName() };
      });
      
      return { ...data, apiData };
    }
  `;

  try {
    const res = await fetch(`https://chrome.browserless.io/chrome/function?token=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: BROWSER_FN, context: { url } })
    });
    const json = await res.json();
    const data = json.data || {};
    
    let price = parsePrice(data.priceText);
    
    // Fallback to API data interception
    if (price === null && data.apiData) {
      price = parsePrice(findPriceInObject(data.apiData));
    }

    return { 
      success: true, 
      method: 'browserless-v2', 
      price: price,
      productName: data.productName
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function findPriceInObject(obj) {
  if (!obj || typeof obj !== 'object') return null;
  for (const k in obj) {
    if (k.toLowerCase() === 'price' || k.toLowerCase() === 'unitprice') {
      if (typeof obj[k] === 'number' || typeof obj[k] === 'string') return obj[k];
    }
    const found = findPriceInObject(obj[k]);
    if (found) return found;
  }
  return null;
}

async function geminiScraper(url, instruction, geminiKey, browserlessKey) {
  if (!geminiKey || !browserlessKey) return { success: false, error: 'Keys missing' };
  
  try {
    // 1. Screenshot
    const screenshotRes = await fetch(`https://chrome.browserless.io/screenshot?token=${browserlessKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        options: { fullPage: false, type: 'jpeg', quality: 70 },
        gotoOptions: { waitUntil: 'networkidle2', timeout: 20000 }
      })
    });
    
    if (!screenshotRes.ok) throw new Error('Screenshot failed');
    const buffer = await screenshotRes.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(buffer)));

    // 2. Gemini
    const prompt = instruction || "Extract product name and price from this image. Return JSON: { \"productName\": \"...\", \"price\": 12.34 }";
    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: base64Image } }
          ]
        }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const aiJson = await aiRes.json();
    const text = aiJson.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);

    return {
      success: true,
      method: 'gemini-v2',
      price: parsed.price,
      productName: parsed.productName
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
