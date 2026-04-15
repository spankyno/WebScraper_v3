import { fetchParser } from '../src/lib/scrapers/fetchParser';
import { browserlessScraper } from '../src/lib/scrapers/browserless';
import { geminiScraper } from '../src/lib/scrapers/gemini';
import { hybridScraper, suggestMethod } from '../src/lib/scrapers/hybrid';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, method, selector, instruction } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  console.log(`[API] Scrape request received for URL: ${url}`);

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
