// ─────────────────────────────────────────────
//  Assignment Store
//  Reads/writes via Vercel KV API
//  Falls back to localStorage if API unavailable
// ─────────────────────────────────────────────

const API_BASE = '/api/assignments'
const LS_KEY   = 'saleseq_assignments'

// ── API calls ────────────────────────────────

export async function fetchAssignments() {
  try {
    const res = await fetch(API_BASE)
    if (!res.ok) throw new Error('API error')
    const data = await res.json()
    if (data.length) return data
    return loadFromLocalStorage()
  } catch {
    return loadFromLocalStorage()
  }
}

export async function fetchAssignment(slug) {
  try {
    const res = await fetch(`${API_BASE}/${slug}`)
    if (!res.ok) throw new Error('Not found')
    return await res.json()
  } catch {
    return loadFromLocalStorage().find(a => a.slug === slug) || null
  }
}

export async function saveAssignment(assignment) {
  const adminKey = getAdminKey()
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': adminKey,
      },
      body: JSON.stringify(assignment),
    })
    if (!res.ok) throw new Error('Save failed')
    upsertLocalStorage(assignment)
    return await res.json()
  } catch (e) {
    upsertLocalStorage(assignment)
    throw e
  }
}

export async function removeAssignment(slug) {
  const adminKey = getAdminKey()
  try {
    const res = await fetch(`${API_BASE}?slug=${slug}`, {
      method: 'DELETE',
      headers: { 'x-api-key': adminKey },
    })
    deleteLocalStorage(slug)
    return res.ok
  } catch {
    deleteLocalStorage(slug)
    return false
  }
}

// ── Sync local assignments up to KV ──────────
export async function syncToKV() {
  const local = loadFromLocalStorage()
  const adminKey = getAdminKey()
  if (!adminKey || !local.length) return
  for (const a of local) {
    await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': adminKey },
      body: JSON.stringify(a),
    })
  }
}

// ── Admin key ────────────────────────────────
export function getAdminKey() {
  return localStorage.getItem('saleseq_admin_key') || ''
}
export function setAdminKey(key) {
  localStorage.setItem('saleseq_admin_key', key)
}
export function hasAdminKey() {
  return !!getAdminKey()
}

// ── localStorage helpers ─────────────────────
function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : getSeedData()
  } catch {
    return getSeedData()
  }
}
function upsertLocalStorage(assignment) {
  const all = loadFromLocalStorage()
  const idx = all.findIndex(a => a.slug === assignment.slug)
  if (idx >= 0) all[idx] = assignment
  else all.push(assignment)
  localStorage.setItem(LS_KEY, JSON.stringify(all))
}
function deleteLocalStorage(slug) {
  const all = loadFromLocalStorage().filter(a => a.slug !== slug)
  localStorage.setItem(LS_KEY, JSON.stringify(all))
}

// ── Utilities ────────────────────────────────
export function makeSlug(title, chapters) {
  const base = title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 30)
  const ch = chapters.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 10)
  return `${base}_ch${ch}`
}

export function blankAssignment(overrides = {}) {
  return {
    slug: '',
    title: 'New Assignment',
    chapterLabel: 'Chapter X',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    p1: {
      title: 'Knowledge Check',
      description: 'Test your understanding of the assigned reading.',
      chapterLabel: 'Chapter X',
      questions: [],
    },
    p2: {
      title: 'Scenario',
      description: 'Apply what you learned.',
      roleLabel: 'Your Role: Sales Rep',
      aiAvatarLabel: 'REP',
      maxTurns: 12,
      systemPrompt: '',
      openingMessage: '',
      scenarioContext: '',
      evaluationCriteria: [],
    },
    apiModel: 'claude-haiku-4-5-20251001',
    ...overrides,
  }
}

// ── Seed data ────────────────────────────────
function getSeedData() {
  return [
    {
      slug: 'reading_the_room_ch4_5',
      title: 'Reading the Room',
      chapterLabel: 'Chapters 4–5',
      status: 'published',
      createdAt: '2025-01-10T00:00:00Z',
      updatedAt: '2025-01-10T00:00:00Z',
      p1: {
        title: 'Knowledge Check',
        description: 'Test your understanding of emotional intelligence in sales.',
        chapterLabel: 'Chapters 4–5',
        questions: [
          {
            id: 'q1',
            text: 'According to Sales EQ, what is the primary driver of buying decisions?',
            options: ['Logic and data', 'Emotion, justified by logic', 'Price and value comparison', 'Relationship history'],
            correct: 1,
            feedback: {
              correct: 'Correct! Buyers decide emotionally first, then justify with logic.',
              incorrect: 'Actually, Sales EQ argues emotion drives decisions — logic is used to justify afterward.'
            }
          },
        ],
      },
      p2: {
        title: 'The Tense Demo Call',
        description: 'Navigate a product demo with a skeptical, distracted prospect.',
        roleLabel: 'Your Role: Account Executive',
        aiAvatarLabel: 'PAT',
        maxTurns: 10,
        systemPrompt: `You are Pat, a skeptical VP of Operations. React authentically to the student's sales technique. Keep responses 2-3 sentences.`,
        openingMessage: "Yeah, I've got about 20 minutes. Go ahead.",
        scenarioContext: `<strong>The Setup:</strong> You're on a Zoom demo with Pat Chen, VP of Operations at Meridian Logistics. Ask before you tell, find the real pain, earn a next step.`,
        evaluationCriteria: [
          'Did the student ask discovery questions before pitching?',
          'Did they adapt to the prospect\'s emotional state?',
          'Did they handle resistance professionally?',
          'Did they attempt to establish a next step?'
        ]
      },
      apiModel: 'claude-haiku-4-5-20251001',
    }
  ]
}
