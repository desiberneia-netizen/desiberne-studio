// Vercel Serverless Function — nunca expõe a chave da OpenAI ao navegador.
// Verifica que quem chamou está autenticado no Supabase antes de gastar créditos.

const DOC_INSTRUCOES = {
  documento_tecnico: 'Escreva o Documento Técnico do projeto: visão geral do sistema, arquitetura sugerida (dado o que foi descrito), integrações necessárias e considerações de identidade visual. Markdown, títulos com #, seja específico usando os dados fornecidos, não invente informação que não foi dada.',
  escopo_funcional: 'Escreva o Escopo Funcional: descreva o fluxo operacional em prosa curta, liste as funcionalidades confirmadas agrupadas por área, e descreva os perfis de usuário e o que cada um faz. Markdown.',
  backlog: 'Escreva um Backlog priorizado, dividido em seções MVP / V2 / V3, com base nas funcionalidades e no fluxo descritos. Cada item deve ser uma linha curta e acionável. Markdown.',
  roadmap: 'Escreva um Roadmap de implementação em fases (Discovery concluído, MVP, V2, Entrega), com uma frase objetiva por fase considerando o prazo e a prioridade informados. Markdown.',
  prompt_claude_code: 'Escreva um briefing técnico completo para ser entregue ao Claude Code (agente de desenvolvimento de IA) implementar este projeto do zero. Estruture em seções: Contexto do cliente, Objetivo do projeto, Fluxo operacional, Funcionalidades e prioridade, Modelo de dados sugerido, Perfis e permissões, Integrações, Identidade visual, Restrições e requisitos especiais, Critérios de aceite do MVP. Seja concreto e implementável, não genérico. Markdown.',
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { tipo, cliente, projeto, snapshot } = req.body || {}
  if (!tipo || !DOC_INSTRUCOES[tipo] || !cliente || !projeto || !snapshot) {
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

  const contexto = montarContexto({ cliente, projeto, snapshot })

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
