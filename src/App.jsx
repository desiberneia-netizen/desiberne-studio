function App() {
  return (
    <div className="studio-shell">
      <header className="studio-topbar">
        <div className="studio-logo">
          <img src="https://i.imgur.com/rrQxwkl.png" alt="Desiberne" />
          <span>Desiberne <b>Studio</b></span>
        </div>
        <a className="studio-back" href="https://desiberne-crm.vercel.app" target="_blank" rel="noreferrer">
          Voltar ao CRM
        </a>
      </header>
      <main className="studio-main">
        <div className="studio-empty">
          <div className="studio-empty-icon">🏗️</div>
          <h1>Fase 1 em construção</h1>
          <p>Clientes, Projetos e o Wizard de Discovery ainda vão entrar aqui.</p>
        </div>
      </main>
    </div>
  )
}

export default App
