import { tokenizer } from 'acorn'

/** Preserves JavaScript structure while masking literal tokens without changing offsets. */
function executableStructure(source: string) {
  const structure = source.split('')
  try {
    const tokens = tokenizer(source, { ecmaVersion: 'latest' })
    while (true) {
      const token = tokens.getToken()
      if (token.type.label === 'eof') break
      if (!['regexp', 'string', 'template'].includes(token.type.label)) continue
      for (let index = token.start; index < token.end; index += 1) {
        if (structure[index] !== '\n') structure[index] = ' '
      }
    }
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

function executableMatch(source: string, pattern: RegExp) {
  const structure = executableStructure(source)
  pattern.lastIndex = 0
  let match = pattern.exec(source)
  while (match) {
    if (structure[match.index] === source[match.index]) return match
    match = pattern.exec(source)
  }
  return null
}

/** Creates a scope that returns only the requested receiver's inline or named event handler body. */
export function eventHandlerBody(receiver: string, eventName: string) {
  const escapedReceiver = receiver.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedEvent = eventName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  return (source: string) => {
    const inlineStart = new RegExp(`\\b${escapedReceiver}\\s*\\.\\s*addEventListener\\s*\\(\\s*["']${escapedEvent}["']\\s*,\\s*(?:(?:function(?:\\s+[$\\w]+)?\\s*\\([^)]*\\))|(?:(?:\\([^)]*\\)|[$A-Z_a-z][$\\w]*)\\s*=>))\\s*\\{`, 'g')
    const inlineMatch = executableMatch(source, inlineStart)
    if (inlineMatch) return bracedBody(source, inlineMatch.index + inlineMatch[0].lastIndexOf('{'))

    const namedListener = new RegExp(`\\b${escapedReceiver}\\s*\\.\\s*addEventListener\\s*\\(\\s*["']${escapedEvent}["']\\s*,\\s*([$A-Z_a-z][$\\w]*)\\s*\\)`, 'g')
    const callbackName = executableMatch(source, namedListener)?.[1]
    if (!callbackName) return ''
    const escapedCallback = callbackName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const namedStart = new RegExp(`(?:function\\s+${escapedCallback}\\s*\\([^)]*\\)|(?:const|let|var)\\s+${escapedCallback}\\s*=\\s*(?:(?:function\\s*\\([^)]*\\))|(?:(?:\\([^)]*\\)|[$A-Z_a-z][$\\w]*)\\s*=>)))\\s*\\{`, 'g')
    const namedMatch = executableMatch(source, namedStart)
    return namedMatch ? bracedBody(source, namedMatch.index + namedMatch[0].lastIndexOf('{')) : ''
  }
}
