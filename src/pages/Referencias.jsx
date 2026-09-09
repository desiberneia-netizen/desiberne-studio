import { useEffect, useState } from 'react'
import { sb } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

function emptyForm() {
  return { id: null, departamento: '', url: '', motivo: '' }
}

export default function Referencias() {
  const { isAdminOuGestor } = useAuth()
  const [referencias, setReferencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [melhorando, setMelhorando] = useState(false)
  const [departamentoFiltro, setDepartamentoFiltro] = useState('todos')

  async function load() {
    setLoading(true)
    const { data, error } = await sb.from('sh_referencias').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setReferencias(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function openNew() {
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(r) {
    setForm({ id: r.id, departamento: r.departamento || '', url: r.url || '', motivo: r.motivo || '' })
    setModalOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.departamento.trim() || !form.url.trim()) return
    setSaving(true)
    const payload = { departamento: form.departamento.trim(), url: form.url.trim(), motivo: form.motivo.trim() }
    const { error } = form.id
      ? await sb.from('sh_referencias').update(payload).eq('id', form.id)
      : await sb.from('sh_referencias').insert(payload)
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setModalOpen(false)
    load()
  }

  async function handleDelete(id) {
    if (!confirm('Excluir esta referência?')) return
    const { error } = await sb.from('sh_referencias').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  async function handleMelhorarComIA() {
    if (!form.motivo.trim()) return
    setMelhorando(true)
    setError('')
    try {
      const { data: sessionData } = await sb.auth.getSession()
      const resp = await fetch('/api/melhorar-texto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({ texto: form.motivo, contexto: `Motivo de gostar de uma referência de site pro departamento "${form.departamento}"` }),
      })
      const result = await resp.json()
      if (!resp.ok) throw new Error(result.error || 'Erro ao melhorar texto')
      setForm({ ...form, motivo: result.texto_melhorado })
    } catch (err) {
      setError(err.message)
    } finally {
      setMelhorando(false)
    }
  }

  const departamentos = ['todos', ...new Set(referencias.map((r) => r.departamento).filter(Boolean))]
  const filtradas = departamentoFiltro === 'todos' ? referencias : referencias.filter((r) => r.departamento === departamentoFiltro)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Referências</h1>
          <p>Sites de referência por departamento/segmento — o que gostamos e por quê</p>
        </div>
        {isAdminOuGestor && <button className="btn-primary" onClick={openNew}>+ Nova Referência</button>}
      </div>

      <div className="link-filter-btns">
        {departamentos.map((d) => (
          <button key={d} className={'filter-chip' + (departamentoFiltro === d ? ' active' : '')} onClick={() => setDepartamentoFiltro(d)}>
            {d === 'todos' ? 'Todos' : d}
          </button>
        ))}
      </div>

      {error && <div className="banner-error">{error}</div>}

      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div className="empty-state">Nenhuma referência por aqui ainda.</div>
      ) : (
        <div className="ideias-grid">
          {filtradas.map((r) => (
            <div key={r.id} className="ideia-card" onClick={() => isAdminOuGestor && openEdit(r)}>
              <span className="status-pill status-ideia-nova">{r.departamento}</span>
              <div className="ideia-titulo" style={{ marginTop: 8, wordBreak: 'break-all' }}>{r.url}</div>
              {r.motivo && <div className="ideia-desc">{r.motivo}</div>}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{form.id ? 'Editar Referência' : 'Nova Referência'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-row">
                <label>Departamento / segmento *</label>
                <input value={form.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value })} placeholder="Ex: Direito, Contabilidade, Restaurante..." required />
              </div>
              <div className="form-row">
                <label>URL *</label>
                <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." required />
              </div>
              <div className="form-row">
                <label>Motivo</label>
                <textarea rows={5} value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="O que especificamente gostou nessa referência..." />
                <button type="button" className="btn-ghost" style={{ marginTop: 8, alignSelf: 'flex-start' }} onClick={handleMelhorarComIA} disabled={melhorando || !form.motivo.trim()}>
                  {melhorando ? 'Melhorando...' : '✨ Melhorar com IA'}
                </button>
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
