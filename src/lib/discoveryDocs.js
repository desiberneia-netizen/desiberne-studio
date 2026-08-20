// Geração dos 5 documentos a partir de um snapshot de discovery confirmado.
// MVP: baseado em template/regras. IA assistida (Claude API) entra na Fase 2 (PRD backlog BL-11).

function list(items, empty = '_nenhum item informado_') {
  if (!items || items.length === 0) return empty
  return items.map((i) => `- ${i}`).join('\n')
}

export function gerarDocumentoTecnico(ctx) {
  const { cliente, projeto, snapshot } = ctx
  const e1 = snapshot.etapa1_empresa || {}
  const e6 = snapshot.etapa6_integracoes || {}
  const e7 = snapshot.etapa7_identidade || {}
  return `# Documento Técnico — ${projeto.nome}

**Cliente:** ${cliente.nome}${cliente.empresa ? ` (${cliente.empresa})` : ''}
**Código:** ${projeto.codigo}
**Segmento:** ${e1.segmento || '—'}

## Visão geral

${e1.funcionamento_atual || '_não informado_'}

## Integrações necessárias

${list([...(e6.padrao || []), e6.outra].filter(Boolean))}

## Identidade visual

- Tema: ${e7.tema || '—'}
- Tipografia: ${e7.tipografia || '—'}
- Estilo/referências: ${e7.estilo || '—'}
`
}

export function gerarEscopoFuncional(ctx) {
  const { projeto, snapshot } = ctx
  const e4 = snapshot.etapa4_funcionalidades || {}
  const e5 = snapshot.etapa5_usuarios || {}
  const e3 = snapshot.etapa3_fluxo || {}
  return `# Escopo Funcional — ${projeto.nome}

## Fluxo operacional

${(e3.etapas || []).length ? e3.etapas.map((s, i) => `${i + 1}. ${s}`).join('\n') : '_fluxo não desenhado_'}

## Funcionalidades confirmadas

${list(e4.padrao)}

${list(e4.personalizadas, '')}

## Perfis de usuário

${(e5.perfis || []).length
    ? e5.perfis.map((p) => `- **${p.nome}** — ${p.permissoes || 'permissões não detalhadas'}`).join('\n')
    : '_nenhum perfil definido_'}
`
}

export function gerarBacklog(ctx) {
  const { snapshot } = ctx
  const e4 = snapshot.etapa4_funcionalidades || {}
  const todas = [...(e4.padrao || []), ...(e4.personalizadas || [])]
  const mvp = todas.slice(0, Math.ceil(todas.length / 2))
  const v2 = todas.slice(Math.ceil(todas.length / 2))
  return `# Backlog — ${ctx.projeto.nome}

## MVP

${list(mvp)}

## V2

${list(v2)}

## V3 / Futuro

_a definir com o cliente após entrega do MVP_
`
}

export function gerarRoadmap(ctx) {
  const { projeto } = ctx
  return `# Roadmap — ${projeto.nome}

**Prazo informado:** ${projeto.prazo ? new Date(projeto.prazo + 'T12:00:00').toLocaleDateString('pt-BR') : 'não definido'}
**Prioridade:** ${projeto.prioridade}

1. **Discovery** — concluído
2. **MVP** — implementação das funcionalidades essenciais
3. **V2** — funcionalidades complementares
4. **Entrega e homologação**
`
}

export function gerarPromptClaudeCode(ctx) {
  const { cliente, projeto, snapshot } = ctx
  const e1 = snapshot.etapa1_empresa || {}
  const e2 = snapshot.etapa2_objetivos || {}
  const e3 = snapshot.etapa3_fluxo || {}
  const e4 = snapshot.etapa4_funcionalidades || {}
  const e5 = snapshot.etapa5_usuarios || {}
  const e6 = snapshot.etapa6_integracoes || {}
  const e7 = snapshot.etapa7_identidade || {}
  const e8 = snapshot.etapa8_requisitos_especiais || ''

  return `# ${projeto.nome} — Briefing para Claude Code

## Contexto do cliente
${cliente.nome}${cliente.empresa ? ` (${cliente.empresa})` : ''} — segmento: ${e1.segmento || '—'}.
Funcionamento atual: ${e1.funcionamento_atual || '—'}
Departamentos que vão usar o sistema: ${(e1.departamentos || []).join(', ') || '—'}
Maiores dificuldades hoje: ${e1.dificuldades || '—'}

## Objetivo do projeto
${e2.problema_resolver || '—'}
Maior problema a resolver: ${e2.maior_problema || '—'}
Definição de sucesso: ${e2.definicao_sucesso || '—'}

## Fluxo operacional
${(e3.etapas || []).length ? e3.etapas.map((s, i) => `${i + 1}. ${s}`).join('\n') : '—'}

## Funcionalidades e prioridade
${list([...(e4.padrao || []), ...(e4.personalizadas || [])])}

## Perfis e permissões
${(e5.perfis || []).length ? e5.perfis.map((p) => `- ${p.nome}: ${p.permissoes || '—'}`).join('\n') : '—'}

## Integrações
${list([...(e6.padrao || []), e6.outra].filter(Boolean))}

## Identidade visual
- Tema: ${e7.tema || '—'}
- Cores: ${(e7.cores || []).join(', ') || '—'}
- Tipografia: ${e7.tipografia || '—'}
- Estilo/referências: ${e7.estilo || '—'}
- Logo: ${e7.logo_url || '—'}

## Restrições e requisitos especiais
${e8 || '—'}

## Critérios de aceite do MVP
- Todas as funcionalidades marcadas como MVP no backlog funcionando ponta a ponta
- Fluxo operacional acima implementado sem etapas puladas
- Perfis de usuário com as permissões descritas acima respeitadas
`
}

export function gerarTodosDocumentos(ctx) {
  return [
    { tipo: 'documento_tecnico', conteudo: gerarDocumentoTecnico(ctx) },
    { tipo: 'escopo_funcional', conteudo: gerarEscopoFuncional(ctx) },
    { tipo: 'backlog', conteudo: gerarBacklog(ctx) },
    { tipo: 'roadmap', conteudo: gerarRoadmap(ctx) },
    { tipo: 'prompt_claude_code', conteudo: gerarPromptClaudeCode(ctx) },
  ]
}
