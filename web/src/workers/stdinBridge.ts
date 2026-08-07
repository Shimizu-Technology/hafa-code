export function createStdinBridge(onRequest: () => void) {
  let pending: { resolve: (value: string) => void; reject: (reason: Error) => void } | null = null

  return {
    read() {
      if (pending) return Promise.reject(new Error('Program input is already pending.'))
      onRequest()
      return new Promise<string>((resolve, reject) => {
        pending = { resolve, reject }
      })
    },
    write(value: string) {
      const request = pending
      pending = null
      request?.resolve(value)
    },
    abort(reason = new Error('Execution stopped.')) {
      const request = pending
      pending = null
      request?.reject(reason)
    },
  }
}
