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
      const published = data.filter(a => a.status === 'published')
      published.sort((a, b) => {
        const numA = parseInt((a.chapterLabel || '').match(/\d+/)?.[0]) || 999
        const numB = parseInt((b.chapterLabel || '').match(/\d+/)?.[0]) || 999
        return numA - numB
      })
      setAssignments(published)
      setLoading(false)
    })
  }, [])

  return (
    <div className={styles.page}>
      {/* Navbar */}
      <nav className={styles.navbar}>
        <a href="/" className={styles.navBrand}>
          <img src="/logo.png" alt="Sales EQ Coach" className={styles.navLogo} />
          <span className={styles.navTitle}>Sales EQ Coach</span>
        </a>
        <button className={styles.settingsBtn} onClick={() => nav('/dashboard')}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </nav>

      {/* Hero */}
      <header className={styles.hero}>
        <h1 className={styles.heroTitle}>Sales EQ Coach</h1>
        <p className={styles.heroTagline}>AI-Powered Sales Training</p>
      </header>

      {/* Assignment grid */}
      <section className={styles.content}>
        {loading && (
          <div className={styles.loadingWrap}>
            <div className={styles.spinner} />
          </div>
        )}

        {!loading && assignments.length > 0 && (
          <>
            <div className={styles.sectionLabel}>Assignments</div>
            <div className={styles.grid}>
              {assignments.map(a => (
                <div key={a.slug} className={styles.card} onClick={() => nav(`/${a.slug}`)}>
                  <div className={styles.cardChip}>{a.chapterLabel}</div>
                  <h2 className={styles.cardTitle}>{a.title}</h2>
                  <div className={styles.cardMeta}>
                    <div className={styles.cardStat}>
                      <span className={styles.cardStatNum}>{a.p1?.questions?.length || 0}</span>
                      <span className={styles.cardStatLabel}>Questions</span>
                    </div>
                    <div className={styles.cardDivider} />
                    <div className={styles.cardStat}>
                      <span className={styles.cardStatNum}>{a.p2?.maxTurns || '—'}</span>
                      <span className={styles.cardStatLabel}>Turns</span>
                    </div>
                  </div>
                  <div className={styles.cardAction}>
                    Start
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && assignments.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className={styles.emptyText}>No assignments available yet.</p>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        Sales EQ Coach
      </footer>
    </div>
  )
}
