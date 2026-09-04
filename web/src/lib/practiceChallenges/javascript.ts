import { tokenizer } from 'acorn'

/** Preserves JavaScript structure while masking literal tokens without changing offsets. */
function executableStructure(source: string) {
  const structure = source.split('')
  const comments: Array<{ start: number; end: number }> = []
  try {
    const tokens = tokenizer(source, {
      ecmaVersion: 'latest',
      onComment: (_isBlock, _text, start, end) => comments.push({ start, end }),
    })
    while (true) {
      const token = tokens.getToken()
      if (token.type.label === 'eof') break
      if (!['regexp', 'string', 'template'].includes(token.type.label)) continue
      for (let index = token.start; index < token.end; index += 1) {
        if (structure[index] !== '\n') structure[index] = ' '
      }
    }
    comments.forEach(({ start, end }) => {
      for (let index = start; index < end; index += 1) {
        if (structure[index] !== '\n') structure[index] = ' '
      }
    })
  } catch {
    return ''
  }
  return structure.join('')
}

function closingBraceIndex(structure: string, openingBrace: number) {
  let depth = 1
  for (let index = openingBrace + 1; index < structure.length; index += 1) {
    if (structure[index] === '{') depth += 1
    if (structure[index] === '}') depth -= 1
    if (depth === 0) return index
  }
  return -1
}

function bracedBody(source: string, openingBrace: number) {
  const closingBrace = closingBraceIndex(executableStructure(source), openingBrace)
  return closingBrace === -1 ? '' : source.slice(openingBrace + 1, closingBrace)
}

function executableMatches(source: string, pattern: RegExp) {
  const structure = executableStructure(source)
  pattern.lastIndex = 0
  const matches: RegExpExecArray[] = []
  let match = pattern.exec(source)
  while (match) {
    if (structure[match.index] === source[match.index]) matches.push(match)
    match = pattern.exec(source)
  }
  return matches
}

/** Creates a scope that returns only the requested receiver's inline or named event handler body. */
export function eventHandlerBody(receiver: string, eventName: string) {
  const escapedReceiver = receiver.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedEvent = eventName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  return (source: string) => {
    const standaloneReceiver = `(?<![$.\\w])${escapedReceiver}`
    const inlineStart = new RegExp(`${standaloneReceiver}\\s*\\.\\s*addEventListener\\s*\\(\\s*["']${escapedEvent}["']\\s*,\\s*(?:(?:function(?:\\s+[$\\w]+)?\\s*\\([^)]*\\))|(?:(?:\\([^)]*\\)|[$A-Z_a-z][$\\w]*)\\s*=>))\\s*\\{`, 'g')
    const bodies = executableMatches(source, inlineStart).map((match) => (
      bracedBody(source, match.index + match[0].lastIndexOf('{'))
    ))

    const namedListener = new RegExp(`${standaloneReceiver}\\s*\\.\\s*addEventListener\\s*\\(\\s*["']${escapedEvent}["']\\s*,\\s*([$A-Z_a-z][$\\w]*)\\s*\\)`, 'g')
    executableMatches(source, namedListener).forEach((listener) => {
      const escapedCallback = listener[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const namedStart = new RegExp(`(?:function\\s+${escapedCallback}\\s*\\([^)]*\\)|(?:const|let|var)\\s+${escapedCallback}\\s*=\\s*(?:(?:function\\s*\\([^)]*\\))|(?:(?:\\([^)]*\\)|[$A-Z_a-z][$\\w]*)\\s*=>)))\\s*\\{`, 'g')
      executableMatches(source, namedStart).forEach((match) => {
        bodies.push(bracedBody(source, match.index + match[0].lastIndexOf('{')))
      })
    })

    return bodies.join('\n')
  }
}
