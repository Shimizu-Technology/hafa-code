import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

// A stand-in for Monaco: one model whose text the test can change, like a paste would.
const model = vi.hoisted(() => ({ text: '', setValue(next: string) { this.text = next } }))

vi.mock('../rustMonaco', () => ({}))
vi.mock('@monaco-editor/react', () => ({
  default: ({ onMount, onChange }: { onMount: (editor: unknown, monaco: unknown) => void; onChange: (value: string) => void }) => {
    const editor = {
      getModel: () => ({ getValue: () => model.text, setValue: (next: string) => model.setValue(next) }),
      getValue: () => model.text,
      addCommand: () => {},
      createContextKey: () => ({ set: () => {} }),
      onKeyDown: () => {},
      onDidBlurEditorText: () => {},
      getContainerDomNode: () => document.body,
    }
    queueMicrotask(() => onMount(editor, { KeyCode: { Escape: 9, Tab: 2, Enter: 3 }, KeyMod: { CtrlCmd: 2048, Shift: 1024 }, editor: { setModelMarkers: () => {} }, MarkerSeverity: {} }))
    return <button type="button" onClick={() => { model.text = 'x'.repeat(10); onChange(model.text) }}>paste</button>
  },
}))

const { RustEditor } = await import('../RustEditor')

afterEach(cleanup)

it('puts the accepted text back in the editor when a change is refused', async () => {
  model.text = 'fn main() {}'
  function Host() {
    const [value, setValue] = useState('fn main() {}')
    return <RustEditor value={value} theme="hafa-light" diagnostics={[]} onRun={() => {}} onChange={(next) => {
      if (next.length > 5) return false
      setValue(next)
      return true
    }} />
  }
  render(<Host />)
  const paste = await screen.findByRole('button', { name: 'paste' })
  await act(async () => {
    fireEvent.click(paste)
    await Promise.resolve()
  })
  expect(model.text).toBe('fn main() {}')
})
