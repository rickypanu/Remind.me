import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme.css'
import App from './App.jsx'
import { ThemeProvider } from './theme/ThemeContext.jsx'
import { warmUpServer } from './utils/warmup'
import { initInstallCapture } from './utils/install'

initInstallCapture() // catch the browser's one-time install offer before React starts
warmUpServer() // wake a sleeping API now, while the page is still loading

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
