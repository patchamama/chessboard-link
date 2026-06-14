import type { RecognizedGame } from '@chess-ebook/chess-shared'
import { mainlineNodes } from '@chess-ebook/chess-shared'

interface MoveTextProps {
  fullText: string
  game: RecognizedGame
  activeNodeId: string | null
  onSelectNode: (nodeId: string) => void
  onPreviewFen?: (fen: string | null) => void
  onFenClick?: (fen: string) => void
}

export default function MoveText({ fullText, game, activeNodeId, onSelectNode, onPreviewFen, onFenClick }: MoveTextProps) {
  const nodes = mainlineNodes(game.tree)

  const text = fullText.slice(game.charStart, game.charEnd)
  const segments: React.ReactNode[] = []
  let cursor = 0

  for (const node of nodes) {
    const sanIdx = text.indexOf(node.san, cursor)
    if (sanIdx < 0) continue

    if (sanIdx > cursor) {
      segments.push(text.slice(cursor, sanIdx))
    }

    const isActive = node.id === activeNodeId
    segments.push(
      <button
        key={node.id}
        data-node-id={node.id}
        aria-current={isActive ? 'true' : undefined}
        className={`inline font-medium px-0.5 rounded hover:bg-yellow-200 focus:outline-none ${
          isActive ? 'bg-yellow-300 font-bold' : ''
        }`}
        onClick={() => { onSelectNode(node.id); onFenClick?.(node.fen) }}
        onMouseEnter={() => onPreviewFen?.(node.fen)}
        onMouseLeave={() => onPreviewFen?.(null)}
      >
        {node.san}
      </button>
    )

    cursor = sanIdx + node.san.length
  }

  if (cursor < text.length) {
    segments.push(text.slice(cursor))
  }

  return <span>{segments}</span>
}
