import { useState, useEffect, useMemo } from 'react';
import { api, uploadFile, productImageUrl } from '../api';

const CURRENCY = 'AMD';
const ACCESS_LEVELS = ['user', 'vip_user', 'admin', 'superadmin'];

function StockBadge({ availability }) {
  if (availability === 1) {
    return <span className="badge badge-stock-in">In stock</span>;
  }
  return <span className="badge badge-stock-out">Out of stock</span>;
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
      <th className={className}>
        {sortable ? (
          <button
            type="button"
            onClick={() => toggleSort(id)}
            style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
          >
            {label}
            <span className="th-sort" aria-hidden>{sortKey === id ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
          </button>
        ) : (
          label
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
        await api(`/api/admin/products/${form.id}`, { method: 'PATCH', body: JSON.stringify({
          price: form.price, img_path: form.img_path, type: form.type, type_name: form.type_name,
          availability: form.availability ?? 1, access_level: form.access_level || null, name_en: form.name_en, name_am: form.name_am, name_ru: form.name_ru,
        }) });
      } else {
        await api('/api/admin/products', { method: 'POST', body: JSON.stringify({
          price: Number(form.price), img_path: form.img_path || 'new_menu/placeholder.png', type: form.type, type_name: form.type_name,
          availability: form.availability ?? 1, access_level: form.access_level || null, name_en: form.name_en, name_am: form.name_am, name_ru: form.name_ru,
        }) });
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

  if (error) return <p className="error-msg">{error}</p>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Products</h1>
        <button type="button" className="btn btn-primary" onClick={() => setForm({ price: 0, img_path: '', type: 'main_course', type_name: 'Main', availability: 1, access_level: '', name_en: '', name_am: '', name_ru: '' })}>
          Add product
        </button>
      </div>

      {form && (
        <div className="product-modal-overlay" onClick={() => setForm(null)}>
          <div className="product-modal-content card" onClick={e => e.stopPropagation()}>
            <h2>{form.id ? 'Edit product' : 'New product'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                <div className="form-group">
                  <label>Title (name EN)</label>
                  <input value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Price</label>
                  <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>Category (type name)</label>
                  <input value={form.type_name} onChange={e => setForm(f => ({ ...f, type_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Type key</label>
                  <input value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Availability</label>
                  <select value={form.availability} onChange={e => setForm(f => ({ ...f, availability: Number(e.target.value) }))}>
                    <option value={1}>In stock</option>
                    <option value={0}>Out of stock</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Access level</label>
                  <select value={form.access_level ?? ''} onChange={e => setForm(f => ({ ...f, access_level: e.target.value || null }))}>
                    <option value="">—</option>
                    {ACCESS_LEVELS.map(lvl => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Image path</label>
                <input value={form.img_path} onChange={e => setForm(f => ({ ...f, img_path: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Upload image</label>
                <input type="file" accept="image/*" onChange={handleUpload} />
                {form.img_path && (
                  <img src={productImageUrl(form.img_path)} alt="" className="img-thumb-lg" style={{ marginTop: 8 }} onError={e => { e.target.style.display = 'none'; }} />
                )}
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>{form.id ? 'Update' : 'Create'}</button>
                <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="search-bar">
        <input
          type="search"
          placeholder="Search by title, SKU, category, access level…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="card products-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 56 }}>IMAGE</th>
              <Th id="sku" label="SKU" />
              <Th id="title" label="TITLE" />
              <Th id="category" label="CATEGORY" />
              <Th id="price" label="PRICE" className="num" />
              <Th id="access_level" label="ACCESS LEVEL" />
              <Th id="stock" label="STOCK" sortable={false} />
              <th style={{ width: 140 }}></th>
            </tr>
          </thead>
          <tbody>
            {sortedList.map(p => (
              <tr key={p.id}>
                <td>
                  <img src={productImageUrl(p.img_path)} alt="" className="img-thumb" onError={e => { e.target.style.display = 'none'; }} />
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.item_id != null ? String(p.item_id) : `#${p.id}`}</td>
                <td>{p.name_en || p.name_am || p.name_ru || '—'}</td>
                <td>{p.type_name || '—'}</td>
                <td className="num">{formatPrice(p.price)}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.access_level || '—'}</td>
                <td><StockBadge availability={p.availability} /></td>
                <td>
                  <div className="cell-actions">
                    <button type="button" className="btn" onClick={() => setForm({ ...p })}>Edit</button>
                    <button type="button" className="btn btn-danger" onClick={() => handleDelete(p.id)}>Delete</button>
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
