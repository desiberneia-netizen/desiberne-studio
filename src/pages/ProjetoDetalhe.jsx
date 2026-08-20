import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { sb } from '../lib/supabaseClient'

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
  const { id } = useParams()
  const [projeto, setProjeto] = useState(null)
  const [documentos, setDocumentos] = useState([])
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState('resumo')
  const [docAtivo, setDocAtivo] = useState('prompt_claude_code')
  const [copiado, setCopiado] = useState(false)

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
          {!projeto.discovery_confirmado ? (
            <Link className="btn-primary" to={`/projetos/${id}/discovery`} style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}>
              Iniciar Discovery
            </Link>
          ) : (
            <Link className="btn-ghost" to={`/projetos/${id}/discovery`} style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}>
              Revisar Discovery (cria nova versão)
            </Link>
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
                {docAtivo === 'prompt_claude_code' && (
                  <button className="btn-ghost" style={{ marginLeft: 'auto' }} onClick={copiarPrompt}>
                    {copiado ? 'Copiado!' : 'Copiar prompt'}
                  </button>
                )}
              </div>
              <pre className="doc-content">{docSelecionado?.conteudo || '—'}</pre>
            </div>
          )}
        </div>
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
