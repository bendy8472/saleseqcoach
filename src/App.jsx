import { Routes, Route } from 'react-router-dom'
import { ToastProvider } from './lib/toast'
import Dashboard from './pages/Dashboard'
import Editor from './pages/Editor'
import Assignment from './pages/Assignment'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/"            element={<Dashboard />} />
        <Route path="/dashboard"   element={<Dashboard />} />
        <Route path="/edit/:slug"  element={<Editor />} />
        <Route path="/new"         element={<Editor />} />
        <Route path="/:slug"       element={<Assignment />} />
      </Routes>
    </ToastProvider>
  )
}
