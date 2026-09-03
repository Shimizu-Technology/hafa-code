import { BookOpen, Lightbulb, MapPin } from 'lucide-react'
import { languageGuideFor } from '../lib/languageGuides'
import type { ErrorCoachAdvice } from '../lib/errorCoach'
import type { ProjectKind } from '../lib/projectTypes'

export function ErrorCoach({ advice, kind, onOpenGuideTopic }: { advice: ErrorCoachAdvice; kind: ProjectKind; onOpenGuideTopic: (topicId: string) => void }) {
  const topic = languageGuideFor(kind).topics.find((candidate) => candidate.id === advice.guideTopicId)
  return (
    <aside className="error-coach" aria-label="Error coach">
      <div className="error-coach-heading">
        <span><Lightbulb size={16} /> Error coach</span>
        {advice.location && <small><MapPin size={13} /> {advice.location}</small>}
      </div>
      <h3>{advice.title}</h3>
      <p>{advice.explanation}</p>
      <ol>{advice.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      <button className="secondary compact" type="button" onClick={() => onOpenGuideTopic(advice.guideTopicId)}>
        <BookOpen size={15} /> Review {topic?.title ?? 'the guide'}
      </button>
    </aside>
  )
}
