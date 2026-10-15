// Leitura dos dados da empresa, com atualização em tempo real.
// Quando alguém (escritório ou driver) muda um serviço noutro aparelho,
// o Supabase avisa esta app e a lista recarrega sozinha.
import { useCallback, useEffect, useState } from 'react';

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

function useTable<T>(table: string, query: () => PromiseLike<{ data: T[] | null }>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data } = await query();
    setRows(data ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`rt-${table}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => load())
      .subscribe();
    return () => {
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
