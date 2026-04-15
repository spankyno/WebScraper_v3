import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Search, Loader2, Plus, ExternalLink, DollarSign } from 'lucide-react';
import { ScrapeResult } from '../types';

export default function Extraction({ session, onMonitor }: { session: any, onMonitor: () => void }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [targetPrice, setTargetPrice] = useState('');
  const [frequency, setFrequency] = useState('24h');
  const [saving, setSaving] = useState(false);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to scrape');
      
      setResult(data);
      toast.success('Price extracted successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Scraping failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMonitor = async () => {
    if (!result || !targetPrice) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.from('monitored_items').insert({
        user_id: session.user.id,
        url,
        name: result.name,
        target_price: parseFloat(targetPrice),
        current_price: result.price,
        frequency,
        next_check: new Date().toISOString()
      });

      if (error) throw error;
      
      toast.success('Item added to monitoring!');
      onMonitor();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6">
      <Card className="bg-[#1A1D23] border-[#2D333B]">
        <CardHeader>
          <span className="text-[10px] text-[#8B949E] uppercase tracking-wider font-semibold mb-2 block">Nueva Extracción</span>
          <CardTitle className="text-xl font-bold">Product Scraper</CardTitle>
          <CardDescription className="text-[#8B949E]">Enter a product URL to get its current price.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleScrape} className="flex gap-3">
            <Input
              placeholder="https://tienda.com/producto-especifico"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 bg-[#0F1115] border-[#2D333B] text-white focus-visible:ring-[#4F46E5]"
            />
            <select
              className="bg-[#0F1115] border-[#2D333B] rounded-md px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
            >
              <option>Hybrid (Auto)</option>
              <option>Gemini AI (Visual)</option>
              <option>Browserless (JS)</option>
              <option>FetchParser (Fast)</option>
            </select>
            <Button type="submit" disabled={loading} className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Extraer Precio
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card className="bg-[#1A1D23] border-[#2D333B] animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold">{result.name}</CardTitle>
                <div className="flex items-center gap-2 text-xs text-[#8B949E]">
                  <span className="bg-[#0F1115] border border-[#2D333B] px-2 py-0.5 rounded text-[10px] font-mono uppercase">Method: {result.method}</span>
                  <a href={url} target="_blank" rel="noreferrer" className="flex items-center hover:text-[#E6EDF3] transition-colors">
                    View Original <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </div>
              </div>
              <div className="text-3xl font-bold text-[#10B981]">
                {result.price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider">Target Price (€)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8B949E]" />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="pl-9 bg-[#0F1115] border-[#2D333B] text-white focus-visible:ring-[#4F46E5]"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider">Check Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full h-10 rounded-md border border-[#2D333B] bg-[#0F1115] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                >
                  <option value="1h">Every hour</option>
                  <option value="6h">Every 6 hours</option>
                  <option value="24h">Daily (24h)</option>
                  <option value="72h">Every 3 days (72h)</option>
                </select>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleMonitor} disabled={saving || !targetPrice} className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold py-6">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Start Monitoring
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
