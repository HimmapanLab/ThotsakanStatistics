// features/data/icons.tsx
// The small line icons of the Data rail, drawer and type menu, copied from the approved prototype.
import type { ColumnType } from '../../utils/columnTypes'

function Icon({ children, size }: { children: React.ReactNode; size?: number }) {
  return (
    <svg className="lab-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false" style={size ? { width: size, height: size } : undefined}>
      {children}
    </svg>
  )
}

export const TableIcon = () => <Icon><rect x="3" y="4" width="14" height="12" rx="1.5" /><path d="M3 8.5h14M3 12.5h14M8 4v12" /></Icon>
export const CloseIcon = () => <Icon><path d="M5 5l10 10M15 5L5 15" /></Icon>
export const UploadIcon = () => <Icon><path d="M10 13V4M6.5 7.5L10 4l3.5 3.5M4 14v2h12v-2" /></Icon>
export const FilterIcon = () => <Icon><path d="M3.5 4.5h13L11.5 11v4.5l-3 1.5V11z" /></Icon>
export const UndoIcon = () => <Icon><path d="M7 5L3.5 8.5 7 12" /><path d="M4 8.5h8a4 4 0 010 8H9" /></Icon>
export const RedoIcon = () => <Icon><path d="M13 5l3.5 3.5L13 12" /><path d="M16 8.5H8a4 4 0 000 8h3" /></Icon>
export const SortUpIcon = () => <Icon size={14}><path d="M5 12l5-5 5 5" /></Icon>
export const SortDownIcon = () => <Icon size={14}><path d="M5 8l5 5 5-5" /></Icon>

const TYPE_PATHS: Record<ColumnType, React.ReactNode> = {
  Continuous: <path d="M2 13h14M3 13V9M6.5 13v-2M10 13V9M13.5 13v-2M16 13V9" />,
  Discrete: <><rect x="3" y="9" width="3" height="6" /><rect x="7.5" y="4" width="3" height="11" /><rect x="12" y="11" width="3" height="4" /></>,
  Ordinal: <path d="M2 15h4v-4h4V7h4V3h2" />,
  Nominal: <><circle cx="5" cy="12" r="2.5" /><circle cx="13" cy="12" r="2.5" /><circle cx="9" cy="5.5" r="2.5" /></>,
  ID: <path d="M7 3l-1.5 12M12.5 3L11 15M3 7h12M2.5 11.5h12" />,
}

/** A column type's shape. The shape and the name say the type, never colour alone. */
export function TypeIcon({ type }: { type: ColumnType }) {
  return (
    <span className="data-type-ico" aria-hidden="true">
      <svg viewBox="0 0 18 18" focusable="false">{TYPE_PATHS[type]}</svg>
    </span>
  )
}
