import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Board color themes
export type BoardTheme =
  | 'classic'   // brown / beige
  | 'blue'      // steel blue
  | 'green'     // green felt
  | 'purple'    // purple
  | 'gray'      // monochrome
  | 'coral'     // coral / cream

export const BOARD_THEMES: Record<BoardTheme, { light: string; dark: string; label: string }> = {
  classic: { light: '#f0d9b5', dark: '#b58863', label: 'Classic' },
  blue:    { light: '#dee3e6', dark: '#5a80a7', label: 'Blue' },
  green:   { light: '#ffffdd', dark: '#86a666', label: 'Green' },
  purple:  { light: '#e8d9f0', dark: '#8e55a0', label: 'Purple' },
  gray:    { light: '#e0e0e0', dark: '#7a7a7a', label: 'Gray' },
  coral:   { light: '#fef0e6', dark: '#cc7755', label: 'Coral' },
}

export type EvalBarDirection = 'horizontal' | 'vertical'

export type StockfishVersion = 'sf10-jsdelivr' | 'sf16-jsdelivr' | 'sf10-cdnjs' | 'sf9-cdnjs'

export const STOCKFISH_VERSIONS: Record<StockfishVersion, { url: string; label: string }> = {
  'sf10-jsdelivr': {
    url: 'https://cdn.jsdelivr.net/npm/stockfish.js@10/stockfish.js',
    label: 'Stockfish 10 (jsDelivr)',
  },
  'sf16-jsdelivr': {
    url: 'https://cdn.jsdelivr.net/npm/stockfish@16/src/stockfish-nnue-16-single.js',
    label: 'Stockfish 16 (jsDelivr)',
  },
  'sf10-cdnjs': {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js',
    label: 'Stockfish 10 (cdnjs)',
  },
  'sf9-cdnjs': {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/9.0/stockfish.js',
    label: 'Stockfish 9 (cdnjs)',
  },
}

export type FontFamily = 'serif' | 'sans' | 'mono'
export const FONT_FAMILIES: Record<FontFamily, { css: string; label: string }> = {
  serif: { css: 'Georgia, Times New Roman, serif', label: 'Serif' },
  sans:  { css: 'Inter, system-ui, sans-serif',    label: 'Sans-serif' },
  mono:  { css: 'JetBrains Mono, Courier New, monospace', label: 'Monospace' },
}

export type ImageAlign = 'left' | 'center' | 'right'

export interface HeadingStyle {
  bold: boolean
  italic: boolean
  sizeDelta: number   // relative px offset from base font size (-4..+16)
}

export interface EpubLayout {
  h1: HeadingStyle
  h2: HeadingStyle
  h3: HeadingStyle
  h4: HeadingStyle
  h5: HeadingStyle
  paragraphSpacing: number   // rem between <p> tags (0–4)
  paragraphIndent: number    // rem text-indent for first line (0–4)
  imageAlign: ImageAlign
}

export type EngineVariations = 1 | 2 | 3

export interface AppSettings {
  boardTheme: BoardTheme
  evalBarDirection: EvalBarDirection
  stockfishVersion: StockfishVersion
  /** Master switch: ON → engine runs, eval panel + best-move arrow shown. */
  showEval: boolean
  /** Target search depth (plies). Progressive analysis ramps up to this value. */
  engineDepth: number
  /** Number of principal variations to compute (MultiPV), 1–3. */
  engineVariations: EngineVariations
  /** Hide the engine best-move arrow even while the engine is active. */
  hideEngineArrow: boolean
  fontFamily: FontFamily
  fontSize: number        // 12–22 px
  bgColor: string         // hex
  textColor: string       // hex
  marginH: number         // horizontal padding rem (0–6)
  epub: EpubLayout
}

const DEFAULT_EPUB: EpubLayout = {
  h1: { bold: true,  italic: false, sizeDelta: 10 },
  h2: { bold: true,  italic: false, sizeDelta: 6  },
  h3: { bold: true,  italic: false, sizeDelta: 3  },
  h4: { bold: true,  italic: false, sizeDelta: 1  },
  h5: { bold: false, italic: true,  sizeDelta: 0  },
  paragraphSpacing: 1,
  paragraphIndent: 1.5,
  imageAlign: 'center',
}

const DEFAULT: AppSettings = {
  boardTheme: 'blue',
  evalBarDirection: 'vertical',
  stockfishVersion: 'sf10-jsdelivr',
  showEval: true,
  engineDepth: 30,
  engineVariations: 1,
  hideEngineArrow: false,
  fontFamily: 'serif',
  fontSize: 16,
  bgColor: '#ffffff',
  textColor: '#1a1a1a',
  marginH: 2,
  epub: DEFAULT_EPUB,
}

interface SettingsStore extends AppSettings {
  set: (patch: Partial<AppSettings>) => void
  reset: () => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT,
      set: (patch) => set((s) => ({ ...s, ...patch })),
      reset: () => set({ ...DEFAULT }),
    }),
    { name: 'chessreader-settings' },
  ),
)
