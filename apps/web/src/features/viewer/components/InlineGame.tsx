import type { RecognizedGame } from '@chess-ebook/chess-shared'
import ChessBoard from '../../../shared/chess/ChessBoard'
import EvalBar from './EvalBar'
import MoveText from './MoveText'
import VariationTree from './VariationTree'
import { useGameNavigation } from '../hooks/useGameNavigation'
import { useViewerStore } from '../store/viewerStore'

interface InlineGameProps {
  treeId: string
  game: RecognizedGame
  fullText: string
}

export default function InlineGame({ treeId, game, fullText }: InlineGameProps) {
  const orientation = useViewerStore((s) => s.orientation)
  const isInVariation = useViewerStore((s) => s.isInVariation[treeId] ?? false)
  const currentNodeId = useViewerStore((s) => s.currentNodeId[treeId] ?? null)
  const { fen, lastMove, selectNode, next, prev, enterVariation, returnToMainline } =
    useGameNavigation(treeId, game.tree)
  const { goToStart, flipOrientation } = useViewerStore.getState()

  return (
    <div className="my-4 flex flex-col gap-2">
      <div className="flex gap-4 items-start">
        <div className="flex gap-2 shrink-0">
          <EvalBar fen={fen} />
          <div className="w-48">
          <ChessBoard fen={fen} orientation={orientation} lastMove={lastMove} />
          <div className="flex gap-1 mt-1">
            <button
              aria-label="Go to start"
              className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
              onClick={() => goToStart(treeId)}
            >
              ⏮
            </button>
            <button
              aria-label="Previous move"
              className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
              onClick={prev}
            >
              ◀
            </button>
            <button
              aria-label="Next move"
              className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
              onClick={next}
            >
              ▶
            </button>
            <button
              aria-label="Flip board"
              className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
              onClick={flipOrientation}
            >
              ⇅
            </button>
          </div>
          </div>
        </div>
        <div className="flex-1">
          <MoveText
            fullText={fullText}
            game={game}
            activeNodeId={currentNodeId}
            onSelectNode={(id) => selectNode(id, false)}
          />
          <VariationTree
            tree={game.tree}
            activeNodeId={currentNodeId}
            isInVariation={isInVariation}
            onEnterVariation={enterVariation}
            onReturnToMainline={returnToMainline}
          />
        </div>
      </div>
    </div>
  )
}
