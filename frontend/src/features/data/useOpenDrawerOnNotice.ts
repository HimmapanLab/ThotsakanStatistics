import { useEffect, useRef } from 'react'

/**
 * When the data from the last visit could not be brought back, the Data drawer opens once on a page that has one,
 * and its one line says why (DataContext sets the notice). `enabled` is false on pages without a drawer: the
 * drawer then opens on the first page that has one.
 */
export function useOpenDrawerOnNotice(notice: string, enabled: boolean, open: () => void) {
  const shown = useRef('')
  useEffect(() => {
    if (!notice || !enabled || shown.current === notice) return
    shown.current = notice
    open()
  }, [notice, enabled, open])
}
