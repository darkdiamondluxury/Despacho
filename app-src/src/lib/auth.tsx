// Contexto de autenticação: sabe quem está ligado e qual o seu perfil (empresa, papel).
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

export type Profile = {
  id: string;
  company_id: string;
  full_name: string;
  role: 'admin' | 'office' | 'driver';
  can_money: boolean;
  can_track: boolean;
};

type AuthState = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  companyName: string;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [companyName, setCompanyName] = useState('');

  const loadProfile = useCallback(async (s: Session | null) => {
    // Garante que o tempo real usa o login atual (sem isto pode ligar como anónimo e não receber nada).
    supabase.realtime.setAuth(s?.access_token ?? null);
    if (!s) {
      setProfile(null);
      setCompanyName('');
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    setProfile((data as Profile) ?? null);
    if (data) {
      const { data: c } = await supabase.from('companies').select('name').eq('id', data.company_id).maybeSingle();
      setCompanyName(c?.name ?? '');
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Fora do callback, para não bloquear o cliente do Supabase.
      setTimeout(() => loadProfile(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const value: AuthState = {
    ready,
    session,
    profile,
    companyName,
    refreshProfile: () => loadProfile(session),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fora do AuthProvider');
  return v;
}
