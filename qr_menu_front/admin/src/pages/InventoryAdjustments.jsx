import { useEffect, useMemo, useState } from 'react';
import { Check, RefreshCcw, XCircle } from 'lucide-react';
import { api } from '../api';

const TEN_MINUTES_MS = 10 * 60 * 1000;

const STATUS_META = {
  pending: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  'auto-approved': 'bg-cyan-500/15 text-cyan-300 ring-cyan-500/30',
  rejected: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
};

function StatusBadge({ status }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
        STATUS_META[status] || 'bg-slate-700 text-slate-200 ring-slate-600',
      ].join(' ')}
    >
      {status || 'unknown'}
    </span>
  );
}

function parseCreatedAtMs(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function formatDateTime(value) {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString();
}

function formatCountdown(msRemaining) {
  if (msRemaining == null) return '--:--';
  if (msRemaining <= 0) return '00:00';
  const totalSeconds = Math.floor(msRemaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function InventoryAdjustments() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [updatingKey, setUpdatingKey] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [nowMs, setNowMs] = useState(Date.now());

  async function loadRequests() {
    setError('');
    try {
      const data = await api('/admin/inventory-adjustments?limit=500');
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Failed to load inventory adjustments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadRequests();
  }, []);

  useEffect(() => {
    const refreshId = window.setInterval(() => {
      loadRequests();
    }, 15000);
    return () => window.clearInterval(refreshId);
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timerId);
  }, []);

  const pendingRequests = useMemo(() => {
    return requests
      .filter((item) => item.status === 'pending')
      .sort((a, b) => Date.parse(a.created_at || 0) - Date.parse(b.created_at || 0));
  }, [requests]);

  const historyRequests = useMemo(() => {
    let rows = requests.filter((item) => item.status !== 'pending');
    if (historyFilter !== 'all') {
      rows = rows.filter((item) => item.status === historyFilter);
    }
    return rows.sort((a, b) => Date.parse(b.updated_at || b.created_at || 0) - Date.parse(a.updated_at || a.created_at || 0));
  }, [requests, historyFilter]);

  const summary = useMemo(() => {
    return requests.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.status === 'pending') acc.pending += 1;
        if (row.status === 'approved') acc.approved += 1;
        if (row.status === 'auto-approved') acc.autoApproved += 1;
        if (row.status === 'rejected') acc.rejected += 1;
        return acc;
      },
      { total: 0, pending: 0, approved: 0, autoApproved: 0, rejected: 0 }
    );
  }, [requests]);

  async function decide(requestId, decision) {
    const actionKey = `${requestId}:${decision}`;
    setUpdatingKey(actionKey);
    setError('');
    setNotice('');
    try {
      const updated = await api(`/admin/inventory-adjustments/${requestId}/approve-reject`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      setRequests((prev) =>
        prev.map((item) => {
          if (item.id !== requestId) return item;
          return {
            ...item,
            ...updated,
          };
        })
      );
      setNotice(`Request #${requestId} ${decision === 'approve' ? 'approved' : 'rejected'}.`);
    } catch (err) {
      setError(err?.message || 'Failed to submit decision');
    } finally {
      setUpdatingKey('');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Inventory Adjustments</h2>
          <p className="mt-1 text-sm text-slate-400">
            Review chef adjustment requests, monitor the 10-minute approval window, and audit final outcomes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadRequests()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
        >
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Total</p>
          <p className="mt-2 text-2xl font-bold text-slate-100">{summary.total}</p>
        </article>
        <article className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-xs uppercase tracking-wide text-amber-300">Pending</p>
          <p className="mt-2 text-2xl font-bold text-amber-200">{summary.pending}</p>
        </article>
        <article className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-xs uppercase tracking-wide text-emerald-300">Approved</p>
          <p className="mt-2 text-2xl font-bold text-emerald-200">{summary.approved}</p>
        </article>
        <article className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
          <p className="text-xs uppercase tracking-wide text-cyan-300">Auto-approved</p>
          <p className="mt-2 text-2xl font-bold text-cyan-200">{summary.autoApproved}</p>
        </article>
        <article className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
          <p className="text-xs uppercase tracking-wide text-rose-300">Rejected</p>
          <p className="mt-2 text-2xl font-bold text-rose-200">{summary.rejected}</p>
        </article>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-100">Pending Requests</h3>
          <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300">
            {pendingRequests.length} open
          </span>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-8 text-center text-sm text-slate-400">
            Loading pending requests...
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-8 text-center text-sm text-slate-400">
            No pending inventory adjustment requests.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full text-sm text-slate-200">
              <thead className="bg-slate-950/90 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Request</th>
                  <th className="px-4 py-3 text-left font-semibold">Order</th>
                  <th className="px-4 py-3 text-left font-semibold">Ingredient</th>
                  <th className="px-4 py-3 text-left font-semibold">Created</th>
                  <th className="px-4 py-3 text-left font-semibold">Countdown</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pendingRequests.map((row) => {
                  const createdAtMs = parseCreatedAtMs(row.created_at);
                  const remainingMs = createdAtMs == null ? null : createdAtMs + TEN_MINUTES_MS - nowMs;
                  const expired = remainingMs != null && remainingMs <= 0;

                  return (
                    <tr key={row.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-medium text-slate-100">#{row.id}</td>
                      <td className="px-4 py-3">#{row.order_id}</td>
                      <td className="px-4 py-3">{row.ingredient_name || `Ingredient ${row.ingredient_id}`}</td>
                      <td className="px-4 py-3 text-slate-300">{formatDateTime(row.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <p className={[
                            'font-semibold tabular-nums',
                            expired ? 'text-rose-300' : 'text-amber-300',
                          ].join(' ')}>
                            {formatCountdown(remainingMs)}
                          </p>
                          {expired && (
                            <p className="text-xs text-rose-300">
                              Auto-approval in progress...
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={!!updatingKey || expired}
                            onClick={() => decide(row.id, 'approve')}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Check size={13} />
                            {updatingKey === `${row.id}:approve` ? 'Approving...' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            disabled={!!updatingKey || expired}
                            onClick={() => decide(row.id, 'reject')}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <XCircle size={13} />
                            {updatingKey === `${row.id}:reject` ? 'Rejecting...' : 'Reject'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-slate-100">History Log</h3>
          <select
            value={historyFilter}
            onChange={(event) => setHistoryFilter(event.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            <option value="all">All results</option>
            <option value="approved">Approved</option>
            <option value="auto-approved">Auto-approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {historyRequests.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-8 text-center text-sm text-slate-400">
            No history records for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full text-sm text-slate-200">
              <thead className="bg-slate-950/90 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Request</th>
                  <th className="px-4 py-3 text-left font-semibold">Order</th>
                  <th className="px-4 py-3 text-left font-semibold">Ingredient</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Created</th>
                  <th className="px-4 py-3 text-left font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {historyRequests.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-medium text-slate-100">#{row.id}</td>
                    <td className="px-4 py-3">#{row.order_id}</td>
                    <td className="px-4 py-3">{row.ingredient_name || `Ingredient ${row.ingredient_id}`}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-300">{formatDateTime(row.created_at)}</td>
                    <td className="px-4 py-3 text-slate-300">{formatDateTime(row.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}