import { GoogleGenAI } from '@google/genai';

export async function geminiScraper(url: string, instruction?: string): Promise<any> {
  const t0 = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  const browserlessKey = process.env.BROWSERLESS_API_KEY;
  if (!apiKey || !browserlessKey) {
    console.error('[Gemini] Keys missing');
    return { success: false, error: 'Keys missing', method: 'gemini' };
  }

  try {
    console.log(`[Gemini] Taking screenshot for: \${url}`);
    const screenshotRes = await fetch(`https://chrome.browserless.io/screenshot?token=\${browserlessKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        options: { fullPage: false, type: 'jpeg', quality: 80 },
        gotoOptions: { waitUntil: 'networkidle2', timeout: 25000 }
      })
    });
    
    if (!screenshotRes.ok) {
      const text = await screenshotRes.text();
      console.error(`[Gemini] Screenshot failed (\${screenshotRes.status}):`, text.slice(0, 100));
      throw new Error('Screenshot failed');
    }
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
    
    console.log(`[Gemini] Calling Gemini API...`);
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
    console.log(`[Gemini] Response text:`, text.slice(0, 100));
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
    console.error(`[Gemini] Fatal Error:`, e.message);
    return { success: false, error: e.message, method: 'gemini' };
  }
}
