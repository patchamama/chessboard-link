import { useMemo, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useChapter, useTouchBook } from '../api/libraryApi'
import { recognizeGames } from '@chess-ebook/chess-shared'
import type { GameTree } from '@chess-ebook/chess-shared'
import InlineGame from '../../viewer/components/InlineGame'
import { useKeyboardNavigation } from '../../viewer/hooks/useKeyboardNavigation'

export default function BookReader() {
  const { bookId } = useParams<{ bookId: string }>()
  const id = Number(bookId)
  const { data, isLoading } = useChapter(id, 1)

  const html      = data?.html ?? ''
  const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const games     = useMemo(() => recognizeGames(plainText), [plainText])

  // Build treeId → GameTree map for keyboard navigation
  const treesMap = useMemo<Map<string, GameTree>>(() => {
    const m = new Map<string, GameTree>()
    games.forEach((g, i) => m.set(`book-${id}-game-${i}`, g.tree))
    return m
  }, [games, id])

  useKeyboardNavigation(treesMap)

  const touchBook = useTouchBook()
  useEffect(() => {
    if (id) {
      touchBook.mutate(id)
    }
    // Fire once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (isLoading) {
    return (
      <div role="status" className="p-8">
        <span className="sr-only">Loading…</span>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{data?.title}</h1>

      {games.length === 0 ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div>
          {games.map((game, i) => {
            const treeId = `book-${id}-game-${i}`
            return (
              <InlineGame
                key={treeId}
                treeId={treeId}
                game={game}
                fullText={plainText}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
