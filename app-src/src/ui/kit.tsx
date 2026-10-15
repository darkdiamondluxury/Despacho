// Peças de interface reutilizadas em todos os ecrãs.
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { C } from './theme';

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ flex: 1, backgroundColor: C.bg }, style]}>{children}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={s.h1}>{children}</Text>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 12 }}>
      <Label>{label}</Label>
      <TextInput placeholderTextColor="#A3A497" style={[s.input, style]} {...rest} />
    </View>
  );
}

export function Btn({
  title, onPress, kind = 'primary', busy, disabled,
}: { title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'gold'; busy?: boolean; disabled?: boolean }) {
  const bg = kind === 'primary' ? C.green : kind === 'gold' ? C.gold : 'transparent';
  const fg = kind === 'ghost' ? C.green : kind === 'gold' ? C.green : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        kind === 'ghost' && { borderWidth: 1, borderColor: C.line }]}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnTxt, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && { backgroundColor: C.green, borderColor: C.green }]}>
      <Text style={{ color: on ? '#fff' : C.text, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ backgroundColor: color + '22', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <Text style={{ color: C.danger, marginBottom: 10 }}>{children}</Text>;
}

export const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line },
  h1: { fontSize: 24, fontWeight: '700', color: C.green, marginBottom: 4 },
  label: { fontSize: 13, color: C.muted, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: C.text },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnTxt: { fontSize: 16, fontWeight: '600' },
  chip: { borderWidth: 1, borderColor: C.line, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, marginBottom: 8 },
});
