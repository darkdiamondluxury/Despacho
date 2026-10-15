// Ecrã do driver: só os seus serviços (a base de dados não lhe mostra mais nada)
// e os botões de estado. Cada mudança passa pela função driver_set_status, que
// valida o passo (ex.: não dá para "Concluído" sem "A bordo") e guarda a hora e o GPS.
import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { useLive, useServices, useVehicles, type Service } from '@/lib/data';
import { supabase, todayISO } from '@/lib/supabase';
import { Btn, Card, Chip, ErrorText, Pill, s } from '@/ui/kit';
import { C, STATUS } from '@/ui/theme';

// Posição atual, se o aparelho deixar (no browser pede autorização). Nunca bloqueia o botão.
function getPos(): Promise<{ lat: number; lng: number; acc: number } | null> {
  const geo = typeof navigator !== 'undefined' ? (navigator as Navigator).geolocation : undefined;
  if (!geo) return Promise.resolve(null);
  return new Promise((res) => {
    const t = setTimeout(() => res(null), 6000);
    geo.getCurrentPosition(
      (p) => { clearTimeout(t); res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }); },
      () => { clearTimeout(t); res(null); },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 },
    );
  });
}

const maps = (q: string) => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`);

function fmtDay(d: string, today: string) {
  if (d === today) return 'Hoje';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function Meus() {
  const { profile, signOut } = useAuth();
  const { rows, loading, reload } = useServices();
  const { rows: vehicles } = useVehicles();
  const [liveState] = useLive().split('|');
  const [view, setView] = useState<'proximos' | 'historico'>('proximos');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ id: string; msg: string } | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const today = todayISO();

  const done = ['concluido', 'no_show', 'cancelado'];
  // Ativos em "Hoje e próximos"; terminados vão logo para o Histórico (mais recentes primeiro).
  const list = useMemo(() => {
    if (view === 'proximos') return rows.filter((r) => !done.includes(r.status));
    return rows.filter((r) => done.includes(r.status))
      .sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, view]);
  const novos = rows.filter((r) => r.status === 'enviado').length;

  // Marca como "visto" os serviços novos que aparecem no ecrã
  useEffect(() => {
    rows.filter((r) => r.status === 'enviado' && !r.seen_by_driver)
      .forEach((r) => supabase.rpc('driver_mark_seen', { p_service: r.id }));
  }, [rows]);

  async function step(r: Service, st: string, note?: string) {
    setBusy(r.id + st); setErr(null);
    const pos = await getPos();
    const { error } = await supabase.rpc('driver_set_status', {
      p_service: r.id, p_status: st, p_note: note ?? null,
      p_lat: pos?.lat ?? null, p_lng: pos?.lng ?? null, p_acc: pos?.acc ?? null,
    });
    setBusy(null);
    if (error) return setErr({ id: r.id, msg: error.message });
    setDeclining(null); setReason('');
    reload();
  }

  const B = ({ r, st, title, kind = 'primary' }: { r: Service; st: string; title: string; kind?: 'primary' | 'ghost' | 'gold' }) => (
    <View style={{ flex: 1, minWidth: 130 }}>
      <Btn kind={kind} title={title} busy={busy === r.id + st} disabled={!!busy && busy !== r.id + st} onPress={() => step(r, st)} />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: C.green }}>Olá, {profile?.full_name.split(' ')[0]}</Text>
      <Text style={{ color: liveState === 'ao vivo' ? C.ok : C.muted, fontSize: 13, marginBottom: 12 }}>
        ● {liveState === 'ao vivo' ? 'Ao vivo' : 'A atualizar a cada 30 s'}{novos ? ` · ${novos} novo(s) por aceitar` : ''}
      </Text>
      <View style={{ flexDirection: 'row' }}>
        <Chip label="Hoje e próximos" on={view === 'proximos'} onPress={() => setView('proximos')} />
        <Chip label="Histórico" on={view === 'historico'} onPress={() => setView('historico')} />
      </View>

      {!loading && list.length === 0 && (
        <Card style={{ marginTop: 8 }}>
          <Text style={{ color: C.muted }}>{view === 'proximos' ? 'Sem serviços atribuídos. Quando o escritório te enviar um, aparece aqui.' : 'Ainda sem histórico.'}</Text>
        </Card>
      )}

      {list.map((r, i) => {
        const veh = vehicles.find((v) => v.id === r.vehicle_id);
        const showDay = i === 0 || list[i - 1].date !== r.date;
        const st = STATUS[r.status] ?? { label: r.status, color: C.grey };
        return (
          <View key={r.id}>
            {showDay && <Text style={{ fontWeight: '700', color: C.green, marginTop: 14, marginBottom: 8, textTransform: 'capitalize' }}>{fmtDay(r.date, today)}</Text>}
            <Card style={{ marginBottom: 10, borderColor: r.status === 'enviado' ? C.gold : C.line, borderWidth: r.status === 'enviado' ? 2 : 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 22, fontWeight: '700', color: C.text }}>{r.time?.slice(0, 5) ?? '--:--'}</Text>
                <Pill label={r.status === 'enviado' ? 'Novo' : st.label} color={r.status === 'enviado' ? '#9A7B1F' : st.color} />
              </View>
              {r.service_type ? <Text style={{ color: C.muted, marginTop: 2 }}>{r.service_type}</Text> : null}

              <Pressable onPress={() => r.pickup && maps(r.pickup)} style={{ marginTop: 10 }}>
                <Text style={{ color: C.muted, fontSize: 12 }}>RECOLHA</Text>
                <Text style={{ color: C.text, fontSize: 16, textDecorationLine: r.pickup ? 'underline' : 'none' }}>{r.pickup ?? '—'}</Text>
              </Pressable>
              <Pressable onPress={() => r.dropoff && maps(r.dropoff)} style={{ marginTop: 8 }}>
                <Text style={{ color: C.muted, fontSize: 12 }}>DESTINO</Text>
                <Text style={{ color: C.text, fontSize: 16, textDecorationLine: r.dropoff ? 'underline' : 'none' }}>{r.dropoff ?? '—'}</Text>
              </Pressable>

              <View style={{ marginTop: 10, gap: 3 }}>
                {r.client_name ? <Text style={{ color: C.text }}>👤 {r.client_name}{r.pax ? ` · ${r.pax} pax` : ''}</Text> : null}
                {r.client_phone ? (
                  <Pressable onPress={() => Linking.openURL(`tel:${r.client_phone!.replace(/\s/g, '')}`)}>
                    <Text style={{ color: C.olive, fontWeight: '600' }}>📞 {r.client_phone}</Text>
                  </Pressable>
                ) : null}
                {r.flight ? <Text style={{ color: C.text }}>✈️ {r.flight}</Text> : null}
                {veh ? <Text style={{ color: C.text }}>🚘 {veh.name}{veh.plate ? ` · ${veh.plate}` : ''}</Text> : null}
                {r.notes ? <Text style={{ color: C.text, marginTop: 4 }}>📝 {r.notes}</Text> : null}
                {r.arrived_at && r.status === 'a_caminho' ? (
                  <Text style={{ color: C.ok, marginTop: 4 }}>📍 Chegaste às {new Date(r.arrived_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</Text>
                ) : null}
              </View>

              {err?.id === r.id && <View style={{ marginTop: 8 }}><ErrorText>{err.msg}</ErrorText></View>}

              {declining === r.id ? (
                <View style={{ marginTop: 10 }}>
                  <TextInput placeholder="Motivo (ex.: já tenho serviço a essa hora)" placeholderTextColor="#A3A497"
                    value={reason} onChangeText={setReason} style={[s.input, { marginBottom: 8 }]} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}><Btn kind="ghost" title="Voltar" onPress={() => setDeclining(null)} /></View>
                    <View style={{ flex: 1 }}><Btn title="Recusar" disabled={!reason.trim()} busy={busy === r.id + 'recusado'} onPress={() => step(r, 'recusado', reason.trim())} /></View>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {r.status === 'enviado' && <>
                    <View style={{ flex: 1, minWidth: 130 }}><Btn kind="ghost" title="Recusar" onPress={() => { setDeclining(r.id); setReason(''); }} /></View>
                    <B r={r} st="aceite" title="Aceitar" kind="gold" />
                  </>}
                  {r.status === 'aceite' && <B r={r} st="a_caminho" title="A caminho" kind="gold" />}
                  {r.status === 'a_caminho' && <>
                    {!r.arrived_at && <B r={r} st="chegou" title="Cheguei ao local" kind="ghost" />}
                    <B r={r} st="a_bordo" title="Cliente a bordo" kind="gold" />
                  </>}
                  {r.status === 'a_caminho' && r.arrived_at && <B r={r} st="no_show" title="Não apareceu" kind="ghost" />}
                  {r.status === 'a_bordo' && <B r={r} st="concluido" title="Concluído" kind="gold" />}
                  {r.status === 'no_show' && r.date === today && <B r={r} st="desfazer" title="Desfazer 'não apareceu'" kind="ghost" />}
                </View>
              )}
            </Card>
          </View>
        );
      })}

      <View style={{ marginTop: 20 }}>
        <Btn kind="ghost" title="Terminar sessão" onPress={signOut} />
        {Platform.OS === 'web' && <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>A localização só é registada quando tocas num botão de estado.</Text>}
      </View>
    </ScrollView>
  );
}
