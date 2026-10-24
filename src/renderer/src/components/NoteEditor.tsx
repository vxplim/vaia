import { useEffect, useRef, useState, type ReactNode } from 'react'
import { dispatch } from '../state'

const SAVE_DELAY_MS = 400

const ALLOWED = new Set(['P', 'DIV', 'BR', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'A', 'IMG', 'INPUT', 'BLOCKQUOTE', 'CODE', 'PRE', 'SPAN'])
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH', 'FORM', 'BUTTON', 'SELECT', 'TEXTAREA', 'META', 'LINK', 'TITLE', 'HEAD'])

/**
 * Keep only simple formatting: headings, lists, checkboxes, links and pictures. Pasted web
 * content can't bring scripts, event handlers, styles or frames into VAIA's interface.
 */
export function cleanHtml(html: string): string {
  // A <template> is completely inert: nothing in it loads or runs while we clean it.
  const template = document.createElement('template')
  template.innerHTML = html
  const walk = (node: Node): void => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove()
        continue
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue
      const el = child as Element
      if (DROP.has(el.tagName)) {
        el.remove()
        continue
      }
      walk(el)
      if (!ALLOWED.has(el.tagName) || (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'checkbox')) {
        el.replaceWith(...el.childNodes)
        continue
      }
      for (const attr of [...el.attributes]) {
        const keep =
          (el.tagName === 'A' && attr.name === 'href' && /^(https?:|mailto:)/i.test(attr.value)) ||
          (el.tagName === 'IMG' && attr.name === 'src' && /^(https:|data:image\/(png|jpe?g|gif|webp);)/i.test(attr.value)) ||
          (el.tagName === 'INPUT' && (attr.name === 'type' || attr.name === 'checked')) ||
          (attr.name === 'class' && attr.value === 'checklist')
        if (!keep) el.removeAttribute(attr.name)
      }
      if (el.tagName === 'IMG' && !el.getAttribute('src')) el.remove()
    }
  }
  walk(template.content)
  const out = document.createElement('div')
  out.append(template.content)
  return out.innerHTML
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function ToolButton({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      className="note-tool"
      title={title}
      // Keep the text selection in the note while clicking the toolbar.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** A note: simple rich text, saved automatically on this Mac. */
export function NoteEditor({ docId }: { docId: string }) {
  const editor = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [missing, setMissing] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const savedRange = useRef<Range | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let stale = false
    setLoaded(false)
    window.vaia.getDoc(docId).then((doc) => {
      if (stale) return
      if (!doc || !editor.current) return setMissing(true)
      editor.current.innerHTML = cleanHtml(doc.html ?? '')
      // Enter starts a new paragraph (<p>), so lines stay separate in the saved note.
      document.execCommand('defaultParagraphSeparator', false, 'p')
      setLoaded(true)
      if (!doc.html) editor.current.focus()
    })
    return () => {
      stale = true
    }
  }, [docId])

  const saveNow = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (editor.current) dispatch({ type: 'doc/save', id: docId, patch: { html: cleanHtml(editor.current.innerHTML) } })
  }
  const save = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(saveNow, SAVE_DELAY_MS)
  }
  // Don't lose the last few keystrokes when the note is closed or you switch tabs.
  useEffect(() => () => void (timer.current && saveNow()), [docId])

  const run = (command: string, value?: string) => {
    editor.current?.focus()
    document.execCommand(command, false, value)
    save()
  }
  const insertImages = async (files: File[]) => {
    for (const file of files.filter((f) => f.type.startsWith('image/'))) run('insertImage', await readAsDataUrl(file))
  }

  if (missing) return <div className="empty-state"><p>This note was deleted.</p></div>

  return (
    <div className="note">
      <div className="note-toolbar">
        <ToolButton title="Big heading" onClick={() => run('formatBlock', 'H1')}>H1</ToolButton>
        <ToolButton title="Heading" onClick={() => run('formatBlock', 'H2')}>H2</ToolButton>
        <ToolButton title="Text" onClick={() => run('formatBlock', 'P')}>¶</ToolButton>
        <span className="note-sep" />
        <ToolButton title="Bold (⌘B)" onClick={() => run('bold')}><b>B</b></ToolButton>
        <ToolButton title="Italic (⌘I)" onClick={() => run('italic')}><i>I</i></ToolButton>
        <span className="note-sep" />
        <ToolButton title="Bulleted list" onClick={() => run('insertUnorderedList')}>•</ToolButton>
        <ToolButton title="Numbered list" onClick={() => run('insertOrderedList')}>1.</ToolButton>
        <ToolButton title="Checklist" onClick={() => run('insertHTML', '<ul class="checklist"><li><input type="checkbox">&nbsp;</li></ul>')}>☐</ToolButton>
        <span className="note-sep" />
        <ToolButton
          title="Link"
          onClick={() => {
            const sel = window.getSelection()
            savedRange.current = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null
            setLinkUrl('https://')
            setLinkOpen(true)
          }}
        >
          Link
        </ToolButton>
        <ToolButton title="Picture" onClick={() => fileInput.current?.click()}>Picture</ToolButton>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            insertImages([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
        {linkOpen && (
          <input
            className="note-link-field"
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onBlur={() => setLinkOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setLinkOpen(false)
              if (e.key !== 'Enter') return
              setLinkOpen(false)
              const url = /^(https?:|mailto:)/i.test(linkUrl) ? linkUrl : `https://${linkUrl}`
              const sel = window.getSelection()
              if (savedRange.current && sel) {
                sel.removeAllRanges()
                sel.addRange(savedRange.current)
              }
              if (sel && !sel.isCollapsed) run('createLink', url)
              else run('insertHTML', `<a href="${url.replace(/"/g, '&quot;')}">${url.replace(/</g, '&lt;')}</a>&nbsp;`)
            }}
          />
        )}
        <span className="note-saved">{loaded ? 'Saved on this Mac' : ''}</span>
      </div>
      <div
        ref={editor}
        className="note-body"
        contentEditable
        suppressContentEditableWarning
        spellCheck
        data-placeholder="Start writing… The first line becomes the note’s name."
        onInput={save}
        onBlur={saveNow}
        onPaste={(e) => {
          e.preventDefault()
          const files = [...e.clipboardData.files]
          if (files.length) return void insertImages(files)
          const html = e.clipboardData.getData('text/html')
          if (html) run('insertHTML', cleanHtml(html))
          else run('insertText', e.clipboardData.getData('text/plain'))
        }}
        onDrop={(e) => {
          const files = [...e.dataTransfer.files]
          if (!files.length) return
          e.preventDefault()
          insertImages(files)
        }}
        onClick={(e) => {
          const target = e.target as HTMLElement
          // Checkboxes: remember the tick in the saved note.
          if (target instanceof HTMLInputElement && target.type === 'checkbox') {
            if (target.checked) target.setAttribute('checked', '')
            else target.removeAttribute('checked')
            save()
          }
          // ⌘-click a link to open it.
          const link = target.closest('a')
          if (link && (e.metaKey || e.ctrlKey) && /^https?:/.test(link.href)) {
            e.preventDefault()
            dispatch({ type: 'tab/new', url: link.href })
          }
        }}
      />
    </div>
  )
}
