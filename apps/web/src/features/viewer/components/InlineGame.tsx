import { useState } from 'react'
import type { RecognizedGame } from '@chess-ebook/chess-shared'
import ChessBoard from '../../../shared/chess/ChessBoard'
import EvalBar from './EvalBar'
import EngineLines from './EngineLines'
import MoveText from './MoveText'
import VariationTree from './VariationTree'
import { useGameNavigation } from '../hooks/useGameNavigation'
import { useViewerStore } from '../store/viewerStore'
import { useSettingsStore } from '../../../shared/settings/settingsStore'

interface InlineGameProps {
  treeId: string
  game: RecognizedGame
  fullText: string
  onFenClick?: (fen: string) => void
}

export default function InlineGame({ treeId, game, fullText, onFenClick }: InlineGameProps) {
  const orientation    = useViewerStore((s) => s.orientation)
  const isInVariation  = useViewerStore((s) => s.isInVariation[treeId] ?? false)
  const currentNodeId  = useViewerStore((s) => s.currentNodeId[treeId] ?? null)
  const evalDirection  = useSettingsStore((s) => s.evalBarDirection)
  const { fen, lastMove, selectNode, next, prev, enterVariation, returnToMainline } =
    useGameNavigation(treeId, game.tree)
  const { goToStart, flipOrientation, setActiveTree } = useViewerStore.getState()

  const [previewFen, setPreviewFen] = useState<string | null>(null)
  const displayFen = previewFen ?? fen

  const activateThis = () => setActiveTree(treeId)

  // Centered relative to the board; in vertical mode pl-3 offsets the eval bar (w-2 + gap-1)
  // and mt-4 clears the score label hanging below the bar
  const navButtons = (
    <div className={`flex gap-1 justify-center ${evalDirection === 'vertical' ? 'pl-3 mt-4' : 'mt-1'}`}>
      <button
        aria-label="Go to start"
        className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
        onClick={() => goToStart(treeId)}
      >⏮</button>
      <button
        aria-label="Previous move"
        className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
        onClick={prev}
      >◀</button>
      <button
        aria-label="Next move"
        className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
        onClick={next}
      >▶</button>
      <button
        aria-label="Flip board"
        className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
        onClick={flipOrientation}
      >⇅</button>
    </div>
  )

  const boardArea = evalDirection === 'vertical' ? (
    // Vertical: bar left of board, both same height (only board, not nav buttons)
    <div className="flex flex-col">
      <div className="flex gap-1 items-stretch">
        <EvalBar fen={displayFen} />
        <div className="flex-1">
          <ChessBoard fen={displayFen} orientation={orientation} lastMove={lastMove} />
        </div>
      </div>
      {navButtons}
    </div>
  ) : (
    // Horizontal: bar below board
    <div className="flex flex-col">
      <ChessBoard fen={displayFen} orientation={orientation} lastMove={lastMove} />
      {navButtons}
      <EvalBar fen={displayFen} />
    </div>
  )

  return (
    <div className="my-4 flex flex-col gap-2">
      <div className="flex gap-4 items-start">

        {/* Left column: board + eval bar + engine lines */}
        <div
          role="region"
          aria-label="Chess board"
          className="shrink-0 w-52"
          onClick={activateThis}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') activateThis() }}
          tabIndex={0}
        >
          {boardArea}

          {/* Engine lines — no background box, inherits page text color */}
          <div className="mt-1.5">
            <EngineLines fen={fen} onPreviewFen={setPreviewFen} />
          </div>
        </div>

        {/* Right column: move text + variation tree */}
        <div className="flex-1">
          <MoveText
            fullText={fullText}
            game={game}
            activeNodeId={currentNodeId}
            onSelectNode={(id) => selectNode(id, false)}
            onPreviewFen={setPreviewFen}
            onFenClick={onFenClick}
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
