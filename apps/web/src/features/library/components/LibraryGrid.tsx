import { useBooks } from '../api/libraryApi'
import BookCard from './BookCard'

export default function LibraryGrid() {
  const { isLoading, data: books } = useBooks()

  if (isLoading) {
    return (
      <div role="status" className="flex justify-center p-8">
        <span className="sr-only">Loading…</span>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (!books || books.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No books yet
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  )
}
