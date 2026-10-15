// Frota: drivers e viaturas. Por agora: ver, adicionar e remover.
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { useDrivers, useVehicles } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { Btn, Card, Chip, ErrorText, Field } from '@/ui/kit';
import { C } from '@/ui/theme';

const CATS = ['Carro', 'Carro Executive', 'Van', 'Van VIP'];

export default function Frota() {
  const { profile } = useAuth();
  const drivers = useDrivers();
  const vehicles = useVehicles();
  const [dn, setDn] = useState(''); const [dp, setDp] = useState('');
  const [vn, setVn] = useState(''); const [vp, setVp] = useState(''); const [vc, setVc] = useState('Carro');
  const [err, setErr] = useState<string | null>(null);

  async function addDriver() {
    setErr(null);
    const { error } = await supabase.from('drivers').insert({ company_id: profile!.company_id, name: dn.trim(), phone: dp.trim() || null });
    if (error) return setErr(error.message);
    setDn(''); setDp(''); drivers.reload();
  }
  async function addVehicle() {
    setErr(null);
    const { error } = await supabase.from('vehicles').insert({ company_id: profile!.company_id, name: vn.trim(), plate: vp.trim().toUpperCase() || null, category: vc });
    if (error) return setErr(error.message);
    setVn(''); setVp(''); vehicles.reload();
  }
  async function remove(table: 'drivers' | 'vehicles', id: string) {
    await supabase.from(table).update({ removed: true }).eq('id', id);
    table === 'drivers' ? drivers.reload() : vehicles.reload();
  }

  const Row = ({ title, sub, onRemove }: { title: string; sub?: string | null; onRemove: () => void }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600', color: C.text }}>{title}</Text>
        {sub ? <Text style={{ color: C.muted }}>{sub}</Text> : null}
      </View>
      <Pressable onPress={onRemove} hitSlop={10}><Text style={{ color: C.danger }}>Remover</Text></Pressable>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, maxWidth: 900, width: '100%', alignSelf: 'center' }}>
      <ErrorText>{err}</ErrorText>
      <Card>
        <Text style={{ fontWeight: '700', color: C.green, fontSize: 17, marginBottom: 6 }}>Drivers · {drivers.rows.length}</Text>
        {drivers.rows.map((d) => <Row key={d.id} title={d.name} sub={d.phone} onRemove={() => remove('drivers', d.id)} />)}
        <View style={{ marginTop: 12 }}>
          <Field label="Nome" value={dn} onChangeText={setDn} />
          <Field label="Telefone" value={dp} onChangeText={setDp} keyboardType="phone-pad" />
          <Btn title="Adicionar driver" onPress={addDriver} disabled={!dn.trim()} />
        </View>
      </Card>

      <Card>
        <Text style={{ fontWeight: '700', color: C.green, fontSize: 17, marginBottom: 6 }}>Viaturas · {vehicles.rows.length}</Text>
        {vehicles.rows.map((v) => <Row key={v.id} title={v.name} sub={[v.category, v.plate].filter(Boolean).join(' · ')} onRemove={() => remove('vehicles', v.id)} />)}
        <View style={{ marginTop: 12 }}>
          <Field label="Modelo" value={vn} onChangeText={setVn} placeholder="Mercedes Classe E" />
          <Field label="Matrícula" value={vp} onChangeText={setVp} autoCapitalize="characters" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
            {CATS.map((c) => <Chip key={c} label={c} on={vc === c} onPress={() => setVc(c)} />)}
          </View>
          <Btn title="Adicionar viatura" onPress={addVehicle} disabled={!vn.trim()} />
        </View>
      </Card>
    </ScrollView>
  );
}
