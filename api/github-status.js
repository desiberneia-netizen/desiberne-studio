// Vercel Serverless Function — status do repositório GitHub (branch + último commit)
// Token do GitHub nunca chega no navegador (env var sem prefixo VITE_)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { owner, repo } = req.query
  if (!owner || !repo) {
    res.status(400).json({ error: 'Parâmetros owner/repo obrigatórios' })
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

  const githubToken = process.env.GITHUB_TOKEN
  const headers = {
    Accept: 'application/vnd.github+json',
    ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
  }

  try {
    const repoResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers })
    const repoData = await repoResp.json()
    if (!repoResp.ok) {
      res.status(repoResp.status).json({ error: repoData.message || 'Erro ao consultar o GitHub' })
      return
    }

    const commitsResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1&sha=${repoData.default_branch}`, { headers })
    const commits = await commitsResp.json()
    const ultimoCommit = Array.isArray(commits) ? commits[0] : null

    res.status(200).json({
      branch: repoData.default_branch,
      privado: repoData.private,
      atualizadoEm: repoData.pushed_at,
      ultimoCommit: ultimoCommit
        ? {
            mensagem: ultimoCommit.commit?.message?.split('\n')[0],
            autor: ultimoCommit.commit?.author?.name,
            data: ultimoCommit.commit?.author?.date,
            sha: ultimoCommit.sha?.slice(0, 7),
          }
        : null,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
