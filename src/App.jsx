import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import Layout from './pages/Layout'
import Clientes from './pages/Clientes'
import Projetos from './pages/Projetos'

function Gate({ children }) {
  const { session } = useAuth()
  if (session === undefined) return <div className="studio-loading">Carregando...</div>
  if (session === null) return <Login />
  return children
}

function App() {
  return (
    <AuthProvider>
      <Gate>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/clientes" replace />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/projetos" element={<Projetos />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </Gate>
    </AuthProvider>
  )
}

export default App
