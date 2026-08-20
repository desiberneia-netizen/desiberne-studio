import { useEffect, useState } from 'react'
import { sb } from '../lib/supabaseClient'

const emptyForm = {
  id: null,
  nome: '',
  empresa: '',
  segmento: '',
  responsavel: '',
  cnpj: '',
  site: '',
  contatoNome: '',
  contatoTelefone: '',
  contatoEmail: '',
}

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function loadClientes() {
    setLoading(true)
    const { data, error } = await sb.from('sh_clientes').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setClientes(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadClientes()
  }, [])

  function openNew() {
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(c) {
    const contato = (c.contatos || [])[0] || {}
    setForm({
      id: c.id,
      nome: c.nome || '',
      empresa: c.empresa || '',
      segmento: c.segmento || '',
      responsavel: c.responsavel || '',
      cnpj: c.cnpj || '',
      site: c.site || '',
      contatoNome: contato.nome || '',
      contatoTelefone: contato.telefone || '',
      contatoEmail: contato.email || '',
    })
    setModalOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.nome.trim()) return
    setSaving(true)
    const payload = {
      nome: form.nome.trim(),
      empresa: form.empresa.trim(),
      segmento: form.segmento.trim(),
      responsavel: form.responsavel.trim(),
      cnpj: form.cnpj.trim(),
      site: form.site.trim(),
      contatos: form.contatoNome
        ? [{ nome: form.contatoNome, telefone: form.contatoTelefone, email: form.contatoEmail }]
        : [],
    }
    const { error } = form.id
      ? await sb.from('sh_clientes').update(payload).eq('id', form.id)
      : await sb.from('sh_clientes').insert(payload)
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setModalOpen(false)
    loadClientes()
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este cliente?')) return
    const { error } = await sb.from('sh_clientes').delete().eq('id', id)
    if (error) setError(error.message)
    else loadClientes()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Clientes</h1>
          <p>Quem contrata desenvolvimento de sistema com a Desiberne</p>
        </div>
        <button className="btn-primary" onClick={openNew}>+ Novo Cliente</button>
      </div>

      {error && <div className="banner-error">{error}</div>}

      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : clientes.length === 0 ? (
        <div className="empty-state">Nenhum cliente cadastrado ainda.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Empresa</th>
                <th>Segmento</th>
                <th>Responsável</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} onClick={() => openEdit(c)}>
                  <td>{c.nome}</td>
                  <td>{c.empresa || '—'}</td>
                  <td>{c.segmento || '—'}</td>
                  <td>{c.responsavel || '—'}</td>
                  <td>
                    <button
                      className="btn-icon-danger"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(c.id)
                      }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{form.id ? 'Editar Cliente' : 'Novo Cliente'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-row">
                <label>Nome *</label>
                <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
              </div>
              <div className="form-row-split">
                <div className="form-row">
                  <label>Empresa</label>
                  <input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Segmento</label>
                  <input value={form.segmento} onChange={(e) => setForm({ ...form, segmento: e.target.value })} />
                </div>
              </div>
              <div className="form-row-split">
                <div className="form-row">
                  <label>Responsável</label>
                  <input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>CNPJ</label>
                  <input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <label>Site</label>
                <input value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} />
              </div>
              <div className="section-divider">Contato principal</div>
              <div className="form-row-split">
                <div className="form-row">
                  <label>Nome</label>
                  <input value={form.contatoNome} onChange={(e) => setForm({ ...form, contatoNome: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Telefone</label>
                  <input value={form.contatoTelefone} onChange={(e) => setForm({ ...form, contatoTelefone: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <label>E-mail</label>
                <input type="email" value={form.contatoEmail} onChange={(e) => setForm({ ...form, contatoEmail: e.target.value })} />
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
