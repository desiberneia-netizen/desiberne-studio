// Vercel Serverless Function — le uma pagina publica (site/rede social do cliente)
// e extrai dados de negocio estruturados via IA. NAO usar com links do Google Maps
// (pagina renderizada via JS, sem HTML estatico pra ler) — funciona bem com site
// institucional, Instagram, Facebook. Chave da OpenAI so no servidor.

function extrairTextoDoHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { url } = req.body || {}
  if (!url || !/^https?:\/\//.test(url)) {
    res.status(400).json({ error: 'URL inválida' })
    return
  }
  if (url.includes('google.com/maps') || url.includes('maps.app.goo.gl')) {
    res.status(400).json({ error: 'Link do Google Maps não funciona aqui — a página é toda em JavaScript. Usa o site ou rede social da empresa.' })
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

  let texto
  try {
    const pageResp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DesiberneStudioBot/1.0)' } })
    if (!pageResp.ok) throw new Error(`Não consegui acessar a página (status ${pageResp.status})`)
    const html = await pageResp.text()
    texto = extrairTextoDoHtml(html)
    if (!texto || texto.length < 40) throw new Error('Página sem texto legível — provavelmente carregada via JavaScript. Tenta outro link.')
  } catch (err) {
    res.status(422).json({ error: err.message })
    return
  }

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Você extrai dados de negócio de um texto de página web e devolve APENAS um JSON com as chaves: segmento, endereco, telefone, horario, descricao, diferenciais. Todas as chaves são strings. Se não encontrar um dado, use string vazia. Nunca invente informação que não está no texto.',
          },
          { role: 'user', content: `Texto da página (${url}):\n\n${texto}` },
        ],
      }),
    })
    const data = await resp.json()
    if (!resp.ok) {
      res.status(resp.status).json({ error: data.error?.message || 'Erro na OpenAI' })
      return
    }
    const extraido = JSON.parse(data.choices?.[0]?.message?.content || '{}')
    res.status(200).json({ dados: extraido })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
