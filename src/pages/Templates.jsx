import { useEffect, useState } from 'react'
import { sb } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { FUNCIONALIDADES_CATALOGO } from '../lib/catalogos'

function emptyForm() {
  return {
    id: null,
    nome: '',
    segmento: '',
    descricao: '',
    funcionalidades: [],
    cores: '',
    tipografia: '',
    estilo: '',
    tema: 'escuro',
  }
}

function toggleInArray(arr, value) {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

export default function Templates() {
  const { isAdminOuGestor } = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await sb.from('sh_templates').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setTemplates(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function openNew() {
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(t) {
    const e7 = t.discovery_padrao?.etapa7_identidade || {}
    setForm({
      id: t.id,
      nome: t.nome || '',
      segmento: t.segmento || '',
      descricao: t.descricao || '',
      funcionalidades: t.funcionalidades_padrao?.padrao || [],
      cores: (e7.cores || []).join(', '),
      tipografia: e7.tipografia || '',
      estilo: e7.estilo || '',
      tema: e7.tema || 'escuro',
    })
    setModalOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.nome.trim()) return
    setSaving(true)
    const payload = {
      nome: form.nome.trim(),
      segmento: form.segmento.trim(),
      descricao: form.descricao.trim(),
      funcionalidades_padrao: { padrao: form.funcionalidades },
      discovery_padrao: {
        etapa7_identidade: {
          cores: form.cores.split(',').map((s) => s.trim()).filter(Boolean),
          tipografia: form.tipografia,
          estilo: form.estilo,
          tema: form.tema,
        },
      },
    }
    const { error } = form.id
      ? await sb.from('sh_templates').update(payload).eq('id', form.id)
      : await sb.from('sh_templates').insert(payload)
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setModalOpen(false)
    load()
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este template?')) return
    const { error } = await sb.from('sh_templates').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Templates</h1>
          <p>Pontos de partida por segmento — acelera a criação de um projeto novo</p>
        </div>
        {isAdminOuGestor && <button className="btn-primary" onClick={openNew}>+ Novo Template</button>}
      </div>

      {error && <div className="banner-error">{error}</div>}

      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : templates.length === 0 ? (
        <div className="empty-state">Nenhum template cadastrado ainda.</div>
      ) : (
        <div className="ideias-grid">
          {templates.map((t) => (
            <div key={t.id} className="ideia-card" onClick={() => isAdminOuGestor && openEdit(t)}>
              <div className="ideia-titulo">{t.nome}</div>
              {t.segmento && <span className="status-pill status-ideia-nova">{t.segmento}</span>}
              {t.descricao && <div className="ideia-desc" style={{ marginTop: 8 }}>{t.descricao}</div>}
              <div className="ideia-desc" style={{ marginTop: 8 }}>
                {(t.funcionalidades_padrao?.padrao || []).length} funcionalidades pré-marcadas
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{form.id ? 'Editar Template' : 'Novo Template'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-row-split">
                <div className="form-row">
                  <label>Nome *</label>
                  <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: CRM Clínica" required />
                </div>
                <div className="form-row">
                  <label>Segmento</label>
                  <input value={form.segmento} onChange={(e) => setForm({ ...form, segmento: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <label>Descrição</label>
                <textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div className="section-divider">Funcionalidades padrão</div>
              <div className="checklist-grid">
                {FUNCIONALIDADES_CATALOGO.map((f) => (
                  <label key={f} className="checklist-item">
                    <input
                      type="checkbox"
                      checked={form.funcionalidades.includes(f)}
                      onChange={() => setForm({ ...form, funcionalidades: toggleInArray(form.funcionalidades, f) })}
                    />
                    {f}
                  </label>
                ))}
              </div>
              <div className="section-divider">Identidade visual padrão</div>
              <div className="form-row-split">
                <div className="form-row">
                  <label>Cores</label>
                  <input placeholder="separadas por vírgula" value={form.cores} onChange={(e) => setForm({ ...form, cores: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Tema</label>
                  <select value={form.tema} onChange={(e) => setForm({ ...form, tema: e.target.value })}>
                    <option value="escuro">Escuro</option>
                    <option value="claro">Claro</option>
                    <option value="ambos">Claro e escuro</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <label>Tipografia / estilo</label>
                <input value={form.tipografia} onChange={(e) => setForm({ ...form, tipografia: e.target.value })} />
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
