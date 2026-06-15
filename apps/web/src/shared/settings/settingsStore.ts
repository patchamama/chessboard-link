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

export type AppTheme = 'light' | 'dark'

export const APP_THEME_PRESETS: Record<AppTheme, { bgColor: string; textColor: string; label: string }> = {
  light: { bgColor: '#ffffff', textColor: '#1a1a1a', label: 'Light' },
  dark:  { bgColor: '#1a1a1a', textColor: '#e8e8e8', label: 'Dark'  },
}

export type PieceTheme =
  | 'default'
  | 'alpha'
  | 'merida'
  | 'leipzig'
  | 'maestro'
  | 'fantasy'
  | 'cardinal'
  | 'staunty'

export const PIECE_THEMES: Record<PieceTheme, { label: string }> = {
  default:  { label: 'Default'  },
  alpha:    { label: 'Alpha'    },
  merida:   { label: 'Merida'   },
  leipzig:  { label: 'Leipzig'  },
  maestro:  { label: 'Maestro'  },
  fantasy:  { label: 'Fantasy'  },
  cardinal: { label: 'Cardinal' },
  staunty:  { label: 'Staunty'  },
}

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
  /** Show the engine best-move arrow while the engine is active. */
  showEngineArrow: boolean
  fontFamily: FontFamily
  fontSize: number        // 12–22 px
  bgColor: string         // hex
  textColor: string       // hex
  marginH: number         // horizontal padding rem (0–6)
  epub: EpubLayout
  /** Light/dark preset selector for bg/text colors. */
  appTheme: AppTheme
  /** Piece sprite set. */
  pieceTheme: PieceTheme
  /** Width in px of the study-board side panel (drag-resizable). */
  studyPanelWidth: number
  /** Show file/rank coordinate labels (a–h / 1–8). */
  showBoardLabels: boolean
  /** Tint the whole last-move square instead of a subtle dot. */
  fullSquareHighlight: boolean
  /** Play a short sound when navigating moves. */
  playMoveSound: boolean
  /** Delay in seconds between autoplayed moves. */
  autoplayDelay: number
  /** Board color theme used when regenerating book diagram images. */
  diagramBoardTheme: BoardTheme
  /** Piece set used when regenerating book diagram images. */
  diagramPieceTheme: PieceTheme
  /** Draw file/rank coordinate symbols on regenerated book diagrams. */
  diagramCoordinates: boolean
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
  showEngineArrow: true,
  fontFamily: 'serif',
  fontSize: 16,
  bgColor: '#ffffff',
  textColor: '#1a1a1a',
  marginH: 2,
  epub: DEFAULT_EPUB,
  appTheme: 'light',
  pieceTheme: 'default',
  studyPanelWidth: 320,
  showBoardLabels: true,
  fullSquareHighlight: true,
  playMoveSound: true,
  autoplayDelay: 1,
  diagramBoardTheme: 'classic',
  diagramPieceTheme: 'merida',
  diagramCoordinates: false,
}

interface SettingsStore extends AppSettings {
  set: (patch: Partial<AppSettings>) => void
  /** Switch app theme AND apply its bg/text color preset in one shot. */
  applyAppTheme: (theme: AppTheme) => void
  reset: () => void
}

/**
 * Merge persisted state over the current (default-seeded) state so any setting
 * added after a user first saved — e.g. `showEngineArrow` — keeps its default
 * instead of hydrating as `undefined`. Defaults first, persisted values on top.
 */
export function mergeWithDefaults(
  current: SettingsStore,
  persisted: unknown,
): SettingsStore {
  return { ...current, ...(persisted as Partial<SettingsStore> | undefined) }
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT,
      set: (patch) => set((s) => ({ ...s, ...patch })),
      applyAppTheme: (theme) =>
        set((s) => ({
          ...s,
          appTheme: theme,
          bgColor: APP_THEME_PRESETS[theme].bgColor,
          textColor: APP_THEME_PRESETS[theme].textColor,
        })),
      reset: () => set({ ...DEFAULT }),
    }),
    {
      name: 'chessreader-settings',
      merge: (persisted, current) => mergeWithDefaults(current as SettingsStore, persisted),
    },
  ),
)
