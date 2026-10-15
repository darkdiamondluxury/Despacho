// Cores Dark Diamond (as mesmas do protótipo), tema claro.
export const C = {
  green: '#082016',
  gold: '#CAB26A',
  olive: '#7C844C',
  grey: '#7C7C6C',
  bg: '#F4F3EE',
  card: '#FFFFFF',
  line: '#E3E1D8',
  text: '#14201A',
  muted: '#6B6E64',
  danger: '#B4442F',
  ok: '#3E7B4F',
};

export const STATUS: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Por enviar', color: '#9A8C55' },
  enviado: { label: 'Enviado', color: '#5C6E8A' },
  aceite: { label: 'Aceite', color: '#3E7B4F' },
  a_caminho: { label: 'A caminho', color: '#2F6F8F' },
  a_bordo: { label: 'A bordo', color: '#6A4C93' },
  concluido: { label: 'Concluído', color: '#3E5B48' },
  no_show: { label: 'Não apareceu', color: '#B4442F' },
  recusado: { label: 'Recusado', color: '#B4442F' },
  cancelado: { label: 'Cancelado', color: '#7C7C6C' },
  entregue: { label: 'Entregue a parceiro', color: '#7C844C' },
};
