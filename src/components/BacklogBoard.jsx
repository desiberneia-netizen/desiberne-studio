import { useEffect, useState } from 'react'
import { sb } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

const FASES = [
  { key: 'mvp', label: 'MVP' },
  { key: 'v2', label: 'V2' },
  { key: 'v3', label: 'V3' },
  { key: 'futuro', label: 'Futuro' },
]

export default function BacklogBoard({ projetoId, discoveryConfirmado }) {
  const { isAdminOuGestor, papel } = useAuth()
  const podeMover = isAdminOuGestor || papel === 'sh_operacional'
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [novoTitulo, setNovoTitulo] = useState({})
  const [seeding, setSeeding] = useState(false)
  const [seedAviso, setSeedAviso] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await sb.from('sh_backlog_itens').select('*').eq('projeto_id', projetoId).order('created_at')
    setItens(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [projetoId])

  async function seedFromDiscovery() {
    setSeeding(true)
    setSeedAviso('')
    const { data: snapshot } = await sb
      .from('sh_discovery_snapshots')
      .select('etapa4_funcionalidades')
      .eq('projeto_id', projetoId)
      .order('versao', { ascending: false })
      .limit(1)
      .single()
    const e4 = snapshot?.etapa4_funcionalidades || {}
    const todas = [...(e4.padrao || []), ...(e4.personalizadas || [])]
    const metade = Math.ceil(todas.length / 2)
    const rows = todas.map((titulo, i) => ({
      projeto_id: projetoId,
      titulo,
      fase: i < metade ? 'mvp' : 'v2',
      status: 'pendente',
      prioridade: i,
    }))
    if (rows.length > 0) {
      await sb.from('sh_backlog_itens').insert(rows)
    } else {
      setSeeding(false)
      setSeedAviso('Nenhuma funcionalidade foi marcada na etapa 4 do Discovery — adicione itens manualmente abaixo, ou revise o Discovery pra marcar funcionalidades.')
      return
    }
    setSeeding(false)
    load()
  }

  async function addItem(fase) {
    const titulo = (novoTitulo[fase] || '').trim()
    if (!titulo) return
    await sb.from('sh_backlog_itens').insert({ projeto_id: projetoId, titulo, fase, status: 'pendente' })
    setNovoTitulo({ ...novoTitulo, [fase]: '' })
    load()
  }

  async function toggleStatus(item) {
    const status = item.status === 'concluido' ? 'pendente' : 'concluido'
    await sb.from('sh_backlog_itens').update({ status }).eq('id', item.id)
    setItens(itens.map((i) => (i.id === item.id ? { ...i, status } : i)))
  }

  async function moveFase(item, fase) {
    await sb.from('sh_backlog_itens').update({ fase }).eq('id', item.id)
    setItens(itens.map((i) => (i.id === item.id ? { ...i, fase } : i)))
  }

  async function removeItem(id) {
    await sb.from('sh_backlog_itens').delete().eq('id', id)
    setItens(itens.filter((i) => i.id !== id))
  }

  if (loading) return <div className="empty-state">Carregando...</div>

  return (
    <div>
      {itens.length === 0 && discoveryConfirmado && isAdminOuGestor && (
        <div className="banner-hint">
          <span>Nenhum item no backlog ainda.</span>
          <button className="btn-ghost" onClick={seedFromDiscovery} disabled={seeding}>
            {seeding ? 'Gerando...' : 'Gerar itens a partir das funcionalidades do Discovery'}
          </button>
        </div>
      )}
      {seedAviso && <div className="banner-error">{seedAviso}</div>}
      <div className="backlog-board">
      {FASES.map((f) => {
        const itensFase = itens.filter((i) => i.fase === f.key)
        return (
          <div key={f.key} className="backlog-col">
            <div className="backlog-col-header">
              <span className={'phase-pill pill-' + f.key}>{f.label}</span>
              <span className="backlog-col-count">{itensFase.length}</span>
            </div>
            <div className="backlog-col-items">
              {itensFase.map((item) => (
                <div key={item.id} className={'backlog-card' + (item.status === 'concluido' ? ' done' : '')}>
                  <label className="backlog-check">
                    <input type="checkbox" checked={item.status === 'concluido'} disabled={!podeMover} onChange={() => toggleStatus(item)} />
                    <span>{item.titulo}</span>
                  </label>
                  <div className="backlog-card-actions">
                    <select value={item.fase} disabled={!podeMover} onChange={(e) => moveFase(item, e.target.value)}>
                      {FASES.map((f2) => (
                        <option key={f2.key} value={f2.key}>{f2.label}</option>
                      ))}
                    </select>
                    {isAdminOuGestor && <button onClick={() => removeItem(item.id)}>×</button>}
                  </div>
                </div>
              ))}
            </div>
            {isAdminOuGestor && (
              <div className="backlog-add">
                <input
                  placeholder="+ novo item"
                  value={novoTitulo[f.key] || ''}
                  onChange={(e) => setNovoTitulo({ ...novoTitulo, [f.key]: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && addItem(f.key)}
                />
              </div>
            )}
          </div>
        )
      })}
      </div>
    </div>
  )
}
