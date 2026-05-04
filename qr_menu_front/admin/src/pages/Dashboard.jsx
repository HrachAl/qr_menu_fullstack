import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Box, ShoppingCart, UsersRound, PackageCheck, ChefHat, ClipboardCheck, Check, XCircle } from 'lucide-react';
import { api, productImageUrl } from '../api';

const TEN_MINUTES_MS = 10 * 60 * 1000;

function parseCreatedAtMs(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function formatCountdown(msRemaining) {
  if (msRemaining == null) return '--:--';
  if (msRemaining <= 0) return '00:00';
  const totalSeconds = Math.floor(msRemaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const statMeta = [
  { key: 'users_count', label: 'Users', Icon: UsersRound, trend: '+12% this month' },
  { key: 'products_count', label: 'Products', Icon: Box, trend: '+7% this month' },
  { key: 'orders_count', label: 'Orders', Icon: ShoppingCart, trend: '+15% this month' },
  { key: 'orders_today', label: 'Orders today', Icon: PackageCheck, trend: '+4% vs yesterday' },
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingAdjustments, setPendingAdjustments] = useState([]);
  const [adjustmentsError, setAdjustmentsError] = useState('');
  const [decisionLoadingKey, setDecisionLoadingKey] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());

  async function loadPendingAdjustments() {
    try {
      const rows = await api('/admin/inventory-adjustments?status=pending&limit=6');
      setPendingAdjustments(Array.isArray(rows) ? rows : []);
      setAdjustmentsError('');
    } catch (e) {
      setAdjustmentsError(e?.message || 'Failed to load pending inventory adjustments');
    }
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    api('/api/admin/stats/dashboard')
      .then((d) => setData(d != null ? d : {}))
      .catch((e) => setError(e?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));

    loadPendingAdjustments();
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timerId);
  }, []);

  async function decideAdjustment(requestId, decision) {
    const actionKey = `${requestId}:${decision}`;
    setDecisionLoadingKey(actionKey);
    setAdjustmentsError('');
    try {
      await api(`/admin/inventory-adjustments/${requestId}/approve-reject`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      setPendingAdjustments((prev) => prev.filter((row) => row.id !== requestId));
    } catch (e) {
      setAdjustmentsError(e?.message || 'Failed to submit inventory adjustment decision');
    } finally {
      setDecisionLoadingKey('');
    }
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-36 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/80" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/80" />
      </div>
    );
  }

  const topProducts = Array.isArray(data?.top_products) ? data.top_products : [];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statMeta.map(({ key, label, Icon, trend }) => (
          <article
            key={key}
            className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_16px_30px_-24px_rgba(59,130,246,0.5)]"
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">{label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-100">{data?.[key] ?? 0}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/35">
                <Icon size={18} />
              </div>
            </div>

            <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
              <ArrowUpRight size={14} />
              {trend}
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Chef/Admin Actions</h2>
            <p className="mt-1 text-sm text-slate-400">Quick entry points for the newly added workflow pages.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/chef"
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-3 py-2 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-500/25"
            >
              <ChefHat size={15} />
              Chef Panel
            </Link>
            <Link
              to="/admin/inventory-adjustments"
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/25"
            >
              <ClipboardCheck size={15} />
              Inventory Adjustments
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Pending Inventory Adjustment Requests</h2>
            <p className="mt-1 text-sm text-slate-400">Approve or reject before the 10-minute auto-approval window expires.</p>
          </div>
          <Link
            to="/admin/inventory-adjustments"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            Open Full Queue
          </Link>
        </div>

        {adjustmentsError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {adjustmentsError}
          </div>
        )}

        {pendingAdjustments.length === 0 ? (
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
                  <th className="px-4 py-3 text-left font-semibold">Countdown</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pendingAdjustments.map((row) => {
                  const createdAtMs = parseCreatedAtMs(row.created_at);
                  const remainingMs = createdAtMs == null ? null : createdAtMs + TEN_MINUTES_MS - nowMs;
                  const expired = remainingMs != null && remainingMs <= 0;

                  return (
                    <tr key={row.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-medium text-slate-100">#{row.id}</td>
                      <td className="px-4 py-3">#{row.order_id}</td>
                      <td className="px-4 py-3">{row.ingredient_name || `Ingredient ${row.ingredient_id}`}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <p className={[
                            'font-semibold tabular-nums',
                            expired ? 'text-rose-300' : 'text-amber-300',
                          ].join(' ')}>
                            {formatCountdown(remainingMs)}
                          </p>
                          {expired && <p className="text-xs text-rose-300">Auto-approval in progress...</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={!!decisionLoadingKey || expired}
                            onClick={() => decideAdjustment(row.id, 'approve')}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Check size={13} />
                            {decisionLoadingKey === `${row.id}:approve` ? 'Approving...' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            disabled={!!decisionLoadingKey || expired}
                            onClick={() => decideAdjustment(row.id, 'reject')}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <XCircle size={13} />
                            {decisionLoadingKey === `${row.id}:reject` ? 'Rejecting...' : 'Reject'}
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

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-[0_18px_30px_-24px_rgba(99,102,241,0.55)]">
        <div className="border-b border-slate-800 px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-slate-100">Top Products</h2>
          <p className="mt-1 text-sm text-slate-400">Best-performing items by order quantity</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-950/90 text-slate-300">
              <tr>
                <th className="px-5 py-3 text-left font-semibold sm:px-6" aria-label="Product image" />
                <th className="px-5 py-3 text-left font-semibold sm:px-6">Product</th>
                <th className="px-5 py-3 text-right font-semibold sm:px-6">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {topProducts.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-slate-400 sm:px-6">
                    No order data yet
                  </td>
                </tr>
              ) : (
                topProducts.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-slate-800/50">
                    <td className="px-5 py-3 sm:px-6">
                      {p.img_path ? (
                        <img
                          src={productImageUrl(p.img_path)}
                          alt=""
                          className="h-10 w-10 rounded-lg border border-slate-700 object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="inline-flex h-10 w-10 rounded-lg border border-slate-700 bg-slate-800" aria-hidden />
                      )}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-200 sm:px-6">{p.name ?? p.id}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-100 sm:px-6">{p.total ?? 0}</td>
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
