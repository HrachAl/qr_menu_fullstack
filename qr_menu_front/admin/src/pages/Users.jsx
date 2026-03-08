import { useState, useEffect, useMemo } from 'react';
import { api } from '../api';

export default function Users() {
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const load = () => api('/api/admin/users').then(setList).catch(e => setError(e.message));

  useEffect(() => { load(); }, []);

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.trim().toLowerCase();
    return list.filter((u) => {
      const name = (u.fullname || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const role = (u.access_level || '').toLowerCase();
      return name.includes(q) || email.includes(q) || role.includes(q);
    });
  }, [list, searchQuery]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      if (form.id) {
        await api(`/api/admin/users/${form.id}`, { method: 'PATCH', body: JSON.stringify({ fullname: form.fullname, email: form.email, access_level: form.access_level, ...(form.password ? { password: form.password } : {}) }) });
      } else {
        await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ fullname: form.fullname, email: form.email, password: form.password, access_level: form.access_level || 'user' }) });
      }
      setForm(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this user?')) return;
    try {
      await api(`/api/admin/users/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <p className="error-msg">{error}</p>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Users</h1>
        <button type="button" className="btn btn-primary" onClick={() => setForm({ fullname: '', email: '', password: '', access_level: 'user' })}>Add user</button>
      </div>
      {form && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2>{form.id ? 'Edit user' : 'New user'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Full name</label>
              <input value={form.fullname} onChange={e => setForm(f => ({ ...f, fullname: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>{form.id ? 'New password (leave blank to keep)' : 'Password'}</label>
              <input type="password" value={form.password || ''} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select value={form.access_level} onChange={e => setForm(f => ({ ...f, access_level: e.target.value }))}>
                <option value="user">user</option>
                <option value="vip_user">vip_user</option>
                <option value="admin">admin</option>
                <option value="superadmin">superadmin</option>
              </select>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>{form.id ? 'Update' : 'Create'}</button>
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      <div className="search-bar">
        <input type="search" placeholder="Search by name, email, role…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
      </div>
      <div className="card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Full name</th>
              <th>Email</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredList.map(u => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.fullname}</td>
                <td>{u.email ?? '—'}</td>
                <td>{u.access_level}</td>
                <td>
                  <div className="cell-actions">
                    <button type="button" className="btn" onClick={() => setForm({ id: u.id, fullname: u.fullname, email: u.email || '', password: '', access_level: u.access_level })}>Edit</button>
                    <button type="button" className="btn btn-danger" onClick={() => handleDelete(u.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
