export type E2EEditorAction = {
  run: () => Promise<void> | void
}

export type E2EEditor = {
  getAction: (actionId: string) => E2EEditorAction | null
  hasTextFocus: () => boolean
}

export async function runE2EEditorAction(editors: readonly E2EEditor[], actionId: string): Promise<boolean> {
  const editor = editors.find((candidate) => candidate.hasTextFocus()) ?? editors.at(-1)
  const action = editor?.getAction(actionId)
  if (!action) return false

  await action.run()
  return true
}
