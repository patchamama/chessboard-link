import { useCallback, useMemo } from 'react'
import type { GameTree, GameNode } from '@chess-ebook/chess-shared'
import { useStudyBoardStore } from '../store/studyBoardStore'
import { variationLinesFrom } from '../utils/proseChess'

const STANDARD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export interface StudyNavResult {
  fen: string
  lastMove: { from: string; to: string } | null
  node: GameNode | null
  canPrev: boolean
  canNext: boolean
  /** the mainline node that `next()` would advance to (the chooser's "Mainline") */
  successorId: string | null
  /** the mainline successor of the current node also has variation alternatives */
  hasChoiceAhead: boolean
  /** variation lines that branch from the successor (each line is an array of node ids) */
  siblingLines: string[][]
  goStart: () => void
  prev: () => void
  next: () => void
  /** enter the i-th variation line that replaces the current node's successor */
  enterLine: (lineIndex: number) => void
  variationUp: () => void
  variationDown: () => void
}

/** Find the variation line (and its key) that contains a given node id. */
function findContainingLine(
  tree: GameTree,
  nodeId: string,
): { parentId: string; lineIndex: number; line: string[] } | null {
  for (const [parentId, lines] of tree.variations) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(nodeId)) return { parentId, lineIndex: i, line: lines[i] }
    }
  }
  return null
}

export function useStudyNavigation(): StudyNavResult {
  const tree = useStudyBoardStore((s) => s.activeGame)
  const currentNodeId = useStudyBoardStore((s) => s.currentNodeId)
  const isInVariation = useStudyBoardStore((s) => s.isInVariation)
  const setCurrentNode = useStudyBoardStore((s) => s.setCurrentNode)

  const node = useMemo(
    () => (tree && currentNodeId ? tree.nodes.get(currentNodeId) ?? null : null),
    [tree, currentNodeId],
  )

  const fen = node?.fen ?? tree?.startFen ?? STANDARD_FEN
  const lastMove = node && node.from ? { from: node.from, to: node.to } : null

  // The mainline successor of the current node (or the first mainline move at start).
  const successorId = useMemo<string | null>(() => {
    if (!tree) return null
    if (!currentNodeId) return tree.mainline[0] ?? null
    if (isInVariation) {
      const found = findContainingLine(tree, currentNodeId)
      if (found) {
        const idx = found.line.indexOf(currentNodeId)
        return idx >= 0 && idx < found.line.length - 1 ? found.line[idx + 1] : null
      }
      return null
    }
    const idx = tree.mainline.indexOf(currentNodeId)
    return idx >= 0 && idx < tree.mainline.length - 1 ? tree.mainline[idx + 1] : null
  }, [tree, currentNodeId, isInVariation])

  // Variation lines that branch FROM the current node — i.e. whose first move is
  // a sibling of `successorId` (same parent = the current node). The fork happens
  // AT the current node: the next move is either `successorId` or one of these.
  const siblingLines = useMemo<string[][]>(
    () => (tree && node ? variationLinesFrom(tree, node) : []),
    [tree, node],
  )

  // A fork exists whenever the current node has variation lines branching from it.
  const hasChoiceAhead = successorId !== null && siblingLines.length > 0

  const canNext = successorId !== null
  const canPrev = currentNodeId !== null

  const goStart = useCallback(() => setCurrentNode(null, false), [setCurrentNode])

  const next = useCallback(() => {
    if (!successorId) return
    setCurrentNode(successorId, isInVariation)
  }, [successorId, isInVariation, setCurrentNode])

  const prev = useCallback(() => {
    if (!tree || !currentNodeId) return
    if (isInVariation) {
      const found = findContainingLine(tree, currentNodeId)
      if (found) {
        const idx = found.line.indexOf(currentNodeId)
        if (idx > 0) {
          setCurrentNode(found.line[idx - 1], true)
          return
        }
        // first node of the line — go back to the shared parent (on the mainline)
        const parent = tree.nodes.get(currentNodeId)?.parentId ?? null
        setCurrentNode(parent, false)
        return
      }
    }
    const idx = tree.mainline.indexOf(currentNodeId)
    if (idx <= 0) setCurrentNode(null, false)
    else setCurrentNode(tree.mainline[idx - 1], false)
  }, [tree, currentNodeId, isInVariation, setCurrentNode])

  const enterLine = useCallback(
    (lineIndex: number) => {
      const line = siblingLines[lineIndex]
      if (line && line.length > 0) setCurrentNode(line[0], true)
    },
    [siblingLines, setCurrentNode],
  )

  // Cycle through sibling continuations at the current branch point:
  // index 0 = mainline successor, 1..n = variation lines.
  const cycleSibling = useCallback(
    (dir: 1 | -1) => {
      if (!tree || !successorId) return
      const options: string[] = [successorId, ...siblingLines.map((l) => l[0]).filter(Boolean)]
      if (options.length < 2) return
      // Which option are we currently heading toward? Default mainline (0).
      const current = 0
      const nextIdx = (current + dir + options.length) % options.length
      const target = options[nextIdx]
      const inVar = nextIdx > 0
      setCurrentNode(target, inVar)
    },
    [tree, successorId, siblingLines, setCurrentNode],
  )

  const variationUp = useCallback(() => cycleSibling(-1), [cycleSibling])
  const variationDown = useCallback(() => cycleSibling(1), [cycleSibling])

  return {
    fen,
    lastMove,
    node,
    canPrev,
    canNext,
    successorId,
    hasChoiceAhead,
    siblingLines,
    goStart,
    prev,
    next,
    enterLine,
    variationUp,
    variationDown,
  }
}
