import { parsePrice } from './fetchParser';

export async function browserlessScraper(url: string, selector?: string): Promise<any> {
  const t0 = Date.now();
  const apiKey = process.env.BROWSERLESS_API_KEY;
  if (!apiKey) {
    console.error('[Browserless] API Key missing');
    return { success: false, error: 'BROWSERLESS_API_KEY missing', method: 'browserless' };
  }

  const BROWSER_FN = `
    export default async function({ page, context }) {
      try {
        const { url, selector } = context;
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
        
        const priceSelectors = [
          selector, 
          '[itemprop="price"]', 
          'meta[property="product:price:amount"]', 
          '.a-price-whole', 
          '[class*="price"]:not([class*="was"]):not([class*="old"])',
          '.current-price',
          '.price',
          '#priceblock_ourprice',
          '#priceblock_dealprice'
        ].filter(Boolean);

        let priceText = '';
        for (const sel of priceSelectors) {
          try {
            const el = await page.$(sel);
            if (!el) continue;
            priceText = await page.evaluate(el => el.getAttribute('content') ?? el.getAttribute('data-price') ?? el.innerText, el);
            if (priceText && priceText.trim()) {
              priceText = priceText.trim();
              break;
            }
          } catch {}
        }

        const productName = await page.$eval('h1[itemprop="name"], #productTitle, h1', el => el.innerText.trim()).catch(() => '');
        const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
        const inStock = !bodyText.includes('agotado') && !bodyText.includes('out of stock') && !bodyText.includes('no disponible');

        return { success: true, priceText, productName, inStock };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  `;

  try {
    console.log(`[Browserless] Requesting URL: ${url}`);
    const res = await fetch(`https://chrome.browserless.io/chrome/function?token=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: BROWSER_FN,
        context: { url, selector }
      }),
      signal: AbortSignal.timeout(9000)
    });

    const contentType = res.headers.get('content-type');
    if (!res.ok || !contentType?.includes('application/json')) {
      const text = await res.text();
      console.error(`[Browserless] Error Response (${res.status}):`, text.slice(0, 200));
      throw new Error(`Browserless error ${res.status}: ${text.slice(0, 100)}`);
    }

    const json: any = await res.json();
    const data = json?.data ?? json;

    if (data.error) {
      console.error(`[Browserless] Function Error:`, data.error);
      throw new Error(data.error);
    }

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
    console.error(`[Browserless] Fatal Error:`, e.message);
    return { success: false, error: e.message, method: 'browserless' };
  }
}
