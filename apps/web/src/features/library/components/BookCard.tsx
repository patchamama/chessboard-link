import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Book } from '../api/libraryApi'
import BookEditModal from './BookEditModal'

interface Props {
  book: Book
}

export default function BookCard({ book }: Props) {
  const [editing, setEditing] = useState(false)

  return (
    <div className="border rounded p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <h2 className="font-semibold text-lg">{book.title}</h2>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-slate-400 hover:text-slate-600"
          aria-label="Edit book"
        >
          ✎
        </button>
      </div>
      <p className="text-sm text-gray-600">{book.author}</p>
      {book.description && (
        <p className="text-xs text-slate-500 line-clamp-2">{book.description}</p>
      )}
      <Link to={`/read/${book.id}`} className="text-blue-600 hover:underline text-sm mt-auto">
        Read
      </Link>

      {editing && (
        <BookEditModal book={book} onClose={() => setEditing(false)} />
      )}
    </div>
  )
}
