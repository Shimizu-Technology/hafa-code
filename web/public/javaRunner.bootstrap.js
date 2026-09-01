const CHEERPJ_LOADER_URL = 'https://cjrtnc.leaningtech.com/4.3/loader.js'
const queuedMessages = []
let bootstrapFailure = ''

function reportRunFailure(request) {
  if (!request || request.type !== 'run') return
  self.postMessage({
    id: request.id,
    type: 'result',
    stdout: '',
    stderr: `The Java browser runtime could not start.\n${bootstrapFailure}`,
    exitCode: 1,
    durationMs: 0,
  })
}

self.onmessage = async function bootstrapJavaRunner(event) {
  if (event.data?.type !== '__hafa_initialize') {
    if (bootstrapFailure) {
      reportRunFailure(event.data)
      return
    }
    queuedMessages.push(event)
    return
  }

  try {
    const moduleUrl = new URL(String(event.data.moduleUrl), self.location.href)
    if (moduleUrl.origin !== self.location.origin) {
      throw new Error('The Java runner module must come from the Hafa Code origin.')
    }
    importScripts(CHEERPJ_LOADER_URL)
    await import(moduleUrl.href)
    const javaRunnerHandler = self.onmessage
    if (!javaRunnerHandler || javaRunnerHandler === bootstrapJavaRunner) {
      throw new Error('The Java runner module did not register its message handler.')
    }
    for (const queuedEvent of queuedMessages) javaRunnerHandler.call(self, queuedEvent)
    queuedMessages.length = 0
  } catch (error) {
    bootstrapFailure = error instanceof Error ? error.message : String(error)
    for (const queuedEvent of queuedMessages) reportRunFailure(queuedEvent.data)
    queuedMessages.length = 0
  }
}
