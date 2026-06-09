import { Link } from 'react-router-dom'
import type { Book } from '../api/libraryApi'

interface Props {
  book: Book
}

export default function BookCard({ book }: Props) {
  return (
    <div className="border rounded p-4 flex flex-col gap-2">
      <h2 className="font-semibold text-lg">{book.title}</h2>
      <p className="text-sm text-gray-600">{book.author}</p>
      <Link to={`/read/${book.id}`} className="text-blue-600 hover:underline text-sm mt-auto">
        Read
      </Link>
    </div>
  )
}
