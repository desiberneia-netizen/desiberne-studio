import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { sb } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { gerarTodosDocumentos } from '../lib/discoveryDocs'
import { FUNCIONALIDADES_CATALOGO } from '../lib/catalogos'

const STEP_TITLES = [
  'Conhecendo a empresa',
  'Objetivos',
  'Fluxo operacional',
  'Funcionalidades',
  'Usuários',
  'Integrações',
  'Identidade visual',
  'Requisitos especiais',
  'Revisão final',
]

const INTEGRACOES_CATALOGO = ['WhatsApp', 'Google', 'Outlook', 'ERP', 'API própria', 'Gateway de pagamento', 'OpenAI', 'Supabase']

const PERFIS_SUGERIDOS = ['Administrador', 'Gerente', 'Supervisor', 'Vendedor', 'Financeiro', 'Operacional', 'Cliente']

function emptyDiscovery() {
  return {
    etapa1_empresa: { segmento: '', funcionamento_atual: '', num_funcionarios: '', departamentos: [], dificuldades: '', perda_tempo: '' },
    etapa2_objetivos: { problema_resolver: '', maior_problema: '', definicao_sucesso: '', resultados_esperados: '' },
    etapa3_fluxo: { etapas: [] },
    etapa4_funcionalidades: { padrao: [], personalizadas: [] },
    etapa5_usuarios: { perfis: [] },
    etapa6_integracoes: { padrao: [], outra: '' },
    etapa7_identidade: { logo_url: '', cores: [], tipografia: '', estilo: '', tema: 'escuro' },
    etapa8_requisitos_especiais: '',
  }
}

function draftKey(projetoId) {
  return `sh_discovery_draft_${projetoId}`
}

function toggleInArray(arr, value) {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

export default function Discovery() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session, isAdminOuGestor } = useAuth()

  const [projeto, setProjeto] = useState(null)
  const [cliente, setCliente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const [data, setData] = useState(emptyDiscovery())
  const [confirming, setConfirming] = useState(false)
  const [customFuncionalidade, setCustomFuncionalidade] = useState('')
  const [customIntegracao, setCustomIntegracao] = useState('')
  const [novaEtapaFluxo, setNovaEtapaFluxo] = useState('')
  const [novoPerfilNome, setNovoPerfilNome] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: proj, error: errProj } = await sb.from('sh_projetos').select('*, sh_clientes(*)').eq('id', id).single()
      if (errProj) {
        setError(errProj.message)
        setLoading(false)
        return
      }
      setProjeto(proj)
      setCliente(proj.sh_clientes)

      const draft = localStorage.getItem(draftKey(id))
      if (draft) {
        try {
          setData({ ...emptyDiscovery(), ...JSON.parse(draft) })
          setLoading(false)
          return
        } catch {
          // draft corrompido, ignora
        }
      }

      if (proj.template_origem_id) {
        const { data: template } = await sb.from('sh_templates').select('*').eq('id', proj.template_origem_id).single()
        if (template) {
          const base = emptyDiscovery()
          const prefill = {
            ...base,
            etapa1_empresa: { ...base.etapa1_empresa, segmento: template.segmento || '' },
            etapa4_funcionalidades: { ...base.etapa4_funcionalidades, padrao: template.funcionalidades_padrao?.padrao || [] },
            etapa7_identidade: { ...base.etapa7_identidade, ...(template.discovery_padrao?.etapa7_identidade || {}) },
          }
          setData(prefill)
          localStorage.setItem(draftKey(id), JSON.stringify(prefill))
        }
      }
      setLoading(false)
    }
    load()
  }, [id])

  function updateStep(key, patch) {
    setData((prev) => {
      const next = { ...prev, [key]: { ...prev[key], ...patch } }
      localStorage.setItem(draftKey(id), JSON.stringify(next))
      return next
    })
  }

  function updateEtapa8(value) {
    setData((prev) => {
      const next = { ...prev, etapa8_requisitos_especiais: value }
      localStorage.setItem(draftKey(id), JSON.stringify(next))
      return next
    })
  }

  const canGoNext = useMemo(() => {
    if (step === 0) return data.etapa1_empresa.segmento.trim().length > 0
    if (step === 1) return data.etapa2_objetivos.problema_resolver.trim().length > 0
    return true
  }, [step, data])

  async function handleConfirm() {
    setConfirming(true)
    setError('')
    try {
      const { data: existentes } = await sb
        .from('sh_discovery_snapshots')
        .select('versao')
        .eq('projeto_id', id)
        .order('versao', { ascending: false })
        .limit(1)
      const proximaVersao = (existentes?.[0]?.versao || 0) + 1

      const { data: snapshot, error: errSnap } = await sb
        .from('sh_discovery_snapshots')
        .insert({ projeto_id: id, versao: proximaVersao, criado_por: session?.user?.id, ...data })
        .select()
        .single()
      if (errSnap) throw errSnap

      const docs = gerarTodosDocumentos({ cliente, projeto, snapshot })
      const { error: errDocs } = await sb.from('sh_documentos_gerados').insert(
        docs.map((d) => ({ projeto_id: id, discovery_snapshot_id: snapshot.id, tipo: d.tipo, conteudo: d.conteudo, versao: proximaVersao }))
      )
      if (errDocs) throw errDocs

      const { error: errProjUpdate } = await sb
        .from('sh_projetos')
        .update({ discovery_confirmado: true, status: 'documentado' })
        .eq('id', id)
      if (errProjUpdate) throw errProjUpdate

      await sb.from('sh_timeline_eventos').insert([
        { projeto_id: id, tipo_evento: 'discovery_confirmado', descricao: `Discovery v${proximaVersao} concluído`, autor: session?.user?.id },
        { projeto_id: id, tipo_evento: 'documentos_gerados', descricao: '5 documentos gerados (técnico, escopo, backlog, roadmap, prompt)', autor: session?.user?.id },
      ])

      localStorage.removeItem(draftKey(id))
      navigate(`/projetos/${id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirming(false)
    }
  }

  if (loading) return <div className="empty-state">Carregando...</div>
  if (error && !projeto) return <div className="banner-error">{error}</div>
  if (!isAdminOuGestor) return <div className="banner-error">Você não tem permissão pra rodar o Discovery. Fale com um admin.</div>

  const isReview = step === STEP_TITLES.length - 1

  return (
    <div className="wizard">
      <div className="wizard-header">
        <div>
          <h1>Discovery — {projeto.nome}</h1>
          <p>{cliente?.nome}{cliente?.empresa ? ` · ${cliente.empresa}` : ''}</p>
        </div>
        <button className="btn-ghost" onClick={() => navigate('/projetos')}>Sair sem confirmar</button>
      </div>

      <div className="wizard-progress">
        {STEP_TITLES.map((t, i) => (
          <button
            key={t}
            className={'wizard-step-dot' + (i === step ? ' active' : '') + (i < step ? ' done' : '')}
            onClick={() => setStep(i)}
            type="button"
          >
            <span className="wizard-step-n">{i + 1}</span>
            <span className="wizard-step-label">{t}</span>
          </button>
        ))}
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className="wizard-card">
        {step === 0 && (
          <div>
            <div className="form-row">
              <label>Qual o segmento? *</label>
              <input value={data.etapa1_empresa.segmento} onChange={(e) => updateStep('etapa1_empresa', { segmento: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Como funciona hoje?</label>
              <textarea rows={3} value={data.etapa1_empresa.funcionamento_atual} onChange={(e) => updateStep('etapa1_empresa', { funcionamento_atual: e.target.value })} />
            </div>
            <div className="form-row-split">
              <div className="form-row">
                <label>Quantos funcionários?</label>
                <input value={data.etapa1_empresa.num_funcionarios} onChange={(e) => updateStep('etapa1_empresa', { num_funcionarios: e.target.value })} />
              </div>
              <div className="form-row">
                <label>Departamentos que vão usar</label>
                <input
                  placeholder="separados por vírgula"
                  value={data.etapa1_empresa.departamentos.join(', ')}
                  onChange={(e) => updateStep('etapa1_empresa', { departamentos: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                />
              </div>
            </div>
            <div className="form-row">
              <label>Maiores dificuldades hoje?</label>
              <textarea rows={2} value={data.etapa1_empresa.dificuldades} onChange={(e) => updateStep('etapa1_empresa', { dificuldades: e.target.value })} />
            </div>
            <div className="form-row">
              <label>O que hoje faz perder tempo?</label>
              <textarea rows={2} value={data.etapa1_empresa.perda_tempo} onChange={(e) => updateStep('etapa1_empresa', { perda_tempo: e.target.value })} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="form-row">
              <label>O que esse sistema precisa resolver? *</label>
              <textarea rows={3} value={data.etapa2_objetivos.problema_resolver} onChange={(e) => updateStep('etapa2_objetivos', { problema_resolver: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Qual o maior problema?</label>
              <textarea rows={2} value={data.etapa2_objetivos.maior_problema} onChange={(e) => updateStep('etapa2_objetivos', { maior_problema: e.target.value })} />
            </div>
            <div className="form-row">
              <label>O que seria sucesso?</label>
              <textarea rows={2} value={data.etapa2_objetivos.definicao_sucesso} onChange={(e) => updateStep('etapa2_objetivos', { definicao_sucesso: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Quais resultados espera obter?</label>
              <textarea rows={2} value={data.etapa2_objetivos.resultados_esperados} onChange={(e) => updateStep('etapa2_objetivos', { resultados_esperados: e.target.value })} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="wizard-hint">Desenhe o fluxo em ordem — ex: Lead → Contato → Orçamento → Negociação → Contrato → Execução → Entrega → Pós-venda.</p>
            <div className="fluxo-list">
              {data.etapa3_fluxo.etapas.map((etapa, i) => (
                <div key={i} className="fluxo-item">
                  <span className="fluxo-n">{i + 1}</span>
                  <span className="fluxo-nome">{etapa}</span>
                  {i > 0 && <span className="fluxo-arrow">↑</span>}
                  <button type="button" onClick={() => updateStep('etapa3_fluxo', { etapas: data.etapa3_fluxo.etapas.filter((_, idx) => idx !== i) })}>×</button>
                </div>
              ))}
            </div>
            <div className="fluxo-add">
              <input
                placeholder="Nome da etapa (ex: Orçamento)"
                value={novaEtapaFluxo}
                onChange={(e) => setNovaEtapaFluxo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && novaEtapaFluxo.trim()) {
                    updateStep('etapa3_fluxo', { etapas: [...data.etapa3_fluxo.etapas, novaEtapaFluxo.trim()] })
                    setNovaEtapaFluxo('')
                  }
                }}
              />
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  if (!novaEtapaFluxo.trim()) return
                  updateStep('etapa3_fluxo', { etapas: [...data.etapa3_fluxo.etapas, novaEtapaFluxo.trim()] })
                  setNovaEtapaFluxo('')
                }}
              >
                + Adicionar
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="wizard-hint">Marque as funcionalidades que o sistema vai ter.</p>
            <div className="checklist-grid">
              {FUNCIONALIDADES_CATALOGO.map((f) => (
                <label key={f} className="checklist-item">
                  <input
                    type="checkbox"
                    checked={data.etapa4_funcionalidades.padrao.includes(f)}
                    onChange={() => updateStep('etapa4_funcionalidades', { padrao: toggleInArray(data.etapa4_funcionalidades.padrao, f) })}
                  />
                  {f}
                </label>
              ))}
            </div>
            <div className="section-divider">Funcionalidades personalizadas</div>
            <div className="fluxo-list">
              {data.etapa4_funcionalidades.personalizadas.map((f, i) => (
                <div key={i} className="fluxo-item">
                  <span className="fluxo-nome">{f}</span>
                  <button type="button" onClick={() => updateStep('etapa4_funcionalidades', { personalizadas: data.etapa4_funcionalidades.personalizadas.filter((_, idx) => idx !== i) })}>×</button>
                </div>
              ))}
            </div>
            <div className="fluxo-add">
              <input placeholder="Ex: Integração com balança" value={customFuncionalidade} onChange={(e) => setCustomFuncionalidade(e.target.value)} />
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  if (!customFuncionalidade.trim()) return
                  updateStep('etapa4_funcionalidades', { personalizadas: [...data.etapa4_funcionalidades.personalizadas, customFuncionalidade.trim()] })
                  setCustomFuncionalidade('')
                }}
              >
                + Adicionar
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <p className="wizard-hint">Quem vai usar o sistema? Adicione o perfil e o que ele pode fazer.</p>
            <div className="fluxo-list">
              {data.etapa5_usuarios.perfis.map((p, i) => (
                <div key={i} className="perfil-item">
                  <div>
                    <strong>{p.nome}</strong>
                    <input
                      placeholder="O que esse perfil pode fazer..."
                      value={p.permissoes}
                      onChange={(e) => {
                        const perfis = [...data.etapa5_usuarios.perfis]
                        perfis[i] = { ...perfis[i], permissoes: e.target.value }
                        updateStep('etapa5_usuarios', { perfis })
                      }}
                    />
                  </div>
                  <button type="button" onClick={() => updateStep('etapa5_usuarios', { perfis: data.etapa5_usuarios.perfis.filter((_, idx) => idx !== i) })}>×</button>
                </div>
              ))}
            </div>
            <div className="chip-row">
              {PERFIS_SUGERIDOS.filter((s) => !data.etapa5_usuarios.perfis.some((p) => p.nome === s)).map((s) => (
                <button key={s} type="button" className="chip" onClick={() => updateStep('etapa5_usuarios', { perfis: [...data.etapa5_usuarios.perfis, { nome: s, permissoes: '' }] })}>
                  + {s}
                </button>
              ))}
            </div>
            <div className="fluxo-add">
              <input placeholder="Outro perfil..." value={novoPerfilNome} onChange={(e) => setNovoPerfilNome(e.target.value)} />
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  if (!novoPerfilNome.trim()) return
                  updateStep('etapa5_usuarios', { perfis: [...data.etapa5_usuarios.perfis, { nome: novoPerfilNome.trim(), permissoes: '' }] })
                  setNovoPerfilNome('')
                }}
              >
                + Adicionar
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <p className="wizard-hint">Quais integrações esse sistema vai precisar?</p>
            <div className="checklist-grid">
              {INTEGRACOES_CATALOGO.map((f) => (
                <label key={f} className="checklist-item">
                  <input
                    type="checkbox"
                    checked={data.etapa6_integracoes.padrao.includes(f)}
                    onChange={() => updateStep('etapa6_integracoes', { padrao: toggleInArray(data.etapa6_integracoes.padrao, f) })}
                  />
                  {f}
                </label>
              ))}
            </div>
            <div className="form-row">
              <label>Outra integração</label>
              <input value={data.etapa6_integracoes.outra} onChange={(e) => updateStep('etapa6_integracoes', { outra: e.target.value })} />
            </div>
          </div>
        )}

        {step === 6 && (
          <div>
            <div className="form-row">
              <label>Logo (URL)</label>
              <input value={data.etapa7_identidade.logo_url} onChange={(e) => updateStep('etapa7_identidade', { logo_url: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Cores</label>
              <input
                placeholder="separadas por vírgula, ex: roxo, azul"
                value={data.etapa7_identidade.cores.join(', ')}
                onChange={(e) => updateStep('etapa7_identidade', { cores: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              />
            </div>
            <div className="form-row-split">
              <div className="form-row">
                <label>Tipografia</label>
                <input value={data.etapa7_identidade.tipografia} onChange={(e) => updateStep('etapa7_identidade', { tipografia: e.target.value })} />
              </div>
              <div className="form-row">
                <label>Tema</label>
                <select value={data.etapa7_identidade.tema} onChange={(e) => updateStep('etapa7_identidade', { tema: e.target.value })}>
                  <option value="escuro">Escuro</option>
                  <option value="claro">Claro</option>
                  <option value="ambos">Claro e escuro</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <label>Estilo / referências</label>
              <textarea rows={2} value={data.etapa7_identidade.estilo} onChange={(e) => updateStep('etapa7_identidade', { estilo: e.target.value })} />
            </div>
          </div>
        )}

        {step === 7 && (
          <div>
            <p className="wizard-hint">Campo livre — qualquer coisa que o cliente imaginar.</p>
            <div className="form-row">
              <textarea rows={8} value={data.etapa8_requisitos_especiais} onChange={(e) => updateEtapa8(e.target.value)} />
            </div>
          </div>
        )}

        {isReview && (
          <div className="review">
            <ReviewSection title="Empresa" onEdit={() => setStep(0)}>
              <p>{data.etapa1_empresa.segmento || '—'}</p>
            </ReviewSection>
            <ReviewSection title="Objetivos" onEdit={() => setStep(1)}>
              <p>{data.etapa2_objetivos.problema_resolver || '—'}</p>
            </ReviewSection>
            <ReviewSection title="Fluxo operacional" onEdit={() => setStep(2)}>
              <p>{data.etapa3_fluxo.etapas.join(' → ') || '—'}</p>
            </ReviewSection>
            <ReviewSection title="Funcionalidades" onEdit={() => setStep(3)}>
              <p>{[...data.etapa4_funcionalidades.padrao, ...data.etapa4_funcionalidades.personalizadas].join(', ') || '—'}</p>
            </ReviewSection>
            <ReviewSection title="Usuários" onEdit={() => setStep(4)}>
              <p>{data.etapa5_usuarios.perfis.map((p) => p.nome).join(', ') || '—'}</p>
            </ReviewSection>
            <ReviewSection title="Integrações" onEdit={() => setStep(5)}>
              <p>{[...data.etapa6_integracoes.padrao, data.etapa6_integracoes.outra].filter(Boolean).join(', ') || '—'}</p>
            </ReviewSection>
            <ReviewSection title="Identidade visual" onEdit={() => setStep(6)}>
              <p>Tema {data.etapa7_identidade.tema} · {data.etapa7_identidade.cores.join(', ') || 'sem cores definidas'}</p>
            </ReviewSection>
            <ReviewSection title="Requisitos especiais" onEdit={() => setStep(7)}>
              <p>{data.etapa8_requisitos_especiais || '—'}</p>
            </ReviewSection>
          </div>
        )}
      </div>

      <div className="wizard-footer">
        <button className="btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Voltar</button>
        {!isReview ? (
          <button className="btn-primary" disabled={!canGoNext} onClick={() => setStep(step + 1)}>Próximo</button>
        ) : (
          <button className="btn-primary" disabled={confirming} onClick={handleConfirm}>
            {confirming ? 'Confirmando...' : 'Confirmar discovery e gerar documentos'}
          </button>
        )}
      </div>
    </div>
  )
}

function ReviewSection({ title, children, onEdit }) {
  return (
    <div className="review-section">
      <div className="review-section-header">
        <h3>{title}</h3>
        <button type="button" className="btn-ghost" onClick={onEdit}>Editar</button>
      </div>
      {children}
    </div>
  )
}
