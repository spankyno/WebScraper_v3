import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RefreshCw, Trash2, ExternalLink, TrendingDown, TrendingUp, Minus, Loader2, Pencil, Check, X } from 'lucide-react';
import { MonitoredItem } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { Input } from '@/components/ui/input';

export default function MonitoredItems({ session }: { session: any }) {
  const [items, setItems] = useState<MonitoredItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rechecking, setRechecking] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTargetPrice, setEditTargetPrice] = useState('');
  const [editFrequency, setEditFrequency] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('monitored_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    
    // Real-time subscription
    const channel = supabase
      .channel('monitored_items_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monitored_items' }, () => {
        fetchItems();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('monitored_items').delete().eq('id', id);
      if (error) throw error;
      toast.success('Item removed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete item');
    }
  };

  const handleRecheck = async (item: MonitoredItem) => {
    setRechecking(item.id);
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.url })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to recheck');

      const { error } = await supabase.from('monitored_items').update({
        current_price: data.price,
        previous_price: item.current_price,
        last_check: new Date().toISOString()
      }).eq('id', item.id);

      if (error) throw error;
      
      // Record history
      await supabase.from('price_history').insert({
        item_id: item.id,
        price: data.price,
        method: data.method
      });

      toast.success('Price updated!');
    } catch (error: any) {
      toast.error(error.message || 'Recheck failed');
    } finally {
      setRechecking(null);
    }
  };

  const startEditing = (item: MonitoredItem) => {
    setEditingId(item.id);
    setEditTargetPrice(item.target_price.toString());
    setEditFrequency(item.frequency);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTargetPrice('');
    setEditFrequency('');
  };

  const handleUpdate = async (id: string) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('monitored_items')
        .update({
          target_price: parseFloat(editTargetPrice),
          frequency: editFrequency
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Item updated successfully');
      setEditingId(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update item');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <Card className="bg-[#1A1D23] border-[#2D333B]">
      <CardHeader>
        <span className="text-[10px] text-[#8B949E] uppercase tracking-wider font-semibold mb-2 block">Monitorizados</span>
        <CardTitle className="text-xl font-bold">Monitored Products</CardTitle>
        <CardDescription className="text-[#8B949E]">Items currently being tracked for price changes.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-12 text-[#8B949E]">
            No items monitored yet. Start by extracting a price!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-[#2D333B]">
                <TableRow className="hover:bg-transparent border-b border-[#2D333B]">
                  <TableHead className="text-[#8B949E] uppercase text-[10px] font-bold tracking-wider">Product</TableHead>
                  <TableHead className="text-[#8B949E] uppercase text-[10px] font-bold tracking-wider">Current Price</TableHead>
                  <TableHead className="text-[#8B949E] uppercase text-[10px] font-bold tracking-wider">Target</TableHead>
                  <TableHead className="text-[#8B949E] uppercase text-[10px] font-bold tracking-wider">Trend</TableHead>
                  <TableHead className="text-[#8B949E] uppercase text-[10px] font-bold tracking-wider">Last Check</TableHead>
                  <TableHead className="text-right text-[#8B949E] uppercase text-[10px] font-bold tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const diff = item.previous_price ? item.current_price - item.previous_price : 0;
                  return (
                    <TableRow key={item.id} className="border-b border-[#2D333B] hover:bg-[#0F1115]/50 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="truncate max-w-[200px] text-[#E6EDF3] font-semibold">{item.name}</span>
                          <a href={item.url} target="_blank" rel="noreferrer" className="text-[10px] text-[#8B949E] hover:text-[#4F46E5] flex items-center gap-1 transition-colors">
                            {new URL(item.url).hostname} <ExternalLink className="h-2 w-2" />
                          </a>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-[#10B981]">
                        {item.current_price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </TableCell>
                      <TableCell>
                        {editingId === item.id ? (
                          <div className="flex flex-col gap-2">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-[#8B949E]">€</span>
                              <Input 
                                type="number" 
                                value={editTargetPrice} 
                                onChange={(e) => setEditTargetPrice(e.target.value)}
                                className="h-7 w-20 pl-5 text-[10px] bg-[#0F1115] border-[#2D333B]"
                              />
                            </div>
                            <select
                              value={editFrequency}
                              onChange={(e) => setEditFrequency(e.target.value)}
                              className="h-7 w-20 bg-[#0F1115] border border-[#2D333B] rounded px-1 text-[10px] text-white focus:outline-none"
                            >
                              <option value="1h">1h</option>
                              <option value="6h">6h</option>
                              <option value="24h">24h</option>
                              <option value="72h">72h</option>
                            </select>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-[#8B949E] bg-[#0F1115] border border-[#2D333B] px-2 py-1 rounded">
                            OBJ: {item.target_price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                            <span className="ml-1 opacity-50">({item.frequency})</span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {diff < 0 ? (
                          <span className="text-[#10B981] flex items-center gap-1 text-xs font-bold"><TrendingDown className="h-3 w-3" /> {Math.abs(diff).toFixed(2)}€</span>
                        ) : diff > 0 ? (
                          <span className="text-[#F59E0B] flex items-center gap-1 text-xs font-bold"><TrendingUp className="h-3 w-3" /> {diff.toFixed(2)}€</span>
                        ) : (
                          <span className="text-[#8B949E] flex items-center gap-1 text-xs"><Minus className="h-3 w-3" /> 0.00€</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[10px] text-[#8B949E] font-medium">
                        {item.last_check ? formatDistanceToNow(new Date(item.last_check), { addSuffix: true }) : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {editingId === item.id ? (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleUpdate(item.id)}
                                disabled={updating}
                                className="h-8 w-8 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                              >
                                {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={cancelEditing}
                                className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => startEditing(item)}
                                className="h-8 w-8 text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#2D333B]"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleRecheck(item)}
                                disabled={rechecking === item.id}
                                className="h-8 w-8 text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#2D333B]"
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${rechecking === item.id ? 'animate-spin' : ''}`} />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDelete(item.id)}
                                className="h-8 w-8 text-[#8B949E] hover:text-red-500 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
