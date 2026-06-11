import { useUserBooks } from '../api/adminApi'

interface Props {
  userId: number
}

export default function UserBooksList({ userId }: Props) {
  const { data: books, isLoading } = useUserBooks(userId)

  if (isLoading) return <span className="text-xs text-slate-400">Loading books...</span>
  if (!books || books.length === 0) return <span className="text-xs text-slate-400">No books.</span>

  return (
    <ul className="mt-1 space-y-1 text-xs text-slate-600">
      {books.map((b) => (
        <li key={b.id}>
          <span className="font-medium">{b.title}</span> — {b.author}
        </li>
      ))}
    </ul>
  )
}
