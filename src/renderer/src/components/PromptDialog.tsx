import { useState } from 'react'

/** A small "type something" panel (e.g. a Live Folder's feed address). */
export function PromptDialog({
  title,
  hint,
  placeholder,
  action,
  closing,
  onSubmit,
  onClose
}: {
  title: string
  hint?: string
  placeholder: string
  action: string
  closing: boolean
  onSubmit: (value: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState('')
  const submit = () => {
    if (!value.trim()) return
    onSubmit(value.trim())
    onClose()
  }
  return (
    <div className={`cmd-layer${closing ? ' closing' : ''}`} onMouseDown={onClose}>
      <div className="cmd-bar prompt-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {hint && <p className="field-hint">{hint}</p>}
        <input
          className="text-field"
          autoFocus
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') onClose()
          }}
        />
        <div className="panel-footer">
          <button className="text-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" onClick={submit}>
            {action}
          </button>
        </div>
      </div>
    </div>
  )
}
