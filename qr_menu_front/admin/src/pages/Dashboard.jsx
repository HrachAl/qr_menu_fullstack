import { useState, useEffect } from 'react';
import { ArrowUpRight, Box, ShoppingCart, UsersRound, PackageCheck } from 'lucide-react';
import { api, productImageUrl } from '../api';

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

  useEffect(() => {
    setLoading(true);
    setError('');
    api('/api/admin/stats/dashboard')
      .then((d) => setData(d != null ? d : {}))
      .catch((e) => setError(e?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

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
