/**
 * Serialise a GameTree back to PGN-style move text, with variations in
 * parentheses and NO prose — just the moves. Walks the node tree: the mainline
 * is the spine; each branch point's variation lines are emitted as "( … )"
 * right after the move they replace.
 */

import { type GameTree, type GameNode } from '../model/gameTree.js';

/** Format one ply's number prefix: "5." for white, "5..." for black. */
function numberPrefix(node: GameNode, forceBlackDots: boolean): string {
  if (node.color === 'white') return `${node.moveNumber}. `;
  // Black move: only print "N..." when it starts a line/variation or follows a
  // variation; otherwise the preceding white move already implied the number.
  return forceBlackDots ? `${node.moveNumber}... ` : '';
}

export function treeToPgn(tree: GameTree): string {
  const out: string[] = [];

  // Emit one line of node ids. Variations anchored at a node N are alternatives
  // to the NEXT move in this line (they share N as parent), so they print right
  // after that next move — "2. Nf3 (2. f4 exf4) 2... Nc6". `anchorBefore` is the
  // parent id whose variations should fire after THIS node.
  const emitLine = (ids: string[], startsLine: boolean, anchorBefore: string | null) => {
    let needNumber = startsLine;
    ids.forEach((id, i) => {
      const node = tree.nodes.get(id);
      if (!node) return;
      const forceDots = node.color === 'black' && (needNumber || i === 0);
      out.push(numberPrefix(node, forceDots) + (node.rawSan ?? node.san));
      needNumber = false;

      // Variations whose parent is this node's parent are alternatives to THIS
      // move; print them now (skip the line that is this node's own).
      const altKey = (i === 0 ? anchorBefore : ids[i - 1]) ?? (node.parentId ?? 'root');
      const alts = (tree.variations.get(altKey) ?? []).filter((line) => line[0] !== id);
      for (const line of alts) {
        out.push('(');
        emitLine(line, true, altKey === 'root' ? null : altKey);
        out.push(')');
        needNumber = true;
      }
    });
  };

  emitLine(tree.mainline, true, null);

  // Join, then tidy spaces around parentheses.
  return out
    .join(' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+/g, ' ')
    .trim();
}
