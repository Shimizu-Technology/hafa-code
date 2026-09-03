import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { WebPreview } from './WebPreview'

afterEach(cleanup)

it('sends Web console errors to the learning coach with source context', () => {
  const onErrorAdviceChange = vi.fn()
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
    onErrorAdviceChange={onErrorAdviceChange}
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

  expect(onErrorAdviceChange).toHaveBeenLastCalledWith(expect.objectContaining({
    kind: 'web',
    advice: expect.objectContaining({
      title: 'The page script cannot find that name',
      location: 'feature.js · line 7',
      guideTopicId: 'web-dom-events',
    }),
  }))
})

it('uses neutral entry-file context when a project with multiple scripts reports no source', () => {
  const onErrorAdviceChange = vi.fn()
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
    onErrorAdviceChange={onErrorAdviceChange}
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

  expect(onErrorAdviceChange).toHaveBeenLastCalledWith(expect.objectContaining({
    advice: expect.objectContaining({ location: 'index.html' }),
  }))
})

it('validates source metadata against the latest files after the port connects', () => {
  const onErrorAdviceChange = vi.fn()
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
    onErrorAdviceChange={onErrorAdviceChange}
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
    onErrorAdviceChange={onErrorAdviceChange}
  />)
  act(() => receiveMessage?.({
    data: { source: 'hafa-code-preview-console', level: 'error', message: 'ReferenceError: newName is not defined', path: 'new.js' },
  } as MessageEvent))
  expect(onErrorAdviceChange).toHaveBeenLastCalledWith(expect.objectContaining({
    advice: expect.objectContaining({ location: 'new.js' }),
  }))

  act(() => screen.getByRole('button', { name: 'Clear' }).click())
  expect(onErrorAdviceChange).toHaveBeenLastCalledWith(null)

  act(() => receiveMessage?.({
    data: { source: 'hafa-code-preview-console', level: 'error', message: 'ReferenceError: old is not defined', path: 'old.js', line: 3 },
  } as MessageEvent))
  expect(onErrorAdviceChange).toHaveBeenLastCalledWith(expect.objectContaining({
    advice: expect.objectContaining({ location: 'index.html' }),
  }))
})
