export function remapRunnerInstanceKey(keys: ReadonlyMap<string, string>, previousProjectId: string, nextProjectId: string) {
  if (previousProjectId === nextProjectId) return keys
  const nextKeys = new Map(keys)
  nextKeys.set(nextProjectId, keys.get(previousProjectId) ?? previousProjectId)
  nextKeys.delete(previousProjectId)
  return nextKeys
}
