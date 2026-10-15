// Frota: drivers, viaturas e acessos à app.
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { useDrivers, useVehicles } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { randomPw, teamCall, type Member } from '@/lib/team';
import { Btn, Card, Chip, ErrorText, Field } from '@/ui/kit';
import { C } from '@/ui/theme';

const CATS = ['Carro', 'Carro Executive', 'Van', 'Van VIP'];
const APP_URL = 'https://fabsan33.github.io/Despacho/app/';
const ROLE_LABEL = { admin: 'Administrador', office: 'Escritório', driver: 'Driver' };

type Form = { mode: 'create' | 'reset'; driverId?: string; userId?: string; name: string; role: Member['role']; email: string; pw: string; money: boolean; track: boolean };

export default function Frota() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const drivers = useDrivers();
  const vehicles = useVehicles();
  const [dn, setDn] = useState(''); const [dp, setDp] = useState('');
  const [vn, setVn] = useState(''); const [vp, setVp] = useState(''); const [vc, setVc] = useState('Carro');
  const [err, setErr] = useState<string | null>(null);

  // ---- acessos ----
  const [team, setTeam] = useState<Member[]>([]);
  const [teamErr, setTeamErr] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    if (!isAdmin) return;
    try { setTeam((await teamCall<{ team: Member[] }>({ action: 'list' })).team); setTeamErr(null); }
    catch (e) { setTeamErr((e as Error).message); }
  }, [isAdmin]);
  useEffect(() => { loadTeam(); }, [loadTeam]);

  async function submitAccess() {
    if (!form) return;
    setBusy(true); setTeamErr(null);
    try {
      if (form.mode === 'create') {
        await teamCall({ action: 'create', email: form.email, password: form.pw, role: form.role, full_name: form.name,
          driver_id: form.driverId, can_money: form.money, can_track: form.track });
      } else {
        await teamCall({ action: 'reset', user_id: form.userId, password: form.pw });
      }
      setDone(`${form.name}\nApp: ${APP_URL}\nEmail: ${form.email}\nPalavra-passe: ${form.pw}`);
      setForm(null);
      await loadTeam(); drivers.reload();
    } catch (e) { setTeamErr((e as Error).message); }
    setBusy(false);
  }

  async function toggleActive(m: Member) {
    try { await teamCall({ action: 'set_active', user_id: m.id, active: !m.active }); loadTeam(); }
    catch (e) { setTeamErr((e as Error).message); }
  }

  async function shareDone() {
    if (!done) return;
    if (Platform.OS === 'web') {
      try { await navigator.clipboard.writeText(done); setDone(done + '\n\n✓ Copiado'); } catch {}
    } else await Share.share({ message: done });
  }

  // ---- frota ----
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

  const memberOfDriver = (driverId: string) => team.find((m) => m.driver_id === driverId);
  const staff = team.filter((m) => m.role !== 'driver');

  const accessForm = form && (
    <View style={{ backgroundColor: C.bg, borderRadius: 12, padding: 12, marginTop: 10 }}>
      <Text style={{ fontWeight: '700', color: C.green, marginBottom: 8 }}>
        {form.mode === 'create' ? `Criar acesso · ${form.name || ROLE_LABEL[form.role]}` : `Nova palavra-passe · ${form.name}`}
      </Text>
      {form.mode === 'create' && form.role !== 'driver' && (
        <>
          <Field label="Nome" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
            <Chip label="Escritório" on={form.role === 'office'} onPress={() => setForm({ ...form, role: 'office' })} />
            <Chip label="Administrador" on={form.role === 'admin'} onPress={() => setForm({ ...form, role: 'admin' })} />
          </View>
          {form.role === 'office' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
              <Chip label={`${form.money ? '✓' : '✗'} Vê valores`} on={form.money} onPress={() => setForm({ ...form, money: !form.money })} />
              <Chip label={`${form.track ? '✓' : '✗'} Vê localização`} on={form.track} onPress={() => setForm({ ...form, track: !form.track })} />
            </View>
          )}
        </>
      )}
      {form.mode === 'create' && (
        <Field label="Email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} autoCapitalize="none" keyboardType="email-address" />
      )}
      <Field label="Palavra-passe" value={form.pw} onChangeText={(v) => setForm({ ...form, pw: v })} autoCapitalize="none" />
      <ErrorText>{teamErr}</ErrorText>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Btn kind="ghost" title="Cancelar" onPress={() => { setForm(null); setTeamErr(null); }} /></View>
        <View style={{ flex: 1 }}>
          <Btn title={form.mode === 'create' ? 'Criar' : 'Guardar'} onPress={submitAccess} busy={busy}
            disabled={form.pw.length < 6 || (form.mode === 'create' && (!form.email.includes('@') || !form.name.trim()))} />
        </View>
      </View>
    </View>
  );

  const Row = ({ title, sub, right, onRemove }: { title: string; sub?: string | null; right?: React.ReactNode; onRemove?: () => void }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line, gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600', color: C.text }}>{title}</Text>
        {sub ? <Text style={{ color: C.muted }}>{sub}</Text> : null}
      </View>
      {right}
      {onRemove && <Pressable onPress={onRemove} hitSlop={10}><Text style={{ color: C.danger }}>Remover</Text></Pressable>}
    </View>
  );
  const Link = ({ label, onPress, color = C.olive }: { label: string; onPress: () => void; color?: string }) => (
    <Pressable onPress={onPress} hitSlop={8}><Text style={{ color, fontWeight: '600' }}>{label}</Text></Pressable>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, maxWidth: 900, width: '100%', alignSelf: 'center' }}>
      <ErrorText>{err}</ErrorText>

      {done && (
        <Card style={{ borderColor: C.ok }}>
          <Text style={{ fontWeight: '700', color: C.ok, marginBottom: 6 }}>Acesso pronto. Envia isto à pessoa:</Text>
          <Text selectable style={{ color: C.text, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, lineHeight: 21 }}>{done}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1 }}><Btn kind="gold" title={Platform.OS === 'web' ? 'Copiar' : 'Partilhar'} onPress={shareDone} /></View>
            <View style={{ flex: 1 }}><Btn kind="ghost" title="Fechar" onPress={() => setDone(null)} /></View>
          </View>
        </Card>
      )}

      <Card>
        <Text style={{ fontWeight: '700', color: C.green, fontSize: 17, marginBottom: 6 }}>Drivers · {drivers.rows.length}</Text>
        {drivers.rows.map((d) => {
          const m = memberOfDriver(d.id);
          return (
            <View key={d.id}>
              <Row
                title={d.name}
                sub={[d.phone, m ? `${m.active ? '✓' : '⏸'} ${m.email}` : isAdmin ? 'Sem acesso à app' : null].filter(Boolean).join(' · ')}
                right={isAdmin ? (m
                  ? <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Link label="Nova palavra-passe" onPress={() => setForm({ mode: 'reset', userId: m.id, name: d.name, role: 'driver', email: m.email ?? '', pw: randomPw(), money: false, track: false })} />
                      <Link label={m.active ? 'Desativar' : 'Ativar'} color={m.active ? C.danger : C.ok} onPress={() => toggleActive(m)} />
                    </View>
                  : <Link label="Criar acesso" onPress={() => setForm({ mode: 'create', driverId: d.id, name: d.name, role: 'driver', email: '', pw: randomPw(), money: false, track: false })} />)
                  : undefined}
                onRemove={() => remove('drivers', d.id)}
              />
              {form && form.role === 'driver' && (form.driverId === d.id || (m && form.userId === m.id)) && accessForm}
            </View>
          );
        })}
        <View style={{ marginTop: 12 }}>
          <Field label="Nome" value={dn} onChangeText={setDn} />
          <Field label="Telefone" value={dp} onChangeText={setDp} keyboardType="phone-pad" />
          <Btn title="Adicionar driver" onPress={addDriver} disabled={!dn.trim()} />
        </View>
      </Card>

      {isAdmin && (
        <Card>
          <Text style={{ fontWeight: '700', color: C.green, fontSize: 17, marginBottom: 6 }}>Equipa do escritório · {staff.length}</Text>
          {staff.map((m) => (
            <View key={m.id}>
              <Row
                title={`${m.full_name || '—'}${m.id === profile?.id ? ' (tu)' : ''}`}
                sub={[ROLE_LABEL[m.role], m.email, m.role === 'office' ? [m.can_money && 'vê valores', m.can_track && 'vê localização'].filter(Boolean).join(', ') : null, m.active ? null : 'desativado'].filter(Boolean).join(' · ')}
                right={m.id === profile?.id ? undefined : (
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Link label="Nova palavra-passe" onPress={() => setForm({ mode: 'reset', userId: m.id, name: m.full_name, role: m.role, email: m.email ?? '', pw: randomPw(), money: false, track: false })} />
                    <Link label={m.active ? 'Desativar' : 'Ativar'} color={m.active ? C.danger : C.ok} onPress={() => toggleActive(m)} />
                  </View>
                )}
              />
              {form && form.mode === 'reset' && form.userId === m.id && accessForm}
            </View>
          ))}
          {form && form.mode === 'create' && form.role !== 'driver' ? accessForm : (
            <Btn kind="ghost" title="+ Acesso para escritório / admin"
              onPress={() => setForm({ mode: 'create', name: '', role: 'office', email: '', pw: randomPw(), money: false, track: true })} />
          )}
          {!form && teamErr ? <View style={{ marginTop: 8 }}><ErrorText>{teamErr}</ErrorText></View> : null}
        </Card>
      )}

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
