import { useState } from 'react'
import { useUploadBook } from '../api/libraryApi'

type Tab = 'file' | 'url'

export default function UploadBookForm() {
  const [tab, setTab] = useState<Tab>('file')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')

  const { mutateAsync, isPending, isError, error } = useUploadBook()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (tab === 'file' && file) {
      await mutateAsync({ file })
    } else if (tab === 'url' && url.trim()) {
      await mutateAsync({ url: url.trim() })
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm mb-6"
      aria-label="Upload book"
    >
      <h2 className="mb-3 text-lg font-semibold text-gray-800">Add a book</h2>

      {/* Tabs */}
      <div role="tablist" className="mb-4 flex gap-2 border-b border-gray-200">
        <button
          role="tab"
          type="button"
          aria-selected={tab === 'file'}
          onClick={() => setTab('file')}
          className={`pb-2 px-1 text-sm font-medium transition-colors ${
            tab === 'file'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          EPUB File
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={tab === 'url'}
          onClick={() => setTab('url')}
          className={`pb-2 px-1 text-sm font-medium transition-colors ${
            tab === 'url'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          URL
        </button>
      </div>

      {/* File input */}
      {tab === 'file' && (
        <div className="mb-4">
          <label htmlFor="epub-file-input" className="mb-1 block text-sm font-medium text-gray-700">
            EPUB File
          </label>
          <input
            id="epub-file-input"
            type="file"
            accept=".epub,application/epub+zip"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-500 file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
      )}

      {/* URL input */}
      {tab === 'url' && (
        <div className="mb-4">
          <label htmlFor="url-input" className="mb-1 block text-sm font-medium text-gray-700">
            URL
          </label>
          <input
            id="url-input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/chess-article"
            className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      )}

      {/* Error */}
      {isError && error && (
        <div role="alert" className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">
          {error.message}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? 'Uploading…' : 'Upload'}
      </button>
    </form>
  )
}
