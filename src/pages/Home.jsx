import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAssignments } from '../lib/store'
import styles from './Home.module.css'

export default function Home() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    fetchAssignments().then(data => {
      setAssignments(data.filter(a => a.status === 'published'))
      setLoading(false)
    })
  }, [])

  return (
    <div className={styles.page}>
      {/* Hero */}
      <header className={styles.hero}>
        <img src="/logo.png" alt="Sales EQ Coach" className={styles.heroLogo} />
        <h1 className={styles.heroTitle}>Sales EQ Coach</h1>
        <p className={styles.heroTagline}>AI-Powered Sales Training</p>
      </header>

      {/* Assignment grid */}
      <section className={styles.content}>
        {loading && (
          <div className="flex justify-center py-20">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        )}

        {!loading && assignments.length > 0 && (
          <>
            <div className={styles.sectionLabel}>Available Assignments</div>
            <div className={styles.grid}>
              {assignments.map(a => (
                <div key={a.slug} className={styles.card}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge badge-outline badge-sm" style={{fontFamily:'var(--font-mono)',fontSize:10}}>
                      {a.chapterLabel}
                    </span>
                  </div>
                  <h2 className={styles.cardTitle}>{a.title}</h2>
                  <div className={styles.cardMeta}>
                    <div className={styles.cardStat}>
                      <span className={styles.cardStatNum}>{a.p1?.questions?.length || 0}</span>
                      <span className={styles.cardStatLabel}>Questions</span>
                    </div>
                    <div className={styles.cardStat}>
                      <span className={styles.cardStatNum}>{a.p2?.maxTurns || '—'}</span>
                      <span className={styles.cardStatLabel}>Turns</span>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm mt-auto self-start"
                    onClick={() => nav(`/${a.slug}`)}
                  >
                    Start →
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && assignments.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>⬡</div>
            <p>No assignments available yet.</p>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        Sales EQ Coach — AI-Powered Sales Training
      </footer>
    </div>
  )
}
