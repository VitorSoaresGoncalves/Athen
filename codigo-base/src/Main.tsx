import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Hub from './Hub.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Hub />
  </StrictMode>,
)
