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
export const IconMore = (p: P) => (
  <Svg {...p}>
    <circle cx="4" cy="8" r="0.6" fill="currentColor" />
    <circle cx="8" cy="8" r="0.6" fill="currentColor" />
    <circle cx="12" cy="8" r="0.6" fill="currentColor" />
  </Svg>
)
export const IconArchive = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="3" width="11" height="3" rx="1" />
    <path d="M3.5 6v6a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V6M6.5 8.5h3" />
  </Svg>
)
export const IconExpand = (p: P) => (
  <Svg width="13" height="13" {...p}>
    <path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9" />
  </Svg>
)
export const IconFolderOpen = (p: P) => (
  <Svg width="13" height="13" {...p}>
    <path d="M2.5 12V4.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1V7" />
    <path d="M2.5 12l1.6-4.2a1 1 0 0 1 .9-.6h8.6a.6.6 0 0 1 .6.8L12.6 12a1 1 0 0 1-.9.6H3.1a.6.6 0 0 1-.6-.6Z" />
  </Svg>
)
export const IconDownload = (p: P) => (
  <Svg {...p}>
    <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />
  </Svg>
)
export const IconChevronUp = (p: P) => (
  <Svg width="12" height="12" {...p}>
    <path d="M4 10l4-4 4 4" />
  </Svg>
)
export const IconChevronDown = (p: P) => (
  <Svg width="12" height="12" {...p}>
    <path d="M4 6l4 4 4-4" />
  </Svg>
)
export const IconBoost = (p: P) => (
  <Svg width="14" height="14" {...p}>
    <path d="M9 2.5 4 9h3.5L7 13.5 12 7H8.5L9 2.5Z" />
  </Svg>
)
export const IconBroom = (p: P) => (
  <Svg {...p}>
    <path d="M12.5 2.5 8.6 6.4" />
    <path d="M7.4 6.2 9.8 8.6c.3.3.3.8 0 1.1l-.6.6-3.5-3.5.6-.6c.3-.3.8-.3 1.1 0Z" />
    <path d="M5.7 6.8 2.6 9.9c1.2 2.4 2.5 3.7 4.9 4.6l2-2" />
    <path d="M4.2 11.6l1.3-1.3M6 13l1.3-1.3" />
  </Svg>
)
export const IconCheckCircle = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="2.5" width="11" height="11" rx="3.2" />
    <path d="m5.4 8.1 1.8 1.8 3.5-3.6" />
  </Svg>
)
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="m3.8 8.3 2.7 2.7 5.7-5.9" />
  </Svg>
)
export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
    <path d="M2.5 6.5h11M5.5 2v2.5M10.5 2v2.5" />
  </Svg>
)
export const IconLink = (p: P) => (
  <Svg {...p}>
    <path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.6.6" />
    <path d="M9.2 6.8a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.6-.6" />
  </Svg>
)
export const IconPopout = (p: P) => (
  <Svg {...p}>
    <path d="M9.5 2.5h4v4M13.5 2.5 8 8" />
    <path d="M12 9.5v2.5a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 3 12V6a1.5 1.5 0 0 1 1.5-1.5H7" />
  </Svg>
)
export const IconPin = (p: P) => (
  <Svg {...p}>
    <path d="M6 2.5h4l-.6 3.8 2.3 2.2v1H4.3v-1l2.3-2.2Z" />
    <path d="M8 9.5v4" />
  </Svg>
)
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.2c0 .5.5.8 1 .8h3.8c.5 0 .9-.3 1-.8l.6-8.2" />
  </Svg>
)
export const IconGrip = (p: P) => (
  <Svg {...p}>
    <path d="M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01" strokeWidth="2.2" />
  </Svg>
)
export const IconPuzzle = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 3.2a1.4 1.4 0 0 1 2.8 0v.8h2.2a.9.9 0 0 1 .9.9v2.2h-.8a1.4 1.4 0 0 0 0 2.8h.8v2.2a.9.9 0 0 1-.9.9H9.3v-.8a1.4 1.4 0 0 0-2.8 0v.8H4.3a.9.9 0 0 1-.9-.9V9.9h.8a1.4 1.4 0 0 0 0-2.8h-.8V4.9a.9.9 0 0 1 .9-.9h2.2Z" />
  </Svg>
)
export const IconMask = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 6.2c1.8-.9 3.6-1.3 5.5-1.3s3.7.4 5.5 1.3c0 3-1.3 4.8-3 4.8-1.2 0-1.6-1.2-2.5-1.2s-1.3 1.2-2.5 1.2c-1.7 0-3-1.8-3-4.8Z" />
    <path d="M5 7.6h1.4M9.6 7.6H11" />
  </Svg>
)
export const IconLayout = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="3" width="11" height="10" rx="2" />
    <path d="M8 3v10" />
  </Svg>
)
export const IconLibrary = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="2.5" width="3" height="11" rx="0.8" />
    <rect x="6.5" y="2.5" width="3" height="11" rx="0.8" />
    <path d="m11 3.4 2.4-.6 1.1 10.3-2.4.5Z" />
  </Svg>
)
export const IconImage = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="3" width="11" height="10" rx="2" />
    <circle cx="6" cy="6.5" r="1" />
    <path d="m3 12 3.5-3.5 2.5 2.5 1.5-1.5L13 12" />
  </Svg>
)
export const IconColumns = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="3" width="11" height="10" rx="2" />
    <path d="M6.2 3v10M9.8 3v10" />
  </Svg>
)
