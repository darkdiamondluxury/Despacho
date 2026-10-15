// Serviços: lista por dia, com pesquisa e alocação rápida de driver.
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useDrivers, useServices, useVehicles, type Service } from '@/lib/data';
import { supabase, todayISO } from '@/lib/supabase';
import { Btn, Card, Chip, Pill, s } from '@/ui/kit';
import { C, STATUS } from '@/ui/theme';

function fmtDay(d: string, today: string) {
  if (d === today) return 'Hoje';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function Servicos() {
  const { rows, loading } = useServices();
  const { rows: drivers } = useDrivers();
  const { rows: vehicles } = useVehicles();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'proximos' | 'por_alocar' | 'todos'>('proximos');
  const [open, setOpen] = useState<string | null>(null);
  const today = todayISO();

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'proximos' && r.date < today) return false;
      if (filter === 'por_alocar' && (r.driver_id || r.status === 'cancelado')) return false;
      if (!t) return true;
      return [r.client_name, r.pickup, r.dropoff, r.flight, r.service_type]
        .some((v) => v?.toLowerCase().includes(t));
    });
  }, [rows, q, filter, today]);

  const byDay = useMemo(() => {
    const m = new Map<string, Service[]>();
    list.forEach((r) => m.set(r.date, [...(m.get(r.date) ?? []), r]));
    return [...m.entries()];
  }, [list]);

  async function update(id: string, patch: Partial<Service>) {
    const { error } = await supabase.from('services').update(patch).eq('id', id);
    if (error) Platform.OS === 'web' ? window.alert(error.message) : Alert.alert('Erro', error.message);
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100, maxWidth: 900, width: '100%', alignSelf: 'center' }}>
        <TextInput
          placeholder="Pesquisar cliente, local, voo…"
          placeholderTextColor="#A3A497"
          value={q}
          onChangeText={setQ}
          style={[s.input, { marginBottom: 10 }]}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Chip label="Próximos" on={filter === 'proximos'} onPress={() => setFilter('proximos')} />
          <Chip label="Por alocar" on={filter === 'por_alocar'} onPress={() => setFilter('por_alocar')} />
          <Chip label="Todos" on={filter === 'todos'} onPress={() => setFilter('todos')} />
        </View>

        {!loading && byDay.length === 0 && (
          <Card style={{ marginTop: 8 }}><Text style={{ color: C.muted }}>Nada para mostrar com este filtro.</Text></Card>
        )}

        {byDay.map(([day, items]) => (
          <View key={day} style={{ marginTop: 14 }}>
            <Text style={{ fontWeight: '700', color: C.green, marginBottom: 8, textTransform: 'capitalize' }}>
              {fmtDay(day, today)} · {items.length}
            </Text>
            {items.map((r) => {
              const isOpen = open === r.id;
              const drv = drivers.find((d) => d.id === r.driver_id);
              const veh = vehicles.find((v) => v.id === r.vehicle_id);
              return (
                <Pressable key={r.id} onPress={() => setOpen(isOpen ? null : r.id)} style={{ marginBottom: 8 }}>
                  <Card>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 17, fontWeight: '700', color: C.text }}>{r.time?.slice(0, 5) ?? '--:--'}</Text>
                      <Pill label={STATUS[r.status]?.label ?? r.status} color={STATUS[r.status]?.color ?? C.grey} />
                    </View>
                    <Text style={{ color: C.text, marginTop: 4 }}>{r.pickup ?? '—'} → {r.dropoff ?? '—'}</Text>
                    <Text style={{ color: C.muted, marginTop: 2 }}>
                      {[r.service_type, r.client_name, r.pax ? `${r.pax} pax` : null, r.flight].filter(Boolean).join(' · ')}
                    </Text>
                    <Text style={{ color: drv ? C.olive : C.danger, marginTop: 4, fontWeight: '600' }}>
                      {drv ? `${drv.name}${veh ? ' · ' + veh.name : ''}` : 'Por alocar'}
                    </Text>

                    {isOpen && (
                      <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12 }}>
                        {r.notes ? <Text style={{ color: C.text, marginBottom: 10 }}>Notas: {r.notes}</Text> : null}
                        <Text style={{ color: C.muted, marginBottom: 6 }}>Driver</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                          {drivers.map((d) => (
                            <Chip key={d.id} label={d.name} on={d.id === r.driver_id}
                              onPress={() => update(r.id, { driver_id: d.id === r.driver_id ? null : d.id,
                                // trocar de driver anula o envio anterior
                                ...(r.sent_at || r.status === 'recusado' ? { status: 'pendente', sent_at: null, seen_by_driver: false } : {}) })} />
                          ))}
                          {drivers.length === 0 && <Text style={{ color: C.muted }}>Adiciona drivers no separador Frota.</Text>}
                        </View>
                        <Text style={{ color: C.muted, marginVertical: 6 }}>Viatura</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                          {vehicles.map((v) => (
                            <Chip key={v.id} label={v.name} on={v.id === r.vehicle_id}
                              onPress={() => update(r.id, { vehicle_id: v.id === r.vehicle_id ? null : v.id })} />
                          ))}
                        </View>
                        {r.status === 'recusado' && r.decline_reason ? (
                          <Text style={{ color: C.danger, marginTop: 6 }}>Recusado: {r.decline_reason}</Text>
                        ) : null}
                        {r.sent_at && r.status === 'enviado' ? (
                          <Text style={{ color: C.muted, marginTop: 6 }}>{r.seen_by_driver ? '👁 O driver já viu' : 'Ainda não visto pelo driver'}</Text>
                        ) : null}
                        {r.driver_id && (r.status === 'pendente' || r.status === 'recusado') ? (
                          <Btn kind="gold" title={`Enviar a ${drv?.name ?? 'driver'}`}
                            onPress={() => update(r.id, { status: 'enviado', sent_at: new Date().toISOString(), seen_by_driver: false, decline_reason: null })} />
                        ) : null}
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                          <View style={{ flex: 1 }}>
                            <Btn kind="ghost" title={r.status === 'cancelado' ? 'Reativar' : 'Cancelar serviço'}
                              onPress={() => update(r.id, { status: r.status === 'cancelado' ? 'pendente' : 'cancelado' })} />
                          </View>
                        </View>
                      </View>
                    )}
                  </Card>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <Pressable
        accessibilityLabel="Novo serviço"
        onPress={() => router.push('/servico/novo')}
        style={{ position: 'absolute', right: 18, bottom: 18, width: 58, height: 58, borderRadius: 29, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', elevation: 4 }}>
        <Text style={{ fontSize: 30, color: C.green, marginTop: -2 }}>+</Text>
      </Pressable>
    </View>
  );
}
