import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../AuthContext";
import "./ModernAdmin.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function Stats() {
    const [stats, setStats] = useState(null);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const { getAuthHeaders } = useAuth();

    useEffect(() => {
        fetchStats();
        fetchProducts();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/admin/stats`, {
                headers: getAuthHeaders()
            });
            setStats(response.data);
        } catch (error) {
            console.error("Failed to fetch stats:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchProducts = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/admin/products`, {
                headers: getAuthHeaders()
            });
            setProducts(response.data);
        } catch (error) {
            console.error("Failed to fetch products:", error);
        }
    };

    const deleteEvent = async (eventId) => {
        if (!window.confirm('Ջնջե՞լ այս իրադարձությունը')) return;
        try {
            await axios.delete(`${API_URL}/api/admin/events/${eventId}`, {
                headers: getAuthHeaders()
            });
            fetchStats();
        } catch (error) {
            console.error("Failed to delete event:", error);
            alert('Չհաջողվեց ջնջել');
        }
    };

    const deleteOrder = async (orderId) => {
        if (!window.confirm('Ջնջե՞լ այս պատվերը')) return;
        try {
            await axios.delete(`${API_URL}/api/admin/orders/${orderId}`, {
                headers: getAuthHeaders()
            });
            fetchStats();
        } catch (error) {
            console.error("Failed to delete order:", error);
            alert('Չհաջողվեց ջնջել');
        }
    };

    const getProductName = (itemId) => {
        const product = products.find(p => p.item_id === itemId);
        return product ? product.name : `ID: ${itemId}`;
    };

    const getProductImage = (itemId) => {
        const product = products.find(p => p.item_id === itemId);
        return product?.image || null;
    };

    const normalizeImage = (img) => {
        if (!img) return null;
        const base = String(img).split('/').pop();
        if (!base) return null;
        const lower = base.toLowerCase();
        if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp')) {
            return base;
        }
        return `${base}.png`;
    };

    const actionLabelAm = (action) => {
        const a = String(action || '').toUpperCase();
        if (a === 'CHECKOUT') return 'Պատվերի հաստատում';
        if (a === 'ADD_TO_CART') return 'Ավելացվել է զամբյուղ';
        if (a === 'REMOVE_FROM_CART') return 'Հեռացվել է զամբյուղից';
        return action;
    };

    if (loading) {
        return <div className="loading">Բեռնում...</div>;
    }

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('hy-AM');
    };

    return (
        <div className="admin-page">
            <div className="page-header">
                <h1>Վիճակագրություն</h1>
            </div>

            <div className="stats-section" style={{marginBottom: '30px'}}>
                <h2 style={{fontSize: '18px', marginBottom: '15px'}}>Իրադարձություններ ({stats?.events?.length || 0})</h2>
                <p style={{fontSize: '13px', color: '#6b7280', marginBottom: '15px'}}>Օգտատերերի բոլոր գործողությունները (ավելացում զամբյուղ, պատվեր և այլն)</p>
                <div className="table-container" style={{maxHeight: '400px', overflowY: 'auto'}}>
                    <table>
                        <thead>
                            <tr>
                                <th style={{fontSize: '11px'}}>ID</th>
                                <th style={{fontSize: '11px'}}>Օգտատեր</th>
                                <th style={{fontSize: '11px'}}>Գործողություն</th>
                                <th style={{fontSize: '11px'}}>Ապրանքներ</th>
                                <th style={{fontSize: '11px'}}>Ամսաթիվ</th>
                                <th style={{fontSize: '11px'}}>Ջնջել ապրանքը</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats?.events?.slice().reverse().map(event => (
                                <tr key={event.id}>
                                    <td style={{fontSize: '12px'}}>{event.id}</td>
                                    <td style={{fontSize: '12px'}}>{event.user_id}</td>
                                    <td>
                                        <span className={`badge ${event.action.toLowerCase()}`} style={{fontSize: '10px'}}>
                                            {actionLabelAm(event.action)}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                            {event.items?.map((item, idx) => (
                                                <div key={idx} style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                                    <img 
                                                        src={`/new_menu/${normalizeImage(getProductImage(item.id)) || `${item.id}.png`}`} 
                                                        alt=""
                                                        style={{width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px'}}
                                                        onError={(e) => {
                                                            if (e.currentTarget.dataset.fallback === '1') {
                                                                e.currentTarget.style.display = 'none';
                                                                return;
                                                            }
                                                            e.currentTarget.dataset.fallback = '1';
                                                            e.currentTarget.src = `/new_menu/${item.id}.png`;
                                                        }}
                                                    />
                                                    <span style={{fontSize: '12px'}}>
                                                        {getProductName(item.id)} <strong>x{item.count}</strong>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td style={{fontSize: '12px'}}>{formatDate(event.created_at)}</td>
                                    <td>
                                        <button 
                                            onClick={() => deleteEvent(event.id)}
                                            style={{
                                                padding: '4px 8px',
                                                background: '#ef4444',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '11px'
                                            }}
                                        >
                                            Ջնջել
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="stats-section">
                <h2 style={{fontSize: '18px', marginBottom: '15px'}}>Պատվերներ ({stats?.orders?.length || 0})</h2>
                <p style={{fontSize: '13px', color: '#6b7280', marginBottom: '15px'}}>Հաստատված պատվերներ որոնք պետք է պատրաստվեն</p>
                <div className="table-container" style={{maxHeight: '400px', overflowY: 'auto'}}>
                    <table>
                        <thead>
                            <tr>
                                <th style={{fontSize: '11px'}}>ID</th>
                                <th style={{fontSize: '11px'}}>Օգտատեր</th>
                                <th style={{fontSize: '11px'}}>Ապրանքներ</th>
                                <th style={{fontSize: '11px'}}>Ընդհանուր</th>
                                <th style={{fontSize: '11px'}}>Կարգավիճակ</th>
                                <th style={{fontSize: '11px'}}>Ամսաթիվ</th>
                                <th style={{fontSize: '11px'}}>Ջնջել ապրանքը</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats?.orders?.slice().reverse().map(order => (
                                <tr key={order.id}>
                                    <td style={{fontSize: '12px'}}>{order.id}</td>
                                    <td style={{fontSize: '12px'}}>{order.user_id}</td>
                                    <td>
                                        <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                            {order.items?.map((item, idx) => (
                                                <div key={idx} style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                                    <img 
                                                        src={`/new_menu/${normalizeImage(getProductImage(item.id)) || `${item.id}.png`}`} 
                                                        alt=""
                                                        style={{width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px'}}
                                                        onError={(e) => {
                                                            if (e.currentTarget.dataset.fallback === '1') {
                                                                e.currentTarget.style.display = 'none';
                                                                return;
                                                            }
                                                            e.currentTarget.dataset.fallback = '1';
                                                            e.currentTarget.src = `/new_menu/${item.id}.png`;
                                                        }}
                                                    />
                                                    <span style={{fontSize: '12px'}}>
                                                        {getProductName(item.id)} <strong>x{item.count}</strong>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td style={{fontSize: '13px', fontWeight: '600', color: '#10b981'}}>{order.total} ֏</td>
                                    <td>
                                        <span className={`badge ${order.status}`} style={{fontSize: '10px'}}>
                                            {order.status === 'pending' ? 'Ընթացքում' : order.status === 'completed' ? 'Կատարված' : order.status}
                                        </span>
                                    </td>
                                    <td style={{fontSize: '12px'}}>{formatDate(order.created_at)}</td>
                                    <td>
                                        <button 
                                            onClick={() => deleteOrder(order.id)}
                                            style={{
                                                padding: '4px 8px',
                                                background: '#ef4444',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '11px'
                                            }}
                                        >
                                            Ջնջել
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
