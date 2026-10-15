// Formulário de novo serviço. O driver é opcional: pode alocar-se depois.
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { useDrivers, useServiceTypes, useVehicles } from '@/lib/data';
import { supabase, todayISO } from '@/lib/supabase';
import { Btn, Chip, ErrorText, Field, Label } from '@/ui/kit';
import { C } from '@/ui/theme';

const empty = () => ({
  date: todayISO(), time: '', service_type: '', pickup: '', dropoff: '', flight: '',
  client_name: '', client_phone: '', pax: '', notes: '', driver_id: '', vehicle_id: '',
});

export default function NovoServico() {
  const { profile } = useAuth();
  const { rows: types } = useServiceTypes();
  const { rows: drivers } = useDrivers();
  const { rows: vehicles } = useVehicles();
  const [f, setF] = useState(empty());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(0);
  const set = (k: keyof ReturnType<typeof empty>) => (v: string) => setF((o) => ({ ...o, [k]: v }));

  async function save(again: boolean) {
    setErr(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return setErr('Data no formato AAAA-MM-DD, ex.: 2026-10-20.');
    if (f.time && !/^\d{1,2}:\d{2}$/.test(f.time)) return setErr('Hora no formato HH:MM, ex.: 09:30.');
    setBusy(true);
    const { error } = await supabase.from('services').insert({
      company_id: profile!.company_id,
      created_by: profile!.id,
      date: f.date,
      time: f.time || null,
      service_type: f.service_type || null,
      pickup: f.pickup || null,
      dropoff: f.dropoff || null,
      flight: f.flight || null,
      client_name: f.client_name || null,
      client_phone: f.client_phone || null,
      pax: f.pax ? Number(f.pax) : null,
      notes: f.notes || null,
      driver_id: f.driver_id || null,
      vehicle_id: f.vehicle_id || null,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    if (again) {
      setF({ ...empty(), date: f.date });
      setSaved((n) => n + 1);
    } else router.back();
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
      {saved > 0 && <Text style={{ color: C.ok, marginBottom: 10 }}>{saved} guardado(s). Podes registar o seguinte.</Text>}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1.3 }}><Field label="Data" value={f.date} onChangeText={set('date')} placeholder="AAAA-MM-DD" /></View>
        <View style={{ flex: 1 }}><Field label="Hora" value={f.time} onChangeText={set('time')} placeholder="09:30" /></View>
      </View>

      <Label>Tipo de serviço</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
        {types.map((t) => (
          <Chip key={t.id} label={t.name} on={f.service_type === t.name}
            onPress={() => set('service_type')(f.service_type === t.name ? '' : t.name)} />
        ))}
      </View>

      <Field label="Recolha" value={f.pickup} onChangeText={set('pickup')} placeholder="Aeroporto de Lisboa, T1" />
      <Field label="Destino" value={f.dropoff} onChangeText={set('dropoff')} placeholder="Hotel…" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Field label="Voo" value={f.flight} onChangeText={set('flight')} autoCapitalize="characters" /></View>
        <View style={{ flex: 1 }}><Field label="Passageiros" value={f.pax} onChangeText={set('pax')} keyboardType="number-pad" /></View>
      </View>
      <Field label="Cliente" value={f.client_name} onChangeText={set('client_name')} />
      <Field label="Telefone do cliente" value={f.client_phone} onChangeText={set('client_phone')} keyboardType="phone-pad" />
      <Field label="Notas para o driver" value={f.notes} onChangeText={set('notes')} multiline style={{ minHeight: 70 }} />

      <Label>Driver (opcional)</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
        {drivers.map((d) => (
          <Chip key={d.id} label={d.name} on={f.driver_id === d.id}
            onPress={() => set('driver_id')(f.driver_id === d.id ? '' : d.id)} />
        ))}
        {drivers.length === 0 && <Text style={{ color: C.muted, marginBottom: 8 }}>Ainda sem drivers. Fica por alocar.</Text>}
      </View>
      <Label>Viatura (opcional)</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
        {vehicles.map((v) => (
          <Chip key={v.id} label={v.name} on={f.vehicle_id === v.id}
            onPress={() => set('vehicle_id')(f.vehicle_id === v.id ? '' : v.id)} />
        ))}
      </View>

      <ErrorText>{err}</ErrorText>
      <Btn title="Guardar" onPress={() => save(false)} busy={busy} />
      <Btn kind="ghost" title="Guardar e novo" onPress={() => save(true)} disabled={busy} />
    </ScrollView>
  );
}
