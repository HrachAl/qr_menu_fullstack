import { useState, useEffect } from 'react';
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

  if (error) return <p className="error-msg">{error}</p>;
  if (loading) {
    return (
      <div>
        <h1 className="page-title">Statistics</h1>
        <div className="stats-loading">Loading statistics…</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Statistics</h1>
      <div className="card">
        <h2>Top 5 products by quantity ordered</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Product</th>
              <th className="num">Total</th>
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
      <div className="card">
        <h2>Top 5 users by order count</h2>
        <table className="admin-table">
          <thead>
            <tr><th>User</th><th className="num">Orders</th></tr>
          </thead>
          <tbody>
            {topUsersCount.length === 0 ? (
              <tr><td colSpan={2} className="empty-cell">No user orders yet</td></tr>
            ) : (
              topUsersCount.map((u) => (
                <tr key={u.id}>
                  <td>{userDisplay(u)}</td>
                  <td className="num">{u.order_count ?? 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>Top 5 users by total order price</h2>
        <table className="admin-table">
          <thead>
            <tr><th>User</th><th className="num">Total price</th></tr>
          </thead>
          <tbody>
            {topUsersPrice.length === 0 ? (
              <tr><td colSpan={2} className="empty-cell">No user orders yet</td></tr>
            ) : (
              topUsersPrice.map((u) => (
                <tr key={u.id}>
                  <td>{userDisplay(u)}</td>
                  <td className="num">{u.total_price != null ? Number(u.total_price).toLocaleString() : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>Orders by hour</h2>
        <table className="admin-table">
          <thead>
            <tr><th>Hour</th><th className="num">Count</th></tr>
          </thead>
          <tbody>
            {hourly.length === 0 ? (
              <tr><td colSpan={2} className="empty-cell">No orders in selected period</td></tr>
            ) : (
              [...hourly]
                .sort((a, b) => Number(a.hour) - Number(b.hour))
                .map((h) => (
                  <tr key={h.hour}>
                    <td>{String(h.hour).padStart(2, '0')}:00</td>
                    <td className="num">{h.count ?? 0}</td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
