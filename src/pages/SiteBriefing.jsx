import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { sb } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { gerarTodosDocumentosSite } from '../lib/siteBriefingDocs'

const STEP_TITLES = ['Dados do negócio', 'Mídia', 'Referências e estilo', 'Estrutura de páginas', 'Requisitos especiais', 'Revisão final']

function emptyBriefing() {
  return {
    etapa1_negocio: { segmento: '', endereco: '', telefone: '', horario: '', descricao: '', diferenciais: '' },
    etapa2_midia: { logo: null, fotos: [], redesSociais: [] },
    etapa3_referencias: { referencias: [], cores: [], tomDeVoz: '' },
    etapa4_estrutura: { paginas: [] },
    etapa5_requisitos_especiais: '',
  }
}

function draftKey(projetoId) {
  return `sh_briefing_draft_${projetoId}`
}

export default function SiteBriefing() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session, isAdminOuGestor } = useAuth()

  const [projeto, setProjeto] = useState(null)
  const [cliente, setCliente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const [data, setData] = useState(emptyBriefing())
  const [confirming, setConfirming] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [linkExtracao, setLinkExtracao] = useState('')
  const [textoColado, setTextoColado] = useState('')
  const [extraindo, setExtraindo] = useState(false)
  const [erroExtracao, setErroExtracao] = useState('')

  const [novaRede, setNovaRede] = useState('')
  const [novaRefUrl, setNovaRefUrl] = useState('')
  const [novaRefMotivo, setNovaRefMotivo] = useState('')
  const [novaCor, setNovaCor] = useState('')
  const [novaPaginaNome, setNovaPaginaNome] = useState('')
  const [novaPaginaConteudo, setNovaPaginaConteudo] = useState('')

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
          setData({ ...emptyBriefing(), ...JSON.parse(draft) })
        } catch {
          // ignora rascunho corrompido
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

  function updateEtapa5(value) {
    setData((prev) => {
      const next = { ...prev, etapa5_requisitos_especiais: value }
      localStorage.setItem(draftKey(id), JSON.stringify(next))
      return next
    })
  }

  async function handleExtrairComIA() {
    if (!linkExtracao.trim()) return
    await extrairComIA({ url: linkExtracao.trim() })
  }

  async function handleOrganizarTexto() {
    if (!textoColado.trim()) return
    await extrairComIA({ texto: textoColado.trim() })
  }

  async function extrairComIA(payload) {
    setExtraindo(true)
    setErroExtracao('')
    try {
      const { data: sessionData } = await sb.auth.getSession()
      const resp = await fetch('/api/extrair-negocio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify(payload),
      })
      const result = await resp.json()
      if (!resp.ok) throw new Error(result.error || 'Erro ao extrair dados')
      const d = result.dados || {}
      updateStep('etapa1_negocio', {
        segmento: d.segmento || data.etapa1_negocio.segmento,
        endereco: d.endereco || data.etapa1_negocio.endereco,
        telefone: d.telefone || data.etapa1_negocio.telefone,
        horario: d.horario || data.etapa1_negocio.horario,
        descricao: d.descricao || data.etapa1_negocio.descricao,
        diferenciais: d.diferenciais || data.etapa1_negocio.diferenciais,
      })
    } catch (err) {
      setErroExtracao(err.message)
    } finally {
      setExtraindo(false)
    }
  }

  function slugificarNomeArquivo(nome) {
    const pontoIdx = nome.lastIndexOf('.')
    const base = pontoIdx > -1 ? nome.slice(0, pontoIdx) : nome
    const ext = pontoIdx > -1 ? nome.slice(pontoIdx + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
    const baseLimpa = base
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 60) || 'foto'
    return ext ? `${baseLimpa}.${ext}` : baseLimpa
  }

  async function handleUploadFoto(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploading(true)
    setError('')
    try {
      const novasFotos = []
      for (const file of files) {
        const path = `${id}/${Date.now()}_${slugificarNomeArquivo(file.name)}`
        const { error: errUpload } = await sb.storage.from('briefing-sites').upload(path, file)
        if (errUpload) throw errUpload
        const { data: pub } = sb.storage.from('briefing-sites').getPublicUrl(path)
        novasFotos.push({ nome: file.name, url: pub.publicUrl })
      }
      updateStep('etapa2_midia', { fotos: [...data.etapa2_midia.fotos, ...novasFotos] })
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleUploadLogo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const path = `${id}/logo_${Date.now()}_${slugificarNomeArquivo(file.name)}`
      const { error: errUpload } = await sb.storage.from('briefing-sites').upload(path, file)
      if (errUpload) throw errUpload
      const { data: pub } = sb.storage.from('briefing-sites').getPublicUrl(path)
      updateStep('etapa2_midia', { logo: { nome: file.name, url: pub.publicUrl } })
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const canGoNext = useMemo(() => {
    if (step === 0) return data.etapa1_negocio.segmento.trim().length > 0
    return true
  }, [step, data])

  async function handleConfirm() {
    setConfirming(true)
    setError('')
    try {
      const { data: existentes } = await sb
        .from('sh_briefing_sites')
        .select('versao')
        .eq('projeto_id', id)
        .order('versao', { ascending: false })
        .limit(1)
      const proximaVersao = (existentes?.[0]?.versao || 0) + 1

      const { data: briefing, error: errBrief } = await sb
        .from('sh_briefing_sites')
        .insert({ projeto_id: id, versao: proximaVersao, criado_por: session?.user?.id, ...data })
        .select()
        .single()
      if (errBrief) throw errBrief

      const docs = gerarTodosDocumentosSite({ cliente, projeto, briefing })
      const { error: errDocs } = await sb.from('sh_documentos_gerados').insert(
        docs.map((d) => ({ projeto_id: id, briefing_site_id: briefing.id, tipo: d.tipo, conteudo: d.conteudo, versao: proximaVersao }))
      )
      if (errDocs) throw errDocs

      await sb.from('sh_projetos').update({ discovery_confirmado: true, status: 'documentado' }).eq('id', id)

      await sb.from('sh_timeline_eventos').insert([
        { projeto_id: id, tipo_evento: 'briefing_confirmado', descricao: `Briefing de site v${proximaVersao} concluído`, autor: session?.user?.id },
        { projeto_id: id, tipo_evento: 'documentos_gerados', descricao: 'Brief Resumido e Prompt gerados', autor: session?.user?.id },
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
  if (!isAdminOuGestor) return <div className="banner-error">Você não tem permissão pra rodar o Briefing. Fale com um admin.</div>

  const isReview = step === STEP_TITLES.length - 1

  return (
    <div className="wizard">
      <div className="wizard-header">
        <div>
          <h1>Briefing de Site — {projeto.nome}</h1>
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
              <label>Colar texto do Instagram/Facebook (bio, descrição, contato)</label>
              <textarea
                rows={4}
                placeholder="Cola aqui o texto que aparece no perfil: bio, descrição, telefone, endereço se tiver..."
                value={textoColado}
                onChange={(e) => setTextoColado(e.target.value)}
              />
              <button type="button" className="btn-ghost" style={{ marginTop: 8, alignSelf: 'flex-start' }} onClick={handleOrganizarTexto} disabled={extraindo || !textoColado.trim()}>
                {extraindo ? 'Organizando...' : '✨ Organizar com IA'}
              </button>
              <span className="form-hint">Caminho principal pra quem não tem site — funciona sempre, porque é você que copia o texto.</span>
            </div>
            <div className="form-row" style={{ marginTop: 8 }}>
              <label>Ou extrair de um site próprio (se tiver)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ flex: 1 }}
                  placeholder="https://site-do-cliente.com.br"
                  value={linkExtracao}
                  onChange={(e) => setLinkExtracao(e.target.value)}
                />
                <button type="button" className="btn-ghost" onClick={handleExtrairComIA} disabled={extraindo || !linkExtracao.trim()}>
                  {extraindo ? 'Extraindo...' : '✨ Extrair com IA'}
                </button>
              </div>
              <span className="form-hint">Não funciona com Instagram, Facebook ou Google Maps (páginas em JavaScript) — usa a opção de colar texto acima pra esses casos.</span>
            </div>
            {erroExtracao && <span className="form-hint" style={{ color: 'var(--danger)' }}>{erroExtracao}</span>}
            <div className="section-divider">Dados do negócio</div>
            <div className="form-row">
              <label>Segmento *</label>
              <input value={data.etapa1_negocio.segmento} onChange={(e) => updateStep('etapa1_negocio', { segmento: e.target.value })} />
            </div>
            <div className="form-row-split">
              <div className="form-row">
                <label>Endereço</label>
                <input value={data.etapa1_negocio.endereco} onChange={(e) => updateStep('etapa1_negocio', { endereco: e.target.value })} />
              </div>
              <div className="form-row">
                <label>Telefone</label>
                <input value={data.etapa1_negocio.telefone} onChange={(e) => updateStep('etapa1_negocio', { telefone: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <label>Horário de funcionamento</label>
              <input value={data.etapa1_negocio.horario} onChange={(e) => updateStep('etapa1_negocio', { horario: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Descrição curta</label>
              <textarea rows={3} value={data.etapa1_negocio.descricao} onChange={(e) => updateStep('etapa1_negocio', { descricao: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Diferenciais</label>
              <textarea rows={2} value={data.etapa1_negocio.diferenciais} onChange={(e) => updateStep('etapa1_negocio', { diferenciais: e.target.value })} />
            </div>
            <div className="callout" style={{ marginTop: 4 }}>
              Dados copiados do Google Maps / site atual do cliente — pesquisa manual, nunca scraping automatizado.
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="form-row">
              <label>Logo</label>
              {data.etapa2_midia.logo ? (
                <div className="fluxo-item">
                  <img src={data.etapa2_midia.logo.url} alt="Logo" style={{ height: 32, width: 'auto', borderRadius: 4 }} />
                  <span className="fluxo-nome">{data.etapa2_midia.logo.nome}</span>
                  <button type="button" onClick={() => updateStep('etapa2_midia', { logo: null })}>×</button>
                </div>
              ) : (
                <input type="file" accept="image/*" onChange={handleUploadLogo} disabled={uploading} />
              )}
              <span className="form-hint">Se não tiver arquivo de logo, o site usa o nome da empresa estilizado no header.</span>
            </div>
            <div className="section-divider">Fotos do negócio</div>
            <p className="wizard-hint">Fachada, produtos, equipe, ambiente.</p>
            <div className="fluxo-list">
              {data.etapa2_midia.fotos.map((f, i) => (
                <div key={i} className="fluxo-item">
                  <span className="fluxo-nome">{f.nome}</span>
                  <button type="button" onClick={() => updateStep('etapa2_midia', { fotos: data.etapa2_midia.fotos.filter((_, idx) => idx !== i) })}>×</button>
                </div>
              ))}
            </div>
            <input type="file" accept="image/*" multiple onChange={handleUploadFoto} disabled={uploading} />
            {uploading && <span className="form-hint">Enviando...</span>}
            <div className="section-divider">Redes sociais</div>
            <div className="fluxo-list">
              {data.etapa2_midia.redesSociais.map((r, i) => (
                <div key={i} className="fluxo-item">
                  <span className="fluxo-nome">{r}</span>
                  <button type="button" onClick={() => updateStep('etapa2_midia', { redesSociais: data.etapa2_midia.redesSociais.filter((_, idx) => idx !== i) })}>×</button>
                </div>
              ))}
            </div>
            <div className="fluxo-add">
              <input placeholder="Link do Instagram/Facebook..." value={novaRede} onChange={(e) => setNovaRede(e.target.value)} />
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  if (!novaRede.trim()) return
                  updateStep('etapa2_midia', { redesSociais: [...data.etapa2_midia.redesSociais, novaRede.trim()] })
                  setNovaRede('')
                }}
              >
                + Adicionar
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="wizard-hint">Sites de referência — o que especificamente o cliente gosta em cada um, não só o link.</p>
            <div className="fluxo-list">
              {data.etapa3_referencias.referencias.map((r, i) => (
                <div key={i} className="perfil-item">
                  <div>
                    <strong>{r.url}</strong>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{r.motivo}</span>
                  </div>
                  <button type="button" onClick={() => updateStep('etapa3_referencias', { referencias: data.etapa3_referencias.referencias.filter((_, idx) => idx !== i) })}>×</button>
                </div>
              ))}
            </div>
            <div className="form-row-split">
              <div className="form-row">
                <label>URL de referência</label>
                <input value={novaRefUrl} onChange={(e) => setNovaRefUrl(e.target.value)} />
              </div>
              <div className="form-row">
                <label>O que o cliente gosta nele</label>
                <input value={novaRefMotivo} onChange={(e) => setNovaRefMotivo(e.target.value)} />
              </div>
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                if (!novaRefUrl.trim()) return
                updateStep('etapa3_referencias', { referencias: [...data.etapa3_referencias.referencias, { url: novaRefUrl.trim(), motivo: novaRefMotivo.trim() }] })
                setNovaRefUrl('')
                setNovaRefMotivo('')
              }}
            >
              + Adicionar referência
            </button>
            <div className="section-divider">Paleta e tom de voz</div>
            <div className="fluxo-list">
              {data.etapa3_referencias.cores.map((c, i) => (
                <div key={i} className="fluxo-item">
                  <span className="fluxo-nome">{c}</span>
                  <button type="button" onClick={() => updateStep('etapa3_referencias', { cores: data.etapa3_referencias.cores.filter((_, idx) => idx !== i) })}>×</button>
                </div>
              ))}
            </div>
            <div className="fluxo-add">
              <input placeholder="Ex: azul marinho, dourado..." value={novaCor} onChange={(e) => setNovaCor(e.target.value)} />
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  if (!novaCor.trim()) return
                  updateStep('etapa3_referencias', { cores: [...data.etapa3_referencias.cores, novaCor.trim()] })
                  setNovaCor('')
                }}
              >
                + Adicionar
              </button>
            </div>
            <div className="form-row" style={{ marginTop: 12 }}>
              <label>Tom de voz</label>
              <input placeholder="Ex: formal, descontraído, técnico..." value={data.etapa3_referencias.tomDeVoz} onChange={(e) => updateStep('etapa3_referencias', { tomDeVoz: e.target.value })} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="wizard-hint">Páginas que o site vai ter e o que cada uma precisa conter.</p>
            <div className="fluxo-list">
              {data.etapa4_estrutura.paginas.map((p, i) => (
                <div key={i} className="perfil-item">
                  <div>
                    <strong>{p.nome}</strong>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{p.conteudo}</span>
                  </div>
                  <button type="button" onClick={() => updateStep('etapa4_estrutura', { paginas: data.etapa4_estrutura.paginas.filter((_, idx) => idx !== i) })}>×</button>
                </div>
              ))}
            </div>
            <div className="form-row-split">
              <div className="form-row">
                <label>Nome da página</label>
                <input placeholder="Ex: Home, Sobre, Serviços..." value={novaPaginaNome} onChange={(e) => setNovaPaginaNome(e.target.value)} />
              </div>
              <div className="form-row">
                <label>O que precisa ter</label>
                <input value={novaPaginaConteudo} onChange={(e) => setNovaPaginaConteudo(e.target.value)} />
              </div>
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                if (!novaPaginaNome.trim()) return
                updateStep('etapa4_estrutura', { paginas: [...data.etapa4_estrutura.paginas, { nome: novaPaginaNome.trim(), conteudo: novaPaginaConteudo.trim() }] })
                setNovaPaginaNome('')
                setNovaPaginaConteudo('')
              }}
            >
              + Adicionar página
            </button>
          </div>
        )}

        {step === 4 && (
          <div>
            <p className="wizard-hint">Campo livre — formulário de contato, WhatsApp flutuante, integração com agenda, etc.</p>
            <div className="form-row">
              <textarea rows={8} value={data.etapa5_requisitos_especiais} onChange={(e) => updateEtapa5(e.target.value)} />
            </div>
          </div>
        )}

        {isReview && (
          <div className="review">
            <div className="review-section">
              <div className="review-section-header"><h3>Negócio</h3><button type="button" className="btn-ghost" onClick={() => setStep(0)}>Editar</button></div>
              <p>{data.etapa1_negocio.segmento || '—'} — {data.etapa1_negocio.descricao || '—'}</p>
            </div>
            <div className="review-section">
              <div className="review-section-header"><h3>Mídia</h3><button type="button" className="btn-ghost" onClick={() => setStep(1)}>Editar</button></div>
              <p>{data.etapa2_midia.logo ? 'logo enviado' : 'sem logo'} · {data.etapa2_midia.fotos.length} foto(s) · {data.etapa2_midia.redesSociais.join(', ') || 'sem redes sociais'}</p>
            </div>
            <div className="review-section">
              <div className="review-section-header"><h3>Referências e estilo</h3><button type="button" className="btn-ghost" onClick={() => setStep(2)}>Editar</button></div>
              <p>{data.etapa3_referencias.cores.join(', ') || 'sem paleta'} · tom: {data.etapa3_referencias.tomDeVoz || '—'}</p>
            </div>
            <div className="review-section">
              <div className="review-section-header"><h3>Estrutura de páginas</h3><button type="button" className="btn-ghost" onClick={() => setStep(3)}>Editar</button></div>
              <p>{data.etapa4_estrutura.paginas.map((p) => p.nome).join(', ') || '—'}</p>
            </div>
            <div className="review-section">
              <div className="review-section-header"><h3>Requisitos especiais</h3><button type="button" className="btn-ghost" onClick={() => setStep(4)}>Editar</button></div>
              <p>{data.etapa5_requisitos_especiais || '—'}</p>
            </div>
          </div>
        )}
      </div>

      <div className="wizard-footer">
        <button className="btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Voltar</button>
        {!isReview ? (
          <button className="btn-primary" disabled={!canGoNext} onClick={() => setStep(step + 1)}>Próximo</button>
        ) : (
          <button className="btn-primary" disabled={confirming} onClick={handleConfirm}>
            {confirming ? 'Confirmando...' : 'Confirmar briefing e gerar documentos'}
          </button>
        )}
      </div>
    </div>
  )
}
