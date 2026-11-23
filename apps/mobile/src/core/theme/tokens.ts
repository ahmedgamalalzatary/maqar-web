// Colour tokens from contract §6.2. Navy and cream follow the brand book (assets/mqr-branding.pdf, 2026-11-23).

const brand = { navy: '#121c27', gold: '#b38959', cream: '#f3efe7', sage: '#61766d' };

export const light = {
  ...brand,
  bg: '#f6f2e9',
  surface: '#ffffff',
  surface2: '#efe9dc',
  surface3: '#e6dfcf',
  ink: '#121c27',
  ink2: '#56616c',
  ink3: '#8a929a',
  line: 'rgba(18, 28, 39, 0.08)',
  line2: 'rgba(18, 28, 39, 0.14)',
  accent: '#b38959',
  accentInk: '#87633a',
  accentSoft: 'rgba(179, 137, 89, 0.14)',
  sageInk: '#4d6158',
  sageSoft: 'rgba(97, 118, 109, 0.14)',
  danger: '#c2453a',
  dangerSoft: 'rgba(194, 69, 58, 0.12)',
  success: '#3f7d5c',
  successSoft: 'rgba(63, 125, 92, 0.13)',
  /** The cream layer of the logo turns navy on light backgrounds. */
  logoCream: '#121c27',
};

export type Colors = typeof light;

export const dark: Colors = {
  ...brand,
  bg: '#121c27',
  surface: '#1a2634',
  surface2: '#223041',
  surface3: '#2b3a4c',
  ink: '#f3efe7',
  ink2: '#a4adb6',
  ink3: '#6f7b87',
  line: 'rgba(243, 239, 231, 0.07)',
  line2: 'rgba(243, 239, 231, 0.14)',
  accent: '#c9a06e',
  accentInk: '#d8b483',
  accentSoft: 'rgba(201, 160, 110, 0.14)',
  sageInk: '#9bb3a7',
  sageSoft: 'rgba(143, 167, 155, 0.14)',
  danger: '#e2766b',
  dangerSoft: 'rgba(226, 118, 107, 0.14)',
  success: '#6dbb8f',
  successSoft: 'rgba(109, 187, 143, 0.14)',
  logoCream: '#f3efe7',
};

export const radius = { sm: 10, md: 16, lg: 24, full: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

/** Readex Pro covers Arabic and Latin (contract §6.1). One family per weight. */
export const fonts = {
  regular: 'ReadexPro_400Regular',
  medium: 'ReadexPro_500Medium',
  semibold: 'ReadexPro_600SemiBold',
  bold: 'ReadexPro_700Bold',
} as const;
