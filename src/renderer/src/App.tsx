import { useEffect, useState } from 'react'
import { activeSpace, locate } from '../../shared/tree'
import type { TabItem } from '../../shared/types'
import { Content } from './components/Content'
import { Sidebar } from './components/Sidebar'
import { dispatch, useAppState } from './state'
import { themeStyle, useSystemDark } from './theme'

export default function App() {
  const state = useAppState()
  const systemDark = useSystemDark()
  const [urlEditing, setUrlEditing] = useState(false)

  const newTab = async () => {
    await dispatch({ type: 'tab/new' })
    setUrlEditing(true)
  }

  useEffect(
    () =>
      window.vaia.onCommand((cmd) => {
        if (cmd.type === 'focus-url') setUrlEditing(true)
        if (cmd.type === 'new-tab') newTab()
      }),
    []
  )

  if (!state) return null

  const space = activeSpace(state)
  const loc = space.activeId ? locate(state, space.activeId) : null
  const activeTab: TabItem | null = loc?.item.kind === 'tab' ? loc.item : null
  const theme = themeStyle(space.theme, systemDark)

  return (
    <div className={`app${theme.isDark ? ' dark' : ''}`} style={theme.vars as React.CSSProperties}>
      <div className="backdrop" style={{ background: theme.background }} />
      <Sidebar
        state={state}
        space={space}
        activeTab={activeTab}
        urlEditing={urlEditing}
        setUrlEditing={setUrlEditing}
        onNewTab={newTab}
      />
      <Content tab={activeTab} />
    </div>
  )
}
