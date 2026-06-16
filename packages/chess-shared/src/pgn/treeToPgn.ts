/**
 * Serialise a GameTree back to PGN-style move text, with variations in
 * parentheses and NO prose — just the moves. Walks the node tree: the mainline
 * is the spine; each branch point's variation lines are emitted as "( … )"
 * right after the move they replace.
 */

import { type GameTree, type GameNode } from '../model/gameTree.js';

export interface TreeToPgnOptions {
  /** Put each variation on its own line, indented 3 spaces per nesting depth. */
  multiline?: boolean;
}

/** Format one ply's number prefix: "5." for white, "5..." for black. */
function numberPrefix(node: GameNode, forceBlackDots: boolean): string {
  if (node.color === 'white') return `${node.moveNumber}. `;
  // Black move: only print "N..." when it starts a line/variation; otherwise the
  // preceding white move already implied the number.
  return forceBlackDots ? `${node.moveNumber}... ` : '';
}

/** Count the non-empty variation lines in a tree (for the debug panel). */
export function countVariations(tree: GameTree): number {
  let n = 0;
  for (const lines of tree.variations.values()) {
    for (const line of lines) if (line.length > 0) n++;
  }
  return n;
}

export function treeToPgn(tree: GameTree, options: TreeToPgnOptions = {}): string {
  const multiline = options.multiline ?? false;
  const tokens: string[] = [];
  // Guard against cycles / double emission: each variation line is emitted once.
  const emitted = new Set<string[]>();

  const indent = (depth: number) => '   '.repeat(depth); // 3 spaces per depth

  const emitLine = (ids: string[], startsLine: boolean, depth: number) => {
    if (emitted.has(ids)) return;
    emitted.add(ids);

    let needNumber = startsLine;
    ids.forEach((id, i) => {
      const node = tree.nodes.get(id);
      if (!node) return;
      const forceDots = node.color === 'black' && (needNumber || i === 0);
      tokens.push(numberPrefix(node, forceDots) + (node.rawSan ?? node.san));
      needNumber = false;

      // Alternatives to THIS move hang off this move's parent.
      const altKey = node.parentId ?? 'root';
      const altLines = (tree.variations.get(altKey) ?? []).filter(
        (line) => line.length > 0 && line !== ids && !emitted.has(line) && line[0] !== id,
      );
      // Sub-variations keyed by this node print only when it is the line's last
      // node (otherwise its child carries them as altLines).
      const isLast = i === ids.length - 1;
      const subLines = isLast
        ? (tree.variations.get(id) ?? []).filter(
            (line) => line.length > 0 && line !== ids && !emitted.has(line),
          )
        : [];

      for (const line of [...altLines, ...subLines]) {
        // Re-check here: an earlier line in this loop may have emitted it. Without
        // this, emitLine returns early and leaves an empty "()".
        if (emitted.has(line) || line.length === 0) continue;
        const before = tokens.length;
        tokens.push(multiline ? '\n' + indent(depth + 1) + '(' : '(');
        emitLine(line, true, depth + 1);
        if (tokens.length === before + 1) {
          tokens.pop(); // nothing emitted → drop the empty parens
        } else {
          tokens.push(')');
          needNumber = true;
        }
      }
    });
  };

  emitLine(tree.mainline, true, 0);

  // Join with single spaces, but never put a space right after a "(" or before
  // a ")", and preserve our explicit "\n<indent>(" line breaks verbatim.
  let result = '';
  for (const tok of tokens) {
    if (tok === ')') {
      result = result.replace(/\s+$/, '') + ')';
    } else if (tok === '(' || tok.startsWith('\n')) {
      result += (result && !result.endsWith('\n') && !tok.startsWith('\n') ? ' ' : '') + tok;
    } else {
      result += (result && !result.endsWith('(') && !result.endsWith('\n') ? ' ' : '') + tok;
    }
  }
  void multiline;
  return result.trim();
}
