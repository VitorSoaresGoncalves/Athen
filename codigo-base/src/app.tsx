import React from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { SupaConnect, ProtectedRoute } from './components/supabase-connect'
import { CrudConsole } from './components/crud-console'

const HomePage: React.FC = () => {
  return (
    <div>
        <h2>Bem-vindo ao Athen</h2>
        <SupaConnect />
        <hr />
        <li><Link to="/crud">Console CRUD</Link></li>
    </div>
  )
}



export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/crud" element={<ProtectedRoute><CrudConsole /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}