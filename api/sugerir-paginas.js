// Vercel Serverless Function — sugere estrutura de páginas com base no que já foi
// preenchido no briefing (segmento, descrição, arquétipo). Chave da OpenAI só no servidor.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { segmento, descricao, arquetipoLabel, secoesEscolhidas } = req.body || {}
  if (!segmento) {
    res.status(400).json({ error: 'segmento obrigatório' })
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

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.5,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Você sugere a estrutura de páginas/seções de um site institucional. Devolva APENAS um JSON com a chave "paginas": um array de objetos {"nome": string, "conteudo": string curto descrevendo o que a seção precisa ter}. Sugira entre 5 e 8 seções específicas pro segmento informado, em português, práticas e concretas — não genéricas.',
          },
          {
            role: 'user',
            content: `Segmento: ${segmento}\nDescrição do negócio: ${descricao || '—'}\nArquétipo visual: ${arquetipoLabel || '—'}\nSeções já escolhidas (não repetir): ${(secoesEscolhidas || []).join(', ') || '—'}`,
          },
        ],
      }),
    })
    const data = await resp.json()
    if (!resp.ok) {
      res.status(resp.status).json({ error: data.error?.message || 'Erro na OpenAI' })
      return
    }
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}')
    res.status(200).json({ paginas: parsed.paginas || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
