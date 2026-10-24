import type { AppState, Boost } from '../../../shared/types'
import { dispatch } from '../state'
import { Favicon } from './Favicon'
import { IconTrash } from './Icons'
import { Toggle } from './Toggle'

/** What a Boost changes, in a few words. */
function summary(boost: Boost): string {
  const parts: string[] = []
  if (boost.bgColor || boost.textColor || boost.linkColor) parts.push('colors')
  if (boost.font) parts.push('font')
  if (boost.zaps.length) parts.push(`${boost.zaps.length} zapped`)
  if (boost.css.trim()) parts.push('CSS')
  if (boost.js.trim()) parts.push('JavaScript')
  return parts.length ? parts.join(' · ') : 'No changes yet'
}

/** Library → Boosts: every site you've customized, with a switch to turn each one off. */
export function BoostsView({ state, onEdit }: { state: AppState; onEdit: (site: string) => void }) {
  const sites = Object.keys(state.boosts).sort((a, b) => a.localeCompare(b))
  return (
    <div className="library-section">
      <div className="list-panel-head">
        <h2>Boosts</h2>
        <span className="field-hint">To Boost a site, open it and click the Boost button next to its address.</span>
      </div>
      <div className="list-panel-body">
        {sites.length === 0 && <div className="list-empty">Sites you Boost (new colors, fonts, zapped elements, your own CSS) appear here.</div>}
        {sites.map((site) => {
          const boost = state.boosts[site]
          return (
            <div key={site} className={`list-row boost-row${boost.enabled ? '' : ' off'}`}>
              <Favicon url={`https://${site}`} />
              <span className="list-row-title">{site}</span>
              <span className="list-row-meta">{summary(boost)}</span>
              <Toggle
                checked={boost.enabled}
                title={boost.enabled ? 'Turn this Boost off' : 'Turn this Boost on'}
                onChange={(enabled) => dispatch({ type: 'boost/update', site, patch: { enabled } })}
              />
              <button className="text-button small" onClick={() => onEdit(site)}>
                Edit
              </button>
              <button
                className="tab-action"
                title="Delete this Boost"
                onClick={() => confirm(`Delete the Boost for ${site}? The site goes back to how it looks normally.`) && dispatch({ type: 'boost/delete', site })}
              >
                <IconTrash />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
