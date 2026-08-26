import { useEffect, useState } from 'react'
import { sb } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

const STATUS_DEPLOY = {
  nao_iniciado: 'Não iniciado',
  em_desenvolvimento: 'Em desenvolvimento',
  deployado: 'Deployado',
  com_problema: 'Com problema',
}

const STATUS_PAGAMENTO = {
  pendente: 'Pendente',
  implementacao_paga: 'Implementação paga',
  mensalidade_ativa: 'Mensalidade ativa',
  inadimplente: 'Inadimplente',
  cancelado: 'Cancelado',
}

function parseRepoUrl(url) {
  const m = (url || '').match(/github\.com\/([^/]+)\/([^/#?]+)/)
  if (!m) return null
  return { owner: m[1], repo: m[2].replace(/\.git$/, '') }
}

function emptyForm(projetoId) {
  return {
    projeto_id: projetoId,
    repo_url: '',
    supabase_project_ref: '',
    vercel_project: '',
    dominio: '',
    onde_estao_as_credenciais: '',
    status_deploy: 'nao_iniciado',
    valor_implementacao: '',
    valor_mensalidade: '',
    status_pagamento: 'pendente',
    data_inicio_mensalidade: '',
    dominio_proprietario: '',
    custo_dominio_anual: '',
  }
}

export default function TecnicoPanel({ projetoId }) {
  const { isAdminOuGestor } = useAuth()
  const [form, setForm] = useState(emptyForm(projetoId))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [salvo, setSalvo] = useState(false)
  const [githubStatus, setGithubStatus] = useState(null)
  const [githubLoading, setGithubLoading] = useState(false)
  const [githubError, setGithubError] = useState('')
  const [vercelStatus, setVercelStatus] = useState(null)
  const [vercelLoading, setVercelLoading] = useState(false)
  const [vercelError, setVercelError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await sb.from('sh_tecnico').select('*').eq('projeto_id', projetoId).maybeSingle()
      if (data) {
        setForm({
          ...emptyForm(projetoId),
          ...data,
          valor_implementacao: data.valor_implementacao ?? '',
          valor_mensalidade: data.valor_mensalidade ?? '',
          data_inicio_mensalidade: data.data_inicio_mensalidade || '',
          dominio_proprietario: data.dominio_proprietario || '',
          custo_dominio_anual: data.custo_dominio_anual ?? '',
        })
      }
      setLoading(false)
    }
    load()
  }, [projetoId])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      ...form,
      valor_implementacao: form.valor_implementacao === '' ? null : Number(form.valor_implementacao),
      valor_mensalidade: form.valor_mensalidade === '' ? null : Number(form.valor_mensalidade),
      data_inicio_mensalidade: form.data_inicio_mensalidade || null,
      dominio_proprietario: form.dominio_proprietario || null,
      custo_dominio_anual: form.custo_dominio_anual === '' ? null : Number(form.custo_dominio_anual),
    }
    const { error } = await sb.from('sh_tecnico').upsert(payload, { onConflict: 'projeto_id' })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  async function atualizarGithub() {
    const parsed = parseRepoUrl(form.repo_url)
    if (!parsed) {
      setGithubError('URL de repositório inválida — precisa ser algo tipo https://github.com/dono/repo')
      return
    }
    setGithubLoading(true)
    setGithubError('')
    try {
      const { data: sessionData } = await sb.auth.getSession()
      const resp = await fetch(`/api/github-status?owner=${encodeURIComponent(parsed.owner)}&repo=${encodeURIComponent(parsed.repo)}`, {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      })
      const result = await resp.json()
      if (!resp.ok) throw new Error(result.error || 'Erro ao consultar o GitHub')
      setGithubStatus(result)
    } catch (err) {
      setGithubError(err.message)
    } finally {
      setGithubLoading(false)
    }
  }

  async function atualizarVercel() {
    setVercelLoading(true)
    setVercelError('')
    try {
      const { data: sessionData } = await sb.auth.getSession()
      const resp = await fetch(`/api/vercel-status?project=${encodeURIComponent(form.vercel_project)}`, {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      })
      const result = await resp.json()
      if (!resp.ok) throw new Error(result.error || 'Erro ao consultar a Vercel')
      setVercelStatus(result)
    } catch (err) {
      setVercelError(err.message)
    } finally {
      setVercelLoading(false)
    }
  }

  if (loading) return <div className="empty-state">Carregando...</div>

  const fmtMoney = (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

  return (
    <div className="table-wrap" style={{ padding: 20 }}>
      {!isAdminOuGestor ? (
        <div className="resumo-grid">
          <div><span className="resumo-label">Repositório</span><span>{form.repo_url || '—'}</span></div>
          <div><span className="resumo-label">Supabase</span><span>{form.supabase_project_ref || '—'}</span></div>
          <div><span className="resumo-label">Domínio</span><span>{form.dominio || '—'}</span></div>
          <div><span className="resumo-label">Status deploy</span><span>{STATUS_DEPLOY[form.status_deploy]}</span></div>
        </div>
      ) : (
        <form onSubmit={handleSave}>
          <div className="section-divider">Infraestrutura</div>
          <div className="form-row">
            <label>Repositório GitHub</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ flex: 1 }} value={form.repo_url} onChange={(e) => setForm({ ...form, repo_url: e.target.value })} placeholder="https://github.com/desiberneia-netizen/..." />
              <button type="button" className="btn-ghost" onClick={atualizarGithub} disabled={githubLoading || !form.repo_url}>
                {githubLoading ? 'Consultando...' : 'Atualizar status'}
              </button>
            </div>
            {githubError && <span className="form-hint" style={{ color: 'var(--danger)' }}>{githubError}</span>}
            {githubStatus && (
              <div className="banner-hint" style={{ justifyContent: 'flex-start', gap: 20, marginTop: 10 }}>
                <span>Branch: <b style={{ color: 'var(--text)' }}>{githubStatus.branch}</b></span>
                {githubStatus.ultimoCommit && (
                  <span>
                    Último commit: <b style={{ color: 'var(--text)' }}>{githubStatus.ultimoCommit.mensagem}</b> ({githubStatus.ultimoCommit.sha}, {githubStatus.ultimoCommit.autor}, {new Date(githubStatus.ultimoCommit.data).toLocaleDateString('pt-BR')})
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="form-row-split">
            <div className="form-row">
              <label>Projeto Supabase</label>
              <input value={form.supabase_project_ref} onChange={(e) => setForm({ ...form, supabase_project_ref: e.target.value })} placeholder="referência ou nome do projeto — nunca a chave" />
            </div>
            <div className="form-row">
              <label>Projeto Vercel</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ flex: 1 }} value={form.vercel_project} onChange={(e) => setForm({ ...form, vercel_project: e.target.value })} placeholder="nome do projeto na Vercel" />
                <button type="button" className="btn-ghost" onClick={atualizarVercel} disabled={vercelLoading || !form.vercel_project}>
                  {vercelLoading ? 'Consultando...' : 'Atualizar status'}
                </button>
              </div>
              {vercelError && <span className="form-hint" style={{ color: 'var(--danger)' }}>{vercelError}</span>}
              {vercelStatus?.encontrado && (
                <div className="banner-hint" style={{ justifyContent: 'flex-start', gap: 20, marginTop: 10 }}>
                  <span>Estado: <b style={{ color: 'var(--text)' }}>{vercelStatus.estado}</b></span>
                  <span>Deploy: <b style={{ color: 'var(--text)' }}>{new Date(vercelStatus.criadoEm).toLocaleString('pt-BR')}</b></span>
                </div>
              )}
              {vercelStatus && !vercelStatus.encontrado && (
                <span className="form-hint">Nenhum deploy encontrado pra esse nome de projeto.</span>
              )}
            </div>
          </div>
          <div className="form-row-split">
            <div className="form-row">
              <label>Domínio</label>
              <input value={form.dominio} onChange={(e) => setForm({ ...form, dominio: e.target.value })} placeholder="nomedaempresa.com.br" />
            </div>
            <div className="form-row">
              <label>Status do deploy</label>
              <select value={form.status_deploy} onChange={(e) => setForm({ ...form, status_deploy: e.target.value })}>
                {Object.entries(STATUS_DEPLOY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row-split">
            <div className="form-row">
              <label>Quem administra o domínio</label>
              <select value={form.dominio_proprietario} onChange={(e) => setForm({ ...form, dominio_proprietario: e.target.value })}>
                <option value="">— não definido —</option>
                <option value="cliente">Cliente (já tinha ou comprou por conta própria)</option>
                <option value="desiberne">Desiberne administra pro cliente</option>
              </select>
            </div>
            {form.dominio_proprietario === 'desiberne' && (
              <div className="form-row">
                <label>Custo anual do domínio</label>
                <input type="number" step="0.01" value={form.custo_dominio_anual} onChange={(e) => setForm({ ...form, custo_dominio_anual: e.target.value })} placeholder="Ex: 40" />
              </div>
            )}
          </div>
          <div className="form-row">
            <label>Onde estão as credenciais</label>
            <input value={form.onde_estao_as_credenciais} onChange={(e) => setForm({ ...form, onde_estao_as_credenciais: e.target.value })} placeholder="Ex: 1Password → cofre Desiberne → Cliente X (nunca a chave em si)" />
          </div>

          <div className="section-divider">Cobrança</div>
          <div className="form-row-split">
            <div className="form-row">
              <label>Valor de implementação</label>
              <input type="number" step="0.01" value={form.valor_implementacao} onChange={(e) => setForm({ ...form, valor_implementacao: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Mensalidade de manutenção</label>
              <input type="number" step="0.01" value={form.valor_mensalidade} onChange={(e) => setForm({ ...form, valor_mensalidade: e.target.value })} />
            </div>
          </div>
          <div className="form-row-split">
            <div className="form-row">
              <label>Status do pagamento</label>
              <select value={form.status_pagamento} onChange={(e) => setForm({ ...form, status_pagamento: e.target.value })}>
                {Object.entries(STATUS_PAGAMENTO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Início da mensalidade</label>
              <input type="date" value={form.data_inicio_mensalidade} onChange={(e) => setForm({ ...form, data_inicio_mensalidade: e.target.value })} />
            </div>
          </div>

          {form.valor_implementacao !== '' && form.valor_mensalidade !== '' && (
            <div className="banner-hint" style={{ justifyContent: 'flex-start', gap: 20 }}>
              <span>Implementação: <b style={{ color: 'var(--text)' }}>{fmtMoney(form.valor_implementacao)}</b></span>
              <span>Mensalidade: <b style={{ color: 'var(--text)' }}>{fmtMoney(form.valor_mensalidade)}</b>/mês</span>
            </div>
          )}

          {error && <div className="banner-error">{error}</div>}

          <div className="modal-footer" style={{ justifyContent: 'flex-start', borderTop: 'none', paddingTop: 0 }}>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : salvo ? 'Salvo!' : 'Salvar'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
