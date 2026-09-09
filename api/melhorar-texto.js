// Vercel Serverless Function — reescreve/completa um texto curto escrito pelo usuário,
// deixando mais claro e completo sem mudar o sentido. Genérica, reaproveitável.
// Chave da OpenAI so no servidor.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { texto, contexto } = req.body || {}
  if (!texto || texto.trim().length < 3) {
    res.status(400).json({ error: 'Texto muito curto' })
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
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: 'Você corrige e completa anotações curtas em português do Brasil, deixando-as mais claras e específicas, sem inventar informação nova nem mudar o sentido original. Devolve só o texto reescrito, sem aspas, sem explicação.',
          },
          { role: 'user', content: `${contexto ? `Contexto: ${contexto}\n\n` : ''}Texto original:\n${texto}` },
        ],
      }),
    })
    const data = await resp.json()
    if (!resp.ok) {
      res.status(resp.status).json({ error: data.error?.message || 'Erro na OpenAI' })
      return
    }
    res.status(200).json({ texto_melhorado: data.choices?.[0]?.message?.content?.trim() || texto })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
