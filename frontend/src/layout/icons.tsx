// Small stroke icons for the shell (top bar, menus, sheets). Decorative: the button around each one has a name.
import type { ReactNode } from 'react'

function Icon({ size = 20, children }: { size?: number; children: ReactNode }) {
  return (
    <svg className="sh-icon" viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

export const HelpIcon = () => <Icon><circle cx="10" cy="10" r="7.5" /><path d="M7.8 7.8a2.3 2.3 0 114 1.5c-.8.7-1.8 1.1-1.8 2.2M10 14.3v.1" /></Icon>
export const GearIcon = () => <Icon><path d="M3 5.5h8M15 5.5h2M3 10h2M9 10h8M3 14.5h6M13 14.5h4" /><circle cx="13" cy="5.5" r="2" /><circle cx="7" cy="10" r="2" /><circle cx="11" cy="14.5" r="2" /></Icon>
export const CloseIcon = () => <Icon><path d="M5 5l10 10M15 5L5 15" /></Icon>
export const CheckIcon = () => <Icon size={18}><path d="M4 10.5l4 4 8-9" /></Icon>
export const ChevDownIcon = () => <Icon size={16}><path d="M5 8l5 5 5-5" /></Icon>
