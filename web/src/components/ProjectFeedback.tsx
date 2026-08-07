import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CornerDownRight, MessageSquare, RotateCcw, Send } from 'lucide-react'
import { api, type CloudProjectComment } from '../lib/api'
import type { ProjectFile } from '../lib/codeRunner'

interface ProjectFeedbackProps {
  projectId: string
  files: ProjectFile[]
  currentUserId?: number
}

export function ProjectFeedback({ projectId, files, currentUserId }: ProjectFeedbackProps) {
  const [comments, setComments] = useState<CloudProjectComment[]>([])
  const [body, setBody] = useState('')
  const [filePath, setFilePath] = useState('')
  const [lineNumber, setLineNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const unresolvedCount = useMemo(() => comments.filter((comment) => !comment.resolved_at).length, [comments])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setLoading(true)
      setError('')
    })

    api.getProjectComments(projectId).then((res) => {
      if (cancelled) return
      if (res.data) {
        setComments(res.data.comments)
        api.markProjectCommentsRead(projectId)
      } else {
        setError(res.error || 'Could not load feedback.')
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [projectId])

  const submitComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedBody = body.trim()
    if (!trimmedBody || submitting) return

    setSubmitting(true)
    setError('')
    const parsedLineNumber = Number.parseInt(lineNumber, 10)
    const res = await api.createProjectComment(projectId, {
      body: trimmedBody,
      ...(filePath ? { file_path: filePath } : {}),
      ...(filePath && Number.isInteger(parsedLineNumber) && parsedLineNumber > 0 ? { line_number: parsedLineNumber } : {}),
    })

    if (res.data) {
      setComments((current) => [...current, res.data!])
      setBody('')
      setLineNumber('')
    } else {
      setError(res.error || 'Could not post feedback.')
    }
    setSubmitting(false)
  }

  const toggleResolved = async (comment: CloudProjectComment) => {
    const res = await api.resolveProjectComment(projectId, comment.id, !comment.resolved_at)
    if (res.data) {
      setComments((current) => current.map((candidate) => candidate.id === res.data!.id ? res.data! : candidate))
    } else {
      setError(res.error || 'Could not update the feedback thread.')
    }
  }

  return (
    <section className="project-feedback panel surface-grid" aria-labelledby="project-feedback-title">
      <div className="panel-header feedback-header">
        <div>
          <p className="eyebrow">Review</p>
          <h2 id="project-feedback-title"><MessageSquare size={18} /> Teacher feedback</h2>
          <p className="helper-text">Private to the student who owns this project and the class teaching staff.</p>
        </div>
        <span className="feedback-count">{unresolvedCount} open</span>
      </div>

      {loading ? (
        <p className="helper-text">Loading feedback…</p>
      ) : comments.length === 0 ? (
        <p className="empty-project-list">No feedback yet. Start a focused project conversation here.</p>
      ) : (
        <div className="feedback-list" aria-live="polite">
          {comments.map((comment) => (
            <article key={comment.id} className={`feedback-comment${comment.resolved_at ? ' resolved' : ''}`}>
              <div className="feedback-comment-meta">
                <div>
                  <strong>{comment.author.id === currentUserId ? 'You' : comment.author.full_name}</strong>
                  <span>{comment.author.role}</span>
                </div>
                <time dateTime={comment.created_at}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(comment.created_at))}</time>
              </div>
              {(comment.file_path || comment.line_number) && (
                <p className="feedback-location">
                  {comment.file_path}{comment.line_number ? ` · line ${comment.line_number}` : ''}
                </p>
              )}
              <p>{comment.body}</p>
              <button className="secondary compact" type="button" onClick={() => toggleResolved(comment)}>
                {comment.resolved_at ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
                {comment.resolved_at ? 'Reopen' : 'Resolve'}
              </button>
            </article>
          ))}
        </div>
      )}

      <form className="feedback-form" onSubmit={submitComment}>
        <label htmlFor="feedback-body">
          <span><CornerDownRight size={14} /> Add feedback or reply</span>
          <textarea
            id="feedback-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Ask a question, explain the next step, or reply to the review."
            maxLength={10_000}
            required
          />
        </label>
        <div className="feedback-reference-row">
          <label htmlFor="feedback-file">
            <span>File (optional)</span>
            <select id="feedback-file" value={filePath} onChange={(event) => {
              setFilePath(event.target.value)
              if (!event.target.value) setLineNumber('')
            }}>
              <option value="">Whole project</option>
              {files.map((file) => <option key={file.path} value={file.path}>{file.path}</option>)}
            </select>
          </label>
          <label htmlFor="feedback-line">
            <span>Line (optional)</span>
            <input
              id="feedback-line"
              type="number"
              min="1"
              inputMode="numeric"
              value={lineNumber}
              onChange={(event) => setLineNumber(event.target.value)}
              disabled={!filePath}
            />
          </label>
          <button type="submit" disabled={!body.trim() || submitting}>
            <Send size={15} /> {submitting ? 'Posting…' : 'Post'}
          </button>
        </div>
        {error && <p className="feedback-error" role="alert">{error}</p>}
      </form>
    </section>
  )
}
