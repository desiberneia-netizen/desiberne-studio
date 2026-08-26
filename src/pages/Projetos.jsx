import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

const STATUS_LABEL = {
  discovery: 'Discovery',
  documentado: 'Documentado',
  em_desenvolvimento: 'Em desenvolvimento',
  em_homologacao: 'Em homologação',
  entregue: 'Entregue',
  pausado: 'Pausado',
}

const TIPO_LABEL = { crm: 'CRM / Sistema', site: 'Site / Landing Page' }

const emptyForm = {
  id: null,
  cliente_id: '',
  tipo_projeto: 'crm',
  template_origem_id: '',
  nome: '',
  responsavel: '',
  prazo: '',
  prioridade: 'media',
  status: 'discovery',
  discovery_confirmado: false,
}

const STATUS_POS_DISCOVERY = ['discovery', 'pausado']

export default function Projetos() {
  const { isAdminOuGestor } = useAuth()
  const navigate = useNavigate()
  const [projetos, setProjetos] = useState([])
  const [clientes, setClientes] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function loadAll() {
    setLoading(true)
    const [{ data: proj, error: errProj }, { data: cli, error: errCli }, { data: tpl }] = await Promise.all([
      sb.from('sh_projetos').select('*, sh_clientes(nome)').order('created_at', { ascending: false }),
      sb.from('sh_clientes').select('id, nome').order('nome'),
      sb.from('sh_templates').select('id, nome').order('nome'),
    ])
    if (errProj) setError(errProj.message)
    else if (errCli) setError(errCli.message)
    setProjetos(proj || [])
    setClientes(cli || [])
    setTemplates(tpl || [])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  function openNew() {
    setForm({ ...emptyForm, cliente_id: clientes[0]?.id || '' })
    setModalOpen(true)
  }

  function openEdit(p) {
    setForm({
      id: p.id,
      cliente_id: p.cliente_id || '',
      tipo_projeto: p.tipo_projeto || 'crm',
      nome: p.nome || '',
      responsavel: p.responsavel || '',
      prazo: p.prazo || '',
      prioridade: p.prioridade || 'media',
      status: p.status || 'discovery',
      discovery_confirmado: p.discovery_confirmado || false,
    })
    setModalOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.nome.trim() || !form.cliente_id) return
    setSaving(true)
    const payload = {
      cliente_id: form.cliente_id,
      nome: form.nome.trim(),
      responsavel: form.responsavel.trim(),
      prazo: form.prazo || null,
      prioridade: form.prioridade,
      status: form.status,
    }
    if (!form.id) {
      payload.tipo_projeto = form.tipo_projeto
      payload.template_origem_id = form.tipo_projeto === 'crm' ? form.template_origem_id || null : null
    }
    const { error } = form.id
      ? await sb.from('sh_projetos').update(payload).eq('id', form.id)
      : await sb.from('sh_projetos').insert(payload)
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setModalOpen(false)
    loadAll()
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este projeto?')) return
    const { error } = await sb.from('sh_projetos').delete().eq('id', id)
    if (error) setError(error.message)
    else loadAll()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Projetos</h1>
          <p>Projetos de desenvolvimento em andamento</p>
        </div>
        {isAdminOuGestor && (
          <button className="btn-primary" onClick={openNew} disabled={clientes.length === 0}>
            + Novo Projeto
          </button>
        )}
      </div>

      {clientes.length === 0 && !loading && (
        <div className="banner-error">Cadastre um cliente antes de criar um projeto.</div>
      )}
      {error && <div className="banner-error">{error}</div>}

      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : projetos.length === 0 ? (
        <div className="empty-state">Nenhum projeto cadastrado ainda.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Projeto</th>
                <th>Tipo</th>
                <th>Cliente</th>
                <th>Status</th>
                <th>Prioridade</th>
                <th>Prazo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {projetos.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/projetos/${p.id}`)}>
                  <td><code>{p.codigo}</code></td>
                  <td>{p.nome}</td>
                  <td><span className={'tipo-pill tipo-' + (p.tipo_projeto || 'crm')}>{TIPO_LABEL[p.tipo_projeto || 'crm']}</span></td>
                  <td>{p.sh_clientes?.nome || '—'}</td>
                  <td><span className={'status-pill status-' + p.status}>{STATUS_LABEL[p.status] || p.status}</span></td>
                  <td>{p.prioridade}</td>
                  <td>{p.prazo ? new Date(p.prazo + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                  <td>
                    {isAdminOuGestor && (
                      <>
                        <button
                          className="btn-icon-danger"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEdit(p)
                          }}
                        >
                          Editar
                        </button>
                        <button
                          className="btn-icon-danger"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(p.id)
                          }}
                        >
                          Excluir
                        </button>
                      </>
                    )}
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
              <h2>{form.id ? 'Editar Projeto' : 'Novo Projeto'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-row">
                <label>Cliente *</label>
                <select value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })} required>
                  <option value="" disabled>Selecione...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              {!form.id && (
                <div className="form-row">
                  <label>Tipo de projeto</label>
                  <select value={form.tipo_projeto} onChange={(e) => setForm({ ...form, tipo_projeto: e.target.value, template_origem_id: '' })}>
                    {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              )}
              {!form.id && form.tipo_projeto === 'crm' && templates.length > 0 && (
                <div className="form-row">
                  <label>Template (opcional)</label>
                  <select value={form.template_origem_id} onChange={(e) => setForm({ ...form, template_origem_id: e.target.value })}>
                    <option value="">Começar do zero</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                  <span className="form-hint">Pré-preenche o Wizard de Discovery com o padrão do template.</span>
                </div>
              )}
              <div className="form-row">
                <label>Nome do projeto *</label>
                <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
              </div>
              <div className="form-row-split">
                <div className="form-row">
                  <label>Responsável</label>
                  <input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Prazo</label>
                  <input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
                </div>
              </div>
              <div className="form-row-split">
                <div className="form-row">
                  <label>Prioridade</label>
                  <select value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })}>
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
                {form.id && (
                  <div className="form-row">
                    <label>Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      {Object.entries(STATUS_LABEL)
                        .filter(([v]) => form.discovery_confirmado || STATUS_POS_DISCOVERY.includes(v))
                        .map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                    </select>
                    {!form.discovery_confirmado && (
                      <span className="form-hint">Discovery ainda não confirmado — Wizard chega na próxima etapa.</span>
                    )}
                  </div>
                )}
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
