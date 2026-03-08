import { useState, useEffect } from "react";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";

export default function OrderHistoryPanel({ show, onClose }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setError("");
    setLoading(true);
    const token = localStorage.getItem("customer_token");
    if (!token) {
      setList([]);
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/api/my-orders`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((res) => {
        if (res.status === 401) {
          localStorage.removeItem("customer_token");
          return [];
        }
        return res.ok ? res.json() : Promise.reject(new Error(res.statusText));
      })
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((e) => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [show]);

  if (!show) return null;

  return (
    <div className="order-history-overlay" onClick={onClose}>
      <div className="order-history-panel" onClick={(e) => e.stopPropagation()}>
        <div className="order-history-header">
          <h3>Orders history</h3>
          <button type="button" className="order-history-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="order-history-body">
          {loading && <p className="order-history-loading">Loading…</p>}
          {error && <p className="order-history-error">{error}</p>}
          {!loading && !error && list.length === 0 && (
            <p className="order-history-empty">No orders yet.</p>
          )}
          {!loading && !error && list.length > 0 && (
            <ul className="order-history-list">
              {list.map(({ order, items }) => (
                <li key={order.id} className="order-history-item">
                  <div className="order-history-item-head">
                    <span className="order-history-id">#{order.id}</span>
                    <span className="order-history-status">{order.status}</span>
                    <span className="order-history-price">{order.price} AMD</span>
                    <span className="order-history-date">{order.created_at?.slice(0, 10)}</span>
                  </div>
                  <ul className="order-history-items">
                    {items?.map((it) => (
                      <li key={it.id}>
                        {it.product_name || `Item #${it.product_id}`} × {it.count}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
