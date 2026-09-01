import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, Copy, Lightbulb, Play, Search, Terminal, TriangleAlert, X } from 'lucide-react'
import { useModalFocus } from '../hooks/useModalFocus'
import { filterGuideTopics, languageGuideFor, type LanguageGuideTopic } from '../lib/languageGuides'
import type { ProjectKind } from '../lib/projectTypes'
import { writeClipboardText } from '../lib/workspace'

interface LanguageGuideProps {
  kind: ProjectKind
  open: boolean
  onClose: () => void
  onTryExample: (topic: LanguageGuideTopic) => void
}

type CopyFeedback = {
  topicId: string
  status: 'copied' | 'failed'
} | null

function inlineCode(text: string) {
  return text.split(/(`[^`]+`)/g).filter(Boolean).map((part, index) => (
    part.startsWith('`') && part.endsWith('`')
      ? <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>
      : part
  ))
}

export function LanguageGuide({ kind, open, onClose, onTryExample }: LanguageGuideProps) {
  const guide = languageGuideFor(kind)
  const [query, setQuery] = useState('')
  const [selectedTopicId, setSelectedTopicId] = useState(guide.topics[0].id)
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>(null)
  const dialogRef = useModalFocus<HTMLElement>(open, onClose)
  const filteredTopics = useMemo(() => filterGuideTopics(guide, query), [guide, query])
  const selectedTopic = filteredTopics.find((topic) => topic.id === selectedTopicId) ?? filteredTopics[0] ?? null

  useEffect(() => {
    if (!copyFeedback) return
    const timer = window.setTimeout(() => setCopyFeedback(null), 2_400)
    return () => window.clearTimeout(timer)
  }, [copyFeedback])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  const copyCode = async (topic: LanguageGuideTopic) => {
    const copied = await writeClipboardText(topic.code)
    setCopyFeedback({ topicId: topic.id, status: copied ? 'copied' : 'failed' })
  }

  return (
    <div className="guide-backdrop" role="presentation" onClick={onClose}>
      <section
        ref={dialogRef}
        className="language-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="language-guide-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="guide-header">
          <div className="guide-heading-mark" aria-hidden="true"><BookOpen size={23} /></div>
          <div>
            <p className="eyebrow">Quick reference · follows your project</p>
            <h2 id="language-guide-title">{guide.label} Language Guide</h2>
            <p>{guide.introduction}</p>
          </div>
          <button className="ghost icon-button guide-close-button" type="button" onClick={onClose} aria-label="Close language guide">
            <X size={19} />
          </button>
        </header>

        <div className="guide-layout">
          <aside className="guide-index" aria-label={`${guide.label} guide topics`}>
            <label className="guide-search" htmlFor="guide-search-input">
              <Search size={17} />
              <input
                id="guide-search-input"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search syntax or a concept"
                autoComplete="off"
                data-modal-initial-focus
              />
            </label>
            <p className="guide-result-count" aria-live="polite">
              {filteredTopics.length} of {guide.topics.length} topics
            </p>
            <nav className="guide-topic-list">
              {filteredTopics.map((topic, index) => (
                <button
                  key={topic.id}
                  className={topic.id === selectedTopic?.id ? 'active' : ''}
                  type="button"
                  aria-current={topic.id === selectedTopic?.id ? 'page' : undefined}
                  onClick={() => setSelectedTopicId(topic.id)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{topic.title}</strong>
                </button>
              ))}
            </nav>
          </aside>

          <article className="guide-page" aria-live="polite">
            {selectedTopic ? (
              <>
                <div className="guide-page-heading">
                  <div>
                    <p className="eyebrow">{guide.label} field note</p>
                    <h3>{selectedTopic.title}</h3>
                    <p>{inlineCode(selectedTopic.summary)}</p>
                  </div>
                  <span className="guide-topic-stamp">{selectedTopic.id.split('-').slice(1).join(' / ')}</span>
                </div>

                <section className="guide-code-section" aria-label={`${selectedTopic.title} example`}>
                  <div className="guide-section-heading">
                    <span><Terminal size={15} /> Runnable example</span>
                    <button className="guide-copy-button" type="button" onClick={() => copyCode(selectedTopic)}>
                      {copyFeedback?.topicId === selectedTopic.id && copyFeedback.status === 'copied'
                        ? <Check size={15} />
                        : copyFeedback?.topicId === selectedTopic.id && copyFeedback.status === 'failed'
                          ? <TriangleAlert size={15} />
                          : <Copy size={15} />}
                      {copyFeedback?.topicId === selectedTopic.id && copyFeedback.status === 'copied'
                        ? 'Copied'
                        : copyFeedback?.topicId === selectedTopic.id && copyFeedback.status === 'failed'
                          ? 'Copy failed'
                          : 'Copy'}
                    </button>
                  </div>
                  <pre><code>{selectedTopic.code}</code></pre>
                  {copyFeedback?.topicId === selectedTopic.id && copyFeedback.status === 'failed' && (
                    <p className="guide-copy-error" role="status">Copy was blocked. Select the code and copy it manually.</p>
                  )}
                </section>

                <div className="guide-notes-grid">
                  <section className="guide-note guide-output-note">
                    <div><Lightbulb size={17} /><h4>What you should see</h4></div>
                    <pre>{selectedTopic.expectedOutput}</pre>
                  </section>
                  <section className="guide-note guide-mistake-note">
                    <div><TriangleAlert size={17} /><h4>Common mistake</h4></div>
                    <p>{inlineCode(selectedTopic.commonMistake)}</p>
                  </section>
                </div>

                <footer className="guide-page-footer">
                  <p><strong>Your current code stays untouched.</strong> Trying this creates a separate practice project with a complete example.</p>
                  <button type="button" onClick={() => onTryExample(selectedTopic)}>
                    <Play size={16} /> Try example
                  </button>
                </footer>
              </>
            ) : (
              <div className="guide-empty-state">
                <Search size={26} />
                <h3>No topics match “{query}”</h3>
                <p>Try a broader word such as variable, loop, string, class, array, form, or layout.</p>
                <button className="secondary" type="button" onClick={() => setQuery('')}>Clear search</button>
              </div>
            )}
          </article>
        </div>
      </section>
    </div>
  )
}
