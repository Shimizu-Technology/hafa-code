import { describe, expect, it } from 'vitest'
import { appendTerminalChunks, emptyTerminalBuffer } from './terminalBuffer'

let nextId = 0
const id = () => `line-${nextId++}`

describe('appendTerminalChunks', () => {
  it('merges streamed text of the same kind and keeps other kinds separate', () => {
    const buffer = appendTerminalChunks(emptyTerminalBuffer([{ id: 'cmd', kind: 'command', text: 'python main.py' }]), [
      { kind: 'stdout', text: 'Name? ' },
      { kind: 'input', text: 'Leon' },
      { kind: 'stdout', text: 'Hi ' },
      { kind: 'stdout', text: 'Leon\n' },
      { kind: 'stderr', text: 'warning\n' },
    ], id)
    expect(buffer.lines.map((line) => [line.kind, line.text])).toEqual([
      ['command', 'python main.py'],
      ['stdout', 'Name? '],
      ['input', 'Leon'],
      ['stdout', 'Hi Leon\n'],
      ['stderr', 'warning\n'],
    ])
  })

  it('keeps only the newest lines, pins the command, and counts what was hidden', () => {
    let buffer = emptyTerminalBuffer([{ id: 'cmd', kind: 'command', text: 'python main.py' }])
    for (let batch = 0; batch < 5; batch += 1) {
      buffer = appendTerminalChunks(buffer, [{ kind: 'stdout', text: Array.from({ length: 10 }, (_, index) => `${batch * 10 + index}\n`).join('') }], id, 25)
    }
    expect(buffer.lines[0].kind).toBe('command')
    expect(buffer.hiddenLineCount).toBe(25)
    expect(buffer.lines[1].text.split('\n').filter(Boolean)).toEqual(Array.from({ length: 25 }, (_, index) => String(index + 25)))
  })

  it('returns the same buffer when nothing is appended', () => {
    const buffer = emptyTerminalBuffer()
    expect(appendTerminalChunks(buffer, [], id)).toBe(buffer)
  })
})
