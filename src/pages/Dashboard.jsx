import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAssignments, removeAssignment, saveAssignment } from '../lib/store'
import { downloadScormPackage } from '../lib/scorm'
import { toast } from '../lib/toast'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [downloading, setDownloading] = useState(null)
  const [showImport, setShowImport]   = useState(false)
  const nav = useNavigate()

  useEffect(() => { load() }, [])

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
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={load} />}

      <aside className={styles.sidebar}>
        <div className={styles.logoWrap}>
          <img src="/logo.png" alt="Sales EQ Coach" className={styles.logoImg} />
          <span className="badge badge-ghost badge-sm tracking-widest uppercase" style={{fontSize:10,letterSpacing:'0.12em'}}>Dashboard</span>
        </div>
        <ul className="menu menu-sm w-full gap-0.5 px-0">
          <li>
            <a className="active bg-primary/10 text-primary font-medium rounded-lg gap-2.5">
              <span>⬡</span> Assignments
            </a>
          </li>
          <li>
            <a className="rounded-lg gap-2.5" onClick={() => window.open('/', '_blank')}>
              <span>↗</span> Live Site
            </a>
          </li>
        </ul>
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
            <p className={styles.pageSubtitle}>AI-Powered Sales Training Platform</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setShowImport(true)}>↑ Import JSON</button>
            <button className="btn btn-primary btn-sm" onClick={() => nav('/new')}>+ New Assignment</button>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        )}

        {!loading && published.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className="flex items-center gap-2">
                <span className="badge badge-success badge-xs p-0 w-2 h-2 rounded-full"></span>
                <span>Published</span>
              </div>
            </div>
            <div className={styles.grid}>
              {published.map(a => <AssignmentCard key={a.slug} assignment={a} onEdit={() => nav(`/edit/${a.slug}`)} onPreview={() => window.open(`/${a.slug}`,'_blank')} onDownload={() => handleDownload(a)} onDelete={() => handleDelete(a.slug)} onToggleStatus={() => handleToggleStatus(a)} isDownloading={downloading===a.slug} />)}
            </div>
          </section>
        )}

        {!loading && drafts.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className="flex items-center gap-2">
                <span className="badge badge-ghost badge-xs p-0 w-2 h-2 rounded-full"></span>
                <span>Drafts</span>
              </div>
            </div>
            <div className={styles.grid}>
              {drafts.map(a => <AssignmentCard key={a.slug} assignment={a} onEdit={() => nav(`/edit/${a.slug}`)} onPreview={() => window.open(`/${a.slug}`,'_blank')} onDownload={() => handleDownload(a)} onDelete={() => handleDelete(a.slug)} onToggleStatus={() => handleToggleStatus(a)} isDownloading={downloading===a.slug} />)}
            </div>
          </section>
        )}

        {!loading && assignments.length === 0 && (
          <div className={styles.empty}>
            <div className="text-5xl opacity-20">⬡</div>
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
    <div className="card bg-base-200 border border-base-300 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      <div className="card-body p-5 gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="badge badge-outline badge-sm" style={{fontFamily:'var(--font-mono)',fontSize:10}}>{chapterLabel}</span>
          <span
            className={`badge badge-sm cursor-pointer ${status==='published' ? 'badge-success' : 'badge-ghost'}`}
            onClick={onToggleStatus}
            title="Click to toggle"
            style={{fontFamily:'var(--font-mono)',fontSize:10}}
          >
            {status==='published' ? '● Live' : '○ Draft'}
          </span>
        </div>
        <h2 className="card-title text-lg" style={{fontFamily:'var(--font-display)',letterSpacing:'0.04em'}}>{title}</h2>
        <div style={{fontFamily:'var(--font-mono)',fontSize:11}} className="opacity-40">/{slug}</div>
        <div className="flex gap-5 bg-base-300/50 rounded-lg p-3">
          <div className="flex flex-col gap-0.5">
            <span style={{fontFamily:'var(--font-display)',fontSize:18}} className="leading-none">{p1?.questions?.length||0}</span>
            <span className="uppercase tracking-wider opacity-50" style={{fontFamily:'var(--font-mono)',fontSize:9}}>Questions</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span style={{fontFamily:'var(--font-display)',fontSize:18}} className="leading-none">{p2?.maxTurns||'—'}</span>
            <span className="uppercase tracking-wider opacity-50" style={{fontFamily:'var(--font-mono)',fontSize:9}}>Turns</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span style={{fontFamily:'var(--font-display)',fontSize:18}} className="leading-none">{new Date(updatedAt).toLocaleDateString()}</span>
            <span className="uppercase tracking-wider opacity-50" style={{fontFamily:'var(--font-mono)',fontSize:9}}>Updated</span>
          </div>
        </div>
        <div className="card-actions mt-1">
          <button className="btn btn-ghost btn-sm" onClick={onEdit}>✏ Edit</button>
          <button className="btn btn-ghost btn-sm" onClick={onPreview}>↗ Preview</button>
          <button className="btn btn-primary btn-sm" onClick={onDownload} disabled={isDownloading}>{isDownloading?'⏳':'↓'} SCORM</button>
          <button className="btn btn-error btn-outline btn-sm" onClick={onDelete}>✕</button>
        </div>
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
    <dialog className="modal modal-open">
      <div className="modal-box bg-base-200">
        <button className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3" onClick={onClose}>✕</button>
        <h3 className="text-lg font-bold" style={{fontFamily:'var(--font-display)',letterSpacing:'0.04em'}}>Import Assignment JSON</h3>
        <p className="text-sm opacity-60 mt-1 leading-relaxed">
          Paste a JSON assignment config. Can be a single object or array of assignments.
        </p>
        <textarea
          className="textarea textarea-bordered w-full mt-4"
          style={{fontFamily:'var(--font-mono)',fontSize:12}}
          rows={12}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={'{\n  "slug": "my_assignment_ch1",\n  "title": "..."\n}'}
        />
        {error && <div className="text-error text-sm mt-2">Error: {error}</div>}
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleImport} disabled={!text.trim()}>Import</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop bg-black/70">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  )
}
