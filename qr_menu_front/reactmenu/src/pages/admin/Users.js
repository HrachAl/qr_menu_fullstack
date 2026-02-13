import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../AuthContext";
import "./ModernAdmin.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function Users() {
    const [users, setUsers] = useState([]);
    const [products, setProducts] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userMenu, setUserMenu] = useState([]);
    const [loading, setLoading] = useState(true);
    const { getAuthHeaders } = useAuth();

    useEffect(() => {
        fetchUsers();
        fetchProducts();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/admin/users`, {
                headers: getAuthHeaders()
            });
            setUsers(response.data);
        } catch (error) {
            console.error("Failed to fetch users:", error);
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

    const fetchUserMenu = async (userId) => {
        try {
            const response = await axios.get(`${API_URL}/api/admin/users/${userId}/menu`, {
                headers: getAuthHeaders()
            });
            setUserMenu(response.data.menu_ids);
            setSelectedUser(userId);
        } catch (error) {
            console.error("Failed to fetch user menu:", error);
        }
    };

    const addToUserMenu = async (userId, productId) => {
        try {
            await axios.post(`${API_URL}/api/admin/users/${userId}/menu/${productId}`, {}, {
                headers: getAuthHeaders()
            });
            fetchUserMenu(userId);
        } catch (error) {
            console.error("Failed to add product:", error);
        }
    };

    const removeFromUserMenu = async (userId, productId) => {
        try {
            await axios.delete(`${API_URL}/api/admin/users/${userId}/menu/${productId}`, {
                headers: getAuthHeaders()
            });
            fetchUserMenu(userId);
        } catch (error) {
            console.error("Failed to remove product:", error);
        }
    };

    const resetUserMenu = async (userId) => {
        if (window.confirm("Վերականգնե՞լ օգտատիրոջ մենյուն գլոբալ մենյուին")) {
            try {
                await axios.delete(`${API_URL}/api/admin/users/${userId}/menu`, {
                    headers: getAuthHeaders()
                });
                fetchUserMenu(userId);
                fetchUsers();
            } catch (error) {
                console.error("Failed to reset menu:", error);
            }
        }
    };

    if (loading) return <div className="loading">Բեռնում...</div>;

    const selectedUserData = users.find(u => u.id === selectedUser);

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

    return (
        <div className="admin-page">
            <h1>Օգտատերեր և նրանց մենյուներ</h1>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
                <div className="card">
                    <h2>Օգտատերեր ({users.length})</h2>
                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        {users.map(user => (
                            <div
                                key={user.id}
                                onClick={() => fetchUserMenu(user.id)}
                                style={{
                                    padding: '15px',
                                    margin: '10px 0',
                                    background: selectedUser === user.id ? '#667eea' : '#f5f5f5',
                                    color: selectedUser === user.id ? 'white' : '#333',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s'
                                }}
                            >
                                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                                    {user.username}
                                </div>
                                <div style={{ fontSize: '13px', marginTop: '5px', opacity: 0.8 }}>
                                    Ապրանքներ: {user.menu_count}
                                </div>
                                {user.has_custom_menu && (
                                    <div style={{ 
                                        fontSize: '12px', 
                                        marginTop: '5px',
                                        background: selectedUser === user.id ? 'rgba(255,255,255,0.2)' : '#667eea',
                                        color: selectedUser === user.id ? 'white' : 'white',
                                        padding: '3px 8px',
                                        borderRadius: '4px',
                                        display: 'inline-block'
                                    }}>
                                        Անհատական մենյու
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card">
                    {selectedUser ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2>Մենյու - {selectedUserData?.username}</h2>
                                <button 
                                    onClick={() => resetUserMenu(selectedUser)}
                                    className="btn-danger"
                                >
                                    Վերականգնել գլոբալ մենյուին
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                                {products.map(product => {
                                    const isInMenu = userMenu.includes(product.item_id);
                                    return (
                                        <div
                                            key={product.item_id}
                                            style={{
                                                border: isInMenu ? '2px solid #4caf50' : '2px solid #ddd',
                                                borderRadius: '8px',
                                                padding: '10px',
                                                background: isInMenu ? '#f1f8f4' : 'white'
                                            }}
                                        >
                                            <img
                                                src={`/new_menu/${normalizeImage(product.image) || `${product.item_id}.png`}`}
                                                alt={product.name}
                                                style={{
                                                    width: '100%',
                                                    height: '120px',
                                                    objectFit: 'cover',
                                                    borderRadius: '6px',
                                                    marginBottom: '10px'
                                                }}
                                                onError={(e) => {
                                                    if (e.currentTarget.dataset.fallback === '1') {
                                                        e.currentTarget.style.display = 'none';
                                                        return;
                                                    }
                                                    e.currentTarget.dataset.fallback = '1';
                                                    e.currentTarget.src = `/new_menu/${product.item_id}.png`;
                                                }}
                                            />
                                            <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>
                                                {product.name}
                                            </div>
                                            <div style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
                                                {product.price} ֏
                                            </div>
                                            {isInMenu ? (
                                                <button
                                                    onClick={() => removeFromUserMenu(selectedUser, product.item_id)}
                                                    className="btn-danger"
                                                    style={{ width: '100%', fontSize: '13px', padding: '8px' }}
                                                >
                                                    Հեռացնել
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => addToUserMenu(selectedUser, product.item_id)}
                                                    className="btn-primary"
                                                    style={{ width: '100%', fontSize: '13px', padding: '8px' }}
                                                >
                                                    Ավելացնել
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
                            Ընտրեք օգտատիրոջը՝ նրա մենյուն կառավարելու համար
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
