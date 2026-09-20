/**
 * Paleta e tipografia da identidade visual da Toca do Espanhol — portada do
 * tailwind.config.js do frontend web original (tema único, sempre escuro;
 * o app não tem variante clara).
 */

export const Colors = {
  black: '#0A0A0A',
  dark: '#111111',
  card: '#1A1A1A',
  border: '#2A2A2A',
  red: '#8B1A1A',
  redLight: '#B22222',
  redHover: '#A01F1F',
  gold: '#C9A84C',
  goldLight: '#E8C96A',
  goldMuted: '#8A6F2E',
  white: '#F5F0E8',
  muted: '#9A8A7A',
  success: '#2E7D32',
  warning: '#E65100',
  info: '#1565C0',
} as const;

export type ColorToken = keyof typeof Colors;

// Bordas/fundos dos cards de mesa — espelha as classes Tailwind de
// TableCard no frontend original (ex.: "border-green-800/50 bg-green-950/20").
export const TableCardPalette = {
  LIVRE: { border: 'rgba(22,101,52,0.5)', bg: 'rgba(5,46,22,0.2)' },
  OCUPADA: { border: 'rgba(139,26,26,0.5)', bg: 'rgba(139,26,26,0.1)' },
  CONTA: { border: 'rgba(126,34,206,0.6)', bg: 'rgba(59,7,100,0.3)' },
  RESERVADA: { border: 'rgba(30,64,175,0.5)', bg: 'rgba(23,37,84,0.2)' },
  LIMPEZA: { border: 'rgba(133,77,14,0.5)', bg: 'rgba(66,32,6,0.2)' },
} as const;

// Badges de status (mesas + pedidos) — espelha BADGE_COLORS do frontend original.
export const StatusPalette = {
  LIVRE: { bg: 'rgba(20,83,45,0.4)', border: '#166534', text: '#4ade80' },
  OCUPADA: { bg: 'rgba(139,26,26,0.2)', border: 'rgba(139,26,26,0.4)', text: '#f87171' },
  CONTA: { bg: 'rgba(88,28,135,0.4)', border: '#7e22ce', text: '#d8b4fe' },
  RESERVADA: { bg: 'rgba(30,58,138,0.4)', border: '#1e40af', text: '#60a5fa' },
  LIMPEZA: { bg: 'rgba(113,63,18,0.4)', border: '#854d0e', text: '#facc15' },
  ABERTO: { bg: 'rgba(20,83,45,0.4)', border: '#166534', text: '#4ade80' },
  PREPARANDO: { bg: 'rgba(113,63,18,0.4)', border: '#854d0e', text: '#facc15' },
  PRONTO: { bg: 'rgba(30,58,138,0.4)', border: '#1e40af', text: '#60a5fa' },
  FECHAMENTO: { bg: 'rgba(88,28,135,0.4)', border: '#7e22ce', text: '#d8b4fe' },
  FINALIZADO: { bg: '#1f2937', border: '#374151', text: '#9ca3af' },
  CANCELADO: { bg: '#450a0a', border: '#7f1d1d', text: '#ef4444' },
  PENDENTE: { bg: 'rgba(124,45,18,0.4)', border: '#9a3412', text: '#fb923c' },
  // Não existe no BADGE_COLORS do frontend original — cor própria (item
  // entregue à mesa, depois de PRONTO).
  ENTREGUE: { bg: '#1f2937', border: '#374151', text: '#9ca3af' },
  // Status de senha da fila (queue) que não se repetem com os de mesa/pedido.
  AGUARDANDO: { bg: 'rgba(113,63,18,0.4)', border: '#854d0e', text: '#facc15' },
  CHAMADO: { bg: 'rgba(30,58,138,0.4)', border: '#1e40af', text: '#60a5fa' },
  SENTADO: { bg: 'rgba(20,83,45,0.4)', border: '#166534', text: '#4ade80' },
  // Status do caixa (sessão aberta/fechada).
  FECHADO: { bg: '#1f2937', border: '#374151', text: '#9ca3af' },
} as const;

export type StatusKey = keyof typeof StatusPalette;

// Nomes das famílias registradas por @expo-google-fonts/* via useFonts().
export const Fonts = {
  displayBold: 'PlayfairDisplay_700Bold',
  displaySemiBold: 'PlayfairDisplay_600SemiBold',
  displayRegular: 'PlayfairDisplay_400Regular',
  bodyLight: 'DMSans_300Light',
  bodyRegular: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemiBold: 'DMSans_600SemiBold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
} as const;
