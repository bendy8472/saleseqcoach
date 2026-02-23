# Sales EQ Coach — Assignment Platform

A dashboard for building, managing, and deploying AI-powered SCORM assignments for the Professional Sales course.

---

## Stack
- **React + Vite** — frontend
- **React Router** — dashboard + per-assignment pages
- **JSZip + FileSaver** — client-side SCORM zip generation
- **Vercel** — hosting (free tier is fine)
- **localStorage** — assignment data storage (no backend needed)
- **Anthropic API** — powers the Part 2 AI scenarios

---

## Routes
| Route | Who sees it |
|---|---|
| `/` or `/dashboard` | You (assignment editor dashboard) |
| `/new` | You (create new assignment) |
| `/edit/:slug` | You (edit assignment) |
| `/:slug` | Students (the actual assignment) |

---

## Setup & Deploy

### 1. Install dependencies
```bash
cd saleseqcoach
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
# Edit .env.local with your values:
# VITE_BASE_URL=https://saleseqcoach.com
# VITE_ANTHROPIC_KEY=sk-ant-...
```

### 3. Run locally
```bash
npm run dev
# → http://localhost:5173
```

### 4. Deploy to Vercel
```bash
# Install Vercel CLI if needed
npm install -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard:
# VITE_BASE_URL  →  https://your-domain.com
# VITE_ANTHROPIC_KEY  →  sk-ant-...
```

### 5. Connect your domain
- Buy domain (Namecheap, Google Domains, etc.)
- In Vercel: Project Settings → Domains → Add domain
- Follow Vercel's DNS instructions (usually just add a CNAME)

---

## Creating an Assignment

1. Go to `/dashboard`
2. Click **+ New Assignment**
3. Fill in Assignment Info (title, chapters, slug)
4. Click **✦ AI Generate** to auto-generate quiz questions + scenario from the book
   - Enter your Anthropic API key when prompted
   - Review and edit everything
5. Click **Save**
6. Go to **↓ Export SCORM** tab → Download zip
7. Upload to Canvas as a SCORM 2004 package

---

## Using Claude Code to Generate Assignments

In your `sales-eq-app` Claude Code project, you can generate assignment content by asking:

> "Using the book.txt, generate a Sales EQ assignment config for Chapters 11-12. Focus on [topic]. The Part 2 scenario should involve [scenario idea]."

Then paste the generated config into the dashboard editor.

---

## API Key Management

The Anthropic API key is stored in your `.env.local` (via `VITE_ANTHROPIC_KEY`) and injected at build time. 

**This is fine for a single-instructor setup.** The key is embedded in the built JS bundle — it's not a secret URL. For production with many users, consider a backend proxy.

To update the key: change it in Vercel's environment variables and redeploy.

---

## Grading
- Part 1 (quiz): automatic, based on correct answers
- Part 2 (scenario): AI self-evaluates student at the end (0-100)
- Final Canvas score: **(P1 × 50%) + (P2 × 50%)**
- Passing threshold: **70%** (set in SCORM manifest)

---

## File Structure
```
saleseqcoach/
├── src/
│   ├── pages/
│   │   ├── Dashboard.jsx   ← Assignment list + cards
│   │   ├── Editor.jsx      ← Full assignment editor
│   │   └── Assignment.jsx  ← Student-facing assignment
│   ├── lib/
│   │   ├── store.js        ← localStorage data layer
│   │   ├── scorm.js        ← SCORM zip generator
│   │   └── toast.jsx       ← Notification system
│   ├── App.jsx             ← Router
│   └── index.css           ← Global styles + design tokens
├── .env.example
├── vercel.json             ← SPA routing config
└── vite.config.js
```
