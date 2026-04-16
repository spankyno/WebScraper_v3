import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { LogIn, UserPlus, Loader2, Globe } from 'lucide-react';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success('Check your email for the confirmation link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Logged in successfully!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="bg-[#1A1D23] border-[#2D333B] shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-[#4F46E5] p-3 rounded-2xl shadow-lg shadow-[#4F46E5]/20">
              <Globe className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-extrabold tracking-tight text-[#E6EDF3]">
            Web<span className="text-[#4F46E5]">Scraper</span> v3
          </CardTitle>
          <CardDescription className="text-[#8B949E]">
            {isSignUp ? 'Crea una cuenta para empezar a monitorizar precios' : 'Accede a tu panel de control de WebScraper v3'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleAuth}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider">Correo Electrónico</label>
              <Input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-[#0F1115] border-[#2D333B] text-white focus-visible:ring-[#4F46E5]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider">Contraseña</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-[#0F1115] border-[#2D333B] text-white focus-visible:ring-[#4F46E5]"
              />
            </div>
            
            <div className="pt-2">
              <p className="text-[10px] text-[#8B949E] leading-tight text-center italic">
                Esta es una herramienta privada de monitorización de precios. 
                Tus credenciales están protegidas y cifradas.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold py-6" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : isSignUp ? <UserPlus className="h-4 w-4 mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
              {isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
            </Button>
            
            <div className="flex flex-col items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
              >
                {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : "¿No tienes cuenta? Regístrate"}
              </button>
              
              <div className="flex items-center gap-4 pt-2 border-t border-[#2D333B] w-full justify-center">
                <span className="text-[9px] text-[#545d68] uppercase tracking-widest font-bold flex items-center gap-1">
                  <div className="h-1 w-1 rounded-full bg-[#4F46E5]" />
                  Secure Auth by Supabase
                </span>
              </div>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

