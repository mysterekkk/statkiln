export interface Theme {
  name: string;
  description: string;
  bg1: string;
  bg2: string;
  border: string;
  title: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  track: string;
  /** Five contribution intensity levels, from empty to most active. */
  heat: [string, string, string, string, string];
}

export const THEMES: Record<string, Theme> = {
  midnight: {
    name: 'midnight',
    description: 'Elegant dark navy with violet accents',
    bg1: '#0f1030',
    bg2: '#1a1648',
    border: '#2e2a6b',
    title: '#f3f1ff',
    text: '#d9d6f5',
    muted: '#a6a3cf',
    accent: '#a78bfa',
    accent2: '#7c9cff',
    track: '#262260',
    heat: ['#221f55', '#3d32a0', '#5b47d6', '#8b6cf5', '#c4b0ff'],
  },
  light: {
    name: 'light',
    description: 'Clean, professional light theme',
    bg1: '#ffffff',
    bg2: '#f6f8fb',
    border: '#d0d7de',
    title: '#1f2328',
    text: '#31373d',
    muted: '#59636e',
    accent: '#0a69da',
    accent2: '#8250df',
    track: '#e6eaef',
    heat: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  },
  'github-dark': {
    name: 'github-dark',
    description: 'Close to the GitHub dark palette',
    bg1: '#0d1117',
    bg2: '#161b22',
    border: '#30363d',
    title: '#f0f6fc',
    text: '#c9d1d9',
    muted: '#9198a1',
    accent: '#58a6ff',
    accent2: '#3fb950',
    track: '#21262d',
    heat: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
  },
  aurora: {
    name: 'aurora',
    description: 'Subtle teal and violet gradients',
    bg1: '#0b1d26',
    bg2: '#1a1838',
    border: '#24455a',
    title: '#eafffb',
    text: '#cfeee9',
    muted: '#93bdb8',
    accent: '#2dd4bf',
    accent2: '#a78bfa',
    track: '#16323f',
    heat: ['#14303d', '#0f6a6e', '#139a9f', '#2dd4bf', '#a7f3e4'],
  },
  minimal: {
    name: 'minimal',
    description: 'Near-monochrome and quiet',
    bg1: '#0a0a0a',
    bg2: '#141414',
    border: '#2a2a2a',
    title: '#fafafa',
    text: '#d4d4d4',
    muted: '#a3a3a3',
    accent: '#fafafa',
    accent2: '#a3a3a3',
    track: '#262626',
    heat: ['#1c1c1c', '#404040', '#737373', '#a8a8a8', '#f5f5f5'],
  },
};

export const THEME_NAMES = Object.keys(THEMES);

export function getTheme(name: string): Theme {
  const theme = THEMES[name];
  if (!theme) throw new Error(`Unknown theme: ${name}`);
  return theme;
}
