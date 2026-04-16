import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Send, Shield, User, Loader2, Moon, Sun, Activity } from 'lucide-react';
import { useTheme } from 'next-themes';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function Configuration({ session }: { session: any }) {
  const [telegramId, setTelegramId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [stats, setStats] = useState({
    totalItems: 0,
    alertsToday: 0,
    alerts30Days: 0,
    totalAlerts: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('telegram_chat_id')
          .eq('id', session.user.id)
          .single();

        if (profile) setTelegramId(profile.telegram_chat_id || '');

        // Fetch Stats
        const { count: totalItems } = await supabase
          .from('monitored_items')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', session.user.id);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);

        const { count: alertsToday } = await supabase
          .from('alerts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', session.user.id)
          .gte('timestamp', today.toISOString());

        const { count: alerts30Days } = await supabase
          .from('alerts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', session.user.id)
          .gte('timestamp', last30Days.toISOString());

        const { count: totalAlerts } = await supabase
          .from('alerts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', session.user.id);

        setStats({
          totalItems: totalItems || 0,
          alertsToday: alertsToday || 0,
          alerts30Days: alerts30Days || 0,
          totalAlerts: totalAlerts || 0
        });

        // Fetch Chart Data (Price checks in last 24h)
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);

        const { data: history } = await supabase
          .from('price_history')
          .select('timestamp')
          .gte('timestamp', yesterday.toISOString())
          .order('timestamp', { ascending: true });

        // Group by hour
        const hourlyData = Array.from({ length: 24 }, (_, i) => {
          const d = new Date();
          d.setHours(d.getHours() - (23 - i), 0, 0, 0);
          return {
            time: d.getHours() + ':00',
            checks: 0,
            fullTime: d.toISOString()
          };
        });

        if (history) {
          history.forEach((h: any) => {
            const hDate = new Date(h.timestamp);
            const hourStr = hDate.getHours() + ':00';
            const dataPoint = hourlyData.find(d => d.time === hourStr);
            if (dataPoint) dataPoint.checks++;
          });
        }
        setChartData(hourlyData);

      } catch (error: any) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session.user.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ telegram_chat_id: telegramId })
        .eq('id', session.user.id);

      if (error) throw error;
      toast.success('Settings saved successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!telegramId) {
      toast.error('Please enter a Telegram Chat ID first');
      return;
    }

    setTesting(true);
    try {
      const response = await fetch('/api/test-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Test message sent! Check your Telegram.');
      } else {
        throw new Error(data.error || 'Failed to send test message');
      }
    } catch (error: any) {
      toast.error(error.message || 'Connection test failed');
    } finally {
      setTesting(false);
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
    <div className="grid gap-6">
      <Card className="bg-[#1A1D23] border-[#2D333B]">
        <CardHeader>
          <span className="text-[10px] text-[#8B949E] uppercase tracking-wider font-semibold mb-2 block">Configuración</span>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <Send className="h-5 w-5 text-[#4F46E5]" />
            Telegram Notifications
          </CardTitle>
          <CardDescription className="text-[#8B949E]">Configure where you want to receive price alerts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider">Telegram Chat ID</label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. 123456789"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                className="bg-[#0F1115] border-[#2D333B] text-white focus-visible:ring-[#4F46E5]"
              />
              <Button 
                variant="outline" 
                onClick={handleTestConnection} 
                disabled={testing || !telegramId}
                className="border-[#2D333B] bg-[#0F1115] text-[#E6EDF3] hover:bg-[#2D333B] whitespace-nowrap"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Test
              </Button>
            </div>
            <p className="text-[10px] text-[#8B949E]">
              You can get your Chat ID by messaging <code className="bg-[#0F1115] px-1 rounded text-[#E6EDF3]">@userinfobot</code> on Telegram.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={saving} className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Configuration
          </Button>
        </CardFooter>
      </Card>

      <Card className="bg-[#1A1D23] border-[#2D333B]">
        <CardHeader>
          <span className="text-[10px] text-[#8B949E] uppercase tracking-wider font-semibold mb-2 block">Actividad & Estadísticas</span>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <Activity className="h-5 w-5 text-[#4F46E5]" />
            System Activity
          </CardTitle>
          <CardDescription className="text-[#8B949E]">Real-time monitoring stats and 24h update activity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-[#0F1115] border border-[#2D333B] flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-[#4F46E5]">{stats.totalItems}</span>
                <span className="text-[10px] text-[#8B949E] uppercase font-bold tracking-tighter mt-1">Products</span>
              </div>
              <div className="p-4 rounded-lg bg-[#0F1115] border border-[#2D333B] flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-[#10B981]">{stats.alertsToday}</span>
                <span className="text-[10px] text-[#8B949E] uppercase font-bold tracking-tighter mt-1">Alerts Today</span>
              </div>
              <div className="p-4 rounded-lg bg-[#0F1115] border border-[#2D333B] flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-[#F59E0B]">{stats.alerts30Days}</span>
                <span className="text-[10px] text-[#8B949E] uppercase font-bold tracking-tighter mt-1">Last 30 Days</span>
              </div>
              <div className="p-4 rounded-lg bg-[#0F1115] border border-[#2D333B] flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-[#E6EDF3]">{stats.totalAlerts}</span>
                <span className="text-[10px] text-[#8B949E] uppercase font-bold tracking-tighter mt-1">Total Alerts</span>
              </div>
            </div>

            {/* Right Column: Chart */}
            <div className="h-[200px] w-full bg-[#0F1115] border border-[#2D333B] rounded-lg p-4">
              <div className="text-[10px] text-[#8B949E] uppercase font-bold tracking-wider mb-4 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#4F46E5] animate-pulse" />
                24h Check Activity
              </div>
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorChecks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D333B" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#8B949E', fontSize: 10}}
                    interval={5}
                  />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1A1D23', border: '1px solid #2D333B', borderRadius: '8px', fontSize: '10px' }}
                    itemStyle={{ color: '#E6EDF3' }}
                    labelStyle={{ color: '#8B949E' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="checks" 
                    stroke="#4F46E5" 
                    fillOpacity={1} 
                    fill="url(#colorChecks)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="flex items-center justify-between border-t border-[#2D333B] pt-6">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider">Account Email</div>
              <div className="text-sm font-medium text-[#E6EDF3]">{session.user.email}</div>
            </div>
            <Badge className="pro-badge-gradient border-0 text-[10px] font-bold uppercase tracking-wider">Pro Plan</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
