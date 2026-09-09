// Vercel Serverless Function — nunca expõe a chave da OpenAI ao navegador.
// Verifica que quem chamou está autenticado no Supabase antes de gastar créditos.

const DOC_INSTRUCOES = {
  documento_tecnico: 'Escreva o Documento Técnico do projeto: visão geral do sistema, arquitetura sugerida (dado o que foi descrito), integrações necessárias e considerações de identidade visual. Markdown, títulos com #, seja específico usando os dados fornecidos, não invente informação que não foi dada.',
  escopo_funcional: 'Escreva o Escopo Funcional: descreva o fluxo operacional em prosa curta, liste as funcionalidades confirmadas agrupadas por área, e descreva os perfis de usuário e o que cada um faz. Markdown.',
  backlog: 'Escreva um Backlog priorizado, dividido em seções MVP / V2 / V3, com base nas funcionalidades e no fluxo descritos. Cada item deve ser uma linha curta e acionável. Markdown.',
  roadmap: 'Escreva um Roadmap de implementação em fases (Discovery concluído, MVP, V2, Entrega), com uma frase objetiva por fase considerando o prazo e a prioridade informados. Markdown.',
  prompt_claude_code: 'Escreva um briefing técnico completo para ser entregue ao Claude Code (agente de desenvolvimento de IA) implementar este projeto do zero. Estruture em seções: Contexto do cliente, Objetivo do projeto, Fluxo operacional, Funcionalidades e prioridade, Modelo de dados sugerido, Perfis e permissões, Integrações, Identidade visual, Restrições e requisitos especiais, Critérios de aceite do MVP. Seja concreto e implementável, não genérico. Markdown.',
  brief_resumido: 'Escreva um Brief Resumido de uma página pra alinhar com o cliente antes de começar: negócio, mídia disponível, direção visual e estrutura de páginas. Markdown, direto, sem enrolação.',
  prompt_site_claude_code: 'Escreva um briefing completo para ser entregue ao Claude Code implementar este site do zero. Comece SEMPRE com um título "# Novo projeto Desiberne Studio — {nome do cliente}" seguido de uma seção "## Requisitos técnicos" em duas etapas: (1) gerar primeiro um único arquivo HTML autocontido, CSS/JS inline, sem backend, pra aprovação rápida sem depender de repositório/deploy; (2) depois de aprovado, repositório novo e privado na organização desiberneia-netizen no GitHub, site estático sem painel de edição pro cliente, deploy na Vercel gerando o link .vercel.app antes de qualquer domínio; e seguir a direção visual descrita evitando visual genérico de IA (gradiente roxo-azul padrão, Inter como escolha automática, cards centralizados com ícone sem motivo). Logo depois, uma seção "## Padrão de qualidade — inegociável" deixando claro que a prévia precisa ser extremamente impecável e impactante: imagens grandes e bem tratadas com camadas/profundidade (overlays, sobreposição, parallax sutil ou scroll reveal), micro-animações e movimento sutil ao rolar e no hover, tipografia e espaçamento modernos, tudo isso dentro do arquivo HTML único (pode usar libs leves via CDN tipo AOS/GSAP se precisar), e que isso é critério de aceite, não opcional. Depois, uma seção "## Padrões operacionais — não pergunte, decida e siga" com exatamente estas regras: formulário de contato usa Web3Forms grátis como padrão (funcional visualmente mesmo sem access key configurada); não incluir integração de agenda a menos que pedida nos requisitos especiais; WhatsApp flutuante usa o telefone informado no negócio, sem perguntar; fotos insuficientes usam placeholder do Unsplash mantendo coerência visual; dados divergentes entre fontes priorizam sempre o briefing; logo: se houver URL de logo no briefing, usar essa imagem no header (nunca inventar um logo gráfico), senão usar o nome da empresa estilizado tipograficamente; regra geral: nunca pausar esperando resposta do usuário, decidir dentro desses padrões e só sinalizar ao final o que foi assumido. Depois disso, uma seção "## Direção visual" descrevendo o ARQUÉTIPO de estilo informado (com a descrição concreta que vier nos dados) e executando-o de forma específica pro segmento do negócio, nunca genérica — se houver lista de "projetos recentes" nos dados, evitar explicitamente repetir a combinação de arquétipo/paleta usada neles. Depois disso, estruture o resto em seções: Negócio, Mídia disponível, Estrutura de páginas com o que cada uma precisa conter, Requisitos especiais, Critérios de aceite — incluindo explicitamente que responsivo em mobile é obrigatório desde o início, não ajuste final. Seja concreto, não genérico. Markdown.',
}

function montarContexto({ cliente, projeto, snapshot }) {
  const e1 = snapshot.etapa1_empresa || {}
  const e2 = snapshot.etapa2_objetivos || {}
  const e3 = snapshot.etapa3_fluxo || {}
  const e4 = snapshot.etapa4_funcionalidades || {}
  const e5 = snapshot.etapa5_usuarios || {}
  const e6 = snapshot.etapa6_integracoes || {}
  const e7 = snapshot.etapa7_identidade || {}
  const e8 = snapshot.etapa8_requisitos_especiais || ''

  return `
CLIENTE: ${cliente.nome}${cliente.empresa ? ` (${cliente.empresa})` : ''}
PROJETO: ${projeto.nome} — código ${projeto.codigo}, prazo ${projeto.prazo || 'não definido'}, prioridade ${projeto.prioridade}

SEGMENTO: ${e1.segmento || '—'}
FUNCIONAMENTO ATUAL: ${e1.funcionamento_atual || '—'}
NÚMERO DE FUNCIONÁRIOS: ${e1.num_funcionarios || '—'}
DEPARTAMENTOS QUE VÃO USAR: ${(e1.departamentos || []).join(', ') || '—'}
DIFICULDADES HOJE: ${e1.dificuldades || '—'}
O QUE FAZ PERDER TEMPO: ${e1.perda_tempo || '—'}

O QUE O SISTEMA PRECISA RESOLVER: ${e2.problema_resolver || '—'}
MAIOR PROBLEMA: ${e2.maior_problema || '—'}
DEFINIÇÃO DE SUCESSO: ${e2.definicao_sucesso || '—'}
RESULTADOS ESPERADOS: ${e2.resultados_esperados || '—'}

FLUXO OPERACIONAL: ${(e3.etapas || []).join(' → ') || '—'}

FUNCIONALIDADES: ${[...(e4.padrao || []), ...(e4.personalizadas || [])].join(', ') || '—'}

PERFIS DE USUÁRIO: ${(e5.perfis || []).map((p) => `${p.nome} (${p.permissoes || 'sem detalhe'})`).join('; ') || '—'}

INTEGRAÇÕES: ${[...(e6.padrao || []), e6.outra].filter(Boolean).join(', ') || '—'}

IDENTIDADE VISUAL: tema ${e7.tema || '—'}, cores ${(e7.cores || []).join(', ') || '—'}, tipografia ${e7.tipografia || '—'}, estilo ${e7.estilo || '—'}

REQUISITOS ESPECIAIS: ${e8 || '—'}
`.trim()
}

const ARQUETIPO_DIRECAO = {
  editorial: 'Editorial / elegante — tipografia serifada de destaque, bastante espaço em branco, composição assimétrica tipo revista. Tom sofisticado, atemporal.',
  minimalista: 'Minimalista / técnico — sans-serif limpa, grid rígido, paleta reduzida (2-3 cores). Tom confiável, objetivo.',
  artesanal: 'Quente / artesanal — texturas sutis, tons terrosos, tipografia com personalidade. Tom humano, próximo.',
  bold: 'Bold / moderno — contraste alto, tipografia grande e pesada, blocos de cor sólida. Tom confiante, direto.',
  classico: 'Clássico / confiável — paleta sóbria, tipografia tradicional, layout simétrico. Tom sério, institucional.',
  vibrante: 'Vibrante / jovem — cores vivas, formas orgânicas, tipografia divertida. Tom energético, acessível.',
}

function montarContextoSite({ cliente, projeto, briefing, recentes }) {
  const e1 = briefing.etapa1_negocio || {}
  const e2 = briefing.etapa2_midia || {}
  const e3 = briefing.etapa3_referencias || {}
  const e4 = briefing.etapa4_estrutura || {}
  const e5 = briefing.etapa5_requisitos_especiais || ''

  const recentesTexto = (recentes || []).length
    ? `\nPROJETOS RECENTES (evitar repetir arquétipo/paleta): ${recentes.map((r) => `${ARQUETIPO_DIRECAO[r.arquetipo] ? r.arquetipo : r.arquetipo}${r.cores?.length ? ` (${r.cores.join(', ')})` : ''}`).join('; ')}\n`
    : ''

  return `
CLIENTE: ${cliente.nome}${cliente.empresa ? ` (${cliente.empresa})` : ''}
PROJETO: ${projeto.nome} — código ${projeto.codigo}

SEGMENTO: ${e1.segmento || '—'}
ENDEREÇO: ${e1.endereco || '—'}
TELEFONE: ${e1.telefone || '—'}
HORÁRIO: ${e1.horario || '—'}
DESCRIÇÃO: ${e1.descricao || '—'}
DIFERENCIAIS: ${e1.diferenciais || '—'}

LOGO: ${e2.logo?.url || 'não enviado'}
FOTOS DISPONÍVEIS: ${(e2.fotos || []).map((f) => f.url).join(', ') || '—'}
REDES SOCIAIS: ${(e2.redesSociais || []).join(', ') || '—'}

ARQUÉTIPO DE ESTILO: ${ARQUETIPO_DIRECAO[e3.arquetipo] || e3.arquetipo || 'não definido'}
REFERÊNCIAS DE ESTILO: ${(e3.referencias || []).map((r) => `${r.url} (motivo: ${r.motivo || 'não detalhado'})`).join('; ') || '—'}
PALETA: ${(e3.cores || []).join(', ') || '—'}
${recentesTexto}
ESTRUTURA DE PÁGINAS: ${(e4.paginas || []).map((p) => `${p.nome}: ${p.conteudo || 'sem detalhe'}`).join(' | ') || '—'}

REQUISITOS ESPECIAIS: ${e5 || '—'}
`.trim()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { tipo, cliente, projeto, snapshot, briefing } = req.body || {}
  const contextoDado = snapshot || briefing
  if (!tipo || !DOC_INSTRUCOES[tipo] || !cliente || !projeto || !contextoDado) {
    res.status(400).json({ error: 'Parâmetros inválidos' })
    return
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'Não autenticado' })
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` },
  })
  if (!authCheck.ok) {
    res.status(401).json({ error: 'Sessão inválida' })
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'OPENAI_API_KEY não configurada no servidor' })
    return
  }

  let contexto
  if (briefing) {
    let recentes = []
    try {
      const q = `${supabaseUrl}/rest/v1/sh_briefing_sites?select=projeto_id,etapa3_referencias,created_at&projeto_id=neq.${briefing.projeto_id}&order=created_at.desc&limit=10`
      const recResp = await fetch(q, { headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` } })
      if (recResp.ok) {
        const rows = await recResp.json()
        const vistos = new Set()
        for (const r of rows) {
          if (vistos.has(r.projeto_id)) continue
          vistos.add(r.projeto_id)
          const e3 = r.etapa3_referencias || {}
          if (e3.arquetipo) recentes.push({ arquetipo: e3.arquetipo, cores: e3.cores || [] })
          if (recentes.length >= 3) break
        }
      }
    } catch {
      // se falhar, segue sem anti-repeticao — nao bloqueia a geracao
    }
    contexto = montarContextoSite({ cliente, projeto, briefing, recentes })
  } else {
    contexto = montarContexto({ cliente, projeto, snapshot })
  }

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content: 'Você é um analista de sistemas sênior da Desiberne, uma software house. Escreve documentação de projeto objetiva, em português do Brasil, em markdown. Nunca inventa dado que não foi fornecido — usa "a definir" quando faltar informação.',
          },
          { role: 'user', content: `${DOC_INSTRUCOES[tipo]}\n\nDADOS DO PROJETO:\n${contexto}` },
        ],
      }),
    })
    const data = await resp.json()
    if (!resp.ok) {
      res.status(resp.status).json({ error: data.error?.message || 'Erro na OpenAI' })
      return
    }
    res.status(200).json({ conteudo: data.choices?.[0]?.message?.content || '' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
