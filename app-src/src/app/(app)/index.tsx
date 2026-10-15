// Início: o quadro do dia para o escritório.
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { useDrivers, useLive, useServices } from '@/lib/data';
import { ENV_NAME, todayISO } from '@/lib/supabase';
import { Btn, Card, Pill } from '@/ui/kit';
import { C, STATUS } from '@/ui/theme';

function Tile({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <View style={{ flex: 1, minWidth: 140, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14 }}>
      <Text style={{ fontSize: 28, fontWeight: '700', color: tone }}>{n}</Text>
      <Text style={{ color: C.muted, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

export default function Inicio() {
  const { profile, companyName, signOut } = useAuth();
  const { rows } = useServices();
  const { rows: drivers } = useDrivers();
  const [liveState, liveDetail] = useLive().split('|');
  const today = todayISO();
  const hoje = rows.filter((r) => r.date === today && r.status !== 'cancelado');
  const porAlocar = rows.filter((r) => r.date >= today && !r.driver_id && r.status !== 'cancelado');
  const proximos = rows.filter((r) => r.date >= today && r.status !== 'cancelado').slice(0, 6);
  const dName = (id: string | null) => drivers.find((d) => d.id === id)?.name ?? 'Por alocar';

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, maxWidth: 900, width: '100%', alignSelf: 'center' }}>
      <View>
        <Text style={{ fontSize: 22, fontWeight: '700', color: C.green }}>Olá, {profile?.full_name.split(' ')[0]}</Text>
        <Text style={{ color: C.muted }}>{companyName} · ambiente {ENV_NAME}</Text>
        <Text style={{ color: liveState === 'ao vivo' ? C.ok : liveState === 'a ligar' ? C.muted : C.danger, marginTop: 4, fontSize: 13 }}>
          ● {liveState === 'ao vivo' ? 'Ao vivo' : liveState === 'a ligar' ? 'A ligar ao tempo real…' : 'Sem tempo real (atualiza a cada 30 s)'}
          {liveDetail ? ` · ${liveDetail}` : ''}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Tile n={hoje.length} label="Serviços hoje" tone={C.green} />
        <Tile n={porAlocar.length} label="Por alocar" tone={porAlocar.length ? C.danger : C.ok} />
        <Tile n={drivers.length} label="Drivers" tone={C.olive} />
      </View>

      <Btn kind="gold" title="+ Novo serviço" onPress={() => router.push('/servico/novo')} />

      <Text style={{ fontWeight: '700', color: C.text, marginTop: 6 }}>Próximos serviços</Text>
      {proximos.length === 0 && (
        <Card><Text style={{ color: C.muted }}>Sem serviços marcados. Cria o primeiro com o botão acima.</Text></Card>
      )}
      {proximos.map((r) => (
        <Pressable key={r.id} onPress={() => router.push('/servicos')}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontWeight: '700', color: C.green }}>
                {r.date === today ? 'Hoje' : r.date.split('-').reverse().slice(0, 2).join('/')} · {r.time?.slice(0, 5) ?? '--:--'}
              </Text>
              <Pill label={STATUS[r.status]?.label ?? r.status} color={STATUS[r.status]?.color ?? C.grey} />
            </View>
            <Text style={{ color: C.text }}>{r.pickup ?? '—'} → {r.dropoff ?? '—'}</Text>
            <Text style={{ color: r.driver_id ? C.muted : C.danger, marginTop: 4 }}>
              {r.client_name ?? 'Cliente'} · {dName(r.driver_id)}
            </Text>
          </Card>
        </Pressable>
      ))}

      <Btn kind="ghost" title="Terminar sessão" onPress={signOut} />
    </ScrollView>
  );
}
