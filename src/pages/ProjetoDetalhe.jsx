import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { sb } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import BacklogBoard from '../components/BacklogBoard'

const DOC_LABELS = {
  documento_tecnico: 'Documento Técnico',
  escopo_funcional: 'Escopo Funcional',
  backlog: 'Backlog',
  roadmap: 'Roadmap',
  prompt_claude_code: 'Prompt (Claude Code)',
}

const STATUS_LABEL = {
  discovery: 'Discovery',
  documentado: 'Documentado',
  em_desenvolvimento: 'Em desenvolvimento',
  em_homologacao: 'Em homologação',
  entregue: 'Entregue',
  pausado: 'Pausado',
}

export default function ProjetoDetalhe() {
  const { isAdminOuGestor } = useAuth()
  const { id } = useParams()
  const [projeto, setProjeto] = useState(null)
  const [documentos, setDocumentos] = useState([])
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState('resumo')
  const [docAtivo, setDocAtivo] = useState('prompt_claude_code')
  const [copiado, setCopiado] = useState(false)
  const [gerandoIA, setGerandoIA] = useState(false)
  const [erroIA, setErroIA] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: proj }, { data: docs }, { data: tl }] = await Promise.all([
        sb.from('sh_projetos').select('*, sh_clientes(*)').eq('id', id).single(),
        sb.from('sh_documentos_gerados').select('*').eq('projeto_id', id).order('versao', { ascending: false }),
        sb.from('sh_timeline_eventos').select('*').eq('projeto_id', id).order('created_at', { ascending: false }),
      ])
      setProjeto(proj)
      setDocumentos(docs || [])
      setTimeline(tl || [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="empty-state">Carregando...</div>
  if (!projeto) return <div className="banner-error">Projeto não encontrado.</div>

  const ultimaVersao = documentos[0]?.versao
  const docsUltimaVersao = documentos.filter((d) => d.versao === ultimaVersao)
  const docSelecionado = docsUltimaVersao.find((d) => d.tipo === docAtivo)

  async function gerarComIA() {
    if (!docSelecionado) return
    setGerandoIA(true)
    setErroIA('')
    try {
      const { data: snapshot, error: errSnap } = await sb
        .from('sh_discovery_snapshots')
        .select('*')
        .eq('id', docSelecionado.discovery_snapshot_id)
        .single()
      if (errSnap) throw errSnap

      const { data: sessionData } = await sb.auth.getSession()
      const resp = await fetch('/api/gerar-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({ tipo: docAtivo, cliente: projeto.sh_clientes, projeto, snapshot }),
      })
      const result = await resp.json()
      if (!resp.ok) throw new Error(result.error || 'Erro ao gerar com IA')

      const { error: errUpdate } = await sb.from('sh_documentos_gerados').update({ conteudo: result.conteudo }).eq('id', docSelecionado.id)
      if (errUpdate) throw errUpdate

      setDocumentos(documentos.map((d) => (d.id === docSelecionado.id ? { ...d, conteudo: result.conteudo } : d)))
    } catch (err) {
      setErroIA(err.message)
    } finally {
      setGerandoIA(false)
    }
  }

  function copiarPrompt() {
    const doc = docsUltimaVersao.find((d) => d.tipo === 'prompt_claude_code')
    if (!doc) return
    navigator.clipboard.writeText(doc.conteudo).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1><code>{projeto.codigo}</code> {projeto.nome}</h1>
          <p>{projeto.sh_clientes?.nome}{projeto.sh_clientes?.empresa ? ` · ${projeto.sh_clientes.empresa}` : ''}</p>
        </div>
        <span className={'status-pill status-' + projeto.status}>{STATUS_LABEL[projeto.status] || projeto.status}</span>
      </div>

      <div className="tabs-row">
        <button className={'tab-btn' + (aba === 'resumo' ? ' active' : '')} onClick={() => setAba('resumo')}>Resumo</button>
        <button className={'tab-btn' + (aba === 'documentos' ? ' active' : '')} onClick={() => setAba('documentos')}>Documentos</button>
        <button className={'tab-btn' + (aba === 'backlog' ? ' active' : '')} onClick={() => setAba('backlog')}>Backlog</button>
        <button className={'tab-btn' + (aba === 'timeline' ? ' active' : '')} onClick={() => setAba('timeline')}>Timeline</button>
      </div>

      {aba === 'resumo' && (
        <div className="table-wrap" style={{ padding: 20 }}>
          <div className="resumo-grid">
            <div><span className="resumo-label">Responsável</span><span>{projeto.responsavel || '—'}</span></div>
            <div><span className="resumo-label">Prioridade</span><span>{projeto.prioridade}</span></div>
            <div><span className="resumo-label">Prazo</span><span>{projeto.prazo ? new Date(projeto.prazo + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</span></div>
            <div><span className="resumo-label">Discovery</span><span>{projeto.discovery_confirmado ? `confirmado (v${ultimaVersao || 1})` : 'não confirmado'}</span></div>
          </div>
          {isAdminOuGestor && (
            !projeto.discovery_confirmado ? (
              <Link className="btn-primary" to={`/projetos/${id}/discovery`} style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}>
                Iniciar Discovery
              </Link>
            ) : (
              <Link className="btn-ghost" to={`/projetos/${id}/discovery`} style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}>
                Revisar Discovery (cria nova versão)
              </Link>
            )
          )}
        </div>
      )}

      {aba === 'documentos' && (
        <div>
          {docsUltimaVersao.length === 0 ? (
            <div className="empty-state">Nenhum documento gerado ainda — confirme o Discovery primeiro.</div>
          ) : (
            <div className="doc-viewer">
              <div className="doc-tabs">
                {Object.entries(DOC_LABELS).map(([tipo, label]) => (
                  <button
                    key={tipo}
                    className={'doc-tab' + (docAtivo === tipo ? ' active' : '')}
                    onClick={() => setDocAtivo(tipo)}
                    disabled={!docsUltimaVersao.some((d) => d.tipo === tipo)}
                  >
                    {label}
                  </button>
                ))}
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  {isAdminOuGestor && (
                    <button className="btn-ghost" onClick={gerarComIA} disabled={gerandoIA}>
                      {gerandoIA ? 'Gerando com IA...' : '✨ Gerar com IA'}
                    </button>
                  )}
                  {docAtivo === 'prompt_claude_code' && (
                    <button className="btn-ghost" onClick={copiarPrompt}>
                      {copiado ? 'Copiado!' : 'Copiar prompt'}
                    </button>
                  )}
                </span>
              </div>
              {erroIA && <div className="banner-error" style={{ margin: '0 16px 16px' }}>{erroIA}</div>}
              <pre className="doc-content">{docSelecionado?.conteudo || '—'}</pre>
            </div>
          )}
        </div>
      )}

      {aba === 'backlog' && (
        <BacklogBoard projetoId={id} discoveryConfirmado={projeto.discovery_confirmado} />
      )}

      {aba === 'timeline' && (
        <div className="timeline-list">
          {timeline.length === 0 ? (
            <div className="empty-state">Nenhum evento ainda.</div>
          ) : (
            timeline.map((ev) => (
              <div key={ev.id} className="timeline-item">
                <span className="timeline-dot" />
                <div>
                  <div className="timeline-desc">{ev.descricao}</div>
                  <div className="timeline-date">{new Date(ev.created_at).toLocaleString('pt-BR')}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
