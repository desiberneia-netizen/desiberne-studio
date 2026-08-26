// Vercel Serverless Function — status do último deploy (Vercel API)
// Token nunca chega no navegador (env var sem prefixo VITE_)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { project } = req.query
  if (!project) {
    res.status(400).json({ error: 'Parâmetro project obrigatório' })
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

  const vercelToken = process.env.VERCEL_TOKEN
  if (!vercelToken) {
    res.status(500).json({ error: 'VERCEL_TOKEN não configurada no servidor' })
    return
  }
  const teamQuery = process.env.VERCEL_TEAM_ID ? `&teamId=${process.env.VERCEL_TEAM_ID}` : ''

  try {
    const resp = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(project)}&limit=1${teamQuery}`,
      { headers: { Authorization: `Bearer ${vercelToken}` } }
    )
    const data = await resp.json()
    if (!resp.ok) {
      res.status(resp.status).json({ error: data.error?.message || 'Erro ao consultar a Vercel' })
      return
    }
    const dep = data.deployments?.[0]
    if (!dep) {
      res.status(200).json({ encontrado: false })
      return
    }
    res.status(200).json({
      encontrado: true,
      estado: dep.state,
      url: dep.url,
      criadoEm: dep.createdAt,
      branch: dep.meta?.githubCommitRef || dep.meta?.branch || null,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
