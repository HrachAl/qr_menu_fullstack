import { useState, useEffect } from 'react';
import { BarChart3, Clock3, Trophy, Users } from 'lucide-react';
import { api, productImageUrl } from '../api';

function userDisplay(u) {
  return u?.fullname || u?.email || 'Guest';
}

export default function Statistics() {
  const [topProducts, setTopProducts] = useState([]);
  const [topUsersCount, setTopUsersCount] = useState([]);
  const [topUsersPrice, setTopUsersPrice] = useState([]);
  const [hourly, setHourly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api('/api/admin/stats/top-products'),
      api('/api/admin/stats/top-users-by-count'),
      api('/api/admin/stats/top-users-by-price'),
      api('/api/admin/stats/hourly'),
    ])
      .then(([a, b, c, d]) => {
        setTopProducts(Array.isArray(a) ? a : []);
        setTopUsersCount(Array.isArray(b) ? b : []);
        setTopUsersPrice(Array.isArray(c) ? c : []);
        setHourly(Array.isArray(d) ? d : []);
      })
      .catch((e) => setError(e?.message || 'Failed to load statistics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-100">Statistics</h2>
        <div className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-slate-400">Loading statistics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">Statistics</h2>
        <p className="mt-1 text-sm text-slate-400">Operational insights across products, users, and order behavior.</p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <Trophy size={16} className="text-amber-300" />
          <h3 className="text-base font-semibold text-slate-100">Top 5 products by quantity</h3>
        </div>

        {topProducts.length === 0 ? (
          <p className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-6 text-center text-sm text-slate-400">No order data yet.</p>
        ) : (
          <ul className="space-y-2">
            {topProducts.map((p, index) => (
              <li key={p.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 transition hover:bg-slate-800/60">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-xs font-semibold text-indigo-300 ring-1 ring-indigo-500/30">
                    {index + 1}
                  </span>
                  {p.img_path ? (
                    <img
                      src={productImageUrl(p.img_path)}
                      alt={p.name || 'Product'}
                      className="h-12 w-12 rounded-md border border-slate-700 object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <span className="h-12 w-12 rounded-md border border-slate-700 bg-slate-800" aria-hidden />
                  )}
                  <p className="truncate font-medium text-slate-100">{p.name ?? p.id}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-slate-200">{p.total ?? 0}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2 border-b border-slate-800 px-6 py-4">
            <Users size={16} className="text-cyan-300" />
            <h3 className="text-base font-semibold text-slate-100">Top users by order count</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-200">
              <thead className="bg-slate-950/90 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">User</th>
                  <th className="px-6 py-4 text-right font-semibold">Orders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {topUsersCount.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-8 text-center text-slate-400">No user orders yet.</td>
                  </tr>
                ) : (
                  topUsersCount.map((u) => (
                    <tr key={u.id} className="transition-colors hover:bg-slate-800/50">
                      <td className="px-6 py-4">{userDisplay(u)}</td>
                      <td className="px-6 py-4 text-right font-semibold tabular-nums">{u.order_count ?? 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2 border-b border-slate-800 px-6 py-4">
            <BarChart3 size={16} className="text-indigo-300" />
            <h3 className="text-base font-semibold text-slate-100">Top users by total spend</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-200">
              <thead className="bg-slate-950/90 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">User</th>
                  <th className="px-6 py-4 text-right font-semibold">Total price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {topUsersPrice.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-8 text-center text-slate-400">No user orders yet.</td>
                  </tr>
                ) : (
                  topUsersPrice.map((u) => (
                    <tr key={u.id} className="transition-colors hover:bg-slate-800/50">
                      <td className="px-6 py-4">{userDisplay(u)}</td>
                      <td className="px-6 py-4 text-right font-semibold tabular-nums">{u.total_price != null ? Number(u.total_price).toLocaleString() : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
        <div className="flex items-center gap-2 border-b border-slate-800 px-6 py-4">
          <Clock3 size={16} className="text-emerald-300" />
          <h3 className="text-base font-semibold text-slate-100">Orders by hour</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-200">
            <thead className="bg-slate-950/90 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">Hour</th>
                <th className="px-6 py-4 text-right font-semibold">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {hourly.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-6 py-8 text-center text-slate-400">No orders in selected period.</td>
                </tr>
              ) : (
                [...hourly]
                  .sort((a, b) => Number(a.hour) - Number(b.hour))
                  .map((h) => (
                    <tr key={h.hour} className="transition-colors hover:bg-slate-800/50">
                      <td className="px-6 py-4">{String(h.hour).padStart(2, '0')}:00</td>
                      <td className="px-6 py-4 text-right font-semibold tabular-nums">{h.count ?? 0}</td>
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
