import { useState, useEffect, useMemo } from 'react';
import { ArrowUpDown, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { api, uploadFile, productImageUrl } from '../api';

const CURRENCY = 'AMD';
const ACCESS_LEVELS = ['user', 'vip_user', 'admin', 'superadmin'];
const INPUT_CLASS = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40';
const LABEL_CLASS = 'mb-1.5 block text-sm font-medium text-slate-300';

function emptyProductForm() {
  return {
    item_id: '',
    price: 0,
    img_path: '',
    type: 'main_course',
    type_name: 'Main',
    availability: 1,
    access_level: '',
    name_en: '',
    name_am: '',
    name_ru: '',
    description_en: '',
    description_am: '',
    description_ru: '',
    short_description_en: '',
    short_description_am: '',
    short_description_ru: '',
    composition_input: '',
  };
}

function compositionToInput(composition) {
  if (!composition) return '';
  if (Array.isArray(composition)) return composition.join('\n');
  if (typeof composition === 'string') {
    try {
      const parsed = JSON.parse(composition);
      if (Array.isArray(parsed)) return parsed.join('\n');
    } catch (_) {
      return composition;
    }
    return composition;
  }
  return '';
}

function parseCompositionInput(value) {
  if (!value || !value.trim()) return [];
  return value
    .replace(/\r/g, '')
    .split(/\n|,/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeOptionalText(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
}

function buildProductPayload(form, isUpdate = false) {
  const composition = parseCompositionInput(form.composition_input);
  const itemIdValue = String(form.item_id ?? '').trim();
  const payload = {
    item_id: itemIdValue ? Number(itemIdValue) : undefined,
    price: Number(form.price ?? 0),
    img_path: String(form.img_path || '').trim() || 'new_menu/placeholder.png',
    type: String(form.type || '').trim(),
    type_name: String(form.type_name || '').trim(),
    availability: Number(form.availability ?? 1),
    access_level: form.access_level || undefined,
    name_en: normalizeOptionalText(form.name_en) ?? undefined,
    name_am: normalizeOptionalText(form.name_am) ?? undefined,
    name_ru: normalizeOptionalText(form.name_ru) ?? undefined,
    description_en: normalizeOptionalText(form.description_en) ?? undefined,
    description_am: normalizeOptionalText(form.description_am) ?? undefined,
    description_ru: normalizeOptionalText(form.description_ru) ?? undefined,
    short_description_en: normalizeOptionalText(form.short_description_en) ?? undefined,
    short_description_am: normalizeOptionalText(form.short_description_am) ?? undefined,
    short_description_ru: normalizeOptionalText(form.short_description_ru) ?? undefined,
    composition: composition.length ? composition : undefined,
  };

  if (!Number.isFinite(payload.price)) delete payload.price;
  if (!Number.isFinite(payload.availability)) delete payload.availability;

  if (isUpdate) {
    // PATCH payload: omit undefined keys to avoid schema rejections and accidental nulling.
    return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  }

  return {
    ...payload,
    item_id: payload.item_id ?? null,
    access_level: payload.access_level ?? null,
    name_en: payload.name_en ?? null,
    name_am: payload.name_am ?? null,
    name_ru: payload.name_ru ?? null,
    description_en: payload.description_en ?? null,
    description_am: payload.description_am ?? null,
    description_ru: payload.description_ru ?? null,
    short_description_en: payload.short_description_en ?? null,
    short_description_am: payload.short_description_am ?? null,
    short_description_ru: payload.short_description_ru ?? null,
    composition: payload.composition ?? [],
  };
}

function StockBadge({ availability }) {
  if (availability === 1) {
    return <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30">In stock</span>;
  }
  return <span className="inline-flex items-center rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-300 ring-1 ring-rose-500/30">Out of stock</span>;
}

export default function Products() {
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sortKey, setSortKey] = useState('id');
  const [sortDir, setSortDir] = useState('asc');
  const [searchQuery, setSearchQuery] = useState('');

  const load = () => api('/api/admin/products').then(setList).catch(e => setError(e.message));

  useEffect(() => { load(); }, []);

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.trim().toLowerCase();
    return list.filter((p) => {
      const title = (p.name_en || p.name_am || p.name_ru || '').toLowerCase();
      const sku = String(p.item_id ?? p.id ?? '');
      const cat = (p.type_name || '').toLowerCase();
      const access = (p.access_level || '').toLowerCase();
      return title.includes(q) || sku.includes(q) || cat.includes(q) || access.includes(q);
    });
  }, [list, searchQuery]);

  const sortedList = useMemo(() => {
    const arr = [...filteredList];
    arr.sort((a, b) => {
      let va, vb;
      if (sortKey === 'price') {
        va = Number(a.price);
        vb = Number(b.price);
      } else if (sortKey === 'title') {
        va = (a.name_en || a.name_am || a.name_ru || '').toLowerCase();
        vb = (b.name_en || b.name_am || b.name_ru || '').toLowerCase();
      } else if (sortKey === 'sku') {
        va = a.item_id != null ? a.item_id : a.id;
        vb = b.item_id != null ? b.item_id : b.id;
      } else if (sortKey === 'category') {
        va = (a.type_name || '').toLowerCase();
        vb = (b.type_name || '').toLowerCase();
      } else if (sortKey === 'access_level') {
        va = (a.access_level || '').toLowerCase();
        vb = (b.access_level || '').toLowerCase();
      } else {
        va = a[sortKey];
        vb = b[sortKey];
      }
      if (va === vb) return 0;
      const cmp = va < vb ? -1 : 1;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filteredList, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function Th({ id, label, sortable = true, className = '' }) {
    return (
      <th className={`px-6 py-4 text-left font-semibold ${className}`}>
        {sortable ? (
          <button
            type="button"
            onClick={() => toggleSort(id)}
            className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-slate-400 transition hover:text-slate-200"
          >
            {label}
            <ArrowUpDown size={13} className={sortKey === id ? 'text-indigo-300' : 'text-slate-500'} aria-hidden />
          </button>
        ) : (
          <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
        )}
      </th>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      if (form.id) {
        const payload = buildProductPayload(form, true);
        await api(`/api/admin/products/${form.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        const payload = buildProductPayload(form, false);
        await api('/api/admin/products', { method: 'POST', body: JSON.stringify(payload) });
      }
      setForm(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await uploadFile('/api/admin/products/upload-image', file);
      setForm(f => f ? { ...f, img_path: data.img_path } : null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this product?')) return;
    try {
      await api(`/api/admin/products/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function formatPrice(n) {
    return `${Number(n).toLocaleString()} ${CURRENCY}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Products</h2>
          <p className="mt-1 text-sm text-slate-400">Manage catalog, pricing, and visibility.</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
          onClick={() => setForm(emptyProductForm())}
        >
          <Plus size={16} />
          Add product
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
      )}

      {form && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur sm:items-center" onClick={() => setForm(null)}>
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">{form.id ? 'Edit product' : 'New product'}</h3>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-400 transition hover:text-slate-100"
                onClick={() => setForm(null)}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={LABEL_CLASS}>Item ID (optional)</label>
                  <input className={INPUT_CLASS} type="number" value={form.item_id ?? ''} onChange={(e) => setForm((f) => ({ ...f, item_id: e.target.value }))} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Price</label>
                  <input className={INPUT_CLASS} type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} required />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Category name</label>
                  <input className={INPUT_CLASS} value={form.type_name} onChange={(e) => setForm((f) => ({ ...f, type_name: e.target.value }))} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Type key</label>
                  <input className={INPUT_CLASS} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Availability</label>
                  <select className={INPUT_CLASS} value={form.availability} onChange={(e) => setForm((f) => ({ ...f, availability: Number(e.target.value) }))}>
                    <option value={1}>In stock</option>
                    <option value={0}>Out of stock</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Access level</label>
                  <select className={INPUT_CLASS} value={form.access_level ?? ''} onChange={(e) => setForm((f) => ({ ...f, access_level: e.target.value || null }))}>
                    <option value="">—</option>
                    {ACCESS_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className={LABEL_CLASS}>Title (English)</label>
                  <input className={INPUT_CLASS} value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Title (Armenian)</label>
                  <input className={INPUT_CLASS} value={form.name_am ?? ''} onChange={(e) => setForm((f) => ({ ...f, name_am: e.target.value }))} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Title (Russian)</label>
                  <input className={INPUT_CLASS} value={form.name_ru ?? ''} onChange={(e) => setForm((f) => ({ ...f, name_ru: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className={LABEL_CLASS}>Short description (English)</label>
                  <input className={INPUT_CLASS} value={form.short_description_en ?? ''} onChange={(e) => setForm((f) => ({ ...f, short_description_en: e.target.value }))} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Short description (Armenian)</label>
                  <input className={INPUT_CLASS} value={form.short_description_am ?? ''} onChange={(e) => setForm((f) => ({ ...f, short_description_am: e.target.value }))} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Short description (Russian)</label>
                  <input className={INPUT_CLASS} value={form.short_description_ru ?? ''} onChange={(e) => setForm((f) => ({ ...f, short_description_ru: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className={LABEL_CLASS}>Description (English)</label>
                  <textarea className={INPUT_CLASS} rows={4} value={form.description_en ?? ''} onChange={(e) => setForm((f) => ({ ...f, description_en: e.target.value }))} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Description (Armenian)</label>
                  <textarea className={INPUT_CLASS} rows={4} value={form.description_am ?? ''} onChange={(e) => setForm((f) => ({ ...f, description_am: e.target.value }))} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Description (Russian)</label>
                  <textarea className={INPUT_CLASS} rows={4} value={form.description_ru ?? ''} onChange={(e) => setForm((f) => ({ ...f, description_ru: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className={LABEL_CLASS}>Ingredients / Composition (one per line or comma separated)</label>
                <textarea className={INPUT_CLASS} rows={4} value={form.composition_input ?? ''} onChange={(e) => setForm((f) => ({ ...f, composition_input: e.target.value }))} />
              </div>

              <div>
                <label className={LABEL_CLASS}>Image path</label>
                <input className={INPUT_CLASS} value={form.img_path} onChange={(e) => setForm((f) => ({ ...f, img_path: e.target.value }))} />
              </div>

              <div className="space-y-3">
                <label className={LABEL_CLASS}>Upload image</label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800">
                  <Upload size={15} />
                  Choose file
                  <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                </label>
                {form.img_path && (
                  <img
                    src={productImageUrl(form.img_path)}
                    alt="Preview"
                    className="max-h-48 max-w-sm rounded-xl border border-slate-700 object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : form.id ? 'Update product' : 'Create product'}
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
          </div>
        </div>
      )}

      <div className="relative max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          placeholder="Search by title, SKU, category, access level"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-10 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-200">
            <thead className="bg-slate-950/90">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Image</th>
                <Th id="sku" label="SKU" />
                <Th id="title" label="Title" />
                <Th id="category" label="Category" />
                <Th id="price" label="Price" className="text-right" />
                <Th id="access_level" label="Access level" />
                <Th id="stock" label="Stock" sortable={false} />
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sortedList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400">No products found.</td>
                </tr>
              ) : (
                sortedList.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer transition-colors duration-200 hover:bg-slate-800/50"
                    onClick={() => setForm({ ...emptyProductForm(), ...p, composition_input: compositionToInput(p.composition) })}
                  >
                    <td className="px-6 py-4">
                      <img
                        src={productImageUrl(p.img_path)}
                        alt={p.name_en || 'Product'}
                        className="h-12 w-12 rounded-md border border-slate-700 object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{p.item_id != null ? String(p.item_id) : `#${p.id}`}</td>
                    <td className="px-6 py-4 font-medium text-slate-100">{p.name_en || p.name_am || p.name_ru || '—'}</td>
                    <td className="px-6 py-4 text-slate-300">{p.type_name || '—'}</td>
                    <td className="px-6 py-4 text-right font-semibold tabular-nums text-slate-100">{formatPrice(p.price)}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{p.access_level || '—'}</td>
                    <td className="px-6 py-4"><StockBadge availability={p.availability} /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          title="Edit product"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-indigo-500/60 hover:text-indigo-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            setForm({ ...emptyProductForm(), ...p, composition_input: compositionToInput(p.composition) });
                          }}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          title="Delete product"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-red-500/60 hover:text-red-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(p.id);
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
