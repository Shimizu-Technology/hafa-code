import { useRef } from 'react'
import { useModalFocus } from '../hooks/useModalFocus'

/** Plain text stays selectable when an in-app browser denies clipboard access. */
export function ManualCodeCopyDialog({ text, onClose }: { text: string; onClose: () => void }) {
  const dialogRef = useModalFocus<HTMLElement>(true, onClose)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const selectCode = () => {
    textRef.current?.focus()
    textRef.current?.select()
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section ref={dialogRef} className="modal-sheet manual-code-copy" role="dialog" aria-modal="true" aria-labelledby="manual-copy-title" tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <h2 id="manual-copy-title">Copy your code</h2>
        <p id="manual-copy-help">This browser blocked automatic copying. Select all code below, then use your device’s Copy command. Paste it into Learn or your GitHub file.</p>
        <textarea ref={textRef} aria-label="Code to copy" aria-describedby="manual-copy-help" readOnly value={text} spellCheck={false} />
        <div className="workspace-transfer-actions">
          <button className="secondary" type="button" data-modal-initial-focus onClick={selectCode}>Select all code</button>
          <button className="secondary" type="button" onClick={onClose}>Done</button>
        </div>
      </section>
    </div>
  )
}
