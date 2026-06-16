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
  // Black move: only print "N..." when it starts a line/variation; otherwise the
  // preceding white move already implied the number.
  return forceBlackDots ? `${node.moveNumber}... ` : '';
}

export function treeToPgn(tree: GameTree): string {
  const out: string[] = [];
  // Guard against cycles / double emission: each variation line is emitted once.
  const emitted = new Set<string[]>();

  // Emit one line of node ids. After each move, print the variation lines that
  // branch from THAT node (its parent-keyed alternatives are handled by the move
  // they replace — see below). `anchorBefore` is the key whose lines are the
  // alternatives to the FIRST move of this line.
  const emitLine = (ids: string[], startsLine: boolean, anchorBefore: string | null) => {
    if (emitted.has(ids)) return;
    emitted.add(ids);

    let needNumber = startsLine;
    ids.forEach((id, i) => {
      const node = tree.nodes.get(id);
      if (!node) return;
      const forceDots = node.color === 'black' && (needNumber || i === 0);
      out.push(numberPrefix(node, forceDots) + (node.rawSan ?? node.san));
      needNumber = false;

      // Variations stored under key K replace the child of K, so alternatives to
      // THIS move hang off this move's PARENT — print them after this move.
      const altKey = node.parentId ?? 'root';
      const altLines = (tree.variations.get(altKey) ?? []).filter(
        (line) => line !== ids && !emitted.has(line) && line[0] !== id,
      );
      // Sub-variations keyed by THIS node replace this node's child. If the next
      // node in THIS line is that child, it will print them as its own altLines,
      // so only emit them here when this is the last node of the line (no child
      // present to carry them) — this avoids printing them before the child.
      const isLast = i === ids.length - 1;
      const subLines = isLast
        ? (tree.variations.get(id) ?? []).filter((line) => line !== ids && !emitted.has(line))
        : [];

      for (const line of [...altLines, ...subLines]) {
        out.push('(');
        emitLine(line, true, null);
        out.push(')');
        needNumber = true;
      }
    });
  };

  emitLine(tree.mainline, true, null);

  return out
    .join(' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+/g, ' ')
    .trim();
}
