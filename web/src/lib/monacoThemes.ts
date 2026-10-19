/**
 * Warm Monaco themes for Hafa Code's code surface. Both themes sit on the dark
 * `--surface-code` color (the editor stays dark in light mode, like the terminal),
 * so the caret and selection use the on-dark focus color for contrast.
 * Values mirror the CSS tokens in App.css; Monaco cannot read CSS variables.
 */
type ThemeRule = { token: string; foreground?: string; fontStyle?: string }
type ThemeData = {
  base: 'vs-dark'
  inherit: boolean
  rules: ThemeRule[]
  colors: Record<string, string>
}

export type HafaEditorTheme = 'hafa-light' | 'hafa-dark'

const syntax: ThemeRule[] = [
  { token: '', foreground: 'f3eadc' },
  { token: 'comment', foreground: 'a89a8c', fontStyle: 'italic' },
  { token: 'keyword', foreground: 'ff9b85' },
  { token: 'keyword.control', foreground: 'ff9b85' },
  { token: 'string', foreground: 'f8c77a' },
  { token: 'string.escape', foreground: 'ffd9a0' },
  { token: 'number', foreground: '9fe0d4' },
  { token: 'regexp', foreground: 'f8c77a' },
  { token: 'type', foreground: '9fe0d4' },
  { token: 'type.identifier', foreground: '9fe0d4' },
  { token: 'identifier', foreground: 'f3eadc' },
  { token: 'delimiter', foreground: 'c9bcae' },
  { token: 'operator', foreground: 'c9bcae' },
  { token: 'tag', foreground: 'ff9b85' },
  { token: 'attribute.name', foreground: 'f8c77a' },
  { token: 'attribute.value', foreground: '9fe0d4' },
  { token: 'predefined', foreground: 'ffd38a' },
  { token: 'variable', foreground: 'f3eadc' },
  { token: 'constant', foreground: '9fe0d4' },
]

function themeFor(surface: string, raised: string): ThemeData {
  return {
    base: 'vs-dark',
    inherit: true,
    rules: syntax,
    colors: {
      'editor.background': surface,
      'editor.foreground': '#f3eadc',
      'editorLineNumber.foreground': '#8a7d70',
      'editorLineNumber.activeForeground': '#e5d8cb',
      'editorCursor.foreground': '#7dd3c7',
      'editor.selectionBackground': '#7dd3c740',
      'editor.inactiveSelectionBackground': '#7dd3c722',
      'editor.lineHighlightBackground': raised,
      'editor.lineHighlightBorder': '#00000000',
      'editorIndentGuide.background1': '#ffffff12',
      'editorIndentGuide.activeBackground1': '#ffffff2e',
      'editorBracketMatch.background': '#7dd3c726',
      'editorBracketMatch.border': '#7dd3c780',
      'editorWidget.background': raised,
      'editorWidget.border': '#3a332d',
      'editorSuggestWidget.background': raised,
      'editorSuggestWidget.selectedBackground': '#2e2721',
      'focusBorder': '#7dd3c7',
      'scrollbarSlider.background': '#f3eadc1f',
      'scrollbarSlider.hoverBackground': '#f3eadc33',
      'editorError.foreground': '#ff9b85',
      'editorWarning.foreground': '#ffd38a',
    },
  }
}

export const HAFA_EDITOR_THEMES: Record<HafaEditorTheme, ThemeData> = {
  'hafa-light': themeFor('#17130f', '#211c17'),
  'hafa-dark': themeFor('#0f0d0b', '#1a1612'),
}

type MonacoLike = { editor: { defineTheme: (name: string, data: ThemeData) => void } }

export function defineHafaEditorThemes(monaco: MonacoLike) {
  for (const [name, data] of Object.entries(HAFA_EDITOR_THEMES)) monaco.editor.defineTheme(name, data)
}

export function editorThemeFor(resolvedTheme: 'light' | 'dark'): HafaEditorTheme {
  return resolvedTheme === 'dark' ? 'hafa-dark' : 'hafa-light'
}
