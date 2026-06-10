import { describe, it, expect, beforeEach } from 'vitest';
import { tokenize } from '../../notation/sanTokenizer.js';
import { buildGameTree, resetNodeCounter } from '../../pgn/pgnToTree.js';
import { mainlineNodes, pathToNode } from '../../model/gameTree.js';

beforeEach(() => resetNodeCounter());

function buildFromText(text: string) {
  return buildGameTree(tokenize(text));
}

describe('buildGameTree', () => {
  it('builds a simple mainline', () => {
    const tree = buildFromText('1. e4 e5 2. Nf3 Nc6');
    const nodes = mainlineNodes(tree);
    expect(nodes).toHaveLength(4);
    expect(nodes.map(n => n.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
  });

  it('sets correct from/to squares', () => {
    const tree = buildFromText('1. e4');
    const nodes = mainlineNodes(tree);
    expect(nodes[0].from).toBe('e2');
    expect(nodes[0].to).toBe('e4');
  });

  it('sets FEN on each node', () => {
    const tree = buildFromText('1. e4');
    const node = mainlineNodes(tree)[0];
    expect(node.fen).toMatch(/RNBQKBNR/);
    expect(node.fen).toContain('4P3');
  });

  it('sets move number and color', () => {
    const tree = buildFromText('1. e4 e5 2. Nf3 Nc6');
    const nodes = mainlineNodes(tree);
    expect(nodes[0]).toMatchObject({ moveNumber: 1, color: 'white' });
    expect(nodes[1]).toMatchObject({ moveNumber: 1, color: 'black' });
    expect(nodes[2]).toMatchObject({ moveNumber: 2, color: 'white' });
    expect(nodes[3]).toMatchObject({ moveNumber: 2, color: 'black' });
  });

  it('stops mainline at illegal move (invalid node not in mainline)', () => {
    const tree = buildFromText('1. e4 e5 2. Nc4');
    const nodes = mainlineNodes(tree);
    // Invalid node is kept in tree.nodes for reference but NOT in mainline
    const invalidNode = Array.from(tree.nodes.values()).find(n => n.san === 'Nc4');
    expect(invalidNode).toBeDefined();
    expect(invalidNode?.invalid).toBe(true);
    // Mainline has only the 2 valid moves
    expect(nodes).toHaveLength(2);
    expect(nodes.map(n => n.san)).toEqual(['e4', 'e5']);
  });

  it('handles castling', () => {
    const tree = buildFromText('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O');
    const nodes = mainlineNodes(tree);
    const castleNode = nodes.find(n => n.san === 'O-O');
    expect(castleNode).toBeDefined();
    expect(castleNode?.from).toBe('e1');
    expect(castleNode?.to).toBe('g1');
  });

  it('builds a variation and returns to mainline', () => {
    const tree = buildFromText('1. e4 e5 2. Nf3 (2. d4) 2... Nc6');
    const mainNodes = mainlineNodes(tree);
    // mainline: e4, e5, Nf3, Nc6
    expect(mainNodes.map(n => n.san)).toContain('Nf3');
    expect(mainNodes.map(n => n.san)).toContain('Nc6');
    // variation exists
    expect(tree.variations.size).toBeGreaterThan(0);
    // Find d4 in variations
    const allNodes = Array.from(tree.nodes.values());
    const d4 = allNodes.find(n => n.san === 'd4');
    expect(d4).toBeDefined();
  });

  it('supports nested variations', () => {
    const tree = buildFromText('1. e4 e5 2. Nf3 (2. d4 (2. c4)) 2... Nc6');
    const allNodes = Array.from(tree.nodes.values());
    expect(allNodes.some(n => n.san === 'd4')).toBe(true);
    expect(allNodes.some(n => n.san === 'c4')).toBe(true);
    // mainline should still have e4, e5, Nf3, Nc6
    const main = mainlineNodes(tree);
    expect(main.map(n => n.san)).toContain('Nc6');
  });

  it('computes path to a node', () => {
    const tree = buildFromText('1. e4 e5 2. Nf3');
    const nf3 = mainlineNodes(tree).find(n => n.san === 'Nf3')!;
    const path = pathToNode(tree, nf3.id);
    expect(path).toHaveLength(3); // e4 -> e5 -> Nf3
    const nodesInPath = path.map(id => tree.nodes.get(id)!.san);
    expect(nodesInPath).toEqual(['e4', 'e5', 'Nf3']);
  });
});
