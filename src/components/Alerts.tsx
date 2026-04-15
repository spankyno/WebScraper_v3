import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Bell, History, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Alert } from '../types';
import { format } from 'date-fns';

export default function Alerts({ session }: { session: any }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const { data, error } = await supabase
          .from('alerts')
          .select('*')
          .order('timestamp', { ascending: false });

        if (error) throw error;
        setAlerts(data || []);
      } catch (error: any) {
        console.error('Failed to fetch alerts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Card className="bg-[#1A1D23] border-[#2D333B]">
        <CardHeader>
          <span className="text-[10px] text-[#8B949E] uppercase tracking-wider font-semibold mb-2 block">Historial de Alertas</span>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <Bell className="h-5 w-5 text-[#4F46E5]" />
            Alert History
          </CardTitle>
          <CardDescription className="text-[#8B949E]">Recent price alerts and system notifications.</CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-12 text-[#8B949E]">
              No alerts yet.
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div 
                  key={alert.id} 
                  className="border-b border-[#2D333B] pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      alert.type === 'target_reached' || alert.type === 'price_drop' 
                        ? 'bg-[#10B981]/10 text-[#10B981]' 
                        : 'bg-[#F59E0B]/10 text-[#F59E0B]'
                    }`}>
                      {alert.type.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-[#8B949E] font-medium">
                      {format(new Date(alert.timestamp), 'p')}
                    </span>
                  </div>
                  <p className="text-sm text-[#E6EDF3] leading-relaxed">
                    {alert.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
