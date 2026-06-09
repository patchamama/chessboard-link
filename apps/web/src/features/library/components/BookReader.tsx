import { useParams } from 'react-router-dom'
import { useChapter } from '../api/libraryApi'

export default function BookReader() {
  const { bookId } = useParams<{ bookId: string }>()
  const id = Number(bookId)
  const { data, isLoading } = useChapter(id, 0)

  if (isLoading) {
    return (
      <div role="status" className="p-8">
        <span className="sr-only">Loading…</span>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">{data?.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: data?.html ?? '' }} />
    </div>
  )
}
