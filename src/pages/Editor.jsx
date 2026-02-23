import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchAssignment, saveAssignment, blankAssignment, makeSlug } from '../lib/store'
import { downloadScormPackage } from '../lib/scorm'
import { toast } from '../lib/toast'
import styles from './Editor.module.css'

const TABS = ['meta', 'part1', 'part2', 'export']

export default function Editor() {
  const { slug } = useParams()
  const nav = useNavigate()
  const isNew = !slug

  const [assignment, setAssignment] = useState(null)
  const [activeTab, setActiveTab] = useState('meta')
  const [dirty, setDirty] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (isNew) {
      setAssignment(blankAssignment())
    } else {
      const a = await fetchAssignment(slug)
      if (!a) { nav('/dashboard'); return }
      setAssignment(a)
    }
  }, [slug])

  if (!assignment) return <div className={styles.loading}>Loading…</div>

  function update(path, value) {
    setAssignment(prev => {
      const next = deepClone(prev)
      setNested(next, path, value)
      return next
    })
    setDirty(true)
  }

  function save() {
    // Auto-generate slug from title + chapterLabel if new
    const a = { ...assignment }
    if (!a.slug || isNew) {
      a.slug = makeSlug(a.title, a.chapterLabel)
    }
    a.updatedAt = new Date().toISOString()
    if (isNew) a.createdAt = new Date().toISOString()
    await saveAssignment(a)
    setAssignment(a)
    setDirty(false)
    toast('Saved ✓', 'success')
    if (isNew) nav(`/edit/${a.slug}`, { replace: true })
  }

  async function handleDownload() {
    if (dirty) { toast('Save first before downloading', 'error'); return }
    setDownloading(true)
    try {
      await downloadScormPackage(assignment)
      toast(`Downloaded ${assignment.slug}.zip`, 'success')
    } catch (e) {
      toast('Download failed: ' + e.message, 'error')
    }
    setDownloading(false)
  }

  // ── AI generation ────────────────────────────
  async function generateWithAI() {
    const apiKey = prompt('Enter your Anthropic API key to generate content:')
    if (!apiKey) return

    setGenerating(true)
    toast('Generating assignment content…')

    try {
      const prompt = buildGenerationPrompt(assignment)
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-calls': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }]
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'API error')

      const text = data.content?.[0]?.text || ''
      const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text

      const generated = JSON.parse(jsonStr.trim())

      setAssignment(prev => ({
        ...prev,
        title:        generated.title        || prev.title,
        chapterLabel: generated.chapterLabel  || prev.chapterLabel,
        p1: {
          ...prev.p1,
          title:       generated.p1?.title       || prev.p1.title,
          description: generated.p1?.description || prev.p1.description,
          questions:   generated.p1?.questions   || prev.p1.questions,
        },
        p2: {
          ...prev.p2,
          title:               generated.p2?.title               || prev.p2.title,
          description:         generated.p2?.description         || prev.p2.description,
          systemPrompt:        generated.p2?.systemPrompt        || prev.p2.systemPrompt,
          openingMessage:      generated.p2?.openingMessage      || prev.p2.openingMessage,
          scenarioContext:     generated.p2?.scenarioContext      || prev.p2.scenarioContext,
          evaluationCriteria:  generated.p2?.evaluationCriteria  || prev.p2.evaluationCriteria,
          roleLabel:           generated.p2?.roleLabel           || prev.p2.roleLabel,
          aiAvatarLabel:       generated.p2?.aiAvatarLabel       || prev.p2.aiAvatarLabel,
        }
      }))
      setDirty(true)
      toast('Content generated! Review and save.', 'success')
    } catch (e) {
      toast('Generation failed: ' + e.message, 'error')
      console.error(e)
    }
    setGenerating(false)
  }

  return (
    <div className={styles.page}>
      {/* ── Top bar ── */}
      <header className={styles.topBar}>
        <button className={`btn btn-ghost btn-sm`} onClick={() => nav('/dashboard')}>
          ← Dashboard
        </button>
        <div className={styles.topCenter}>
          <div className={styles.topTitle}>
            {isNew ? 'New Assignment' : assignment.title}
          </div>
          {assignment.slug && (
            <div className={styles.topSlug}>/{assignment.slug}</div>
          )}
        </div>
        <div className={styles.topActions}>
          {dirty && <span className={styles.unsaved}>● Unsaved</span>}
          <button className="btn btn-ghost btn-sm" onClick={() => window.open(`/${assignment.slug}`, '_blank')} disabled={!assignment.slug || isNew}>
            ↗ Preview
          </button>
          <button className={`btn btn-ghost btn-sm`} onClick={generateWithAI} disabled={generating}>
            {generating ? '⏳ Generating…' : '✦ AI Generate'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={save}>
            {dirty ? 'Save *' : 'Saved ✓'}
          </button>
        </div>
      </header>

      {/* ── Tab nav ── */}
      <nav className={styles.tabNav}>
        {[
          { id:'meta',  label:'Assignment Info' },
          { id:'part1', label:`Part 1 — Quiz (${assignment.p1?.questions?.length || 0} questions)` },
          { id:'part2', label:'Part 2 — Scenario' },
          { id:'export', label:'↓ Export SCORM' },
        ].map(t => (
          <button
            key={t.id}
            className={`${styles.tabBtn} ${activeTab === t.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Content ── */}
      <div className={styles.content}>

        {/* META */}
        {activeTab === 'meta' && (
          <MetaTab assignment={assignment} update={update} />
        )}

        {/* PART 1 */}
        {activeTab === 'part1' && (
          <Part1Tab assignment={assignment} update={update} />
        )}

        {/* PART 2 */}
        {activeTab === 'part2' && (
          <Part2Tab assignment={assignment} update={update} />
        )}

        {/* EXPORT */}
        {activeTab === 'export' && (
          <ExportTab
            assignment={assignment}
            onDownload={handleDownload}
            downloading={downloading}
            dirty={dirty}
            onSave={save}
          />
        )}
      </div>
    </div>
  )
}

/* ================================================================
   META TAB
================================================================ */
function MetaTab({ assignment, update }) {
  return (
    <div className={styles.tabContent}>
      <SectionCard title="Assignment Info">
        <Field label="Assignment Title" hint="Shown in the header and Canvas">
          <input
            value={assignment.title}
            onChange={e => update('title', e.target.value)}
            placeholder="e.g. Reading the Room"
          />
        </Field>
        <Field label="Chapter Label" hint="e.g. Chapters 4–5">
          <input
            value={assignment.chapterLabel}
            onChange={e => update('chapterLabel', e.target.value)}
            placeholder="Chapters 4–5"
          />
        </Field>
        <Field label="URL Slug" hint="Auto-generated. Used as the URL: saleseqcoach.com/[slug]">
          <input
            value={assignment.slug || ''}
            onChange={e => update('slug', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
            placeholder="auto_generated_from_title"
          />
        </Field>
        <Field label="Status">
          <select
            value={assignment.status}
            onChange={e => update('status', e.target.value)}
          >
            <option value="draft">Draft (not visible to students)</option>
            <option value="published">Published (live)</option>
          </select>
        </Field>
        <Field label="AI Model for Part 2">
          <select
            value={assignment.apiModel}
            onChange={e => update('apiModel', e.target.value)}
          >
            <option value="claude-haiku-4-5-20251001">Haiku — Fast &amp; cheap (recommended)</option>
            <option value="claude-sonnet-4-6">Sonnet — Smarter, more expensive</option>
          </select>
        </Field>
      </SectionCard>
    </div>
  )
}

/* ================================================================
   PART 1 TAB
================================================================ */
function Part1Tab({ assignment, update }) {
  const questions = assignment.p1?.questions || []

  function addQuestion() {
    const id = 'q' + (Date.now())
    const newQ = {
      id,
      text: '',
      options: ['', '', '', ''],
      correct: 0,
      feedback: { correct: '', incorrect: '' }
    }
    update('p1.questions', [...questions, newQ])
  }

  function updateQuestion(idx, path, value) {
    const qs = deepClone(questions)
    setNested(qs[idx], path, value)
    update('p1.questions', qs)
  }

  function removeQuestion(idx) {
    update('p1.questions', questions.filter((_, i) => i !== idx))
  }

  function moveQuestion(idx, dir) {
    const qs = [...questions]
    const target = idx + dir
    if (target < 0 || target >= qs.length) return
    ;[qs[idx], qs[target]] = [qs[target], qs[idx]]
    update('p1.questions', qs)
  }

  return (
    <div className={styles.tabContent}>
      <SectionCard title="Part 1 Settings">
        <Field label="Section Title">
          <input value={assignment.p1?.title || ''} onChange={e => update('p1.title', e.target.value)} />
        </Field>
        <Field label="Description shown to students">
          <textarea value={assignment.p1?.description || ''} onChange={e => update('p1.description', e.target.value)} rows={2} />
        </Field>
      </SectionCard>

      <div className={styles.sectionHeader}>
        <span>{questions.length} Questions</span>
        <button className="btn btn-primary btn-sm" onClick={addQuestion}>+ Add Question</button>
      </div>

      {questions.length === 0 && (
        <div className={styles.emptyQuestions}>
          No questions yet. Click "+ Add Question" or use AI Generate to create them.
        </div>
      )}

      {questions.map((q, idx) => (
        <QuestionCard
          key={q.id}
          question={q}
          idx={idx}
          total={questions.length}
          onChange={(path, val) => updateQuestion(idx, path, val)}
          onRemove={() => removeQuestion(idx)}
          onMove={dir => moveQuestion(idx, dir)}
        />
      ))}

      {questions.length > 0 && (
        <button className="btn btn-ghost btn-sm" onClick={addQuestion} style={{marginTop:8}}>
          + Add Question
        </button>
      )}
    </div>
  )
}

function QuestionCard({ question, idx, total, onChange, onRemove, onMove }) {
  const letters = ['A', 'B', 'C', 'D', 'E']
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={styles.questionCard}>
      <div className={styles.questionHeader}>
        <div className={styles.questionNum}>Q{idx + 1}</div>
        <div className={styles.questionPreview} onClick={() => setCollapsed(!collapsed)}>
          {question.text ? question.text.slice(0, 60) + (question.text.length > 60 ? '…' : '') : '(no text yet)'}
        </div>
        <div className={styles.questionControls}>
          <button className="btn btn-ghost btn-sm" onClick={() => onMove(-1)} disabled={idx === 0}>↑</button>
          <button className="btn btn-ghost btn-sm" onClick={() => onMove(1)} disabled={idx === total - 1}>↓</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? '▼' : '▲'}
          </button>
          <button className="btn btn-danger btn-sm" onClick={onRemove}>✕</button>
        </div>
      </div>

      {!collapsed && (
        <div className={styles.questionBody}>
          <Field label="Question Text">
            <textarea
              value={question.text}
              onChange={e => onChange('text', e.target.value)}
              rows={2}
              placeholder="Type the question..."
            />
          </Field>

          <div className={styles.optionsGrid}>
            {question.options.map((opt, oi) => (
              <div key={oi} className={styles.optionRow}>
                <div
                  className={`${styles.optionLetter} ${question.correct === oi ? styles.optionCorrect : ''}`}
                  onClick={() => onChange('correct', oi)}
                  title="Click to mark as correct"
                >
                  {letters[oi]}
                </div>
                <input
                  value={opt}
                  onChange={e => {
                    const opts = [...question.options]
                    opts[oi] = e.target.value
                    onChange('options', opts)
                  }}
                  placeholder={`Option ${letters[oi]}`}
                />
                {question.correct === oi && (
                  <span className={styles.correctBadge}>✓ Correct</span>
                )}
              </div>
            ))}
          </div>

          <div className={styles.feedbackRow}>
            <Field label="Feedback if correct">
              <input
                value={question.feedback?.correct || ''}
                onChange={e => onChange('feedback.correct', e.target.value)}
                placeholder="Great! Because..."
              />
            </Field>
            <Field label="Feedback if incorrect">
              <input
                value={question.feedback?.incorrect || ''}
                onChange={e => onChange('feedback.incorrect', e.target.value)}
                placeholder="Not quite. The answer is X because..."
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  )
}

/* ================================================================
   PART 2 TAB
================================================================ */
function Part2Tab({ assignment, update }) {
  const p2 = assignment.p2 || {}
  const criteria = p2.evaluationCriteria || []

  return (
    <div className={styles.tabContent}>
      <SectionCard title="Scenario Settings">
        <Field label="Scenario Title">
          <input value={p2.title || ''} onChange={e => update('p2.title', e.target.value)} />
        </Field>
        <Field label="Description (shown to students)">
          <textarea value={p2.description || ''} onChange={e => update('p2.description', e.target.value)} rows={2} />
        </Field>
        <div className={styles.twoCol}>
          <Field label="Student Role Label" hint="Shown as a chip, e.g. 'Your Role: Sales Rep'">
            <input value={p2.roleLabel || ''} onChange={e => update('p2.roleLabel', e.target.value)} />
          </Field>
          <Field label="AI Avatar Label" hint="2-3 chars shown in chat, e.g. PAT, REP, BOB">
            <input value={p2.aiAvatarLabel || ''} onChange={e => update('p2.aiAvatarLabel', e.target.value)} maxLength={4} />
          </Field>
        </div>
        <Field label="Max Turns" hint="10–14 recommended">
          <input
            type="number" min={4} max={20}
            value={p2.maxTurns || 12}
            onChange={e => update('p2.maxTurns', parseInt(e.target.value))}
            style={{width:100}}
          />
        </Field>
      </SectionCard>

      <SectionCard title="Context Block" hint="HTML shown above the chat window. Tell students what's happening.">
        <Field label="Scenario Context (HTML allowed)">
          <textarea
            value={p2.scenarioContext || ''}
            onChange={e => update('p2.scenarioContext', e.target.value)}
            rows={4}
            placeholder="<strong>The Setup:</strong> You're on a call with..."
          />
        </Field>
        <Field label="Opening Message from AI Character">
          <textarea
            value={p2.openingMessage || ''}
            onChange={e => update('p2.openingMessage', e.target.value)}
            rows={3}
            placeholder="The first thing the AI character says to the student..."
          />
        </Field>
      </SectionCard>

      <SectionCard
        title="AI Character System Prompt"
        hint="This defines who Claude is playing. Be specific about personality, goals, and how to react to good vs bad sales technique."
      >
        <textarea
          value={p2.systemPrompt || ''}
          onChange={e => update('p2.systemPrompt', e.target.value)}
          rows={14}
          placeholder={`You are [NAME], [description].\n\nSCENARIO: ...\n\nYOUR PERSONALITY: ...\n\nRULES:\n- Stay in character\n- React authentically to the student's technique\n- Keep responses 2-4 sentences`}
        />
      </SectionCard>

      <SectionCard title="Evaluation Criteria" hint="Used by the AI when scoring the student's performance at the end.">
        {criteria.map((c, i) => (
          <div key={i} className={styles.criteriaRow}>
            <input
              value={c}
              onChange={e => {
                const arr = [...criteria]; arr[i] = e.target.value
                update('p2.evaluationCriteria', arr)
              }}
              placeholder="e.g. Did the student ask discovery questions?"
            />
            <button
              className="btn btn-danger btn-sm"
              onClick={() => update('p2.evaluationCriteria', criteria.filter((_,j)=>j!==i))}
            >✕</button>
          </div>
        ))}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => update('p2.evaluationCriteria', [...criteria, ''])}
        >+ Add Criterion</button>
      </SectionCard>
    </div>
  )
}

/* ================================================================
   EXPORT TAB
================================================================ */
function ExportTab({ assignment, onDownload, downloading, dirty, onSave }) {
  const baseUrl = import.meta.env.VITE_BASE_URL || 'https://saleseqcoach.com'
  const url = `${baseUrl}/${assignment.slug}`

  return (
    <div className={styles.tabContent}>
      <SectionCard title="SCORM Package">
        <p className={styles.exportDesc}>
          Download a SCORM 2004 zip to upload directly into Canvas. The zip contains a
          thin launcher that loads the assignment from its live URL.
        </p>

        <div className={styles.exportMeta}>
          <div className={styles.exportRow}>
            <span className={styles.exportKey}>Assignment URL</span>
            <a href={url} target="_blank" className={styles.exportVal}>{url}</a>
          </div>
          <div className={styles.exportRow}>
            <span className={styles.exportKey}>SCORM Version</span>
            <span className={styles.exportVal}>2004 4th Edition</span>
          </div>
          <div className={styles.exportRow}>
            <span className={styles.exportKey}>Filename</span>
            <span className={styles.exportVal}>{assignment.slug}.zip</span>
          </div>
          <div className={styles.exportRow}>
            <span className={styles.exportKey}>Passing score</span>
            <span className={styles.exportVal}>70%</span>
          </div>
          <div className={styles.exportRow}>
            <span className={styles.exportKey}>Questions</span>
            <span className={styles.exportVal}>{assignment.p1?.questions?.length || 0}</span>
          </div>
        </div>

        {dirty && (
          <div className={styles.exportWarn}>
            ⚠ You have unsaved changes. Save before downloading to ensure the zip reflects your latest edits.
            <button className="btn btn-primary btn-sm" onClick={onSave} style={{marginLeft:12}}>Save Now</button>
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={onDownload}
          disabled={downloading || !assignment.slug}
          style={{marginTop:16}}
        >
          {downloading ? '⏳ Generating…' : '↓ Download SCORM Zip'}
        </button>
      </SectionCard>

      <SectionCard title="Canvas Upload Instructions">
        <ol className={styles.instructions}>
          <li>Download the SCORM zip above</li>
          <li>In Canvas, go to your course → <strong>Modules</strong> or <strong>Assignments</strong></li>
          <li>Click <strong>+ Add Item</strong> → <strong>External Tool</strong> or use the <strong>Import</strong> option</li>
          <li>For SCORM: go to <strong>Settings → Import Course Content → SCORM packages</strong></li>
          <li>Upload the zip file — Canvas will auto-detect SCORM 2004</li>
          <li>Set the point value and due date as usual</li>
          <li>The assignment will report scores directly to the Canvas gradebook</li>
        </ol>
      </SectionCard>
    </div>
  )
}

/* ================================================================
   SHARED COMPONENTS
================================================================ */
function SectionCard({ title, hint, children }) {
  return (
    <div className={styles.sectionCard}>
      <div className={styles.sectionCardTitle}>{title}</div>
      {hint && <div className={styles.sectionCardHint}>{hint}</div>}
      <div className={styles.sectionCardBody}>{children}</div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className={styles.field}>
      {label && <label className="field-label">{label}</label>}
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  )
}

/* ================================================================
   UTILITIES
================================================================ */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function setNested(obj, path, value) {
  const parts = path.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] === undefined) cur[parts[i]] = {}
    cur = cur[parts[i]]
  }
  cur[parts[parts.length - 1]] = value
}

function buildGenerationPrompt(assignment) {
  return `You are helping build a Sales EQ college assignment for a Professional Sales course. 
The assignment covers: ${assignment.chapterLabel || 'the assigned chapters'}.
Assignment title hint: "${assignment.title}"

Generate a complete assignment config in JSON format. The JSON must follow this exact structure:

{
  "title": "engaging assignment title",
  "chapterLabel": "Chapters X–Y",
  "p1": {
    "title": "Knowledge Check",
    "description": "brief description for students",
    "questions": [
      {
        "id": "q1",
        "text": "question text?",
        "options": ["A option", "B option", "C option", "D option"],
        "correct": 0,
        "feedback": {
          "correct": "Correct! explanation...",
          "incorrect": "Not quite. explanation..."
        }
      }
    ]
  },
  "p2": {
    "title": "scenario title",
    "description": "what the student will do",
    "roleLabel": "Your Role: [student's role]",
    "aiAvatarLabel": "XXX",
    "systemPrompt": "full system prompt for the AI character",
    "openingMessage": "first message from AI character",
    "scenarioContext": "<strong>The Setup:</strong> HTML description for students",
    "evaluationCriteria": ["criterion 1", "criterion 2", "criterion 3", "criterion 4"]
  }
}

Requirements:
- Generate 8 quiz questions testing real Sales EQ concepts from ${assignment.chapterLabel || 'the chapters'}
- Questions should test comprehension, not just recall
- The Part 2 scenario should be creative and engaging (real-world sales situation)
- The AI character should have a specific name, personality, and realistic motivation
- The system prompt should tell the AI how to react to good vs bad sales technique
- Keep quiz options plausible — avoid obviously wrong answers

Return ONLY the JSON, wrapped in \`\`\`json\`\`\` tags.`
}
