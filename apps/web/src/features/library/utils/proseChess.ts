import type { GameTree, GameNode } from '@chess-ebook/chess-shared'

/**
 * The node that follows `node` along its own line (mainline or a variation line).
 * Returns null if `node` is the last move of its line.
 */
export function successorOf(tree: GameTree, node: GameNode): string | null {
  const mi = tree.mainline.indexOf(node.id)
  if (mi >= 0) {
    return mi < tree.mainline.length - 1 ? tree.mainline[mi + 1] : null
  }
  for (const lines of tree.variations.values()) {
    for (const line of lines) {
      const i = line.indexOf(node.id)
      if (i >= 0) return i < line.length - 1 ? line[i + 1] : null
    }
  }
  return null
}

/**
 * Variation lines that BRANCH FROM `node` — i.e. whose first move is a sibling
 * of `node`'s own successor (same parent). The fork happens AT `node`: the next
 * move can be the mainline/line continuation OR one of these variation lines.
 *
 * This is keyed on the variation's first-move parentId rather than the
 * `tree.variations` map key, because the parser anchors variations in two ways
 * (re-anchored prose lines vs. inline parentheses) and the map key is not always
 * the branch node. The parent pointer is the single source of truth.
 */
export function variationLinesFrom(tree: GameTree, node: GameNode): string[][] {
  const lines: string[][] = []
  for (const group of tree.variations.values()) {
    for (const line of group) {
      const first = line[0] ? tree.nodes.get(line[0]) : undefined
      if (first && first.parentId === node.id) lines.push(line)
    }
  }
  return lines
}

/**
 * True when the NEXT move after `node` can be replaced by a variation — i.e.
 * there is at least one variation line branching from `node`. Drives both the
 * prose underline and the click-to-choose popover.
 */
export function hasAlternativesAhead(tree: GameTree, node: GameNode): boolean {
  return variationLinesFrom(tree, node).length > 0
}
