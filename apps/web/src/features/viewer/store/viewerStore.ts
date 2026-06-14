import { create } from 'zustand'

interface ViewerState {
  /** currentNodeId per treeId (null = at start position) */
  currentNodeId: Record<string, string | null>
  orientation: 'white' | 'black'
  /** whether viewer is currently inside a variation per treeId */
  isInVariation: Record<string, boolean>
  /** last treeId the user interacted with (for keyboard navigation) */
  activeTreeId: string | null
  /** FEN sent to the study board when user clicks a move in the reader */
  studyFen: string | null

  selectNode: (treeId: string, nodeId: string, inVariation: boolean) => void
  flipOrientation: () => void
  goToStart: (treeId: string) => void
  setActiveTree: (treeId: string) => void
  setStudyFen: (fen: string) => void
}

export const useViewerStore = create<ViewerState>((set) => ({
  currentNodeId: {},
  orientation: 'white',
  isInVariation: {},
  activeTreeId: null,
  studyFen: null,

  selectNode: (treeId, nodeId, inVariation) =>
    set((s) => ({
      currentNodeId: { ...s.currentNodeId, [treeId]: nodeId },
      isInVariation: { ...s.isInVariation, [treeId]: inVariation },
      activeTreeId: treeId,
    })),

  flipOrientation: () =>
    set((s) => ({ orientation: s.orientation === 'white' ? 'black' : 'white' })),

  goToStart: (treeId) =>
    set((s) => ({
      currentNodeId: { ...s.currentNodeId, [treeId]: null },
      isInVariation: { ...s.isInVariation, [treeId]: false },
    })),

  setActiveTree: (treeId) => set({ activeTreeId: treeId }),
  setStudyFen: (fen) => set({ studyFen: fen }),
}))
