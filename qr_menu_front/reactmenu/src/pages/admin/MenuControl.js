import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../AuthContext";
import "./ModernAdmin.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function MenuControl() {
    const [products, setProducts] = useState([]);
    const [menuIds, setMenuIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const { getAuthHeaders } = useAuth();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [productsRes, menuRes] = await Promise.all([
                axios.get(`${API_URL}/api/admin/products`, { headers: getAuthHeaders() }),
                axios.get(`${API_URL}/api/admin/menu`, { headers: getAuthHeaders() })
            ]);
            
            setProducts(productsRes.data);
            setMenuIds(menuRes.data.menu_ids || []);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddToMenu = async (productId) => {
        try {
            await axios.post(
                `${API_URL}/api/admin/menu/${productId}`,
                {},
                { headers: getAuthHeaders() }
            );
            fetchData();
        } catch (error) {
            console.error("Failed to add to menu:", error);
            alert("Չհաջողվեց ավելացնել մենյուին");
        }
    };

    const handleRemoveFromMenu = async (productId) => {
        try {
            await axios.delete(
                `${API_URL}/api/admin/menu/${productId}`,
                { headers: getAuthHeaders() }
            );
            fetchData();
        } catch (error) {
            console.error("Failed to remove from menu:", error);
            alert("Չհաջողվեց հեռացնել մենյուից");
        }
    };

    if (loading) {
        return <div className="loading">Բեռնում...</div>;
    }

    const menuProducts = products.filter(p => menuIds.includes(p.item_id));
    const availableProducts = products.filter(p => !menuIds.includes(p.item_id));

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
            <div className="page-header">
                <h1>Գլոբալ մենյուի կառավարում</h1>
            </div>
            
            <div className="menu-section" style={{marginBottom: '30px'}}>
                <h2 style={{fontSize: '18px', marginBottom: '15px'}}>Ակտիվ մենյու ({menuProducts.length})</h2>
                <p style={{fontSize: '13px', color: '#6b7280', marginBottom: '15px'}}>Այս ապրանքները ցուցադրվում են բոլոր օգտատերերի համար</p>
                <div className="products-grid">
                    {menuProducts.map(product => (
                        <div key={product.item_id} className="product-card" style={{border: '2px solid #10b981'}}>
                            <img
                                src={`/new_menu/${normalizeImage(product.image) || `${product.item_id}.png`}`}
                                alt={product.name}
                                onError={(e) => {
                                    if (e.currentTarget.dataset.fallback === '1') {
                                        e.currentTarget.style.display = 'none';
                                        return;
                                    }
                                    e.currentTarget.dataset.fallback = '1';
                                    e.currentTarget.src = `/new_menu/${product.item_id}.png`;
                                }}
                            />
                            <div className="product-card-content">
                                <h3>{product.name}</h3>
                                <p className="product-desc">{product.short_description}</p>
                                <p className="product-price">{product.price} ֏</p>
                                <button 
                                    onClick={() => handleRemoveFromMenu(product.item_id)} 
                                    className="btn-danger"
                                    style={{width: '100%'}}
                                >
                                    Հեռացնել մենյուից
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="menu-section">
                <h2 style={{fontSize: '18px', marginBottom: '15px'}}>Հասանելի ապրանքներ ({availableProducts.length})</h2>
                <p style={{fontSize: '13px', color: '#6b7280', marginBottom: '15px'}}>Ընտրեք ապրանքները որոնք ցանկանում եք ավելացնել մենյուին</p>
                <div className="products-grid">
                    {availableProducts.map(product => (
                        <div key={product.item_id} className="product-card">
                            <img
                                src={`/new_menu/${normalizeImage(product.image) || `${product.item_id}.png`}`}
                                alt={product.name}
                                onError={(e) => {
                                    if (e.currentTarget.dataset.fallback === '1') {
                                        e.currentTarget.style.display = 'none';
                                        return;
                                    }
                                    e.currentTarget.dataset.fallback = '1';
                                    e.currentTarget.src = `/new_menu/${product.item_id}.png`;
                                }}
                            />
                            <div className="product-card-content">
                                <h3>{product.name}</h3>
                                <p className="product-desc">{product.short_description}</p>
                                <p className="product-price">{product.price} ֏</p>
                                <button 
                                    onClick={() => handleAddToMenu(product.item_id)} 
                                    className="btn-primary"
                                    style={{width: '100%'}}
                                >
                                    Ավելացնել մենյուին
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
