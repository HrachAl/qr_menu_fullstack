import { useState, useEffect } from 'react';
import { api, productImageUrl } from '../api';

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

  if (error) return <p className="error-msg">{error}</p>;
  if (loading) {
    return (
      <div>
        <h1 className="page-title">Dashboard</h1>
        <div className="stats-loading">Loading dashboard…</div>
      </div>
    );
  }
  const topProducts = Array.isArray(data?.top_products) ? data.top_products : [];

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="value">{data?.users_count ?? 0}</div>
          <div className="label">Users</div>
        </div>
        <div className="stat-card">
          <div className="value">{data?.products_count ?? 0}</div>
          <div className="label">Products</div>
        </div>
        <div className="stat-card">
          <div className="value">{data?.orders_count ?? 0}</div>
          <div className="label">Orders</div>
        </div>
        <div className="stat-card">
          <div className="value">{data?.orders_today ?? 0}</div>
          <div className="label">Orders today</div>
        </div>
      </div>
      <div className="card">
        <h2>Top products</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Product</th>
              <th className="num">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {topProducts.length === 0 ? (
              <tr><td colSpan={3} className="empty-cell">No order data yet</td></tr>
            ) : (
              topProducts.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.img_path ? (
                      <img src={productImageUrl(p.img_path)} alt="" className="img-thumb" onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : (
                      <span className="img-thumb img-thumb-placeholder" aria-hidden />
                    )}
                  </td>
                  <td>{p.name ?? p.id}</td>
                  <td className="num">{p.total ?? 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
