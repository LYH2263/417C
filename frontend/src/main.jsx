import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initErrorMonitoring } from './services/errorMonitor'
import { initPerformanceMonitoring } from './services/performance'
import clientLogger from './services/logger'

initErrorMonitoring()
initPerformanceMonitoring()

clientLogger.info('Application initialized', {
  user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  language: typeof navigator !== 'undefined' ? navigator.language : '',
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
