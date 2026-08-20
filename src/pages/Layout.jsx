import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function Layout() {
  const { logout, session } = useAuth()

  return (
    <div className="studio-shell">
      <header className="studio-topbar">
        <div className="studio-logo">
          <img src="https://i.imgur.com/rrQxwkl.png" alt="Desiberne" />
          <span>Desiberne <b>Studio</b></span>
        </div>
        <div className="studio-topbar-right">
          <a className="studio-back" href="https://desiberne-crm.vercel.app" target="_blank" rel="noreferrer">
            Voltar ao CRM
          </a>
          <span className="studio-user">{session?.user?.email}</span>
          <button className="studio-logout" onClick={logout}>Sair</button>
        </div>
      </header>
      <div className="studio-body">
        <nav className="studio-sidebar">
          <NavLink to="/clientes" className={({ isActive }) => 'studio-nav-item' + (isActive ? ' active' : '')}>
            Clientes
          </NavLink>
          <NavLink to="/projetos" className={({ isActive }) => 'studio-nav-item' + (isActive ? ' active' : '')}>
            Projetos
          </NavLink>
        </nav>
        <main className="studio-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
