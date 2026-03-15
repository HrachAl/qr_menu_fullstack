import { useState, useEffect, useMemo } from 'react';
import { Pencil, Plus, Search, Trash2, UserCog, X } from 'lucide-react';
import { api } from '../api';

const INPUT_CLASS = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40';
const LABEL_CLASS = 'mb-1.5 block text-sm font-medium text-slate-300';

function roleBadge(role) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium';
  const map = {
    superadmin: `${base} bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-fuchsia-500/30`,
    admin: `${base} bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30`,
    vip_user: `${base} bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30`,
    user: `${base} bg-slate-700/60 text-slate-200 ring-1 ring-slate-600`,
  };
  return <span className={map[role] || map.user}>{role || 'user'}</span>;
}

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Users</h2>
          <p className="mt-1 text-sm text-slate-400">Manage dashboard access and user roles.</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
          onClick={() => setForm({ fullname: '', email: '', password: '', access_level: 'user' })}
        >
          <Plus size={16} />
          Add user
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
      )}

      {form && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">{form.id ? 'Edit user' : 'New user'}</h3>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-400 transition hover:text-slate-100"
              onClick={() => setForm(null)}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={LABEL_CLASS}>Full name</label>
              <input
                value={form.fullname}
                onChange={(e) => setForm((f) => ({ ...f, fullname: e.target.value }))}
                required
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>{form.id ? 'New password (optional)' : 'Password'}</label>
              <input
                type="password"
                value={form.password || ''}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Role</label>
              <select
                value={form.access_level}
                onChange={(e) => setForm((f) => ({ ...f, access_level: e.target.value }))}
                className={INPUT_CLASS}
              >
                <option value="user">user</option>
                <option value="vip_user">vip_user</option>
                <option value="admin">admin</option>
                <option value="superadmin">superadmin</option>
              </select>
            </div>

            <div className="md:col-span-2 flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving}
              >
                <UserCog size={16} />
                {saving ? 'Saving...' : form.id ? 'Update user' : 'Create user'}
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
                onClick={() => setForm(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="relative max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          placeholder="Search by name, email, role"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-10 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-200">
            <thead className="bg-slate-950/90 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">ID</th>
                <th className="px-6 py-4 text-left font-semibold">Full name</th>
                <th className="px-6 py-4 text-left font-semibold">Email</th>
                <th className="px-6 py-4 text-left font-semibold">Role</th>
                <th className="px-6 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400">No users found.</td>
                </tr>
              ) : (
                filteredList.map((u) => (
                  <tr
                    key={u.id}
                    className="cursor-pointer transition-colors duration-200 hover:bg-slate-800/50"
                    onClick={() => setForm({ id: u.id, fullname: u.fullname, email: u.email || '', password: '', access_level: u.access_level })}
                  >
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">#{u.id}</td>
                    <td className="px-6 py-4 font-medium text-slate-100">{u.fullname}</td>
                    <td className="px-6 py-4 text-slate-300">{u.email ?? '—'}</td>
                    <td className="px-6 py-4">{roleBadge(u.access_level)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          title="Edit user"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-indigo-500/60 hover:text-indigo-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            setForm({ id: u.id, fullname: u.fullname, email: u.email || '', password: '', access_level: u.access_level });
                          }}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          title="Delete user"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-red-500/60 hover:text-red-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(u.id);
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
