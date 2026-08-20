import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

const PAPEL_LABEL = {
  sh_admin: 'Admin',
  sh_gestor: 'Gestor',
  sh_operacional: 'Operacional',
}

export default function Layout() {
  const { logout, session, papel, isAdmin } = useAuth()

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
          <span className="studio-user">
            {session?.user?.email}
            {papel && <span className="papel-badge">{PAPEL_LABEL[papel]}</span>}
          </span>
          <button className="studio-logout" onClick={logout}>Sair</button>
        </div>
      </header>
      {papel === null && (
        <div className="banner-error" style={{ margin: '12px 20px 0', borderRadius: 10 }}>
          Seu acesso ao Studio ainda não foi configurado por um admin — você pode visualizar, mas não criar ou editar nada.
        </div>
      )}
      <div className="studio-body">
        <nav className="studio-sidebar">
          <NavLink to="/dashboard" className={({ isActive }) => 'studio-nav-item' + (isActive ? ' active' : '')}>
            Dashboard
          </NavLink>
          <NavLink to="/clientes" className={({ isActive }) => 'studio-nav-item' + (isActive ? ' active' : '')}>
            Clientes
          </NavLink>
          <NavLink to="/projetos" className={({ isActive }) => 'studio-nav-item' + (isActive ? ' active' : '')}>
            Projetos
          </NavLink>
          <NavLink to="/ideias" className={({ isActive }) => 'studio-nav-item' + (isActive ? ' active' : '')}>
            Banco de Ideias
          </NavLink>
          <NavLink to="/templates" className={({ isActive }) => 'studio-nav-item' + (isActive ? ' active' : '')}>
            Templates
          </NavLink>
          <NavLink to="/componentes" className={({ isActive }) => 'studio-nav-item' + (isActive ? ' active' : '')}>
            Componentes
          </NavLink>
          {isAdmin && (
            <NavLink to="/usuarios" className={({ isActive }) => 'studio-nav-item' + (isActive ? ' active' : '')}>
              Usuários
            </NavLink>
          )}
        </nav>
        <main className="studio-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
