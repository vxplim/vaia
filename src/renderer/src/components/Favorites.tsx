import type { AppState, Space, TabItem } from '../../../shared/types'
import { useDragRow, useDropArea } from '../dnd'
import { tabMenu } from '../menus'
import { dispatch } from '../state'
import { Favicon } from './Favicon'

/** Icon-only tiles at the top of the sidebar, shared by every Space. */
export function Favorites({ state, space }: { state: AppState; space: Space }) {
  const area = useDropArea('favorites', 'favorites', space.id, state.favorites.length)
  // With no favorites yet, the drop spot floats over the address bar instead (see FavoritesDropZone).
  if (state.favorites.length === 0) return null
  return (
    <div className={`favorites${area.active ? ' drop-area' : ''}`} {...area.handlers}>
      {state.favorites.map((tab, index) => (
        <FavoriteTile key={tab.id} tab={tab} index={index} state={state} space={space} />
      ))}
    </div>
  )
}

/** While dragging with no favorites yet: a drop spot laid over the address bar, so nothing shifts. */
export function FavoritesDropZone({ state, space }: { state: AppState; space: Space }) {
  const area = useDropArea('favorites', 'favorites', space.id, 0)
  if (state.favorites.length > 0 || !area.canDrop) return null
  return (
    <div className={`favorites-empty${area.active ? ' active' : ''}`} {...area.handlers}>
      Drop here to add to Favorites
    </div>
  )
}

function FavoriteTile({ tab, index, state, space }: { tab: TabItem; index: number; state: AppState; space: Space }) {
  const rt = state.runtime[tab.id]
  const { draggable, dropClass, dragging, handlers } = useDragRow({
    id: tab.id,
    kind: 'tab',
    url: tab.url,
    zone: 'favorites',
    spaceId: space.id,
    parentId: null,
    index,
    horizontal: true
  })
  return (
    <div
      className={`fav-tile${space.activeId === tab.id ? ' active' : ''}${rt ? ' loaded' : ''}${dragging ? ' dragging' : ''}${dropClass}`}
      title={tab.title}
      role="button"
      draggable={draggable}
      {...handlers}
      onClick={() => dispatch({ type: 'tab/activate', id: tab.id })}
      onContextMenu={(e) => {
        e.preventDefault()
        tabMenu(tab, 'favorites', !!rt, space.activeId === tab.id)
      }}
    >
      <span className={rt?.loading ? 'loading' : ''}>
        <Favicon src={tab.favicon} url={tab.pinnedUrl ?? tab.url} size={20} />
      </span>
    </div>
  )
}
