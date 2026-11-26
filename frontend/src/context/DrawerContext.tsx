// context/DrawerContext.tsx
// Whether the Data drawer is open. The drawer takes the place of the inputs panel while it is open, and the rail
// button, the "Change" button of the Data step and the empty states all open it from different places.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export interface DrawerValue {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

const DrawerContext = createContext<DrawerValue | null>(null)

export function DrawerProvider({ children, initialOpen = false }: { children: ReactNode; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen)
  const toggle = useCallback(() => setOpen((value) => !value), [])
  const value = useMemo(() => ({ open, setOpen, toggle }), [open, toggle])
  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>
}

export function useDrawer(): DrawerValue {
  const ctx = useContext(DrawerContext)
  if (!ctx) throw new Error('useDrawer must be used inside <DrawerProvider>')
  return ctx
}
