/**
 * Golden parity tests: load shared fixtures from fixtures/golden/
 * and assert the TS implementation produces matching trees.
 *
 * FEN comparison: we compare only the first 3 FEN fields (piece placement + active color + castling)
 * because chess.js and p-chess/chess differ on the EP square field.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { tokenize } from '../../notation/sanTokenizer.js';
import { spanishToEnglish } from '../../notation/spanishToEnglish.js';
import { buildGameTree } from '../../pgn/pgnToTree.js';
import { mainlineNodes } from '../../model/gameTree.js';

const FIXTURES_DIR = resolve(__dirname, '../../../../../fixtures/golden');

function loadFixture(name: string) {
  return JSON.parse(readFileSync(resolve(FIXTURES_DIR, name), 'utf8'));
}

function fenFields123(fen: string): string {
  return fen.split(' ').slice(0, 3).join(' ');
}

function buildFromFixture(inputText: string) {
  const normalised = spanishToEnglish(inputText);
  const tokens = tokenize(normalised);
  return buildGameTree(tokens);
}

describe('Golden parity: simple-mainline', () => {
  const fixture = loadFixture('simple-mainline.json');

  it('produces correct mainline nodes', () => {
    const tree = buildFromFixture(fixture.inputText);
    const nodes = mainlineNodes(tree);
    expect(nodes).toHaveLength(fixture.expectedMainline.length);
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const expected = fixture.expectedMainline[i];
      expect(node.san).toBe(expected.san);
      expect(node.from).toBe(expected.from);
      expect(node.to).toBe(expected.to);
      expect(fenFields123(node.fen)).toBe(expected.fenFields123);
      expect(node.moveNumber).toBe(expected.moveNumber);
      expect(node.color).toBe(expected.color);
    }
  });
});

describe('Golden parity: spanish-notation', () => {
  const fixture = loadFixture('spanish-notation.json');

  it('normalises Spanish notation and produces English tree', () => {
    const tree = buildFromFixture(fixture.inputText);
    const nodes = mainlineNodes(tree);
    expect(nodes).toHaveLength(fixture.expectedMainline.length);
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const expected = fixture.expectedMainline[i];
      expect(node.san).toBe(expected.san);
      expect(fenFields123(node.fen)).toBe(expected.fenFields123);
    }
  });
});

describe('Golden parity: castling', () => {
  const fixture = loadFixture('castling.json');

  it('handles castling with correct from/to squares', () => {
    const tree = buildFromFixture(fixture.inputText);
    const nodes = mainlineNodes(tree);
    expect(nodes).toHaveLength(fixture.expectedMainline.length);
    const castleNode = nodes.find(n => n.san === 'O-O');
    expect(castleNode).toBeDefined();
    expect(castleNode?.from).toBe('e1');
    expect(castleNode?.to).toBe('g1');
    expect(fenFields123(castleNode!.fen)).toBe(
      fixture.expectedMainline.find((m: { san: string }) => m.san === 'O-O')!.fenFields123
    );
  });
});

describe('Golden parity: illegal-move', () => {
  const fixture = loadFixture('illegal-move.json');

  it('marks illegal move as invalid', () => {
    const tree = buildFromFixture(fixture.inputText);
    const nodes = mainlineNodes(tree);
    // Invalid node is NOT in mainline — mainline stops before it
    expect(nodes).toHaveLength(fixture.expectedMainline.length);
    // Invalid node lives in tree.nodes but not mainline
    const invalidNode = Array.from(tree.nodes.values()).find(n => n.invalid);
    expect(invalidNode).toBeDefined();
    expect(invalidNode?.san).toBe(fixture.expectedInvalidMove.san);
    expect(invalidNode?.from).toBe('');
    expect(invalidNode?.to).toBe('');
  });
});

describe('Golden parity: with-variation', () => {
  const fixture = loadFixture('with-variation.json');

  it('mainline matches expected', () => {
    const tree = buildFromFixture(fixture.inputText);
    const nodes = mainlineNodes(tree);
    const expectedSans = fixture.expectedMainline.map((m: { san: string }) => m.san);
    expect(nodes.map(n => n.san)).toEqual(expectedSans);
  });

  it('variation contains expected move', () => {
    const tree = buildFromFixture(fixture.inputText);
    const allNodes = Array.from(tree.nodes.values());
    const d4 = allNodes.find(n => n.san === 'd4');
    expect(d4).toBeDefined();
    expect(fenFields123(d4!.fen)).toBe(fixture.expectedVariationMoves[0].fenFields123);
  });
});

describe('Golden parity: nested-variation', () => {
  const fixture = loadFixture('nested-variation.json');

  it('outer variation exists', () => {
    const tree = buildFromFixture(fixture.inputText);
    const allNodes = Array.from(tree.nodes.values());
    const d4 = allNodes.find(n => n.san === 'd4');
    expect(d4).toBeDefined();
    expect(fenFields123(d4!.fen)).toBe(fixture.outerVariation.fenFields123);
  });

  it('inner variation exists', () => {
    const tree = buildFromFixture(fixture.inputText);
    const allNodes = Array.from(tree.nodes.values());
    const c4 = allNodes.find(n => n.san === 'c4');
    expect(c4).toBeDefined();
    expect(fenFields123(c4!.fen)).toBe(fixture.innerVariation.fenFields123);
  });

  it('mainline is intact after nested variations', () => {
    const tree = buildFromFixture(fixture.inputText);
    const nodes = mainlineNodes(tree);
    const expectedSans = fixture.expectedMainline.map((m: { san: string }) => m.san);
    expect(nodes.map(n => n.san)).toEqual(expectedSans);
  });
});
