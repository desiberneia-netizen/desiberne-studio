import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

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
  const { isAdminOuGestor } = useAuth()
  const navigate = useNavigate()
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [gerandoProjeto, setGerandoProjeto] = useState(false)
  const [avisoPosSalvar, setAvisoPosSalvar] = useState('')

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
    setAvisoPosSalvar('')
    setModalOpen(true)
  }

  function openEdit(c) {
    setAvisoPosSalvar('')
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
    const eraNovo = !form.id
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
    const { data, error } = form.id
      ? await sb.from('sh_clientes').update(payload).eq('id', form.id).select().single()
      : await sb.from('sh_clientes').insert(payload).select().single()
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    loadClientes()
    // Cliente recém-criado: mantém o modal aberto (agora em modo edição) pra já poder
    // escolher o tipo do projeto abaixo, em vez de fechar e perguntar sim/não sem opção de tipo.
    if (eraNovo && data?.id) {
      setForm({ ...form, id: data.id })
      showToastLocal('Cliente cadastrado! Escolha abaixo o tipo de projeto, se quiser gerar agora.')
    } else {
      setModalOpen(false)
    }
  }

  // Cria o projeto pro cliente (mesma tabela/fluxo do "+ Novo Projeto" em Projetos) e
  // navega direto pra tela de detalhe — entra na lista de Projetos automaticamente.
  async function gerarProjetoPara(cliente, tipo_projeto) {
    setGerandoProjeto(true)
    const { data, error } = await sb
      .from('sh_projetos')
      .insert({ cliente_id: cliente.id, nome: `Projeto — ${cliente.nome}`, tipo_projeto })
      .select()
      .single()
    setGerandoProjeto(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate(`/projetos/${data.id}`)
  }

  // Aviso simples sem dependência de um sistema de toast do projeto — só pra chamar
  // atenção pro passo seguinte (escolher o tipo) sem travar a tela como o confirm() fazia.
  function showToastLocal(msg) {
    setError('')
    setAvisoPosSalvar(msg)
    setTimeout(() => setAvisoPosSalvar(''), 6000)
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
        {isAdminOuGestor && <button className="btn-primary" onClick={openNew}>+ Novo Cliente</button>}
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
                    {isAdminOuGestor && (
                      <button
                        className="btn-icon-danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(c.id)
                        }}
                      >
                        Excluir
                      </button>
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
              <h2>{form.id ? 'Editar Cliente' : 'Novo Cliente'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            {avisoPosSalvar && <div className="banner-error" style={{ background: 'rgba(124,58,237,0.12)', color: '#c084fc' }}>{avisoPosSalvar}</div>}
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
                  <label>Contato no cliente</label>
                  <input placeholder="Nome de quem responde pelo cliente" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
                  <span className="form-hint">Pessoa do lado do cliente — quem a Desiberne fala diretamente, não é ninguém da equipe.</span>
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
                {form.id && isAdminOuGestor && (
                  <button type="button" className="btn-danger" onClick={() => { handleDelete(form.id); setModalOpen(false) }}>
                    Excluir
                  </button>
                )}
                {form.id && isAdminOuGestor && (
                  <>
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={gerandoProjeto}
                      onClick={() => gerarProjetoPara({ id: form.id, nome: form.nome }, 'site')}
                    >
                      {gerandoProjeto ? 'Gerando...' : 'Gerar Site'}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={gerandoProjeto}
                      onClick={() => gerarProjetoPara({ id: form.id, nome: form.nome }, 'crm')}
                    >
                      {gerandoProjeto ? 'Gerando...' : 'Gerar CRM'}
                    </button>
                  </>
                )}
                <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>{isAdminOuGestor ? 'Cancelar' : 'Fechar'}</button>
                {isAdminOuGestor && (
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
