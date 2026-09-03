import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { WebPreview } from './WebPreview'

afterEach(cleanup)

it('coaches Web console errors and links to the relevant guide topic', async () => {
  const user = userEvent.setup()
  const onOpenGuideTopic = vi.fn()
  let receiveMessage: ((event: MessageEvent) => void) | null = null
  const port = {
    close: vi.fn(),
    postMessage: vi.fn(),
    start: vi.fn(),
    get onmessage() { return receiveMessage },
    set onmessage(listener) { receiveMessage = listener },
  } as unknown as MessagePort

  render(<WebPreview
    entryPath="index.html"
    files={[
      { path: 'index.html', language: 'html', content: '<h1>Test</h1>' },
      { path: 'script.js', language: 'javascript', content: 'console.log(button)' },
      { path: 'feature.js', language: 'javascript', content: 'console.log(feature)' },
    ]}
    onOpenGuideTopic={onOpenGuideTopic}
  />)
  const frame = screen.getByTitle('Web preview') as HTMLIFrameElement
  act(() => window.dispatchEvent(new MessageEvent('message', {
    data: { source: 'hafa-code-preview-connect' },
    source: frame.contentWindow,
    ports: [port],
  })))
  act(() => receiveMessage?.({
    data: { source: 'hafa-code-preview-console', level: 'error', message: 'ReferenceError: feature is not defined', path: 'feature.js', line: 7 },
  } as MessageEvent))

  expect(screen.getByRole('heading', { name: 'The page script cannot find that name' })).toBeTruthy()
  expect(screen.getByText('feature.js · line 7')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Review DOM and events' }))
  expect(onOpenGuideTopic).toHaveBeenCalledWith('web-dom-events')
})

it('uses neutral entry-file context when a project with multiple scripts reports no source', () => {
  let receiveMessage: ((event: MessageEvent) => void) | null = null
  const port = {
    close: vi.fn(),
    postMessage: vi.fn(),
    start: vi.fn(),
    get onmessage() { return receiveMessage },
    set onmessage(listener) { receiveMessage = listener },
  } as unknown as MessagePort

  render(<WebPreview
    entryPath="index.html"
    files={[
      { path: 'index.html', language: 'html', content: '<h1>Test</h1>' },
      { path: 'first.js', language: 'javascript', content: 'console.log(first)' },
      { path: 'second.js', language: 'javascript', content: 'console.log(second)' },
    ]}
  />)
  const frame = screen.getByTitle('Web preview') as HTMLIFrameElement
  act(() => window.dispatchEvent(new MessageEvent('message', {
    data: { source: 'hafa-code-preview-connect' },
    source: frame.contentWindow,
    ports: [port],
  })))
  act(() => receiveMessage?.({
    data: { source: 'hafa-code-preview-console', level: 'error', message: 'ReferenceError: missing is not defined' },
  } as MessageEvent))

  expect(screen.getByText('index.html')).toBeTruthy()
  expect(screen.queryByText('first.js')).toBeNull()
  expect(screen.queryByText('second.js')).toBeNull()
})

it('validates source metadata against the latest files after the port connects', () => {
  let receiveMessage: ((event: MessageEvent) => void) | null = null
  const port = {
    close: vi.fn(),
    postMessage: vi.fn(),
    start: vi.fn(),
    get onmessage() { return receiveMessage },
    set onmessage(listener) { receiveMessage = listener },
  } as unknown as MessagePort
  const indexFile = { path: 'index.html', language: 'html' as const, content: '<h1>Test</h1>' }
  const view = render(<WebPreview
    entryPath="index.html"
    files={[indexFile, { path: 'old.js', language: 'javascript', content: 'old()' }]}
  />)
  const frame = screen.getByTitle('Web preview') as HTMLIFrameElement
  act(() => window.dispatchEvent(new MessageEvent('message', {
    data: { source: 'hafa-code-preview-connect' },
    source: frame.contentWindow,
    ports: [port],
  })))

  view.rerender(<WebPreview
    entryPath="index.html"
    files={[indexFile, { path: 'new.js', language: 'javascript', content: 'newName()' }]}
  />)
  act(() => receiveMessage?.({
    data: { source: 'hafa-code-preview-console', level: 'error', message: 'ReferenceError: newName is not defined', path: 'new.js' },
  } as MessageEvent))
  expect(screen.getByText('new.js')).toBeTruthy()

  act(() => receiveMessage?.({
    data: { source: 'hafa-code-preview-console', level: 'error', message: 'ReferenceError: old is not defined', path: 'old.js', line: 3 },
  } as MessageEvent))
  expect(screen.getByText('index.html')).toBeTruthy()
  expect(screen.queryByText('old.js · line 3')).toBeNull()
})
