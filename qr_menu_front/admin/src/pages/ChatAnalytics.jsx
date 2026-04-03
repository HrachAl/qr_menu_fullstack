import { useState, useEffect } from 'react';
import { MessageCircle, Users, Calendar, TrendingUp, Download, Trash2, Eye } from 'lucide-react';
import { api } from '../api';

export default function ChatAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewSession, setViewSession] = useState(null);
  const [exportData, setExportData] = useState(null);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    api('/api/admin/chat/analytics')
      .then(setData)
      .catch((e) => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleExport = async (sessionId) => {
    try {
      const res = await api(`/api/admin/chat/export/${sessionId}`);
      setExportData(res);
      setViewSession(sessionId);
    } catch (e) {
      setError(e?.message || 'Export failed');
    }
  };

  const handleCleanup = async () => {
    try {
      const res = await api('/api/admin/chat/cleanup', { method: 'POST' });
      setCleanupResult(res);
      load();
    } catch (e) {
      setError(e?.message || 'Cleanup failed');
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Delete ALL chat sessions? This cannot be undone.')) return;
    try {
      const res = await api('/api/admin/chat/sessions', { method: 'DELETE' });
      setCleanupResult({ deleted_expired: res.deleted, deleted_over_limit: 0 });
      load();
    } catch (e) {
      setError(e?.message || 'Delete failed');
    }
  };

  const downloadJson = () => {
    if (!exportData) return;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_${viewSession}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-100">Chat Analytics</h2>
        <div className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-slate-400">Loading analytics...</div>
      </div>
    );
  }

  const filteredSessions = (data?.sessions || []).filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (s.session_id || '').toLowerCase().includes(q) ||
      (s.preview || '').toLowerCase().includes(q) ||
      String(s.customer_id || '').includes(q)
    );
  });

  const dates = Object.keys(data?.messages_by_date || {});
  const maxMsgs = Math.max(1, ...Object.values(data?.messages_by_date || {}));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Chat Analytics</h2>
          <p className="mt-1 text-sm text-slate-400">AI chat usage, sessions, and popular recommendations.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCleanup}
            className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20"
          >
            <Trash2 size={14} />
            Cleanup old
          </button>
          <button
            onClick={handleDeleteAll}
            className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
          >
            <Trash2 size={14} />
            Delete all
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
      )}

      {cleanupResult && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Cleanup done: {cleanupResult.deleted_expired} expired, {cleanupResult.deleted_over_limit} over limit
        </p>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Sessions', value: data?.total_sessions ?? 0, icon: MessageCircle, color: 'indigo' },
          { label: 'Total Messages', value: data?.total_messages ?? 0, icon: TrendingUp, color: 'cyan' },
          { label: 'Registered Users', value: data?.user_sessions_count ?? 0, icon: Users, color: 'emerald' },
          { label: 'Guest Sessions', value: data?.guest_sessions ?? 0, icon: Calendar, color: 'amber' },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Icon size={15} className={`text-${c.color}-300`} />
                <span className="text-xs text-slate-400">{c.label}</span>
              </div>
              <p className="text-2xl font-bold tabular-nums text-slate-100">{c.value.toLocaleString()}</p>
            </div>
          );
        })}
      </div>

      {/* Messages by date chart */}
      {dates.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-100">
            <Calendar size={16} className="text-cyan-300" />
            Messages per day (last 30 days)
          </h3>
          <div className="flex items-end gap-1" style={{ height: 120 }}>
            {dates.map((d) => {
              const val = data.messages_by_date[d];
              const h = Math.max(6, Math.round((val / maxMsgs) * 100));
              return (
                <div key={d} className="group relative flex flex-1 items-end" style={{ height: '100%' }}>
                  <div
                    className="w-full max-w-[24px] rounded-t bg-indigo-500/70 transition-colors hover:bg-indigo-400 mx-auto"
                    style={{ height: `${h}px` }}
                    title={`${d}: ${val} msgs`}
                  />
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 hidden text-[9px] text-slate-500 group-hover:block whitespace-nowrap">{d.slice(5)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex justify-between text-[10px] text-slate-500">
            <span>{dates[0]}</span>
            <span>{dates[dates.length - 1]}</span>
          </div>
        </section>
      )}

      {/* Popular items */}
      {(data?.popular_items || []).length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-100">
            <TrendingUp size={16} className="text-amber-300" />
            Most recommended items in chat
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.popular_items.slice(0, 12).map((item, i) => (
              <div key={item.item_id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                <span className="text-sm text-slate-300">ID {item.item_id}</span>
                <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-300">{item.mentions}x</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sessions list */}
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-100">
            <MessageCircle size={16} className="text-indigo-300" />
            All sessions ({filteredSessions.length})
          </h3>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search session / user..."
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-200">
            <thead className="bg-slate-950/90 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Session</th>
                <th className="px-4 py-3 text-left font-semibold">User</th>
                <th className="px-4 py-3 text-right font-semibold">Msgs</th>
                <th className="px-4 py-3 text-right font-semibold">Today</th>
                <th className="px-4 py-3 text-left font-semibold">Updated</th>
                <th className="px-4 py-3 text-left font-semibold">Preview</th>
                <th className="px-4 py-3 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">No sessions found.</td>
                </tr>
              ) : (
                filteredSessions.slice(0, 100).map((s) => (
                  <tr key={s.session_id} className="transition-colors hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-400" title={s.session_id}>
                      {s.session_id.slice(0, 12)}...
                    </td>
                    <td className="px-4 py-3">
                      {s.customer_id ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">#{s.customer_id}</span>
                      ) : (
                        <span className="text-xs text-slate-500">guest</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.message_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.daily_count}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{(s.updated_at || '').slice(0, 16)}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs text-slate-400">{s.preview}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleExport(s.session_id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
                      >
                        <Eye size={12} /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Session detail modal */}
      {viewSession && exportData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm" onClick={() => { setViewSession(null); setExportData(null); }}>
          <div className="mx-4 max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <h3 className="font-semibold text-slate-100">Session: {viewSession.slice(0, 20)}...</h3>
                <p className="text-xs text-slate-400">
                  Customer: {exportData.customer_id ?? 'guest'} | Created: {exportData.created_at || '—'}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={downloadJson} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500">
                  <Download size={12} /> Export JSON
                </button>
                <button onClick={() => { setViewSession(null); setExportData(null); }} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">
                  Close
                </button>
              </div>
            </div>
            {exportData.summary && (
              <div className="border-b border-slate-800 px-6 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Summary</p>
                <p className="mt-1 text-sm text-slate-300">{exportData.summary}</p>
              </div>
            )}
            <div className="max-h-[55vh] overflow-y-auto px-6 py-4 space-y-3">
              {(exportData.messages || []).length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No messages (only summary)</p>
              ) : (
                exportData.messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                      m.role === 'user'
                        ? 'bg-indigo-600/30 text-indigo-100'
                        : 'bg-slate-800 text-slate-200'
                    }`}>
                      <p className="whitespace-pre-wrap">{m.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-slate-800 px-6 py-3 text-xs text-slate-500">
              Persona: humor={exportData.persona?.humor}, formality={exportData.persona?.formality}, detail={exportData.persona?.analytical_detail}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
