/** An on/off switch. */
export function Toggle({ checked, onChange, title }: { checked: boolean; onChange: (v: boolean) => void; title?: string }) {
  return (
    <button className={`toggle${checked ? ' on' : ''}`} role="switch" aria-checked={checked} title={title} onClick={() => onChange(!checked)}>
      <span />
    </button>
  )
}
