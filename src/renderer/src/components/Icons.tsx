// Small original line icons drawn with SVG (no external icon sets).
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

function Svg({ children, ...props }: P) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const IconBack = (p: P) => (
  <Svg {...p}>
    <path d="M10 3.5 5.5 8l4.5 4.5" />
  </Svg>
)
export const IconForward = (p: P) => (
  <Svg {...p}>
    <path d="M6 3.5 10.5 8 6 12.5" />
  </Svg>
)
export const IconReload = (p: P) => (
  <Svg {...p}>
    <path d="M12.8 8.2A4.8 4.8 0 1 1 11.3 4.6" />
    <path d="M12.2 2.4v2.6H9.6" />
  </Svg>
)
export const IconStop = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
  </Svg>
)
export const IconClose = (p: P) => (
  <Svg width="12" height="12" {...p}>
    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
  </Svg>
)
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M8 3v10M3 8h10" />
  </Svg>
)
export const IconLock = (p: P) => (
  <Svg width="12" height="12" {...p}>
    <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
    <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" />
  </Svg>
)
export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="7" cy="7" r="4.2" />
    <path d="m10.2 10.2 3.3 3.3" />
  </Svg>
)
export const IconGlobe = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M2.5 8h11M8 2.5c1.6 1.6 2.3 3.4 2.3 5.5S9.6 11.9 8 13.5C6.4 11.9 5.7 10.1 5.7 8S6.4 4.1 8 2.5Z" />
  </Svg>
)
export const IconSidebar = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="3" width="11" height="10" rx="2" />
    <path d="M6.5 3v10" />
  </Svg>
)
export const IconReturn = (p: P) => (
  <Svg width="12" height="12" {...p}>
    <path d="M6 4 3 7l3 3" />
    <path d="M3 7h6.5a3.5 3.5 0 0 1 0 7H8" />
  </Svg>
)
export const IconChevron = (p: P) => (
  <Svg width="12" height="12" {...p}>
    <path d="M6 4l4 4-4 4" />
  </Svg>
)
export const IconFolder = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1Z" />
  </Svg>
)
export const IconFolderPlus = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1Z" />
    <path d="M8 7.2v3.6M6.2 9h3.6" />
  </Svg>
)
