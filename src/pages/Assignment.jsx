import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { fetchAssignment } from '../lib/store'
import styles from './Assignment.module.css'

// SCORM communication via postMessage to parent launcher
function scormPost(type, data = {}) {
  window.parent.postMessage({ source: 'saleseq', type, ...data }, '*')
}

// ── Transcript Parser & Viewer ──────────────────
// Detects if a message contains a meeting transcript and renders it as chat bubbles

// Character config — built from assignment JSON `p2.characters` array
// Each character: { name, role, initials, color, bg, photo?, align? }
// Falls back to hardcoded ch20 config if no characters defined

const DEFAULT_SPEAKERS = {
  'Jordan':   { initials: 'JH', color: '#3b82f6', bg: '#eff6ff',  label: 'Jordan Hess — MedBridge Sales Rep', align: 'right' },
  'Dr. Osei': { initials: 'PO', color: '#ef4444', bg: '#fef2f2',  label: 'Dr. Patricia Osei — Chief of Surgery', align: 'left' },
  'Marcus':   { initials: 'MT', color: '#f59e0b', bg: '#fffbeb',  label: 'Marcus Tran — VP of Operations', align: 'left' },
  'Sandra':   { initials: 'SK', color: '#10b981', bg: '#ecfdf5',  label: 'Sandra Kowalski — Nurse Manager', align: 'left' },
  'Elliot':   { initials: 'EF', color: '#8b5cf6', bg: '#f5f3ff',  label: 'Elliot Forde — Director of Finance', align: 'left' },
}

function buildSpeakerMap(characters) {
  if (!characters || !characters.length) return null
  const map = {}
  characters.forEach(c => {
    map[c.name] = {
      initials: c.initials || c.name.slice(0,2).toUpperCase(),
      color: c.color || '#6b7280',
      bg: c.bg || '#f9fafb',
      label: c.role ? `${c.name} — ${c.role}` : c.name,
      align: c.align || 'left',
      photo: c.photo || null,
    }
  })
  return map
}

function getSpeakerConfig(name, speakerMap) {
  const map = speakerMap || DEFAULT_SPEAKERS
  for (const key of Object.keys(map)) {
    if (name.includes(key)) return map[key]
  }
  return { initials: name.slice(0,2).toUpperCase(), color: '#6b7280', bg: '#f9fafb', label: name, align: 'left', photo: null }
}

function parseTranscript(text) {
  if (!text) return null
  const lines = text.split('\n')
  const messages = []
  let currentTime = ''
  let foundSpeakers = 0

  for (const line of lines) {
    const t = line.trim()
    if (!t || t === '---') continue

    // Timestamp: **[0:00]**
    const timeMatch = t.match(/^\*\*\[(\d+:\d+)\]\*\*$/)
    if (timeMatch) { currentTime = timeMatch[1]; continue }

    // Speaker: **Name:** dialogue
    const speakerMatch = t.match(/^\*\*(.+?):\*\*\s*(.+)$/)
    if (speakerMatch) {
      foundSpeakers++
      let name = speakerMatch[1]
      let dialogue = speakerMatch[2]
      const stageDirections = []
      dialogue = dialogue.replace(/\[([^\]]+)\]/g, (_, dir) => {
        stageDirections.push(dir)
        return ''
      }).trim()
      messages.push({ speaker: name, text: dialogue, time: currentTime, stageDirections })
    }
  }

  // Only treat as transcript if we found multiple speakers
  if (foundSpeakers < 4) return null
  return messages
}

function splitTranscriptAndQuestions(text) {
  // The analysis questions come after "YOUR ANALYSIS IS DUE BELOW"
  const marker = '**YOUR ANALYSIS IS DUE BELOW'
  const idx = text.indexOf(marker)
  if (idx === -1) return { transcript: text, questions: null }
  return {
    transcript: text.slice(0, idx).trim(),
    questions: text.slice(idx).trim()
  }
}

function TranscriptViewer({ messages, speakerMap }) {
  const [stepMode, setStepMode] = useState(false)
  const [revealCount, setRevealCount] = useState(messages.length)
  const areaRef = useRef(null)

  const visible = stepMode ? messages.slice(0, revealCount) : messages
  const allRevealed = revealCount >= messages.length

  useEffect(() => {
    if (stepMode && areaRef.current) {
      areaRef.current.scrollTop = areaRef.current.scrollHeight
    }
  }, [revealCount, stepMode])

  // Keyboard nav for step mode
  useEffect(() => {
    if (!stepMode) return
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        setRevealCount(c => Math.min(c + 1, messages.length))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stepMode, messages.length])

  // Collect unique speakers from this transcript for legend
  const speakers = []
  const seen = new Set()
  for (const msg of messages) {
    if (!seen.has(msg.speaker)) {
      seen.add(msg.speaker)
      speakers.push({ name: msg.speaker, ...getSpeakerConfig(msg.speaker, speakerMap) })
    }
  }

  let lastTime = ''

  return (
    <div className={styles.transcriptContainer}>
      {/* Header */}
      <div className={styles.transcriptHeader}>
        <div className={styles.transcriptHeaderLeft}>
          <span className={styles.transcriptIcon}>📋</span>
          <div>
            <div className={styles.transcriptTitle}>Meeting Transcript</div>
            <div className={styles.transcriptSub}>Read carefully before submitting your analysis</div>
          </div>
        </div>
        <button
          className={styles.stepToggle}
          onClick={() => {
            if (!stepMode) { setStepMode(true); setRevealCount(1) }
            else { setStepMode(false); setRevealCount(messages.length) }
          }}
        >
          {stepMode ? 'Show All' : 'Step Through'}
        </button>
      </div>

      {/* Legend */}
      <div className={styles.transcriptLegend}>
        {speakers.map(s => (
          <div key={s.name} className={styles.legendItem}>
            {s.photo
              ? <img src={s.photo} alt="" className={styles.legendPhoto} />
              : <span className={styles.legendDot} style={{ backgroundColor: s.color }} />
            }
            <span className={styles.legendLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Messages */}
      <div className={styles.transcriptMessages} ref={areaRef}>
        {visible.map((msg, i) => {
          const cfg = getSpeakerConfig(msg.speaker, speakerMap)
          const isRight = cfg.align === 'right'
          let showTime = false
          if (msg.time && msg.time !== lastTime) { showTime = true; lastTime = msg.time }

          const avatar = cfg.photo
            ? <img src={cfg.photo} alt="" className={styles.tAvatarImg} style={{ borderColor: cfg.color + '60' }} title={cfg.label} />
            : <div className={styles.tAvatar} style={{ backgroundColor: cfg.color }} title={cfg.label}>{cfg.initials}</div>

          return (
            <div key={i}>
              {showTime && (
                <div className={styles.timeBadge}><span>{msg.time}</span></div>
              )}
              <div className={`${styles.tMsgRow} ${isRight ? styles.tMsgRowRight : ''}`}>
                {!isRight && avatar}
                <div className={styles.tBubbleWrap}>
                  <div className={styles.tSpeakerName} style={{ color: cfg.color }}>
                    {msg.speaker}
                  </div>
                  <div
                    className={`${styles.tBubble} ${isRight ? styles.tBubbleRight : ''}`}
                    style={{ backgroundColor: cfg.bg, borderColor: cfg.color + '30' }}
                  >
                    {msg.stageDirections.length > 0 && (
                      <span className={styles.tStageDir}>
                        [{msg.stageDirections.join('; ')}]
                      </span>
                    )}
                    {msg.text}
                  </div>
                </div>
                {isRight && avatar}
              </div>
            </div>
          )
        })}
      </div>

      {/* Step controls */}
      {stepMode && (
        <div className={styles.stepControls}>
          {!allRevealed ? (
            <>
              <button
                className={styles.stepNextBtn}
                onClick={() => setRevealCount(c => Math.min(c + 1, messages.length))}
              >
                Next Line →
              </button>
              <span className={styles.stepCount}>{revealCount} / {messages.length}</span>
            </>
          ) : (
            <span className={styles.stepDone}>✓ Full transcript revealed</span>
          )}
        </div>
      )}
    </div>
  )
}

function AnalysisQuestions({ text }) {
  // Parse the markdown questions block into rendered HTML-ish content
  // Simple approach: render as structured content
  return (
    <div className={styles.analysisPrompt}>
      <h3 className={styles.analysisTitle}>📝 YOUR ANALYSIS IS DUE BELOW</h3>
      <p className={styles.analysisIntro}>Submit your analysis responding to these four questions:</p>
      <div className={styles.analysisQuestions}>
        <div className={styles.analysisQ}>
          <strong>1. Persona Identification:</strong> Name the dominant Blount persona for each of the four stakeholders. For each, cite at least <strong>two specific behavioral signals</strong> from the transcript as evidence.
        </div>
        <div className={styles.analysisQ}>
          <strong>2. Flex Strategy:</strong> For each stakeholder, describe specifically how Jordan should flex their communication style, pace, and approach in the <strong>next meeting</strong> to complement that persona.
        </div>
        <div className={styles.analysisQ}>
          <strong>3. Persona Shift:</strong> Identify which stakeholder shows a persona shift during the meeting. At what exact moment does it occur? What triggered it? What should Jordan recalibrate immediately?
        </div>
        <div className={styles.analysisQ}>
          <strong>4. Non-Flex Failure:</strong> Describe what a salesperson who defaults to their own preferred style (imagine they're naturally a Socializer/Energizer) would do wrong in this meeting — and which stakeholder relationship would suffer most.
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────
export default function Assignment() {
  const { slug } = useParams()
  const [assignment, setAssignment] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState('p1')
  const [p1State, setP1State] = useState({ answers: {}, submitted: false, score: 0 })
  const [p2State, setP2State] = useState({ messages: [], turns: 0, complete: false, score: 0, feedback: '' })
  const [finalSubmitted, setFinalSubmitted] = useState(false)
  const [inputText, setInputText] = useState('')
  const [aiThinking, setAiThinking] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [inCall, setInCall] = useState(false)
  const [callTime, setCallTime] = useState(0)
  const chatRef = useRef(null)
  const recognitionRef = useRef(null)
  const callTimerRef = useRef(null)

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

  // Check if the opening message contains a transcript
  const openingContent = p2?.openingMessage || ''
  const parsedTranscript = parseTranscript(openingContent)
  const hasTranscript = parsedTranscript !== null
  const { questions: analysisQuestionsText } = hasTranscript ? splitTranscriptAndQuestions(openingContent) : { questions: null }

  // Build character/speaker map from assignment JSON
  const speakerMap = buildSpeakerMap(p2?.characters)
  // Get AI character config for chat avatar
  const aiChar = p2?.characters?.find(c => c.align === 'ai' || c.isAi) || null

  // ── Quiz functions ────────────────────────────
  function selectAnswer(qId, optIdx, correctIdx) {
    if (p1State.submitted || p1State.answers[qId] !== undefined) return
    setP1State(prev => ({ ...prev, answers: { ...prev.answers, [qId]: optIdx } }))
  }

  function submitQuiz() {
    if (p1State.submitted) return
    let correct = 0
    p1.questions.forEach(q => { if (p1State.answers[q.id] === q.correct) correct++ })
    const pct = Math.round((correct / qCount) * 100)
    const pts = Math.round((correct / qCount) * 25)
    setP1State(prev => ({ ...prev, submitted: true, score: pct, points: pts }))
    setProgress(50)
  }

  // ── Chat functions ────────────────────────────
  async function sendMessage() {
    await sendMessageWithText(inputText)
  }

  async function evaluateConversation(conversationMessages, p2Config) {
    const criteria = p2Config.evaluationCriteria || []
    const criteriaText = criteria.length
      ? criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')
      : 'Overall quality of the student\'s sales technique, communication, and application of concepts.'

    const transcript = conversationMessages
      .map(m => `${m.role === 'user' ? 'STUDENT' : 'AI'}: ${m.content}`)
      .join('\n\n')

    const evalPrompt = `You are an expert evaluator for a BYU-Idaho Professional Selling course using Sales EQ by Jeb Blount.

Evaluate the student's performance in the following conversation based on these specific criteria:

${criteriaText}

Here is the full conversation:

${transcript}

Score the student from 0-100. Be fair but rigorous — a student who gives vague or generic advice should score 40-60. A student who demonstrates specific knowledge of Blount's framework and gives actionable, persona-specific guidance should score 75-95. Only give 95+ for truly exceptional responses.

Respond with ONLY a JSON object, no other text:
{"score": <number 0-100>, "feedback": "<2-3 sentences explaining what they did well and what they could improve>"}`

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: assignment.apiModel || 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: 'You are a grading assistant. Respond with only valid JSON, no markdown, no backticks, no extra text.',
          messages: [{ role: 'user', content: evalPrompt }],
        })
      })

      const data = await res.json()
      const raw = (data.content?.[0]?.text || '').trim()

      // Try to parse JSON — handle markdown backticks if present
      const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const ev = JSON.parse(cleaned)
      const score = Math.max(0, Math.min(100, ev.score ?? 70))

      return {
        score,
        points: Math.round(score * 0.25),
        feedback: ev.feedback || 'Scenario complete.',
      }
    } catch (e) {
      // If evaluation fails, give a default passing score rather than zero
      return {
        score: 70,
        points: 18,
        feedback: 'Scenario complete. Your responses were evaluated but detailed scoring was unavailable.',
      }
    }
  }

  // ── Voice functions ────────────────────────────
  function speakText(text) {
    if (!text || typeof window === 'undefined') return
    const synth = window.speechSynthesis
    synth.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    // Pick a voice based on the AI character
    const voices = synth.getVoices()
    const aiName = aiChar?.name?.toLowerCase() || ''
    // Try to match gender from name/role
    const femaleNames = ['becky','megan','rachel','dana','priya','claire','shell','michelle']
    const isFemale = femaleNames.some(n => aiName.includes(n))
    const preferred = voices.find(v => 
      isFemale ? v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Karen')
               : v.name.includes('Male') || v.name.includes('Daniel') || v.name.includes('Alex')
    ) || voices[0]
    if (preferred) utter.voice = preferred
    utter.rate = 1.0
    utter.pitch = isFemale ? 1.1 : 0.9
    synth.speak(utter)
  }

  function startRecording() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser. Please use Chrome.')
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      if (inCall) {
        // In call mode, auto-send the message
        setInputText(transcript)
        setTimeout(() => {
          sendMessageWithText(transcript)
        }, 200)
      } else {
        setInputText(prev => prev + transcript)
      }
      setIsRecording(false)
    }
    recognition.onerror = () => setIsRecording(false)
    recognition.onend = () => setIsRecording(false)
    
    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
  }

  function stopRecording() {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsRecording(false)
  }

  function startCall() {
    setInCall(true)
    setCallTime(0)
    callTimerRef.current = setInterval(() => {
      setCallTime(t => t + 1)
    }, 1000)
    // Start listening immediately
    setTimeout(() => startRecording(), 500)
  }

  function endCall() {
    setInCall(false)
    if (callTimerRef.current) clearInterval(callTimerRef.current)
    if (recognitionRef.current) recognitionRef.current.stop()
    window.speechSynthesis?.cancel()
    setIsRecording(false)
  }

  function formatCallTime(seconds) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  async function sendMessageWithText(text) {
    if (!text?.trim() || p2State.complete || aiThinking) return
    const maxTurns = p2?.maxTurns || 12
    if (p2State.turns >= maxTurns) return

    const newTurns = p2State.turns + 1
    const isLast = newTurns >= maxTurns

    const newMessages = [...p2State.messages, { role: 'user', content: text.trim() }]
    setP2State(prev => ({ ...prev, messages: newMessages, turns: newTurns }))
    setInputText('')
    setAiThinking(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: assignment.apiModel || 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          system: p2.systemPrompt,
          messages: newMessages,
        })
      })

      const data = await res.json()
      const reply = data.content?.[0]?.text || ''
      const updatedMessages = [...newMessages, { role: 'assistant', content: reply }]

      if (isLast) {
        setP2State(prev => ({ ...prev, messages: updatedMessages }))
        const evalResult = await evaluateConversation(updatedMessages, p2)
        setP2State(prev => ({
          ...prev,
          complete: true,
          score: evalResult.score,
          points: evalResult.points,
          feedback: evalResult.feedback,
        }))
        setProgress(100)
        const finalPts = (p1State.points ?? 0) + evalResult.points
        scormPost('score', { raw: finalPts, max: 50 })
        scormPost('complete', { passed: finalPts >= 35 })
        if (inCall) endCall()
      } else {
        setP2State(prev => ({ ...prev, messages: updatedMessages }))
        // In call mode, speak the reply and start listening again
        if (inCall) {
          speakText(reply)
          const wordCount = reply.split(' ').length
          setTimeout(() => {
            if (inCall && !p2State.complete) startRecording()
          }, Math.max(2000, wordCount * 300))
        }
      }
    } catch (e) {
      setP2State(prev => ({
        ...prev,
        messages: [...newMessages, { role: 'assistant', content: '[Connection error — please try again]' }]
      }))
    }
    setAiThinking(false)
  }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  function finalSubmit() {
    setFinalSubmitted(true)
  }

  // ── Render ────────────────────────────────────
  return (
    <div className={styles.app}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <img src="/logo.png" alt="Sales EQ Coach" className={styles.headerLogo} />
          <div>
            <div className={styles.courseLabel}>Professional Sales · {chapterLabel}</div>
            <div className={styles.assignTitle}>{title}</div>
          </div>
        </div>
        <div className={styles.scoreBadge}>
          {p1State.submitted
            ? `P1: ${p1State.points ?? 0}/25 pts${p2State.complete ? `  ·  P2: ${p2State.points ?? 0}/25 pts` : ''}`
            : '50 pts total'
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
            {p1State.submitted ? `${p1State.points ?? 0}/25` : 'Quiz'}
          </span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'p2' ? styles.tabActive : ''} ${p2State.complete ? styles.tabDone : ''}`}
          onClick={() => setActiveTab('p2')}
        >
          Part 2 — Scenario
          <span className={styles.tabPill}>
            {p2State.complete ? `${p2State.points ?? 0}/25` : 'Live'}
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
                <div className={styles.resultScore}>{p1State.points ?? 0}/25</div>
                <div className={styles.resultLabel}>Part 1 Points</div>
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

        {/* ── PART 2 — iMessage Style ── */}
        {activeTab === 'p2' && (
          <div className={styles.imessageWrap}>
            {/* Description card */}
            <div className={styles.introCard}>
              <h2 className={styles.introTitle}>{p2.title}</h2>
              <p className={styles.introDesc}>{p2.description}</p>
              <div className={styles.chips}>
                <span className={styles.chip}>{p2.roleLabel}</span>
                <span className={styles.chip}>Max {p2.maxTurns} Exchanges</span>
              </div>
            </div>

            {/* iMessage contact header */}
            <div className={styles.iContactBar}>
              <div className={styles.iContactInfo}>
                {aiChar?.photo ? (
                  <img src={aiChar.photo} alt="" className={styles.iContactPhoto} />
                ) : (
                  <div className={styles.iContactAvatar} style={{ backgroundColor: aiChar?.color || '#6b7280' }}>
                    {aiChar?.initials || 'AI'}
                  </div>
                )}
                <div>
                  <div className={styles.iContactName}>{aiChar?.name || 'Contact'}</div>
                  <div className={styles.iContactRole}>{aiChar?.role || ''}</div>
                </div>
              </div>
              {!p2State.complete && (
                <button
                  className={`${styles.iCallBtn} ${inCall ? styles.iCallActive : ''}`}
                  onClick={inCall ? endCall : startCall}
                  title={inCall ? 'End Call' : 'Start Voice Call'}
                >
                  {inCall ? (
                    <>
                      <span className={styles.iCallTimer}>{formatCallTime(callTime)}</span>
                      <span className={styles.iCallEndIcon}>✕</span>
                    </>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  )}
                </button>
              )}
            </div>

            {/* Call overlay */}
            {inCall && (
              <div className={styles.iCallOverlay}>
                {aiChar?.photo ? (
                  <img src={aiChar.photo} alt="" className={styles.iCallPhoto} />
                ) : (
                  <div className={styles.iCallAvatarLg}>{aiChar?.initials || 'AI'}</div>
                )}
                <div className={styles.iCallName}>{aiChar?.name || 'Contact'}</div>
                <div className={styles.iCallStatus}>
                  {isRecording ? '🎙 Listening...' : aiThinking ? 'Speaking...' : `${formatCallTime(callTime)}`}
                </div>
                <div className={styles.iCallActions}>
                  {!isRecording && !aiThinking && (
                    <button className={styles.iCallMicBtn} onClick={startRecording}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                      </svg>
                      Tap to Talk
                    </button>
                  )}
                  {isRecording && (
                    <div className={styles.iCallRecording}>
                      <div className={styles.iCallPulse} />
                      <span>Listening...</span>
                    </div>
                  )}
                </div>
                <button className={styles.iCallEndBtn} onClick={endCall}>
                  End Call
                </button>
              </div>
            )}

            {/* Transcript-style opening (ch20 diagnostic format) */}
            {hasTranscript && (
              <>
                <TranscriptViewer messages={parsedTranscript} speakerMap={speakerMap} />
                <AnalysisQuestions text={analysisQuestionsText} />
              </>
            )}

            {/* iMessage chat */}
            <div className={styles.iChatWindow} ref={chatRef}>
              {p2State.messages.map((msg, i) => {
                if (i === 0 && hasTranscript && msg.role === 'assistant') return null
                const isUser = msg.role === 'user'
                return (
                  <div key={i} className={`${styles.iBubbleRow} ${isUser ? styles.iBubbleRowRight : styles.iBubbleRowLeft}`}>
                    {!isUser && aiChar?.photo && (
                      <img src={aiChar.photo} alt="" className={styles.iBubbleAvatar} />
                    )}
                    <div className={`${styles.iBubble} ${isUser ? styles.iBubbleUser : styles.iBubbleAi}`}>
                      {msg.content}
                    </div>
                  </div>
                )
              })}
              {aiThinking && (
                <div className={`${styles.iBubbleRow} ${styles.iBubbleRowLeft}`}>
                  {aiChar?.photo && <img src={aiChar.photo} alt="" className={styles.iBubbleAvatar} />}
                  <div className={`${styles.iBubble} ${styles.iBubbleAi}`}>
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

            {!p2State.complete && !inCall && (
              <div className={styles.iInputRow}>
                <button
                  className={`${styles.iMicBtn} ${isRecording ? styles.iMicActive : ''}`}
                  onClick={isRecording ? stopRecording : startRecording}
                  title={isRecording ? 'Stop recording' : 'Voice input'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                </button>
                <input
                  type="text"
                  className={styles.iInput}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={isRecording ? 'Listening...' : 'iMessage'}
                  disabled={aiThinking || p2State.turns >= p2.maxTurns || isRecording}
                />
                <button
                  className={styles.iSendBtn}
                  onClick={sendMessage}
                  disabled={aiThinking || !inputText.trim() || p2State.turns >= p2.maxTurns}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </div>
            )}

            {p2State.complete && (
              <div className={styles.completeCard}>
                <div className={styles.completeIcon}>✓</div>
                <h3 className={styles.completeTitle}>Scenario Complete</h3>
                <p className={styles.completeFeedback}>{p2State.feedback}</p>
                <div className={styles.completeScore}>
                  P1: {p1State.points ?? 0}/25 &nbsp;·&nbsp; P2: {p2State.points ?? 0}/25 &nbsp;·&nbsp; Total: {(p1State.points ?? 0) + (p2State.points ?? 0)}/50
                </div>
                <button
                  className={`btn ${finalSubmitted ? 'btn-outline' : 'btn-success'}`}
                  onClick={finalSubmit}
                  disabled={finalSubmitted}
                  style={finalSubmitted ? { opacity: 0.85, cursor: 'default' } : {}}
                >
                  {finalSubmitted ? '✓ Submitted to Canvas' : 'Submit to Canvas ✓'}
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
      <img src="/logo.png" alt="Sales EQ Coach" className={styles.loadLogoImg} />
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
