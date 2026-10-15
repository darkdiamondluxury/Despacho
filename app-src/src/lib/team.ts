// Fala com a Edge Function "criar-acesso" (que corre no Supabase com a chave secreta).
import { supabase } from './supabase';

export type Member = {
  id: string; full_name: string; role: 'admin' | 'office' | 'driver';
  can_money: boolean; can_track: boolean; active: boolean;
  email: string | null; driver_id: string | null;
};

export async function teamCall<T = { ok: boolean }>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('criar-acesso', { body });
  if (error) {
    // A função devolve { error: "mensagem" }; tenta ler essa mensagem.
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') msg = (await ctx.json()).error ?? msg;
    } catch {}
    if (msg.includes('Failed to send') || msg.includes('404')) msg = 'A função "criar-acesso" ainda não está publicada no Supabase.';
    throw new Error(msg);
  }
  return data as T;
}

export function randomPw() {
  const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 9 }, () => a[Math.floor(Math.random() * a.length)]).join('');
}
