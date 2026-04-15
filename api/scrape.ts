import { fetchParser } from '../src/lib/scrapers/fetchParser.js';
import { browserlessScraper } from '../src/lib/scrapers/browserless.js';
import { geminiScraper } from '../src/lib/scrapers/gemini.js';
import { hybridScraper, suggestMethod } from '../src/lib/scrapers/hybrid.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, method, selector, instruction } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  console.log(`[API] Scrape request received for URL: ${url}`);

  // --- Scraper Proxy Support ---
  const proxyUrl = process.env.SCRAPER_PROXY_URL;
  if (proxyUrl) {
    try {
      console.log(`[API] Forwarding to Scraper Proxy: ${proxyUrl}`);
      const proxyRes = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, method, selector, instruction }),
        signal: AbortSignal.timeout(25000)
      });
      
      if (proxyRes.ok) {
        const proxyData = await proxyRes.json();
        return res.status(200).json(proxyData);
      } else {
        const errorText = await proxyRes.text();
        console.error(`[API] Proxy failed (${proxyRes.status}):`, errorText.slice(0, 100));
        // Fallback to local if proxy fails? No, let's report it.
        return res.status(proxyRes.status).json({ error: `Proxy error: ${errorText.slice(0, 50)}` });
      }
    } catch (e: any) {
      console.error(`[API] Proxy fatal:`, e.message);
      // Continue to local if proxy fails
    }
  }

  try {
    let result;
    switch (method) {
      case 'fetch-light': result = await fetchParser(url, selector); break;
      case 'browserless': result = await browserlessScraper(url, selector); break;
      case 'gemini': result = await geminiScraper(url, instruction); break;
      default: result = await hybridScraper(url, selector, instruction);
    }

    if (result.success) {
      res.status(200).json({ ...result, suggestedMethod: suggestMethod(url) });
    } else {
      res.status(422).json({ error: result.error || 'Extraction failed' });
    }
  } catch (e: any) {
    console.error('[API] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
