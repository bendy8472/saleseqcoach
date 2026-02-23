import { useState, useCallback } from 'react'

let _setToasts = null

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  _setToasts = setToasts

  return (
    <>
      {children}
      <div id="toast-root">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type || ''}`}>{t.msg}</div>
        ))}
      </div>
    </>
  )
}

export function toast(msg, type = '', duration = 3000) {
  if (!_setToasts) return
  const id = Date.now()
  _setToasts(prev => [...prev, { id, msg, type }])
  setTimeout(() => _setToasts(prev => prev.filter(t => t.id !== id)), duration)
}
