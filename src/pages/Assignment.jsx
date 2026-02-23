import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { fetchAssignment } from '../lib/store'
import styles from './Assignment.module.css'

// SCORM communication via postMessage to parent launcher
function scormPost(type, data = {}) {
  window.parent.postMessage({ source: 'saleseq', type, ...data }, '*')
}

export default function Assignment() {
  const { slug } = useParams()
  const [assignment, setAssignment] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState('p1')
  const [p1State, setP1State] = useState({ answers: {}, submitted: false, score: 0 })
  const [p2State, setP2State] = useState({ messages: [], turns: 0, complete: false, score: 0, feedback: '' })
  const [inputText, setInputText] = useState('')
  const [aiThinking, setAiThinking] = useState(false)
  const [progress, setProgress] = useState(0)
  const chatRef = useRef(null)

  useEffect(() => {
    async function load() {
      const a = await fetchAssignment(slug)
      if (!a) { setNotFound(true); return }
      setAssignment(a)
      if (a.p2?.openingMessage) {
        setP2State(prev => ({ ...prev, messages: [{ role: 'assistant', content: a.p2.openingMessage }] }))
      }
      scormPost('init')
    }
    load()
  }, [slug])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [p2State.messages, aiThinking])

  if (notFound) return <NotFound />
  if (!assignment) return <LoadingScreen />

  const { p1, p2, title, chapterLabel } = assignment
  const qCount = p1?.questions?.length || 0
  const answeredCount = Object.keys(p1State.answers).length

  // ── Quiz functions ────────────────────────────
  function selectAnswer(qId, optIdx, correctIdx) {
    if (p1State.submitted || p1State.answers[qId] !== undefined) return
    setP1State(prev => ({ ...prev, answers: { ...prev.answers, [qId]: optIdx } }))
  }

  function submitQuiz() {
    if (p1State.submitted) return
    let correct = 0
    p1.questions.forEach(q => { if (p1State.answers[q.id] === q.correct) correct++ })
    const score = Math.round((correct / qCount) * 100)
    setP1State(prev => ({ ...prev, submitted: true, score }))
    setProgress(50)
    scormPost('score', { raw: score })
  }

  // ── Chat functions ────────────────────────────
  async function sendMessage() {
    const text = inputText.trim()
    if (!text || p2State.complete || aiThinking) return
    const maxTurns = p2?.maxTurns || 12
    if (p2State.turns >= maxTurns) return

    const newTurns = p2State.turns + 1
    const isLast = newTurns >= maxTurns

    const newMessages = [...p2State.messages, { role: 'user', content: text }]
    setP2State(prev => ({ ...prev, messages: newMessages, turns: newTurns }))
    setInputText('')
    setAiThinking(true)

    try {
      const apiKey = assignment.apiKey || import.meta.env.VITE_ANTHROPIC_KEY
      const messages = isLast
        ? [...newMessages, {
            role: 'user',
            content: `[SYSTEM: Final exchange. Respond in character one last time, then on a new line write "---EVAL---" followed by JSON: {"score":0-100,"feedback":"2-3 sentence eval of their sales technique"}]`
          }]
        : newMessages

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-calls': 'true',
        },
        body: JSON.stringify({
          model: assignment.apiModel || 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          system: p2.systemPrompt,
          messages: newMessages,
        })
      })

      const data = await res.json()
      const reply = data.content?.[0]?.text || ''

      if (isLast && reply.includes('---EVAL---')) {
        const [charReply, evalPart] = reply.split('---EVAL---')
        let score = 70, feedback = 'Scenario complete.'
        try {
          const ev = JSON.parse(evalPart.trim())
          score = ev.score ?? 70
          feedback = ev.feedback || feedback
        } catch {}
        setP2State(prev => ({
          ...prev,
          messages: [...newMessages, { role: 'assistant', content: charReply.trim() }],
          complete: true,
          score,
          feedback
        }))
        setProgress(100)
      } else {
        setP2State(prev => ({
          ...prev,
          messages: [...newMessages, { role: 'assistant', content: reply }],
          ...(isLast ? { complete: true } : {})
        }))
        if (isLast) setProgress(100)
      }
    } catch (e) {
      setP2State(prev => ({
        ...prev,
        messages: [...p2State.messages.slice(0, -0), { role: 'assistant', content: '[Connection error — please try again]' }]
      }))
    }
    setAiThinking(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  function finalSubmit() {
    const final = Math.round((p1State.score * 0.5) + (p2State.score * 0.5))
    scormPost('score', { raw: final })
    scormPost('complete', { passed: final >= 70 })
  }

  // ── Render ────────────────────────────────────
  return (
    <div className={styles.app}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <div className={styles.courseLabel}>Professional Sales · {chapterLabel}</div>
          <div className={styles.assignTitle}>{title}</div>
        </div>
        <div className={styles.scoreBadge}>
          {p1State.submitted
            ? `P1: ${p1State.score}%${p2State.complete ? `  ·  P2: ${p2State.score}%` : ''}`
            : '—'
          }
        </div>
      </header>

      {/* Progress */}
      <div className={styles.progressWrap}>
        <div className={styles.progressBar} style={{ width: `${progress}%` }} />
      </div>

      {/* Tabs */}
      <nav className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'p1' ? styles.tabActive : ''} ${p1State.submitted ? styles.tabDone : ''}`}
          onClick={() => setActiveTab('p1')}
        >
          Part 1 — Knowledge Check
          <span className={styles.tabPill}>
            {p1State.submitted ? `${p1State.score}%` : 'Quiz'}
          </span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'p2' ? styles.tabActive : ''} ${p2State.complete ? styles.tabDone : ''}`}
          onClick={() => setActiveTab('p2')}
        >
          Part 2 — Scenario
          <span className={styles.tabPill}>
            {p2State.complete ? `${p2State.score}%` : 'Live'}
          </span>
        </button>
      </nav>

      {/* Content */}
      <main className={styles.main}>

        {/* ── PART 1 ── */}
        {activeTab === 'p1' && (
          <div>
            <div className={styles.introCard}>
              <h2 className={styles.introTitle}>{p1.title}</h2>
              <p className={styles.introDesc}>{p1.description}</p>
              <div className={styles.chips}>
                <span className={styles.chip}>{chapterLabel}</span>
                <span className={styles.chip}>{qCount} Questions</span>
                <span className={styles.chip}>Instant Feedback</span>
              </div>
            </div>

            {p1.questions.map((q, qi) => {
              const answered = p1State.answers[q.id] !== undefined
              const selected = p1State.answers[q.id]
              const isCorrect = answered && selected === q.correct
              const letters = ['A','B','C','D','E']

              return (
                <div
                  key={q.id}
                  className={`${styles.qCard} ${answered ? (isCorrect ? styles.qCorrect : styles.qIncorrect) : ''}`}
                >
                  <div className={styles.qNum}>QUESTION {qi + 1} OF {qCount}</div>
                  <div className={styles.qText}>{q.text}</div>
                  <div className={styles.qOptions}>
                    {q.options.map((opt, oi) => {
                      let cls = styles.optBtn
                      if (answered) {
                        if (oi === q.correct) cls += ` ${styles.optCorrect}`
                        else if (oi === selected && !isCorrect) cls += ` ${styles.optWrong}`
                        else cls += ` ${styles.optDisabled}`
                      } else if (selected === oi) {
                        cls += ` ${styles.optSelected}`
                      }
                      return (
                        <button
                          key={oi}
                          className={cls}
                          disabled={answered}
                          onClick={() => selectAnswer(q.id, oi, q.correct)}
                        >
                          <span className={styles.optLetter}>{letters[oi]}</span>
                          <span>{opt}</span>
                        </button>
                      )
                    })}
                  </div>
                  {answered && (
                    <div className={`${styles.feedback} ${isCorrect ? styles.feedbackCorrect : styles.feedbackWrong}`}>
                      {isCorrect ? `✓ ${q.feedback.correct}` : `✗ ${q.feedback.incorrect}`}
                    </div>
                  )}
                </div>
              )
            })}

            {!p1State.submitted && (
              <div className={styles.quizFooter}>
                <span className={styles.quizCounter}>{answeredCount} of {qCount} answered</span>
                <button
                  className="btn btn-primary"
                  disabled={answeredCount < qCount}
                  onClick={submitQuiz}
                >
                  Submit Quiz →
                </button>
              </div>
            )}

            {p1State.submitted && (
              <div className={styles.resultsCard}>
                <div className={styles.resultScore}>{p1State.score}%</div>
                <div className={styles.resultLabel}>Part 1 Score</div>
                <div className={styles.resultBar}>
                  <div className={styles.resultBarFill} style={{ width: `${p1State.score}%` }} />
                </div>
                <button className="btn btn-primary" onClick={() => setActiveTab('p2')}>
                  Continue to Part 2 →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── PART 2 ── */}
        {activeTab === 'p2' && (
          <div>
            <div className={styles.introCard}>
              <h2 className={styles.introTitle}>{p2.title}</h2>
              <p className={styles.introDesc}>{p2.description}</p>
              <div className={styles.chips}>
                <span className={styles.chip}>{p2.roleLabel}</span>
                <span className={styles.chip}>Max {p2.maxTurns} Exchanges</span>
                <span className={styles.chip}>AI-Powered</span>
              </div>
            </div>

            {p2.scenarioContext && (
              <div
                className={styles.scenarioContext}
                dangerouslySetInnerHTML={{ __html: p2.scenarioContext }}
              />
            )}

            {/* Chat */}
            <div className={styles.chatWindow} ref={chatRef}>
              {p2State.messages.map((msg, i) => (
                <div key={i} className={`${styles.chatMsg} ${msg.role === 'user' ? styles.chatUser : styles.chatAi}`}>
                  <div className={styles.chatAvatar}>
                    {msg.role === 'user' ? 'YOU' : (p2?.aiAvatarLabel || 'AI')}
                  </div>
                  <div className={styles.chatBubble}>{msg.content}</div>
                </div>
              ))}
              {aiThinking && (
                <div className={`${styles.chatMsg} ${styles.chatAi}`}>
                  <div className={styles.chatAvatar}>{p2?.aiAvatarLabel || 'AI'}</div>
                  <div className={styles.chatBubble}>
                    <div className={styles.typing}>
                      <div className={styles.typingDot} />
                      <div className={styles.typingDot} />
                      <div className={styles.typingDot} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.turnCounter}>
              Exchange {p2State.turns} of {p2.maxTurns}
            </div>

            {!p2State.complete && (
              <div className={styles.chatInputRow}>
                <textarea
                  className={styles.chatInput}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Type your response…"
                  disabled={aiThinking || p2State.turns >= p2.maxTurns}
                  rows={1}
                />
                <button
                  className="btn btn-primary"
                  onClick={sendMessage}
                  disabled={aiThinking || !inputText.trim() || p2State.turns >= p2.maxTurns}
                >
                  Send
                </button>
              </div>
            )}

            {p2State.complete && (
              <div className={styles.completeCard}>
                <div className={styles.completeIcon}>✓</div>
                <h3 className={styles.completeTitle}>Scenario Complete</h3>
                <p className={styles.completeFeedback}>{p2State.feedback}</p>
                <div className={styles.completeScore}>
                  P1: {p1State.score}% &nbsp;·&nbsp; P2: {p2State.score}%
                  &nbsp;·&nbsp; Final: {Math.round((p1State.score + p2State.score) / 2)}%
                </div>
                <button className="btn btn-success" onClick={finalSubmit}>
                  Submit to Canvas ✓
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className={styles.loadScreen}>
      <div className={styles.loadLogo}>Sales <span>EQ</span></div>
      <div className={styles.loadSpinner} />
    </div>
  )
}

function NotFound() {
  return (
    <div className={styles.loadScreen}>
      <div className={styles.loadLogo}>404</div>
      <p style={{color:'var(--muted)', marginTop:12}}>Assignment not found</p>
    </div>
  )
}
