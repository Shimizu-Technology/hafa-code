import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('../rustMonaco', () => ({}))
vi.mock('@monaco-editor/react', () => ({
  default: () => {
    throw new Error('Failed to fetch dynamically imported module')
  },
}))

const { RustEditor } = await import('../RustEditor')

afterEach(cleanup)

it('keeps the lab usable and offers a reload when the editor cannot load', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  render(<RustEditor value={'fn main() {}'} theme="hafa-light" diagnostics={[]} onChange={() => {}} onRun={() => {}} />)
  expect(await screen.findByText('The editor could not load. Your code is saved in this browser.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Reload the page' })).toBeTruthy()
  expect(screen.getByLabelText('Code (read-only)').textContent).toBe('fn main() {}')
})
