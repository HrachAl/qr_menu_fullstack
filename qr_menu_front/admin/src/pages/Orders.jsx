import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Eye, Search } from 'lucide-react';
import { api } from '../api';

const STATUS_OPTIONS = ['created', 'confirmed', 'completed'];

function statusBadge(status) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1';
  const map = {
    completed: `${base} bg-emerald-500/15 text-emerald-300 ring-emerald-500/30`,
    created: `${base} bg-amber-500/15 text-amber-300 ring-amber-500/30`,
    confirmed: `${base} bg-sky-500/15 text-sky-300 ring-sky-500/30`,
  };
  return <span className={map[status] || `${base} bg-slate-700 text-slate-200 ring-slate-600`}>{status || 'unknown'}</span>;
}

function StyledSelect({ value, onChange, options, className = '', onClick }) {
  return (
    <div className={`relative ${className}`} onClick={onClick}>
      <select
        value={value}
        onChange={onChange}
        className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 pr-9 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
    </div>
  );
}

export default function Orders() {
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [detail, setDetail] = useState(null);

  const load = () => {
    const q = statusFilter ? `?status=${statusFilter}` : '';
    api(`/api/admin/orders${q}`).then(setList).catch(e => setError(e.message));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.trim().toLowerCase();
    return list.filter((o) => {
      const id = String(o.id ?? '');
      const userId = String(o.user_id ?? '');
      const status = (o.status || '').toLowerCase();
      return id.includes(q) || userId.includes(q) || status.includes(q);
    });
  }, [list, searchQuery]);

  async function loadDetail(id) {
    try {
      const data = await api(`/api/admin/orders/${id}`);
      setDetail(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateStatus(orderId, status) {
    try {
      await api(`/api/admin/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      load();
      if (detail?.order?.id === orderId) loadDetail(orderId);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Orders</h2>
          <p className="mt-1 text-sm text-slate-400">Track order flow and update statuses quickly.</p>
        </div>

        <div className="w-full sm:w-56">
          <label className="mb-1.5 block text-sm font-medium text-slate-300">Status filter</label>
          <StyledSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { label: 'All statuses', value: '' },
              ...STATUS_OPTIONS.map((status) => ({ label: status, value: status })),
            ]}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
      )}

      <div className="relative max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          placeholder="Search by order ID, user ID, status"
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
                <th className="px-6 py-4 text-left font-semibold">User</th>
                <th className="px-6 py-4 text-right font-semibold">Price</th>
                <th className="px-6 py-4 text-left font-semibold">Status</th>
                <th className="px-6 py-4 text-left font-semibold">Created</th>
                <th className="px-6 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400">No orders found.</td>
                </tr>
              ) : (
                filteredList.map((o) => (
                  <tr
                    key={o.id}
                    className="cursor-pointer transition-colors duration-200 hover:bg-slate-800/50"
                    onClick={() => loadDetail(o.id)}
                  >
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">#{o.id}</td>
                    <td className="px-6 py-4">{o.user_id ?? 'Guest'}</td>
                    <td className="px-6 py-4 text-right font-semibold tabular-nums text-slate-100">{Number(o.price || 0).toLocaleString()} AMD</td>
                    <td className="px-6 py-4">{statusBadge(o.status)}</td>
                    <td className="px-6 py-4 text-slate-300">{o.created_at}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          title="View order details"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-indigo-500/60 hover:text-indigo-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            loadDetail(o.id);
                          }}
                        >
                          <Eye size={15} />
                        </button>

                        <StyledSelect
                          value={o.status}
                          className="w-36"
                          options={STATUS_OPTIONS.map((status) => ({ label: status, value: status }))}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateStatus(o.id, e.target.value);
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {detail && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">Order #{detail.order?.id}</h3>
            <button
              type="button"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
              onClick={() => setDetail(null)}
            >
              Close
            </button>
          </div>

          <p className="mb-4 text-sm text-slate-400">
            <span className="mr-2">Status: {statusBadge(detail.order?.status)}</span>
            <span className="ml-2">Total: <strong className="font-semibold text-slate-200">{Number(detail.order?.price || 0).toLocaleString()} AMD</strong></span>
          </p>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full text-sm text-slate-200">
              <thead className="bg-slate-950/90 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Product</th>
                  <th className="px-6 py-4 text-right font-semibold">Qty</th>
                  <th className="px-6 py-4 text-right font-semibold">Unit price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(detail.items || []).map((i) => (
                  <tr key={i.id} className="transition-colors duration-200 hover:bg-slate-800/50">
                    <td className="px-6 py-4">{i.product_name}</td>
                    <td className="px-6 py-4 text-right tabular-nums">{i.count}</td>
                    <td className="px-6 py-4 text-right tabular-nums">{Number(i.unit_price || 0).toLocaleString()} AMD</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
