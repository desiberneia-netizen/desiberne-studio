import { useEffect, useState } from 'react'
import { sb } from '../lib/supabaseClient'

const PAPEL_LABEL = {
  sh_admin: 'Admin',
  sh_gestor: 'Gestor',
  sh_operacional: 'Operacional',
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [novoEmail, setNovoEmail] = useState('')
  const [novoPapel, setNovoPapel] = useState('sh_operacional')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await sb.from('sh_usuarios').select('*').order('created_at')
    if (error) setError(error.message)
    else setUsuarios(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function addUsuario(e) {
    e.preventDefault()
    if (!novoEmail.trim()) return
    setSaving(true)
    const { error } = await sb.from('sh_usuarios').insert({ email: novoEmail.trim().toLowerCase(), papel: novoPapel })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setNovoEmail('')
    load()
  }

  async function updatePapel(id, papel) {
    const { error } = await sb.from('sh_usuarios').update({ papel }).eq('id', id)
    if (error) setError(error.message)
    else setUsuarios(usuarios.map((u) => (u.id === id ? { ...u, papel } : u)))
  }

  async function removeUsuario(id) {
    if (!confirm('Remover acesso desse usuário ao Studio?')) return
    const { error } = await sb.from('sh_usuarios').delete().eq('id', id)
    if (error) setError(error.message)
    else setUsuarios(usuarios.filter((u) => u.id !== id))
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Usuários</h1>
          <p>Papéis de acesso ao Studio — usa o mesmo login do CRM, só define o nível de permissão aqui</p>
        </div>
      </div>

      {error && <div className="banner-error">{error}</div>}

      <form className="table-wrap" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-end' }} onSubmit={addUsuario}>
        <div className="form-row" style={{ flex: 1, marginBottom: 0 }}>
          <label>E-mail</label>
          <input type="email" value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} placeholder="pessoa@desiberneia.com.br" required />
        </div>
        <div className="form-row" style={{ marginBottom: 0 }}>
          <label>Papel</label>
          <select value={novoPapel} onChange={(e) => setNovoPapel(e.target.value)}>
            <option value="sh_admin">Admin</option>
            <option value="sh_gestor">Gestor</option>
            <option value="sh_operacional">Operacional</option>
          </select>
        </div>
        <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Salvando...' : '+ Adicionar'}</button>
      </form>

      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : usuarios.length === 0 ? (
        <div className="empty-state">Nenhum usuário com papel definido ainda.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Status</th>
                <th>Papel</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.auth_id ? <span className="status-pill status-entregue">ativo</span> : <span className="status-pill status-pausado">aguardando 1º login</span>}</td>
                  <td>
                    <select value={u.papel} onChange={(e) => updatePapel(u.id, e.target.value)}>
                      {Object.entries(PAPEL_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button className="btn-icon-danger" onClick={() => removeUsuario(u.id)}>Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
