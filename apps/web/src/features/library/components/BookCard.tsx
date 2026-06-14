import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Book } from '../api/libraryApi'
import BookEditModal from './BookEditModal'
import { getProgress } from '../store/readingStore'

interface Props {
  book: Book
  totalChapters?: number
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function BookCard({ book, totalChapters }: Props) {
  const [editing, setEditing] = useState(false)
  const progress = getProgress(book.id)

  return (
    <div className="border rounded-lg p-4 flex flex-col gap-2 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <h2 className="font-semibold text-lg leading-snug">{book.title}</h2>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-slate-400 hover:text-slate-600 shrink-0 ml-2"
          aria-label="Edit book"
        >
          ✎
        </button>
      </div>
      <p className="text-sm text-gray-600">{book.author}</p>
      {book.description && (
        <p className="text-xs text-slate-500 line-clamp-2">{book.description}</p>
      )}

      {/* Reading progress */}
      {progress && (
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
          <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Last opened {formatRelativeDate(progress.lastOpenedAt)}
            {totalChapters
              ? ` · Chapter ${progress.chapter} of ${totalChapters}`
              : ` · Chapter ${progress.chapter}`}
          </span>
        </div>
      )}

      <Link
        to={`/read/${book.id}`}
        className="mt-auto inline-flex items-center gap-1 text-blue-600 hover:underline text-sm font-medium"
      >
        {progress ? 'Continue reading' : 'Read'}
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      {editing && (
        <BookEditModal book={book} onClose={() => setEditing(false)} />
      )}
    </div>
  )
}
