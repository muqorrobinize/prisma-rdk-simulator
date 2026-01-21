import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PrismaAdvanced from './PrismaAdvanced.tsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PrismaAdvanced />
  </StrictMode>,
)
