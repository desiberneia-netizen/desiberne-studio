import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sb } from '../lib/supabaseClient'

export default function Dashboard() {
  const [projetos, setProjetos] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: proj }, { data: cli }] = await Promise.all([
        sb.from('sh_projetos').select('*, sh_clientes(nome)').order('prazo', { ascending: true }),
        sb.from('sh_clientes').select('id'),
      ])
      setProjetos(proj || [])
      setClientes(cli || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="empty-state">Carregando...</div>

  const hoje = new Date().toISOString().split('T')[0]
  const ativos = projetos.filter((p) => !['entregue', 'pausado'].includes(p.status))
  const atrasados = ativos.filter((p) => p.prazo && p.prazo < hoje)
  const concluidos = projetos.filter((p) => p.status === 'entregue')
  const proximasEntregas = ativos
    .filter((p) => p.prazo && p.prazo >= hoje)
    .sort((a, b) => (a.prazo > b.prazo ? 1 : -1))
    .slice(0, 5)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Visão geral dos projetos da Software House</p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Projetos ativos</div>
          <div className="kpi-value">{ativos.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Atrasados</div>
          <div className="kpi-value kpi-value-danger">{atrasados.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Concluídos</div>
          <div className="kpi-value kpi-value-success">{concluidos.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Clientes</div>
          <div className="kpi-value">{clientes.length}</div>
        </div>
      </div>

      {atrasados.length > 0 && (
        <>
          <h2 className="section-title">Atrasados</h2>
          <div className="table-wrap" style={{ marginBottom: 24 }}>
            <table>
              <tbody>
                {atrasados.map((p) => (
                  <tr key={p.id}>
                    <td><Link to={`/projetos/${p.id}`}><code>{p.codigo}</code></Link></td>
                    <td>{p.nome}</td>
                    <td>{p.sh_clientes?.nome}</td>
                    <td className="text-danger">{new Date(p.prazo + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="section-title">Próximas entregas</h2>
      <div className="table-wrap">
        {proximasEntregas.length === 0 ? (
          <div className="empty-state">Nenhuma entrega com prazo definido.</div>
        ) : (
          <table>
            <tbody>
              {proximasEntregas.map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/projetos/${p.id}`}><code>{p.codigo}</code></Link></td>
                  <td>{p.nome}</td>
                  <td>{p.sh_clientes?.nome}</td>
                  <td>{new Date(p.prazo + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
