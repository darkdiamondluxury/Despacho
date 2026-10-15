// Leitura dos dados da empresa, com atualização em tempo real.
//
// Três camadas, da mais rápida para a mais segura:
//  1. Tempo real (Supabase Realtime): a base de dados avisa a app quando algo muda.
//  2. Ao voltar à app (separador do browser ou app do telemóvel), recarrega tudo.
//  3. De 30 em 30 segundos recarrega, caso as duas anteriores falhem.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { supabase } from './supabase';

export type Service = {
  id: string; date: string; time: string | null; service_type: string | null;
  pickup: string | null; dropoff: string | null; flight: string | null;
  client_name: string | null; client_phone: string | null; pax: number | null;
  notes: string | null; status: string; driver_id: string | null; vehicle_id: string | null;
};
export type Driver = { id: string; name: string; phone: string | null; available: boolean };
export type Vehicle = { id: string; name: string; plate: string | null; category: string; seats: number | null };
export type ServiceType = { id: string; name: string; duration_min: number };

// ---- Estado da ligação em tempo real (para o indicador no ecrã) ----
export type LiveState = 'a ligar' | 'ao vivo' | 'sem tempo real';
let live: LiveState = 'a ligar';
let liveDetail = '';
const liveSubs = new Set<() => void>();
function setLive(s: LiveState, detail = '') {
  if (s === live && detail === liveDetail) return;
  live = s; liveDetail = detail;
  liveSubs.forEach((f) => f());
}
export function useLive() {
  return useSyncExternalStore(
    (f) => { liveSubs.add(f); return () => liveSubs.delete(f); },
    () => `${live}|${liveDetail}`,
    () => `${live}|${liveDetail}`,
  );
}

// ---- "Voltei à app": avisa todas as listas para recarregarem ----
const wakeSubs = new Set<() => void>();
function wakeAll() { wakeSubs.forEach((f) => f()); }
if (Platform.OS === 'web') {
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wakeAll(); });
    window.addEventListener('focus', wakeAll);
  }
} else {
  AppState.addEventListener('change', (st) => { if (st === 'active') wakeAll(); });
}

function useTable<T>(table: string, query: () => PromiseLike<{ data: T[] | null }>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data } = await query();
    if (data) setRows(data);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`rt-${table}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => load())
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') setLive('ao vivo');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')
          setLive('sem tempo real', `${status}${err?.message ? ': ' + err.message : ''}`);
      });
    wakeSubs.add(load);
    const t = setInterval(load, 30000);
    return () => {
      wakeSubs.delete(load);
      clearInterval(t);
      supabase.removeChannel(ch);
    };
  }, [load, table]);

  return { rows, loading, reload: load };
}

export function useServices() {
  return useTable<Service>('services', () =>
    supabase.from('services').select('*').order('date', { ascending: true }).order('time', { ascending: true }),
  );
}
export function useDrivers() {
  return useTable<Driver>('drivers', () => supabase.from('drivers').select('*').eq('removed', false).order('name'));
}
export function useVehicles() {
  return useTable<Vehicle>('vehicles', () => supabase.from('vehicles').select('*').eq('removed', false).order('name'));
}
export function useServiceTypes() {
  return useTable<ServiceType>('service_types', () => supabase.from('service_types').select('*').order('position'));
}
