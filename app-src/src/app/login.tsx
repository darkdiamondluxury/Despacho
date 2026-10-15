import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { ENV_NAME, supabase } from '@/lib/supabase';
import { Btn, Card, ErrorText, Field, Screen } from '@/ui/kit';
import { C } from '@/ui/theme';

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function go() {
    setErr(null); setInfo(null); setBusy(true);
    const e = email.trim().toLowerCase();
    const res = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email: e, password: pw })
      : await supabase.auth.signUp({ email: e, password: pw });
    setBusy(false);
    if (res.error) {
      const m = res.error.message;
      setErr(
        m.includes('Invalid login') ? 'Email ou palavra-passe errados.'
        : m.includes('Email not confirmed') ? 'Ainda não confirmaste o email. Abre o link que recebeste.'
        : m.includes('already registered') ? 'Esta conta já existe. Usa "Entrar".'
        : m.includes('at least') ? 'A palavra-passe tem de ter pelo menos 6 caracteres.'
        : m,
      );
      return;
    }
    if (mode === 'up' && !res.data.session) setInfo('Conta criada. Confirma o email no link que recebeste e depois entra.');
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20, maxWidth: 440, width: '100%', alignSelf: 'center' }}>
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <Text style={{ fontSize: 30, color: C.gold }}>◆</Text>
            <Text style={{ fontSize: 26, fontWeight: '700', color: C.green, marginTop: 6 }}>Despacho</Text>
            <Text style={{ color: C.muted, marginTop: 4 }}>Gestão de transfers · {ENV_NAME}</Text>
          </View>
          <Card>
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            <Field label="Palavra-passe" value={pw} onChangeText={setPw} secureTextEntry autoComplete="password" onSubmitEditing={go} />
            <ErrorText>{err}</ErrorText>
            {info && <Text style={{ color: C.ok, marginBottom: 10 }}>{info}</Text>}
            <Btn title={mode === 'in' ? 'Entrar' : 'Criar conta'} onPress={go} busy={busy} disabled={!email || !pw} />
            <Btn
              kind="ghost"
              title={mode === 'in' ? 'Ainda não tenho conta' : 'Já tenho conta'}
              onPress={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(null); setInfo(null); }}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
