import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Orders() {
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detail, setDetail] = useState(null);

  const load = () => {
    const q = statusFilter ? `?status=${statusFilter}` : '';
    api(`/api/admin/orders${q}`).then(setList).catch(e => setError(e.message));
  };

  useEffect(() => { load(); }, [statusFilter]);

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

  if (error) return <p className="error-msg">{error}</p>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Orders</h1>
        <div className="form-group" style={{ marginBottom: 0, maxWidth: 200 }}>
          <label>Status filter</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="created">created</option>
            <option value="confirmed">confirmed</option>
            <option value="completed">completed</option>
          </select>
        </div>
      </div>
      <div className="card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th className="num">Price</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map(o => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.user_id ?? 'Guest'}</td>
                <td className="num">{o.price}</td>
                <td>{o.status}</td>
                <td>{o.created_at}</td>
                <td>
                  <button type="button" className="btn" onClick={() => loadDetail(o.id)}>Detail</button>
                  <select value={o.status} onChange={e => updateStatus(o.id, e.target.value)} style={{ marginLeft: 8, padding: 6 }}>
                    <option value="created">created</option>
                    <option value="confirmed">confirmed</option>
                    <option value="completed">completed</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detail && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="page-header">
            <h2 style={{ margin: 0 }}>Order #{detail.order?.id}</h2>
            <button type="button" className="btn" onClick={() => setDetail(null)}>Close</button>
          </div>
          <p style={{ margin: '0 0 16px', color: '#64748b' }}>Status: {detail.order?.status} · Total: {detail.order?.price} AMD</p>
          <table className="admin-table">
            <thead>
              <tr><th>Product</th><th className="num">Qty</th><th className="num">Unit price</th></tr>
            </thead>
            <tbody>
              {(detail.items || []).map(i => (
                <tr key={i.id}><td>{i.product_name}</td><td className="num">{i.count}</td><td className="num">{i.unit_price}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
