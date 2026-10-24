import { useEffect, useRef, type ReactNode } from 'react'
import type { AppState, LibrarySection } from '../../../shared/types'
import type { SpaceEditorFocus } from '../menus'
import { ArchiveView } from './ArchiveView'
import { BoostsView } from './BoostsView'
import { DownloadsView } from './DownloadsView'
import { IconArchive, IconBoost, IconCheckCircle, IconClose, IconColumns, IconDownload, IconImage } from './Icons'
import { MediaView } from './MediaView'
import { SpacesView } from './SpacesView'
import { TodoView } from './TodoList'

const SECTIONS: { id: LibrarySection; label: string; icon: ReactNode }[] = [
  { id: 'archive', label: 'Archive', icon: <IconArchive /> },
  { id: 'downloads', label: 'Downloads', icon: <IconDownload /> },
  { id: 'media', label: 'Media', icon: <IconImage /> },
  { id: 'spaces', label: 'Spaces', icon: <IconColumns /> },
  { id: 'boosts', label: 'Boosts', icon: <IconBoost /> },
  { id: 'todo', label: 'To-do', icon: <IconCheckCircle /> }
]

interface Props {
  state: AppState
  section: LibrarySection
  onSection: (section: LibrarySection) => void
  closing: boolean
  onClose: () => void
  /** Where the content area starts (just right of the sidebar). */
  left: number
  editSpace: (spaceId: string, setup?: boolean, focus?: SpaceEditorFocus) => void
  editBoost: (site: string) => void
}

/** The Library: everything you've collected, sliding out over the page (⇧⌘L). */
export function Library({ state, section, onSection, closing, onClose, left, editSpace, editBoost }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  // Keep the keyboard inside the Library (so Esc works) unless a section focused a field itself.
  useEffect(() => {
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus()
  }, [section])

  return (
    <div className={`overlay-layer light library-layer${closing ? ' closing' : ''}`} onMouseDown={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        className="panel library"
        style={{ left }}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <nav className="library-nav">
          <div className="library-title">Library</div>
          {SECTIONS.map((s) => (
            <button key={s.id} className={`library-nav-item${s.id === section ? ' selected' : ''}`} onClick={() => onSection(s.id)}>
              {s.icon}
              <span>{s.label}</span>
            </button>
          ))}
        </nav>
        <div className="library-content" key={section}>
          <button className="icon-button library-close" title="Close (Esc)" onClick={onClose}>
            <IconClose />
          </button>
          {section === 'archive' && <ArchiveView state={state} onClose={onClose} />}
          {section === 'downloads' && <DownloadsView state={state} />}
          {section === 'media' && <MediaView state={state} />}
          {section === 'spaces' && <SpacesView state={state} onOpen={onClose} onNewSpace={(id) => editSpace(id, true)} />}
          {section === 'boosts' && <BoostsView state={state} onEdit={editBoost} />}
          {section === 'todo' && (
            <div className="library-section">
              <TodoView state={state} header={<div className="list-panel-head"><h2>To-do</h2></div>} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
