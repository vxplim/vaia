import type { AppState, Space, TabItem } from '../../../shared/types'
import { dispatch } from '../state'
import { IconBack, IconForward, IconPlus, IconReload, IconStop } from './Icons'
import { TabRow } from './TabRow'
import { UrlBar } from './UrlBar'

interface Props {
  state: AppState
  space: Space
  activeTab: TabItem | null
  urlEditing: boolean
  setUrlEditing: (editing: boolean) => void
  onNewTab: () => void
}

export function Sidebar({ state, space, activeTab, urlEditing, setUrlEditing, onNewTab }: Props) {
  const rt = activeTab ? state.runtime[activeTab.id] : undefined
  const id = activeTab?.id

  return (
    <aside className="sidebar" style={{ width: state.settings.sidebarWidth }}>
      <div className="sidebar-top">
        <div className="nav-buttons">
          <button
            className="icon-button"
            title="Back (⌘[)"
            disabled={!rt?.canGoBack}
            onClick={() => id && dispatch({ type: 'tab/back', id })}
          >
            <IconBack />
          </button>
          <button
            className="icon-button"
            title="Forward (⌘])"
            disabled={!rt?.canGoForward}
            onClick={() => id && dispatch({ type: 'tab/forward', id })}
          >
            <IconForward />
          </button>
          <button
            className="icon-button"
            title={rt?.loading ? 'Stop' : 'Reload (⌘R)'}
            disabled={!activeTab?.url}
            onClick={() => id && dispatch({ type: rt?.loading ? 'tab/stop' : 'tab/reload', id })}
          >
            {rt?.loading ? <IconStop /> : <IconReload />}
          </button>
        </div>
      </div>

      <UrlBar tab={activeTab} editing={urlEditing} setEditing={setUrlEditing} />

      <div className="sidebar-scroll">
        <button className="new-tab-row" onClick={onNewTab}>
          <IconPlus />
          <span>New Tab</span>
        </button>
        <div className="tab-list">
          {space.today.map((item) =>
            item.kind === 'tab' ? (
              <TabRow
                key={item.id}
                tab={item}
                active={space.activeId === item.id}
                loading={!!state.runtime[item.id]?.loading}
              />
            ) : null
          )}
        </div>
      </div>
    </aside>
  )
}
