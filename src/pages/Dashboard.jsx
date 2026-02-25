import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAssignments, removeAssignment, saveAssignment, getAdminKey, setAdminKey, hasAdminKey, syncToKV } from '../lib/store'
import { downloadScormPackage } from '../lib/scorm'
import { toast } from '../lib/toast'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [downloading, setDownloading] = useState(null)
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [showImport, setShowImport]   = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    if (!hasAdminKey()) setShowKeyModal(true)
    load()
  }, [])

  async function load() {
    setLoading(true)
    const data = await fetchAssignments()
    setAssignments(data)
    setLoading(false)
  }

  async function handleDelete(slug) {
    if (!confirm(`Delete "${slug}"? This cannot be undone.`)) return
    await removeAssignment(slug)
    load()
    toast('Assignment deleted')
  }

  async function handleToggleStatus(assignment) {
    const updated = { ...assignment, status: assignment.status === 'published' ? 'draft' : 'published', updatedAt: new Date().toISOString() }
    try { await saveAssignment(updated); load(); toast(`Marked as ${updated.status}`) }
    catch { toast('Could not update status', 'error') }
  }

  async function handleDownload(assignment) {
    setDownloading(assignment.slug)
    try { await downloadScormPackage(assignment); toast(`Downloaded ${assignment.slug}.zip`, 'success') }
    catch (e) { toast('Download failed: ' + e.message, 'error') }
    setDownloading(null)
  }

  const published = assignments.filter(a => a.status === 'published')
  const drafts     = assignments.filter(a => a.status !== 'published')

  return (
    <div className={styles.page}>
      {showKeyModal && <AdminKeyModal onSave={key => { setAdminKey(key); setShowKeyModal(false); syncToKV(); load() }} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={load} />}

      <aside className={styles.sidebar}>
        <div className={styles.logoWrap}>
          <img src="/logo.png" alt="Sales EQ Coach" className={styles.logoImg} />
          <div className={styles.logoSub}>Dashboard</div>
        </div>
        <nav className={styles.sideNav}>
          <a className={`${styles.navItem} ${styles.navActive}`}><span>⬡</span> Assignments</a>
          <a className={styles.navItem} onClick={() => window.open('/', '_blank')}><span>↗</span> Live Site</a>
          <a className={styles.navItem} onClick={() => setShowKeyModal(true)}><span>⚙</span> API Key</a>
        </nav>
        <div className={styles.sideStats}>
          <div className={styles.statBlock}><div className={styles.statNum}>{assignments.length}</div><div className={styles.statLabel}>Total</div></div>
          <div className={styles.statBlock}><div className={styles.statNum}>{published.length}</div><div className={styles.statLabel}>Live</div></div>
          <div className={styles.statBlock}><div className={styles.statNum}>{drafts.length}</div><div className={styles.statLabel}>Draft</div></div>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>Assignments</h1>
            <p className={styles.pageSubtitle}>Create, edit, and export SCORM packages for Canvas</p>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-ghost" onClick={() => setShowImport(true)}>↑ Import JSON</button>
            <button className="btn btn-primary" onClick={() => nav('/new')}>+ New Assignment</button>
          </div>
        </div>

        {loading && <div className={styles.loadingMsg}>Loading assignments…</div>}

        {!loading && published.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}><span className={styles.sectionDot} style={{background:'var(--success)'}} /> Published</div>
            <div className={styles.grid}>
              {published.map(a => <AssignmentCard key={a.slug} assignment={a} onEdit={() => nav(`/edit/${a.slug}`)} onPreview={() => window.open(`/${a.slug}`,'_blank')} onDownload={() => handleDownload(a)} onDelete={() => handleDelete(a.slug)} onToggleStatus={() => handleToggleStatus(a)} isDownloading={downloading===a.slug} />)}
            </div>
          </section>
        )}

        {!loading && drafts.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}><span className={styles.sectionDot} style={{background:'var(--muted)'}} /> Drafts</div>
            <div className={styles.grid}>
              {drafts.map(a => <AssignmentCard key={a.slug} assignment={a} onEdit={() => nav(`/edit/${a.slug}`)} onPreview={() => window.open(`/${a.slug}`,'_blank')} onDownload={() => handleDownload(a)} onDelete={() => handleDelete(a.slug)} onToggleStatus={() => handleToggleStatus(a)} isDownloading={downloading===a.slug} />)}
            </div>
          </section>
        )}

        {!loading && assignments.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>◈</div>
            <div className={styles.emptyTitle}>No assignments yet</div>
            <div className={styles.emptySub}>Click "+ New Assignment" or "↑ Import JSON" to get started</div>
          </div>
        )}
      </main>
    </div>
  )
}

function AssignmentCard({ assignment, onEdit, onPreview, onDownload, onDelete, onToggleStatus, isDownloading }) {
  const { slug, title, chapterLabel, status, p1, p2, updatedAt } = assignment
  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.cardMeta}>
          <span className={styles.chapterChip}>{chapterLabel}</span>
          <span className={`${styles.statusChip} ${status==='published'?styles.statusLive:styles.statusDraft}`} onClick={onToggleStatus} title="Click to toggle">
            {status==='published'?'● Live':'○ Draft'}
          </span>
        </div>
        <h2 className={styles.cardTitle}>{title}</h2>
        <div className={styles.cardSlug}>/{slug}</div>
      </div>
      <div className={styles.cardStats}>
        <div className={styles.cardStat}><span className={styles.cardStatNum}>{p1?.questions?.length||0}</span><span className={styles.cardStatLabel}>Questions</span></div>
        <div className={styles.cardStat}><span className={styles.cardStatNum}>{p2?.maxTurns||'—'}</span><span className={styles.cardStatLabel}>Turns</span></div>
        <div className={styles.cardStat}><span className={styles.cardStatNum}>{new Date(updatedAt).toLocaleDateString()}</span><span className={styles.cardStatLabel}>Updated</span></div>
      </div>
      <div className={styles.cardActions}>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>✏ Edit</button>
        <button className="btn btn-ghost btn-sm" onClick={onPreview}>↗ Preview</button>
        <button className="btn btn-primary btn-sm" onClick={onDownload} disabled={isDownloading}>{isDownloading?'⏳':'↓'} SCORM</button>
        <button className="btn btn-danger btn-sm" onClick={onDelete}>✕</button>
      </div>
    </div>
  )
}

function AdminKeyModal({ onSave }) {
  const [key, setKey] = useState(getAdminKey())
  return (
    <div style={overlay}>
      <div style={modal}>
        <h2 style={{fontFamily:'var(--font-display)',fontSize:24,marginBottom:8}}>Dashboard API Key</h2>
        <p style={{color:'var(--muted)',fontSize:13,marginBottom:16,lineHeight:1.6}}>
          Enter your Admin API Key to enable saving assignments. This matches the <code>ADMIN_API_KEY</code> in your Vercel environment variables.
        </p>
        <input value={key} onChange={e=>setKey(e.target.value)} placeholder="your-secret-admin-key" type="password" style={{marginBottom:12}} />
        <button className="btn btn-primary" onClick={()=>onSave(key)} disabled={!key}>Save Key</button>
      </div>
    </div>
  )
}

function ImportModal({ onClose, onImport }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  async function handleImport() {
    setError('')
    try {
      const data = JSON.parse(text.trim())
      const assignments = Array.isArray(data) ? data : [data]
      for (const a of assignments) {
        if (!a.slug) throw new Error('Assignment missing slug field')
        await saveAssignment(a)
      }
      toast(`Imported ${assignments.length} assignment(s)`, 'success')
      onImport()
      onClose()
    } catch(e) { setError(e.message) }
  }

  return (
    <div style={overlay}>
      <div style={{...modal,width:560}}>
        <h2 style={{fontFamily:'var(--font-display)',fontSize:24,marginBottom:8}}>Import Assignment JSON</h2>
        <p style={{color:'var(--muted)',fontSize:13,marginBottom:12,lineHeight:1.6}}>
          Paste a JSON assignment config from Claude Code. Can be a single object or array of assignments.
        </p>
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder={'{\n  "slug": "my_assignment_ch1",\n  "title": "..."\n}'} rows={12} style={{fontFamily:'var(--font-mono)',fontSize:12,marginBottom:8}} />
        {error && <div style={{color:'var(--danger)',fontSize:12,marginBottom:8}}>Error: {error}</div>}
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-primary" onClick={handleImport} disabled={!text.trim()}>Import</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

const overlay = {position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}
const modal = {background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:28,width:420,maxWidth:'90vw'}
