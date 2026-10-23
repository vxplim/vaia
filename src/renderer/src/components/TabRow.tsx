import type { TabItem } from '../../../shared/types'
import { dispatch } from '../state'
import { Favicon } from './Favicon'
import { IconClose } from './Icons'

interface Props {
  tab: TabItem
  active: boolean
  loading: boolean
}

export function TabRow({ tab, active, loading }: Props) {
  return (
    <div
      className={`tab-row${active ? ' active' : ''}`}
      role="button"
      title={tab.title}
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault()
          dispatch({ type: 'tab/close', id: tab.id })
        }
      }}
      onClick={() => dispatch({ type: 'tab/activate', id: tab.id })}
    >
      <span className={`tab-icon${loading ? ' loading' : ''}`}>
        <Favicon src={tab.favicon} url={tab.url} />
      </span>
      <span className="tab-title">{tab.title || tab.url || 'New Tab'}</span>
      <button
        className="tab-close"
        title="Close tab (⌘W)"
        onClick={(e) => {
          e.stopPropagation()
          dispatch({ type: 'tab/close', id: tab.id })
        }}
      >
        <IconClose />
      </button>
    </div>
  )
}
