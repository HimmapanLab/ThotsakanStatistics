// features/home/useLoadedHistogram.ts
// The shape of the loaded dataset, for the Statistics scene: the histogram densities of its first numeric column,
// from the same backend route the Graphical Analysis page uses (the numbers are never computed in the browser).
// It is decoration, so a failure is silent and the scene draws a sample shape instead. The request is cancelled when
// the data or column changes, and an answer for an older dataset is ignored.
import { useEffect, useState } from 'react'
import { graphicalApi } from '../../api/graphical'
import { useData } from '../../context/DataContext'

export function useLoadedHistogram(): readonly number[] | null {
  const { state } = useData()
  const { sessionId, status, numericCols } = state
  const column = numericCols[0]
  const key = status === 'ready' && sessionId && column ? `${sessionId}|${column}` : null
  const [result, setResult] = useState<{ key: string; densities: number[] } | null>(null)

  useEffect(() => {
    if (!key || !sessionId || !column) return
    const controller = new AbortController()
    graphicalApi
      .computeGraph(sessionId, { column, graph_type: 'Histogram', add_kde: false, add_normal: false }, controller.signal)
      .then((response) => {
        const densities = response.histogram_data?.densities
        if (!controller.signal.aborted && densities && densities.length > 1) setResult({ key, densities })
      })
      .catch(() => { /* decoration only: the sample shape stays */ })
    return () => controller.abort()
  }, [key, sessionId, column])

  return result && result.key === key ? result.densities : null
}
