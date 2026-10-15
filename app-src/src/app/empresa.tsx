// Primeiro arranque: quem cria a conta cria a empresa e fica admin.
// (Os drivers e o escritório vão entrar por convite, num passo seguinte.)
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Btn, Card, ErrorText, Field, H1, Screen } from '@/ui/kit';
import { C } from '@/ui/theme';

export default function Empresa() {
  const { refreshProfile, signOut, session } = useAuth();
  const [name, setName] = useState('Dark Diamond');
  const [me, setMe] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('create_company', { p_name: name.trim(), p_full_name: me.trim() });
    if (error) { setErr(error.message); setBusy(false); return; }
    await refreshProfile();
    setBusy(false);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20, maxWidth: 440, width: '100%', alignSelf: 'center' }}>
        <H1>Criar a empresa</H1>
        <Text style={{ color: C.muted, marginBottom: 18 }}>
          Ficas como administrador. Depois convidas o escritório e os drivers.
        </Text>
        <Card>
          <Field label="Nome da empresa" value={name} onChangeText={setName} />
          <Field label="O teu nome" value={me} onChangeText={setMe} />
          <ErrorText>{err}</ErrorText>
          <Btn title="Criar empresa" onPress={create} busy={busy} disabled={!name.trim() || !me.trim()} />
          <Btn kind="ghost" title={`Sair (${session?.user.email ?? ''})`} onPress={signOut} />
        </Card>
      </ScrollView>
    </Screen>
  );
}
