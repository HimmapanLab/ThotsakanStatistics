import { isChunkLoadError } from './lazyRetry'

/**
 * What the error boundary shows. A page that could not be downloaded stays failed (React keeps a failed lazy
 * component failed), so asking again does nothing: the one way out is to load the app again.
 */
export function ErrorFallback({ error, resetErrorBoundary, reload = () => window.location.reload() }: {
  error: Error
  resetErrorBoundary: () => void
  reload?: () => void
}) {
  const download = isChunkLoadError(error)
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 mx-auto max-w-2xl text-center">
      <div className="border border-[var(--error)] bg-[var(--error-bg)] rounded-xl p-8 w-full">
        <h2 className="text-2xl font-bold text-[var(--error)] mb-4 flex justify-center items-center gap-2">
          <span className="text-3xl">⚠️</span> {download ? 'This page could not be loaded' : 'Something went wrong'}
        </h2>
        {download ? (
          <p role="alert" className="text-sm mb-6">
            Part of the app did not download. Check your connection and load the app again. A new version may also have replaced this one.
          </p>
        ) : (
          <div className="text-sm text-left w-full overflow-auto max-h-64 bg-[var(--field)] border border-[var(--line)] p-4 rounded-lg mb-6">
            <pre className="font-mono text-[var(--ink)] leading-relaxed whitespace-pre-wrap">
              {error.name}: {error.message}
            </pre>
            {error.stack && (
              <pre className="mt-4 pt-4 border-t border-[var(--line)] font-mono text-[var(--ink-muted)] text-xs whitespace-pre-wrap">
                {error.stack}
              </pre>
            )}
          </div>
        )}
        <button
          onClick={download ? reload : resetErrorBoundary}
          className="px-6 py-3 bg-[var(--color-primary)] hover:brightness-110 text-white font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--ground)] focus:ring-[var(--color-primary)]"
        >
          {download ? 'Reload the app' : 'Recover and Restart'}
        </button>
      </div>
    </div>
  )
}
