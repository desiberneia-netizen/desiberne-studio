import { useEffect, useState } from 'react'
import { sb } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

const STATUS_LABEL = {
  nova: 'Nova',
  avaliando: 'Avaliando',
  aprovada: 'Aprovada',
  descartada: 'Descartada',
}

const emptyForm = { id: null, titulo: '', descricao: '', status: 'nova' }

export default function Ideias() {
  const { isAdminOuGestor } = useAuth()
  const [ideias, setIdeias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState('todas')

  async function load() {
    setLoading(true)
    const { data, error } = await sb.from('sh_ideias').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setIdeias(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function openNew() {
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(i) {
    setForm({ id: i.id, titulo: i.titulo || '', descricao: i.descricao || '', status: i.status || 'nova' })
    setModalOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.titulo.trim()) return
    setSaving(true)
    const payload = { titulo: form.titulo.trim(), descricao: form.descricao.trim(), status: form.status }
    const { error } = form.id
      ? await sb.from('sh_ideias').update(payload).eq('id', form.id)
      : await sb.from('sh_ideias').insert(payload)
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setModalOpen(false)
    load()
  }

  async function handleDelete(id) {
    if (!confirm('Excluir esta ideia?')) return
    const { error } = await sb.from('sh_ideias').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  const ideiasFiltradas = filtro === 'todas' ? ideias : ideias.filter((i) => i.status === filtro)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Banco de Ideias</h1>
          <p>Registro livre de ideias — podem virar backlog de um projeto depois</p>
        </div>
        {isAdminOuGestor && <button className="btn-primary" onClick={openNew}>+ Nova Ideia</button>}
      </div>

      <div className="link-filter-btns">
        {['todas', 'nova', 'avaliando', 'aprovada', 'descartada'].map((f) => (
          <button key={f} className={'filter-chip' + (filtro === f ? ' active' : '')} onClick={() => setFiltro(f)}>
            {f === 'todas' ? 'Todas' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {error && <div className="banner-error">{error}</div>}

      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : ideiasFiltradas.length === 0 ? (
        <div className="empty-state">Nenhuma ideia por aqui ainda.</div>
      ) : (
        <div className="ideias-grid">
          {ideiasFiltradas.map((i) => (
            <div key={i.id} className="ideia-card" onClick={() => isAdminOuGestor && openEdit(i)}>
              <div className="ideia-card-header">
                <span className={'status-pill status-ideia-' + i.status}>{STATUS_LABEL[i.status] || i.status}</span>
              </div>
              <div className="ideia-titulo">{i.titulo}</div>
              {i.descricao && <div className="ideia-desc">{i.descricao}</div>}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{form.id ? 'Editar Ideia' : 'Nova Ideia'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-row">
                <label>Título *</label>
                <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
              </div>
              <div className="form-row">
                <label>Descrição</label>
                <textarea rows={4} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div className="form-row">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="modal-footer">
                {form.id && (
                  <button type="button" className="btn-danger" onClick={() => { handleDelete(form.id); setModalOpen(false) }}>
                    Excluir
                  </button>
                )}
                <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
