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
    const raw = await res.json()
    const data = Array.isArray(raw) ? raw : (raw.value || [])
    if (data.length) return data
    return loadFromLocalStorage()
  } catch {
    return loadFromLocalStorage()
  }
}

export async function fetchAssignment(slug) {
  try {
    const res = await fetch(API_BASE)
    if (!res.ok) throw new Error('API error')
    const raw = await res.json()
    const data = Array.isArray(raw) ? raw : (raw.value || [])
    return data.find(a => a.slug === slug) || null
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
  return []
}

