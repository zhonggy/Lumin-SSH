// ── 终端主题定义（深色/浅色两套配色） ──────────────────────────────────────────────
// 四个主题：Lumin Default / Tokyo Night / Catppuccin / Dracula
// 每个主题含 dark 和 light 两套变体，自动跟随 App 浅色/深色模式切换

const TERMINAL_THEMES = {
  'lumin': {
    name: 'Lumin Default',
    swatches: ['#22c55e', '#58a6ff', '#bc8cff', '#0d1117'],
    dark: {
      xterm: {
        background: '#00000000', foreground: '#cdd9e5', cursor: '#22c55e',
        cursorAccent: '#0d1117', selectionBackground: 'rgba(34,197,94,0.40)',
        selectionForeground: '#ffffff',
        black: '#484f58', red: '#ff7b72', green: '#3fb950', yellow: '#d29922',
        blue: '#58a6ff', magenta: '#bc8cff', cyan: '#39c5cf', white: '#b1bac4',
        brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364',
        brightYellow: '#e3b341', brightBlue: '#79c0ff', brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd', brightWhite: '#f0f6fc',
      },
      container: {
        containerBg: '#0d1117', statusBarBg: 'rgba(22,27,34,0.75)', statusBarBorder: '1px solid rgba(255,255,255,0.06)',
        statusBarColor: '#8b949e', serverNameColor: '#cdd9e5',
        inputBarBg: 'rgba(22,27,34,0.85)', inputBarBorder: '1px solid rgba(255,255,255,0.06)',
        inputBg: 'rgba(13,17,23,0.8)', inputColor: '#cdd9e5', inputPlaceholder: '#484f58',
        popupBg: '#161b22', popupBorder: '1px solid rgba(48,54,61,0.9)',
        popupShadow: '0 -8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
        contextBg: '#161b22', contextBorder: '1px solid rgba(48,54,61,0.9)',
        contextShadow: '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
        separator: 'rgba(255,255,255,0.06)', mutedColor: '#6e7681',
        btnBorder: 'rgba(255,255,255,0.08)', btnMuted: '#484f58',
      },
    },
    light: {
      xterm: {
        background: '#00000000', foreground: '#1f2328', cursor: '#0969da',
        cursorAccent: '#ffffff', selectionBackground: 'rgba(9,105,218,0.30)',
        selectionForeground: '#ffffff',
        black: '#24292f', red: '#cf222e', green: '#1a7f37', yellow: '#9a6700',
        blue: '#0969da', magenta: '#8250df', cyan: '#1b7c83', white: '#6e7781',
        brightBlack: '#57606a', brightRed: '#a40e26', brightGreen: '#2da44e',
        brightYellow: '#bf8700', brightBlue: '#218bff', brightMagenta: '#a475f9',
        brightCyan: '#3192aa', brightWhite: '#8c959f',
      },
      container: {
        containerBg: '#ffffff', statusBarBg: 'rgba(246,248,250,0.92)', statusBarBorder: '1px solid rgba(0,0,0,0.08)',
        statusBarColor: '#57606a', serverNameColor: '#1f2328',
        inputBarBg: 'rgba(246,248,250,0.92)', inputBarBorder: '1px solid rgba(0,0,0,0.08)',
        inputBg: 'rgba(246,248,250,0.9)', inputColor: '#1f2328', inputPlaceholder: '#8c959f',
        popupBg: '#ffffff', popupBorder: '1px solid rgba(0,0,0,0.12)',
        popupShadow: '0 -8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
        contextBg: '#ffffff', contextBorder: '1px solid rgba(0,0,0,0.12)',
        contextShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        separator: 'rgba(0,0,0,0.08)', mutedColor: '#8c959f',
        btnBorder: 'rgba(0,0,0,0.12)', btnMuted: '#8c959f',
      },
    },
  },
  'tokyo-night': {
    name: 'Tokyo Night',
    swatches: ['#7aa2f7', '#bb9af7', '#73daca', '#1a1b26'],
    dark: {
      xterm: {
        background: '#00000000', foreground: '#a9b1d6', cursor: '#7aa2f7',
        cursorAccent: '#1a1b26', selectionBackground: 'rgba(122,162,247,0.40)',
        selectionForeground: '#ffffff',
        black: '#32344a', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68',
        blue: '#7aa2f7', magenta: '#ad8ee6', cyan: '#449dab', white: '#787c99',
        brightBlack: '#444b6a', brightRed: '#ff7a93', brightGreen: '#b9f27c',
        brightYellow: '#ff9e64', brightBlue: '#7da6ff', brightMagenta: '#bb9af7',
        brightCyan: '#0db9d7', brightWhite: '#acb0d0',
      },
      container: {
        containerBg: '#1a1b26', statusBarBg: 'rgba(26,27,38,0.85)', statusBarBorder: '1px solid rgba(255,255,255,0.06)',
        statusBarColor: '#787c99', serverNameColor: '#a9b1d6',
        inputBarBg: 'rgba(26,27,38,0.9)', inputBarBorder: '1px solid rgba(255,255,255,0.06)',
        inputBg: 'rgba(26,27,38,0.8)', inputColor: '#a9b1d6', inputPlaceholder: '#565f89',
        popupBg: '#1a1b26', popupBorder: '1px solid rgba(255,255,255,0.08)',
        popupShadow: '0 -8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
        contextBg: '#1a1b26', contextBorder: '1px solid rgba(255,255,255,0.08)',
        contextShadow: '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
        separator: 'rgba(255,255,255,0.06)', mutedColor: '#565f89',
        btnBorder: 'rgba(255,255,255,0.08)', btnMuted: '#565f89',
      },
    },
    light: {
      xterm: {
        background: '#00000000', foreground: '#343b58', cursor: '#2e7de9',
        cursorAccent: '#e1e2e7', selectionBackground: 'rgba(46,125,233,0.30)',
        selectionForeground: '#e1e2e7',
        black: '#343b58', red: '#8c4351', green: '#485e30', yellow: '#8f5e15',
        blue: '#2e7de9', magenta: '#7847bd', cyan: '#007197', white: '#848cb5',
        brightBlack: '#565a6e', brightRed: '#c64343', brightGreen: '#587539',
        brightYellow: '#c07c00', brightBlue: '#5a9bf6', brightMagenta: '#9854f1',
        brightCyan: '#2483a6', brightWhite: '#acb0d0',
      },
      container: {
        containerBg: '#e1e2e7', statusBarBg: 'rgba(225,226,231,0.92)', statusBarBorder: '1px solid rgba(0,0,0,0.08)',
        statusBarColor: '#848cb5', serverNameColor: '#343b58',
        inputBarBg: 'rgba(225,226,231,0.92)', inputBarBorder: '1px solid rgba(0,0,0,0.08)',
        inputBg: 'rgba(225,226,231,0.9)', inputColor: '#343b58', inputPlaceholder: '#848cb5',
        popupBg: '#e1e2e7', popupBorder: '1px solid rgba(0,0,0,0.12)',
        popupShadow: '0 -8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
        contextBg: '#e1e2e7', contextBorder: '1px solid rgba(0,0,0,0.12)',
        contextShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        separator: 'rgba(0,0,0,0.08)', mutedColor: '#848cb5',
        btnBorder: 'rgba(0,0,0,0.12)', btnMuted: '#848cb5',
      },
    },
  },
  'catppuccin': {
    name: 'Catppuccin',
    swatches: ['#cba6f7', '#89b4fa', '#a6e3a1', '#1e1e2e'],
    dark: {
      xterm: {
        background: '#00000000', foreground: '#cdd6f4', cursor: '#f5c2e7',
        cursorAccent: '#1e1e2e', selectionBackground: 'rgba(203,166,247,0.40)',
        selectionForeground: '#ffffff',
        black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
        blue: '#89b4fa', magenta: '#f5c2e7', cyan: '#94e2d5', white: '#bac2de',
        brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af', brightBlue: '#89b4fa', brightMagenta: '#f5c2e7',
        brightCyan: '#94e2d5', brightWhite: '#a6adc8',
      },
      container: {
        containerBg: '#1e1e2e', statusBarBg: 'rgba(30,30,46,0.85)', statusBarBorder: '1px solid rgba(255,255,255,0.06)',
        statusBarColor: '#bac2de', serverNameColor: '#cdd6f4',
        inputBarBg: 'rgba(30,30,46,0.9)', inputBarBorder: '1px solid rgba(255,255,255,0.06)',
        inputBg: 'rgba(30,30,46,0.8)', inputColor: '#cdd6f4', inputPlaceholder: '#585b70',
        popupBg: '#1e1e2e', popupBorder: '1px solid rgba(255,255,255,0.08)',
        popupShadow: '0 -8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
        contextBg: '#1e1e2e', contextBorder: '1px solid rgba(255,255,255,0.08)',
        contextShadow: '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
        separator: 'rgba(255,255,255,0.06)', mutedColor: '#585b70',
        btnBorder: 'rgba(255,255,255,0.08)', btnMuted: '#585b70',
      },
    },
    light: {
      xterm: {
        background: '#00000000', foreground: '#4c4f69', cursor: '#dc8a78',
        cursorAccent: '#eff1f5', selectionBackground: 'rgba(137,180,250,0.35)',
        selectionForeground: '#eff1f5',
        black: '#5c5f77', red: '#d20f39', green: '#40a02b', yellow: '#df8e1d',
        blue: '#1e66f5', magenta: '#8839ef', cyan: '#179299', white: '#acb0be',
        brightBlack: '#6c6f85', brightRed: '#e64553', brightGreen: '#40a02b',
        brightYellow: '#df8e1d', brightBlue: '#1e66f5', brightMagenta: '#8839ef',
        brightCyan: '#179299', brightWhite: '#bcc0cc',
      },
      container: {
        containerBg: '#eff1f5', statusBarBg: 'rgba(239,241,245,0.92)', statusBarBorder: '1px solid rgba(0,0,0,0.08)',
        statusBarColor: '#acb0be', serverNameColor: '#4c4f69',
        inputBarBg: 'rgba(239,241,245,0.92)', inputBarBorder: '1px solid rgba(0,0,0,0.08)',
        inputBg: 'rgba(239,241,245,0.9)', inputColor: '#4c4f69', inputPlaceholder: '#acb0be',
        popupBg: '#eff1f5', popupBorder: '1px solid rgba(0,0,0,0.12)',
        popupShadow: '0 -8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
        contextBg: '#eff1f5', contextBorder: '1px solid rgba(0,0,0,0.12)',
        contextShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        separator: 'rgba(0,0,0,0.08)', mutedColor: '#acb0be',
        btnBorder: 'rgba(0,0,0,0.12)', btnMuted: '#acb0be',
      },
    },
  },
  'dracula': {
    name: 'Dracula',
    swatches: ['#ff79c6', '#bd93f9', '#50fa7b', '#282a36'],
    dark: {
      xterm: {
        background: '#00000000', foreground: '#f8f8f2', cursor: '#f8f8f2',
        cursorAccent: '#282a36', selectionBackground: 'rgba(189,147,249,0.40)',
        selectionForeground: '#ffffff',
        black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
        blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
        brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94',
        brightYellow: '#ffffa5', brightBlue: '#d6acff', brightMagenta: '#ff92df',
        brightCyan: '#a4ffff', brightWhite: '#ffffff',
      },
      container: {
        containerBg: '#282a36', statusBarBg: 'rgba(40,42,54,0.85)', statusBarBorder: '1px solid rgba(255,255,255,0.06)',
        statusBarColor: '#6272a4', serverNameColor: '#f8f8f2',
        inputBarBg: 'rgba(40,42,54,0.9)', inputBarBorder: '1px solid rgba(255,255,255,0.06)',
        inputBg: 'rgba(40,42,54,0.8)', inputColor: '#f8f8f2', inputPlaceholder: '#6272a4',
        popupBg: '#282a36', popupBorder: '1px solid rgba(255,255,255,0.08)',
        popupShadow: '0 -8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
        contextBg: '#282a36', contextBorder: '1px solid rgba(255,255,255,0.08)',
        contextShadow: '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
        separator: 'rgba(255,255,255,0.06)', mutedColor: '#6272a4',
        btnBorder: 'rgba(255,255,255,0.08)', btnMuted: '#6272a4',
      },
    },
    light: {
      xterm: {
        background: '#00000000', foreground: '#282a36', cursor: '#282a36',
        cursorAccent: '#f8f8f2', selectionBackground: 'rgba(189,147,249,0.30)',
        selectionForeground: '#f8f8f2',
        black: '#282a36', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
        blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#6272a4',
        brightBlack: '#44475a', brightRed: '#ff6e6e', brightGreen: '#69ff94',
        brightYellow: '#ffffa5', brightBlue: '#d6acff', brightMagenta: '#ff92df',
        brightCyan: '#a4ffff', brightWhite: '#bfbfbf',
      },
      container: {
        containerBg: '#f8f8f2', statusBarBg: 'rgba(248,248,242,0.92)', statusBarBorder: '1px solid rgba(0,0,0,0.08)',
        statusBarColor: '#6272a4', serverNameColor: '#282a36',
        inputBarBg: 'rgba(248,248,242,0.92)', inputBarBorder: '1px solid rgba(0,0,0,0.08)',
        inputBg: 'rgba(248,248,242,0.9)', inputColor: '#282a36', inputPlaceholder: '#6272a4',
        popupBg: '#f8f8f2', popupBorder: '1px solid rgba(0,0,0,0.12)',
        popupShadow: '0 -8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
        contextBg: '#f8f8f2', contextBorder: '1px solid rgba(0,0,0,0.12)',
        contextShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        separator: 'rgba(0,0,0,0.08)', mutedColor: '#6272a4',
        btnBorder: 'rgba(0,0,0,0.12)', btnMuted: '#6272a4',
      },
    },
  },
};

// 检测 App 浅色/深色模式
function getAppThemeMode() {
  return localStorage.getItem('themeMode') || 'dark';
}

export function getTerminalTheme() {
  const key = localStorage.getItem('terminalColorTheme') || 'lumin';
  const theme = TERMINAL_THEMES[key] || TERMINAL_THEMES['lumin'];
  const mode = getAppThemeMode() === 'light' ? 'light' : 'dark';
  return theme[mode] || theme.dark;
}

export { TERMINAL_THEMES };