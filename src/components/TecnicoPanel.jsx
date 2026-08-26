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
  }
}

export default function TecnicoPanel({ projetoId }) {
  const { isAdminOuGestor } = useAuth()
  const [form, setForm] = useState(emptyForm(projetoId))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [salvo, setSalvo] = useState(false)

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
            <input value={form.repo_url} onChange={(e) => setForm({ ...form, repo_url: e.target.value })} placeholder="https://github.com/desiberneia-netizen/..." />
          </div>
          <div className="form-row-split">
            <div className="form-row">
              <label>Projeto Supabase</label>
              <input value={form.supabase_project_ref} onChange={(e) => setForm({ ...form, supabase_project_ref: e.target.value })} placeholder="referência ou nome do projeto — nunca a chave" />
            </div>
            <div className="form-row">
              <label>Projeto Vercel</label>
              <input value={form.vercel_project} onChange={(e) => setForm({ ...form, vercel_project: e.target.value })} />
            </div>
          </div>
          <div className="form-row-split">
            <div className="form-row">
              <label>Domínio</label>
              <input value={form.dominio} onChange={(e) => setForm({ ...form, dominio: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Status do deploy</label>
              <select value={form.status_deploy} onChange={(e) => setForm({ ...form, status_deploy: e.target.value })}>
                {Object.entries(STATUS_DEPLOY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
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
