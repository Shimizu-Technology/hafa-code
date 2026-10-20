import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createLazyModule } from './lazyModule'

describe('createLazyModule', () => {
  it('loads once, reports a failure without throwing into React, and retries', async () => {
    const importer = vi.fn<() => Promise<{ answer: number }>>()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValue({ answer: 42 })
    const lazy = createLazyModule(importer)

    function Probe({ needed }: { needed: boolean }) {
      const { module, state, retry } = lazy.useModule(needed)
      return <button type="button" onClick={retry}>{state}:{module?.answer ?? '-'}</button>
    }

    const { rerender } = render(<Probe needed={false} />)
    expect(screen.getByRole('button').textContent).toBe('idle:-')
    expect(importer).not.toHaveBeenCalled()

    rerender(<Probe needed />)
    await act(async () => {})
    expect(screen.getByRole('button').textContent).toBe('failed:-')

    await act(async () => screen.getByRole('button').click())
    expect(screen.getByRole('button').textContent).toBe('ready:42')
    expect(lazy.peek()).toEqual({ answer: 42 })
    await expect(lazy.load()).resolves.toEqual({ answer: 42 })
    expect(importer).toHaveBeenCalledTimes(2)
  })
})
