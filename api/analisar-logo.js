// Vercel Serverless Function — analisa a imagem do logo (via IA com visão) e devolve
// a paleta de cores predominante, pra nao precisar digitar hex na mao.
// Chave da OpenAI so no servidor.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { logoUrl } = req.body || {}
  if (!logoUrl) {
    res.status(400).json({ error: 'logoUrl obrigatório' })
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
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Você analisa uma imagem de logo e devolve APENAS um JSON com a chave "cores": um array de 2 a 4 strings descrevendo as cores predominantes do logo, cada uma no formato "nome da cor (#HEX aproximado)" — ex: "azul petróleo (#0F4C5C)". Baseie-se só no que está visível na imagem.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analise as cores predominantes deste logo:' },
              { type: 'image_url', image_url: { url: logoUrl } },
            ],
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
    res.status(200).json({ cores: parsed.cores || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
