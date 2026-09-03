import { beforeEach, describe, expect, it } from 'vitest'
import { PROJECT_KINDS } from './codeRunner'
import { evaluatePracticeChallenge, practiceChallengeById, practiceChallengesFor } from './practiceLab'
import {
  completePracticeChallenge,
  completedPracticeChallengeIds,
  linkPracticeProject,
  practiceChallengeIdForProject,
  replacePracticeProjectId,
} from './practiceProgress'

describe('practice challenge catalog', () => {
  it('offers a three-step progression for every supported project kind', () => {
    PROJECT_KINDS.forEach((kind) => {
      const challenges = practiceChallengesFor(kind)
      expect(challenges).toHaveLength(3)
      expect(challenges.map((challenge) => challenge.difficulty)).toEqual(['Starter', 'Builder', 'Stretch'])
      challenges.forEach((challenge) => {
        expect(challenge.project.files.some((file) => file.path === challenge.project.entryPath)).toBe(true)
        expect(challenge.instructions.length).toBeGreaterThanOrEqual(2)
        expect(challenge.hints.length).toBeGreaterThanOrEqual(2)
      })
    })
  })

  it('checks both Java syntax requirements and normalized runtime output', () => {
    const challenge = practiceChallengeById('java-variables-greeting')!
    const files = [{
      path: 'Main.java',
      language: 'java' as const,
      content: 'class Main { public static void main(String[] args) { String name = "Lina"; int lessons = 4; } }',
    }]
    const result = evaluatePracticeChallenge(challenge, files, {
      status: 'success',
      stdout: 'Hafa adai, Lina!\r\nLessons: 4\n',
      stderr: '',
      durationMs: 10,
    })

    expect(result.passed).toBe(true)
    expect(result.checks.every((check) => check.passed)).toBe(true)
  })

  it('reports the individual Web requirements that still need work', () => {
    const challenge = practiceChallengeById('web-semantic-profile')!
    const result = evaluatePracticeChallenge(challenge, [{ path: 'index.html', language: 'html', content: '<main><h1>Lina</h1></main>' }])

    expect(result.passed).toBe(false)
    expect(result.checks).toEqual([
      { label: 'Use a main element', passed: true },
      { label: 'Add Lina as the main heading', passed: true },
      { label: 'Add the View work link', passed: false },
    ])
  })
})

describe('practice progress', () => {
  beforeEach(() => localStorage.clear())

  it('persists completion and keeps a challenge linked when a local project receives a cloud id', () => {
    linkPracticeProject('local-project', 'python-loop-stops')
    completePracticeChallenge('python-loop-stops')
    replacePracticeProjectId('local-project', '42')

    expect(practiceChallengeIdForProject('local-project')).toBeNull()
    expect(practiceChallengeIdForProject('42')).toBe('python-loop-stops')
    expect(completedPracticeChallengeIds()).toEqual(['python-loop-stops'])
  })
})
