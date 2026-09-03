import { describe, expect, it } from 'vitest'
import { errorCoachGuideTopicIds } from './errorCoach'
import { PROJECT_KINDS } from './languageRegistry'
import { filterGuideTopics, languageGuideFor } from './languageGuides'

describe('language guides', () => {
  it('covers every supported project kind with stable, unique topics', () => {
    const allTopicIds = PROJECT_KINDS.flatMap((kind) => {
      const guide = languageGuideFor(kind)
      expect(guide.kind).toBe(kind)
      expect(guide.label).not.toBe('')
      expect(guide.introduction.length).toBeGreaterThan(30)
      expect(guide.topics.length).toBeGreaterThanOrEqual(8)
      return guide.topics.map((topic) => topic.id)
    })

    expect(new Set(allTopicIds).size).toBe(allTopicIds.length)
  })

  it.each(PROJECT_KINDS)('gives every %s topic a complete, runnable practice project', (kind) => {
    languageGuideFor(kind).topics.forEach((topic) => {
      expect(topic.id).toMatch(new RegExp(`^${kind}-`))
      expect(topic.summary.length).toBeGreaterThan(20)
      expect(topic.code.trim()).not.toBe('')
      expect(topic.expectedOutput.trim()).not.toBe('')
      expect(topic.commonMistake.length).toBeGreaterThan(20)
      expect(topic.practiceProject.title).toContain('Practice')
      expect(topic.practiceProject.files.length).toBeGreaterThan(0)
      expect(topic.practiceProject.files.some((file) => file.path === topic.practiceProject.entryPath)).toBe(true)

      if (kind === 'web') {
        expect(topic.practiceProject.files.map((file) => file.language)).toEqual(
          expect.arrayContaining(['html', 'css', 'javascript']),
        )
      } else {
        expect(topic.practiceProject.files[0].content).toBe(topic.code)
      }
    })
  })

  it.each(PROJECT_KINDS)('keeps every %s Error Coach destination in the language guide', (kind) => {
    const guideTopicIds = new Set(languageGuideFor(kind).topics.map((topic) => topic.id))
    errorCoachGuideTopicIds(kind).forEach((topicId) => expect(guideTopicIds.has(topicId)).toBe(true))
  })

  it('searches titles, descriptions, literal code, mistakes, and keywords without changing the guide', () => {
    const javaGuide = languageGuideFor('java')

    expect(filterGuideTopics(javaGuide, 'scanner').map((topic) => topic.id)).toContain('java-scanner-input')
    expect(filterGuideTopics(javaGuide, 'same object').map((topic) => topic.id)).toContain('java-strings')
    expect(filterGuideTopics(javaGuide, '  CLASS  ').map((topic) => topic.id)).toContain('java-classes-objects')
    expect(filterGuideTopics(languageGuideFor('web'), 'auto-fit').map((topic) => topic.id)).toContain('web-flexbox-grid')
    expect(filterGuideTopics(javaGuide, '')).toBe(javaGuide.topics)
  })
})
