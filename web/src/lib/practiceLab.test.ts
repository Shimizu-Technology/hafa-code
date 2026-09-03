import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROJECT_KINDS } from './codeRunner'
import { evaluatePracticeChallenge, practiceChallengeById, practiceChallengesFor } from './practiceLab'
import {
  completePracticeChallenge,
  completedPracticeChallengeIds,
  linkPracticeProject,
  practiceChallengeIdForProject,
  preservePracticeConflictLinks,
  resetPracticeProgressCache,
  remapPendingPracticeCheck,
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
      content: 'class Main {\n  public static void main(String[] args) {\n    String name = "Lina";\n    int lessons = 4;\n  }\n}',
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

  it('rejects a View work anchor without a destination', () => {
    const challenge = practiceChallengeById('web-semantic-profile')!
    const result = evaluatePracticeChallenge(challenge, [{ path: 'index.html', language: 'html', content: '<main><h1>Lina</h1><a>View work</a></main>' }])

    expect(result.checks.find((check) => check.label === 'Add the View work link')?.passed).toBe(false)
  })

  it('requires counter updates to happen inside the registered click handler', () => {
    const challenge = practiceChallengeById('web-click-counter')!
    const disconnectedSource = 'button.addEventListener("click", () => {})\ncount += 1\noutput.textContent = count\n'
    const result = evaluatePracticeChallenge(challenge, [{ path: 'script.js', language: 'javascript', content: disconnectedSource }])

    expect(result.passed).toBe(false)
    expect(result.checks.map((check) => check.passed)).toEqual([true, false, false])
  })

  it('does not count syntax examples hidden in comments or string literals', () => {
    const rubyChallenge = practiceChallengeById('ruby-loop-stops')!
    const rubyResult = evaluatePracticeChallenge(rubyChallenge, [{
      path: 'main.rb',
      language: 'ruby',
      content: '# (1..3).each do |stop|\nexample = "for stop in stops"\nputs "Stop 1"\n',
    }], { status: 'success', stdout: 'Stop 1\nStop 2\nStop 3', stderr: '', durationMs: 1 })

    const webChallenge = practiceChallengeById('web-semantic-profile')!
    const webResult = evaluatePracticeChallenge(webChallenge, [{
      path: 'index.html',
      language: 'html',
      content: '<!-- <main><h1>Lina</h1><a href="/work">View work</a></main> -->',
    }])

    const cssChallenge = practiceChallengeById('web-responsive-grid')!
    const cssResult = evaluatePracticeChallenge(cssChallenge, [{
      path: 'style.css',
      language: 'css',
      content: '/* .project-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 1rem; } */',
    }])

    expect(rubyResult.checks[0].passed).toBe(false)
    expect(webResult.checks.every((check) => !check.passed)).toBe(true)
    expect(cssResult.checks.every((check) => !check.passed)).toBe(true)
  })

  it('accepts a nested function callback and declarations without final semicolons', () => {
    const counterChallenge = practiceChallengeById('web-click-counter')!
    const counterResult = evaluatePracticeChallenge(counterChallenge, [{
      path: 'script.js',
      language: 'javascript',
      content: 'button.addEventListener("click", function (event) {\n  if (event) { count += 1 }\n  output.textContent = count\n})',
    }])
    const cssChallenge = practiceChallengeById('web-responsive-grid')!
    const cssResult = evaluatePracticeChallenge(cssChallenge, [{
      path: 'style.css',
      language: 'css',
      content: '.project-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 1rem }',
    }])

    expect(counterResult.checks.every((check) => check.passed)).toBe(true)
    expect(cssResult.checks.every((check) => check.passed)).toBe(true)
  })

  it('does not accept a zero-sized responsive grid gap', () => {
    const challenge = practiceChallengeById('web-responsive-grid')!
    const result = evaluatePracticeChallenge(challenge, [{
      path: 'style.css',
      language: 'css',
      content: '.project-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 0rem; }',
    }])

    expect(result.checks.find((check) => check.label === 'Add space between cards')?.passed).toBe(false)
  })
})

describe('practice progress', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPracticeProgressCache()
  })

  it('persists completion and keeps a challenge linked when a local project receives a cloud id', () => {
    linkPracticeProject('local-project', 'python-loop-stops')
    completePracticeChallenge('python-loop-stops')
    replacePracticeProjectId('local-project', '42')

    expect(practiceChallengeIdForProject('local-project')).toBeNull()
    expect(practiceChallengeIdForProject('42')).toBe('python-loop-stops')
    expect(completedPracticeChallengeIds()).toEqual(['python-loop-stops'])
  })

  it('remaps only the pending check that belongs to the saved local project', () => {
    const pending = { projectId: 'local-project', challengeId: 'python-loop-stops', files: [] }

    expect(remapPendingPracticeCheck(pending, 'local-project', '42')).toEqual({ projectId: '42', challengeId: 'python-loop-stops', files: [] })
    expect(remapPendingPracticeCheck(pending, 'another-project', '42')).toBe(pending)
  })

  it('keeps a conflict copy and restored server project linked to the challenge', () => {
    linkPracticeProject('local-project', 'python-loop-stops')

    preservePracticeConflictLinks('local-project', 'conflict-copy', 'server-project')

    expect(practiceChallengeIdForProject('local-project')).toBeNull()
    expect(practiceChallengeIdForProject('conflict-copy')).toBe('python-loop-stops')
    expect(practiceChallengeIdForProject('server-project')).toBe('python-loop-stops')
  })

  it('keeps practice usable when the browser blocks storage writes', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Storage full') })

    expect(linkPracticeProject('local-project', 'python-loop-stops')).toBe(false)
    expect(completePracticeChallenge('python-loop-stops')).toBe(false)
    expect(practiceChallengeIdForProject('local-project')).toBe('python-loop-stops')
    expect(completedPracticeChallengeIds()).toContain('python-loop-stops')

    setItem.mockRestore()
  })
})
