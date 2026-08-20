import { useEffect, useState } from 'react'
import { sb } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

const CATEGORIAS = ['Componente', 'Layout', 'Card', 'Dashboard', 'Tabela', 'Gráfico', 'Formulário', 'Modal', 'Animação', 'Outro']

function emptyForm() {
  return { id: null, nome: '', categoria: 'Componente', codigo_ou_preview: '', tags: '', projeto_origem_id: '' }
}

export default function Componentes() {
  const { isAdminOuGestor } = useAuth()
  const [componentes, setComponentes] = useState([])
  const [projetos, setProjetos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas')

  async function load() {
    setLoading(true)
    const [{ data: comps, error: errC }, { data: proj }] = await Promise.all([
      sb.from('sh_componentes').select('*, sh_projetos(nome)').order('created_at', { ascending: false }),
      sb.from('sh_projetos').select('id, nome').order('nome'),
    ])
    if (errC) setError(errC.message)
    setComponentes(comps || [])
    setProjetos(proj || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function openNew() {
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(c) {
    setForm({
      id: c.id,
      nome: c.nome || '',
      categoria: c.categoria || 'Componente',
      codigo_ou_preview: c.codigo_ou_preview || '',
      tags: (c.tags || []).join(', '),
      projeto_origem_id: c.projeto_origem_id || '',
    })
    setModalOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.nome.trim()) return
    setSaving(true)
    const payload = {
      nome: form.nome.trim(),
      categoria: form.categoria,
      codigo_ou_preview: form.codigo_ou_preview,
      tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
      projeto_origem_id: form.projeto_origem_id || null,
    }
    const { error } = form.id
      ? await sb.from('sh_componentes').update(payload).eq('id', form.id)
      : await sb.from('sh_componentes').insert(payload)
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setModalOpen(false)
    load()
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este componente?')) return
    const { error } = await sb.from('sh_componentes').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  const filtrados = componentes.filter((c) => {
    if (categoriaFiltro !== 'todas' && c.categoria !== categoriaFiltro) return false
    if (busca && !`${c.nome} ${(c.tags || []).join(' ')}`.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Biblioteca de Componentes</h1>
          <p>Catálogo reutilizável de componentes, layouts e trechos de código entre projetos</p>
        </div>
        {isAdminOuGestor && <button className="btn-primary" onClick={openNew}>+ Novo Componente</button>}
      </div>

      <input className="link-search" placeholder="Buscar por nome ou tag..." value={busca} onChange={(e) => setBusca(e.target.value)} />

      <div className="link-filter-btns">
        <button className={'filter-chip' + (categoriaFiltro === 'todas' ? ' active' : '')} onClick={() => setCategoriaFiltro('todas')}>Todas</button>
        {CATEGORIAS.map((c) => (
          <button key={c} className={'filter-chip' + (categoriaFiltro === c ? ' active' : '')} onClick={() => setCategoriaFiltro(c)}>{c}</button>
        ))}
      </div>

      {error && <div className="banner-error">{error}</div>}

      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">Nenhum componente encontrado.</div>
      ) : (
        <div className="ideias-grid">
          {filtrados.map((c) => (
            <div key={c.id} className="ideia-card" onClick={() => isAdminOuGestor && openEdit(c)}>
              <span className="status-pill status-ideia-nova">{c.categoria}</span>
              <div className="ideia-titulo" style={{ marginTop: 8 }}>{c.nome}</div>
              {c.sh_projetos?.nome && <div className="ideia-desc">Origem: {c.sh_projetos.nome}</div>}
              {(c.tags || []).length > 0 && (
                <div className="chip-row" style={{ marginTop: 8, marginBottom: 0 }}>
                  {c.tags.map((t) => <span key={t} className="chip" style={{ cursor: 'default' }}>{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{form.id ? 'Editar Componente' : 'Novo Componente'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-row-split">
                <div className="form-row">
                  <label>Nome *</label>
                  <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
                </div>
                <div className="form-row">
                  <label>Categoria</label>
                  <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                    {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <label>Tags</label>
                <input placeholder="separadas por vírgula" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              </div>
              <div className="form-row">
                <label>Projeto de origem (opcional)</label>
                <select value={form.projeto_origem_id} onChange={(e) => setForm({ ...form, projeto_origem_id: e.target.value })}>
                  <option value="">—</option>
                  {projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>Código / descrição</label>
                <textarea rows={8} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }} value={form.codigo_ou_preview} onChange={(e) => setForm({ ...form, codigo_ou_preview: e.target.value })} />
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
