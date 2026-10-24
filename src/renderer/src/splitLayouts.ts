// The ready-made Split View layouts, shared by the pane toolbar, right-click menus and Command Bar.
import type { MenuItem } from '../../shared/api'
import type { SplitItem, SplitPreset } from '../../shared/types'
import { dispatch } from './state'

export const SPLIT_LAYOUTS: { preset: SplitPreset; label: string }[] = [
  { preset: '50-50', label: 'Two Even Columns (50 / 50)' },
  { preset: '70-30', label: 'Wide Left (70 / 30)' },
  { preset: '30-70', label: 'Wide Right (30 / 70)' },
  { preset: 'three', label: 'Three Columns' },
  { preset: 'grid', label: 'Grid (2 × 2)' }
]

/** Which preset a split currently matches (if any), for the check mark. */
export function currentPreset(split: SplitItem | null): SplitPreset | null {
  if (!split) return null
  if (split.layout === 'grid' && split.tabs.length === 4) return 'grid'
  const s = split.sizes.map((v) => Math.round(v * 10) / 10)
  if (split.tabs.length === 3) return 'three'
  if (split.tabs.length !== 2) return null
  if (s[0] === 0.5) return '50-50'
  if (s[0] === 0.7) return '70-30'
  if (s[0] === 0.3) return '30-70'
  return null
}

/** Menu items for picking a layout; ids look like "layout-50-50". */
export function layoutMenuItems(split: SplitItem | null): MenuItem[] {
  const current = currentPreset(split)
  return SPLIT_LAYOUTS.map((l) => ({ id: `layout-${l.preset}`, label: l.label, checked: l.preset === current }))
}

/** Apply a "layout-…" menu choice to a tab or split. */
export function applyLayoutChoice(choice: string | null, id: string): boolean {
  if (!choice?.startsWith('layout-')) return false
  dispatch({ type: 'split/layout', id, preset: choice.slice('layout-'.length) as SplitPreset })
  return true
}

/** A popup menu of layouts for a tab or split. */
export async function showLayoutMenu(id: string, split: SplitItem | null): Promise<void> {
  applyLayoutChoice(await window.vaia.popupMenu(layoutMenuItems(split)), id)
}
