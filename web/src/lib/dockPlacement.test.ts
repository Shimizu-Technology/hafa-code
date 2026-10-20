import { describe, expect, it } from 'vitest'
import { dockLift } from './dockPlacement'

// A 360px dock, 90px tall, 16px from the bottom of a 600px window, at x 904–1264.
const dock = { left: 904, right: 1264, height: 90, restingBottom: 16 }

describe('dockLift', () => {
  it('stays put when nothing is underneath', () => {
    expect(dockLift(dock, 600, [{ top: 100, bottom: 140, left: 904, right: 1000 }])).toBe(0)
    // Beside the dock, not under it.
    expect(dockLift(dock, 600, [{ top: 560, bottom: 590, left: 300, right: 800 }])).toBe(0)
  })

  it('rises just above a footer control, then above the next one it would meet', () => {
    // Copy output at 548–584 and the page footer at 590–600.
    const copyOutput = { top: 548, bottom: 584, left: 1150, right: 1260 }
    const footer = { top: 590, bottom: 600, left: 0, right: 1280 }
    expect(dockLift(dock, 600, [copyOutput, footer])).toBe(600 - 16 - 548 + 8)
    // A control right above Copy output is cleared too.
    const clear = { top: 470, bottom: 500, left: 1100, right: 1200 }
    expect(dockLift(dock, 600, [copyOutput, clear])).toBe(600 - 16 - 470 + 8)
  })

  it('gives up rather than leaving the screen', () => {
    const wall = Array.from({ length: 12 }, (_, index) => ({ top: 560 - index * 50, bottom: 600 - index * 50, left: 900, right: 1270 }))
    expect(dockLift(dock, 600, wall)).toBe(0)
  })
})
