// Geração dos documentos do Estúdio de Sites a partir de um briefing confirmado.
// MVP: baseado em template/regras. IA assistida via /api/gerar-documento com tipo específico.

function list(items, empty = '_nenhum item informado_') {
  if (!items || items.length === 0) return empty
  return items.map((i) => `- ${i}`).join('\n')
}

export function gerarBriefResumido(ctx) {
  const { cliente, projeto, briefing } = ctx
  const e1 = briefing.etapa1_negocio || {}
  const e2 = briefing.etapa2_midia || {}
  const e3 = briefing.etapa3_referencias || {}
  const e4 = briefing.etapa4_estrutura || {}
  const e5 = briefing.etapa5_requisitos_especiais || ''

  return `# Brief Resumido — ${projeto.nome}

**Cliente:** ${cliente.nome}${cliente.empresa ? ` (${cliente.empresa})` : ''}
**Código:** ${projeto.codigo}

## Negócio

- Segmento: ${e1.segmento || '—'}
- Endereço: ${e1.endereco || '—'}
- Telefone: ${e1.telefone || '—'}
- Horário: ${e1.horario || '—'}
- Descrição: ${e1.descricao || '—'}
- Diferenciais: ${e1.diferenciais || '—'}

## Mídia

- Fotos: ${(e2.fotos || []).length} arquivo(s)
- Redes sociais: ${list(e2.redesSociais)}

## Estilo e referências

${(e3.referencias || []).length
    ? e3.referencias.map((r) => `- **${r.url}** — ${r.motivo || 'sem motivo detalhado'}`).join('\n')
    : '_nenhuma referência informada_'}
- Paleta: ${(e3.cores || []).join(', ') || '—'}
- Tom de voz: ${e3.tomDeVoz || '—'}

## Estrutura de páginas

${(e4.paginas || []).length
    ? e4.paginas.map((p) => `- **${p.nome}** — ${p.conteudo || 'sem detalhe'}`).join('\n')
    : '_nenhuma página definida_'}

## Requisitos especiais

${e5 || '—'}
`
}

export function gerarPromptSiteClaudeCode(ctx) {
  const { cliente, projeto, briefing } = ctx
  const e1 = briefing.etapa1_negocio || {}
  const e2 = briefing.etapa2_midia || {}
  const e3 = briefing.etapa3_referencias || {}
  const e4 = briefing.etapa4_estrutura || {}
  const e5 = briefing.etapa5_requisitos_especiais || ''

  return `# Novo projeto Desiberne Studio — ${cliente.nome}${cliente.empresa ? ` (${cliente.empresa})` : ''}

Construa um site institucional do zero, seguindo o briefing abaixo.

## Requisitos técnicos
- Repositório novo, privado, na organização desiberneia-netizen no GitHub
- Site estático — sem painel de edição pro cliente
- Deploy na Vercel — assim que possível, gere o link de prévia (.vercel.app) pra mostrar ao cliente antes de qualquer domínio
- Siga exatamente a direção visual e estrutura descritas abaixo, evitando visual genérico de IA (gradiente roxo-azul padrão, fonte Inter como escolha automática, cards centralizados com ícone sem motivo)

---

## Negócio
${cliente.nome}${cliente.empresa ? ` (${cliente.empresa})` : ''} — segmento: ${e1.segmento || '—'}.
Endereço: ${e1.endereco || '—'} · Telefone: ${e1.telefone || '—'} · Horário: ${e1.horario || '—'}
Descrição: ${e1.descricao || '—'}
Diferenciais: ${e1.diferenciais || '—'}

## Direção visual
Paleta: ${(e3.cores || []).join(', ') || '—'}
Tom de voz: ${e3.tomDeVoz || '—'}
Referências que o cliente gosta:
${(e3.referencias || []).length
    ? e3.referencias.map((r) => `- ${r.url} — motivo: ${r.motivo || 'não detalhado'}`).join('\n')
    : '—'}

Importante: evitar o "visual genérico de IA" (gradiente roxo-azul padrão, fonte Inter como escolha automática, cards centralizados com ícone sem motivo). Escolher tipografia e paleta específicas pro segmento e pro tom de voz descritos acima.

## Mídia disponível
Fotos: ${(e2.fotos || []).map((f) => f.url).join(', ') || 'nenhuma enviada'}
Redes sociais: ${list(e2.redesSociais)}

## Estrutura de páginas
${(e4.paginas || []).length
    ? e4.paginas.map((p) => `### ${p.nome}\n${p.conteudo || 'sem detalhe'}`).join('\n\n')
    : '—'}

## Requisitos especiais
${e5 || '—'}

## Critérios de aceite
- Site estático (sem painel de edição pro cliente), deploy Vercel
- Todas as páginas listadas acima implementadas com o conteúdo descrito
- Direção visual seguida — não usar defaults genéricos de IA
- Responsivo (mobile e desktop)
`
}

export function gerarTodosDocumentosSite(ctx) {
  return [
    { tipo: 'brief_resumido', conteudo: gerarBriefResumido(ctx) },
    { tipo: 'prompt_site_claude_code', conteudo: gerarPromptSiteClaudeCode(ctx) },
  ]
}
