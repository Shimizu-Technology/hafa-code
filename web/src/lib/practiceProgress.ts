const STORAGE_KEY = 'hafa-code-practice-progress-v1'

interface PracticeProgress {
  completedChallengeIds: string[]
  projectChallenges: Record<string, string>
}

const emptyProgress = (): PracticeProgress => ({ completedChallengeIds: [], projectChallenges: {} })

function loadProgress(): PracticeProgress {
  try {
    const candidate = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<PracticeProgress> | null
    if (!candidate) return emptyProgress()
    return {
      completedChallengeIds: Array.isArray(candidate.completedChallengeIds)
        ? candidate.completedChallengeIds.filter((id): id is string => typeof id === 'string')
        : [],
      projectChallenges: candidate.projectChallenges && typeof candidate.projectChallenges === 'object'
        ? Object.fromEntries(Object.entries(candidate.projectChallenges).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
        : {},
    }
  } catch {
    return emptyProgress()
  }
}

function saveProgress(progress: PracticeProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
}

/** Lists stable challenge ids that this browser has completed. */
export function completedPracticeChallengeIds() {
  return loadProgress().completedChallengeIds
}

/** Returns the challenge associated with a private practice project. */
export function practiceChallengeIdForProject(projectId: string) {
  return loadProgress().projectChallenges[projectId] ?? null
}

/** Associates a newly created project with its originating challenge. */
export function linkPracticeProject(projectId: string, challengeId: string) {
  const progress = loadProgress()
  progress.projectChallenges[projectId] = challengeId
  saveProgress(progress)
}

/** Preserves a practice session when cloud sync replaces a local UUID with a server id. */
export function replacePracticeProjectId(previousId: string, nextId: string) {
  if (previousId === nextId) return
  const progress = loadProgress()
  const challengeId = progress.projectChallenges[previousId]
  if (!challengeId) return
  delete progress.projectChallenges[previousId]
  progress.projectChallenges[nextId] = challengeId
  saveProgress(progress)
}

/** Records a completed challenge once while keeping attempts unlimited. */
export function completePracticeChallenge(challengeId: string) {
  const progress = loadProgress()
  if (!progress.completedChallengeIds.includes(challengeId)) {
    progress.completedChallengeIds.push(challengeId)
    saveProgress(progress)
  }
}
