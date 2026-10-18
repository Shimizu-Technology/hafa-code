export const PYTHON_PROJECT_ROOT = '/home/pyodide/project'

const FRAME_LINE = /^(\s*)File "([^"]+)", line (\d+)(.*)$/

export interface CleanedTraceback {
  text: string
  hiddenFrames: number
}

/**
 * Removes Pyodide and standard-library frames from a Python traceback so a
 * learner sees only their own files, with project-relative paths. When the
 * traceback has no project frames at all, it is returned unchanged.
 */
export function cleanPythonTraceback(message: string, projectRoot = PYTHON_PROJECT_ROOT): CleanedTraceback {
  const prefix = `${projectRoot}/`
  const lines = message.split('\n')
  const hasProjectFrame = lines.some((line) => {
    const match = FRAME_LINE.exec(line)
    return match ? match[2].startsWith(prefix) : false
  })
  if (!hasProjectFrame) return { text: message, hiddenFrames: 0 }

  const kept: string[] = []
  let hiddenFrames = 0
  let skippingFrame = false
  let frameIndent = 0

  lines.forEach((line) => {
    const frame = FRAME_LINE.exec(line)
    if (frame) {
      frameIndent = frame[1].length
      skippingFrame = !frame[2].startsWith(prefix)
      if (skippingFrame) {
        hiddenFrames += 1
        return
      }
      kept.push(`${frame[1]}File "${frame[2].slice(prefix.length)}", line ${frame[3]}${frame[4]}`)
      return
    }

    // Source and caret lines belong to the frame above them and are indented deeper.
    const indent = line.length - line.trimStart().length
    if (skippingFrame && line.trim() && indent > frameIndent) return
    skippingFrame = false
    kept.push(line.split(prefix).join(''))
  })

  return { text: kept.join('\n'), hiddenFrames }
}
