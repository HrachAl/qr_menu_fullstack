import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { api, getMe } from '../api';

const CATEGORIES = [
  'Meat',
  'Produce',
  'Beverages',
  'Alcohol',
  'Sweets/Bakery',
  'Dairy',
  'Dry Goods',
];

const STOCK_OUT_REASONS = ['Used in kitchen', 'Expired/Spoiled', 'Staff meal'];

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40';
const LABEL_CLASS = 'mb-1.5 block text-sm font-medium text-slate-300';

function emptyForm() {
  return {
    name: '',
    category: CATEGORIES[0],
    quantity: '',
    unit: 'kg',
    low_stock_threshold: '',
  };
}

function formatQuantity(value) {
  const num = Number(value || 0);
  if (Number.isInteger(num)) return String(num);
  return num.toFixed(2).replace(/\.00$/, '');
}

function sortInventory(items, sortKey) {
  const arr = [...items];
  if (sortKey === 'lowest_stock') {
    arr.sort((a, b) => Number(a.quantity) - Number(b.quantity));
    return arr;
  }
  if (sortKey === 'category') {
    arr.sort((a, b) => {
      const c = String(a.category || '').localeCompare(String(b.category || ''));
      if (c !== 0) return c;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return arr;
  }
  arr.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  return arr;
}

export default function Inventory() {
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortKey, setSortKey] = useState('name');

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [adjustModal, setAdjustModal] = useState({
    open: false,
    item: null,
    action: 'add',
    amount: '',
    reason: 'Used in kitchen',
  });
  const [adjusting, setAdjusting] = useState(false);

  const [me, setMe] = useState(null);
  const isSuperadmin = me?.access_level === 'superadmin';

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [inventory, profile] = await Promise.all([
        api('/api/admin/inventory'),
        getMe(),
      ]);
      setList(Array.isArray(inventory) ? inventory : []);
      setMe(profile || null);
    } catch (err) {
      setError(err.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let next = list;

    if (categoryFilter !== 'all') {
      next = next.filter((item) => item.category === categoryFilter);
    }

    if (q) {
      next = next.filter((item) => {
        const name = String(item.name || '').toLowerCase();
        const category = String(item.category || '').toLowerCase();
        const unit = String(item.unit || '').toLowerCase();
        return name.includes(q) || category.includes(q) || unit.includes(q);
      });
    }

    return sortInventory(next, sortKey);
  }, [list, search, categoryFilter, sortKey]);

  async function handleCreateItem(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: String(addForm.name || '').trim(),
        category: addForm.category,
        quantity: Number(addForm.quantity || 0),
        unit: String(addForm.unit || '').trim(),
        low_stock_threshold: Number(addForm.low_stock_threshold || 0),
      };
      const created = await api('/api/admin/inventory', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setList((prev) => [...prev, created]);
      setShowAddModal(false);
      setAddForm(emptyForm());
    } catch (err) {
      setError(err.message || 'Failed to create item');
    } finally {
      setSaving(false);
    }
  }

  function openAdjust(item, action) {
    setAdjustModal({
      open: true,
      item,
      action,
      amount: '',
      reason: action === 'deduct' ? STOCK_OUT_REASONS[0] : 'Stock replenishment',
    });
  }

  async function handleAdjustStock(e) {
    e.preventDefault();
    if (!adjustModal.item) return;

    setAdjusting(true);
    setError('');
    try {
      const payload = {
        action: adjustModal.action,
        amount: Number(adjustModal.amount),
        reason: String(adjustModal.reason || '').trim(),
      };

      const updated = await api(`/api/admin/inventory/${adjustModal.item.id}/adjust`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setAdjustModal({ open: false, item: null, action: 'add', amount: '', reason: STOCK_OUT_REASONS[0] });
    } catch (err) {
      setError(err.message || 'Failed to adjust stock');
    } finally {
      setAdjusting(false);
    }
  }

  async function handleDeleteItem(itemId) {
    if (!confirm('Delete this inventory item?')) return;
    setError('');
    try {
      await api(`/api/admin/inventory/${itemId}`, { method: 'DELETE' });
      setList((prev) => prev.filter((item) => item.id !== itemId));
    } catch (err) {
      setError(err.message || 'Failed to delete item');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Inventory</h2>
          <p className="mt-1 text-sm text-slate-400">Warehouse stock control for the full restaurant ERP workflow.</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={16} />
          Add New Item
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="relative lg:col-span-5">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              placeholder="Search by name, category, unit"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          <div className="lg:col-span-3">
            <select
              className={INPUT_CLASS}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-4">
            <select
              className={INPUT_CLASS}
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
            >
              <option value="name">Sort: Name</option>
              <option value="lowest_stock">Sort: Lowest Stock</option>
              <option value="category">Sort: Category</option>
            </select>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-200">
            <thead className="bg-slate-950/90">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Category</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Quantity</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Unit</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Low Stock Threshold</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Last Updated</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400">Loading inventory...</td>
                </tr>
              ) : filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400">No inventory items found.</td>
                </tr>
              ) : (
                filteredAndSorted.map((item) => {
                  const isLow = Number(item.quantity) <= Number(item.low_stock_threshold);
                  return (
                    <tr key={item.id} className="transition-colors hover:bg-slate-800/50">
                      <td className="px-6 py-4 font-medium text-slate-100">{item.name}</td>
                      <td className="px-6 py-4 text-slate-300">{item.category}</td>
                      <td className="px-6 py-4">
                        <div className={[
                          'inline-flex items-center gap-2 rounded-lg px-2.5 py-1',
                          isLow ? 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30 font-semibold' : 'text-slate-100',
                        ].join(' ')}>
                          {isLow && <AlertTriangle size={14} />}
                          <span>{formatQuantity(item.quantity)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-300">{item.unit}</td>
                      <td className="px-6 py-4 text-slate-300">{formatQuantity(item.low_stock_threshold)}</td>
                      <td className="px-6 py-4 text-xs text-slate-400">{item.last_updated || '—'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            title="Stock In"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => openAdjust(item, 'add')}
                            disabled={!isSuperadmin}
                          >
                            <ArrowUp size={15} />
                          </button>
                          <button
                            type="button"
                            title="Stock Out"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15 text-amber-300 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => openAdjust(item, 'deduct')}
                            disabled={!isSuperadmin}
                          >
                            <ArrowDown size={15} />
                          </button>
                          <button
                            type="button"
                            title="Delete item"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-red-500/60 hover:text-red-300"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {!isSuperadmin && !loading && (
        <p className="text-xs text-slate-500">Only superadmin accounts can perform Stock In/Stock Out adjustments.</p>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur sm:items-center" onClick={() => setShowAddModal(false)}>
          <div
            className="w-full max-w-xl rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6 shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">Add Inventory Item</h3>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-400 transition hover:text-slate-100"
                onClick={() => setShowAddModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-4">
              <div>
                <label className={LABEL_CLASS}>Name</label>
                <input
                  className={INPUT_CLASS}
                  value={addForm.name}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL_CLASS}>Category</label>
                  <select
                    className={INPUT_CLASS}
                    value={addForm.category}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, category: e.target.value }))}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={LABEL_CLASS}>Unit</label>
                  <input
                    className={INPUT_CLASS}
                    value={addForm.unit}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, unit: e.target.value }))}
                    placeholder="kg, L, pcs, boxes"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL_CLASS}>Current Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={INPUT_CLASS}
                    value={addForm.quantity}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, quantity: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className={LABEL_CLASS}>Low Stock Threshold</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={INPUT_CLASS}
                    value={addForm.low_stock_threshold}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, low_stock_threshold: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Create Item'}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {adjustModal.open && adjustModal.item && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur sm:items-center" onClick={() => setAdjustModal({ open: false, item: null, action: 'add', amount: '', reason: STOCK_OUT_REASONS[0] })}>
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6 shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">
                {adjustModal.action === 'add' ? 'Stock In' : 'Stock Out'}: {adjustModal.item.name}
              </h3>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-400 transition hover:text-slate-100"
                onClick={() => setAdjustModal({ open: false, item: null, action: 'add', amount: '', reason: STOCK_OUT_REASONS[0] })}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAdjustStock} className="space-y-4">
              <div>
                <label className={LABEL_CLASS}>Amount ({adjustModal.item.unit})</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={INPUT_CLASS}
                  value={adjustModal.amount}
                  onChange={(e) => setAdjustModal((prev) => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>

              {adjustModal.action === 'deduct' ? (
                <div>
                  <label className={LABEL_CLASS}>Reason</label>
                  <select
                    className={INPUT_CLASS}
                    value={adjustModal.reason}
                    onChange={(e) => setAdjustModal((prev) => ({ ...prev, reason: e.target.value }))}
                  >
                    {STOCK_OUT_REASONS.map((reason) => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className={LABEL_CLASS}>Reason</label>
                  <input
                    className={INPUT_CLASS}
                    value={adjustModal.reason}
                    onChange={(e) => setAdjustModal((prev) => ({ ...prev, reason: e.target.value }))}
                    placeholder="Stock replenishment"
                    required
                  />
                </div>
              )}

              <div className="rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-300">
                Current stock: {formatQuantity(adjustModal.item.quantity)} {adjustModal.item.unit}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={adjusting}
                  className={[
                    'rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60',
                    adjustModal.action === 'add' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-600 hover:bg-amber-500',
                  ].join(' ')}
                >
                  {adjusting ? 'Applying...' : adjustModal.action === 'add' ? 'Apply Stock In' : 'Apply Stock Out'}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
                  onClick={() => setAdjustModal({ open: false, item: null, action: 'add', amount: '', reason: STOCK_OUT_REASONS[0] })}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
