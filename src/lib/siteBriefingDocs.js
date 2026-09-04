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

- Logo: ${e2.logo ? 'enviado' : 'não enviado'}
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
- Etapa 1 — Prévia: gere primeiro um único arquivo HTML autocontido (CSS/JS inline, sem backend), pra aprovação rápida do cliente sem depender de repositório ou deploy
- Etapa 2 — Depois de aprovado: repositório novo, privado, na organização desiberneia-netizen no GitHub; site estático (sem painel de edição pro cliente); deploy na Vercel, gerando o link .vercel.app antes de qualquer domínio
- Siga exatamente a direção visual e estrutura descritas abaixo, evitando visual genérico de IA (gradiente roxo-azul padrão, fonte Inter como escolha automática, cards centralizados com ícone sem motivo)

## Padrões operacionais — não pergunte, decida e siga
- Formulário de contato: use Web3Forms (grátis) como padrão; se não houver access key configurada, deixe funcional visualmente com um comentário indicando onde configurar depois — nunca bloqueie a entrega por isso
- Agenda: não inclua integração de agendamento a menos que pedido explicitamente nos requisitos especiais abaixo
- WhatsApp flutuante: use o telefone informado na seção Negócio abaixo, sem perguntar
- Fotos insuficientes: use imagens de banco gratuito (Unsplash) como placeholder temporário, mantendo coerência visual — nunca bloqueie a entrega esperando mais fotos
- Dados divergentes entre fontes: priorize sempre o que está escrito neste briefing
- Logo: ${e2.logo?.url ? `use a imagem em ${e2.logo.url} como logo no header (substitui o nome da empresa em texto)` : 'nenhum arquivo de logo foi enviado — use o nome da empresa estilizado tipograficamente no header, sem inventar um logo gráfico'}
- Regra geral: nunca pause esperando resposta do usuário para decisões operacionais — decida dentro destes padrões e só sinalize ao final o que foi assumido, pra revisão posterior

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
Logo: ${e2.logo?.url || 'não enviado'}
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
