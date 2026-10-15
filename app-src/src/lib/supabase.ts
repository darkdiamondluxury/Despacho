// Ligação única ao Supabase, usada por toda a app.
// O URL e a anon key vêm do ficheiro .env (variáveis EXPO_PUBLIC_*),
// por isso trocar de pré-prod para prod é só trocar esse ficheiro.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anonKey, {
  auth: {
    // No telemóvel a sessão fica guardada no AsyncStorage; no browser usa o localStorage.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// No telemóvel, só renova o login enquanto a app está aberta (poupa bateria).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const ENV_NAME = url?.includes('ccwzqtdxugutkgdupgxc') ? 'pré-prod' : 'prod';

export function todayISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
