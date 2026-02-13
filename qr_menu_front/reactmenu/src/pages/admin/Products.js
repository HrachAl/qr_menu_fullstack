import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../AuthContext";
import "./ModernAdmin.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function Products() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const { getAuthHeaders } = useAuth();

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        short_description: "",
        price: "",
        composition: "",
        type: "",
        type_name: "",
        image: ""
    });

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/admin/products`, {
                headers: getAuthHeaders()
            });
            setProducts(response.data);
        } catch (error) {
            console.error("Failed to fetch products:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const productData = {
            ...formData,
            composition: formData.composition.split(",").map(item => item.trim())
        };

        try {
            if (editingProduct) {
                await axios.put(
                    `${API_URL}/api/admin/products/${editingProduct.item_id}`,
                    productData,
                    { headers: getAuthHeaders() }
                );
            } else {
                await axios.post(
                    `${API_URL}/api/admin/products`,
                    productData,
                    { headers: getAuthHeaders() }
                );
            }
            
            setShowModal(false);
            setEditingProduct(null);
            resetForm();
            fetchProducts();
        } catch (error) {
            console.error("Failed to save product:", error);
            alert("Սխալ: " + (error.response?.data?.detail || "Չհաջողվեց պահպանել"));
        }
    };

    const handleDelete = async (productId) => {
        if (!window.confirm("Վստա՞հ եք, որ ցանկանում եք ջնջել այս ապրանքը:")) {
            return;
        }

        try {
            await axios.delete(`${API_URL}/api/admin/products/${productId}`, {
                headers: getAuthHeaders()
            });
            fetchProducts();
        } catch (error) {
            console.error("Failed to delete product:", error);
            alert("Չհաջողվեց ջնջել ապրանքը");
        }
    };

    const handleEdit = (product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            description: product.description,
            short_description: product.short_description,
            price: product.price,
            composition: product.composition.join(", "),
            type: product.type,
            type_name: product.type_name,
            image: product.image
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setFormData({
            name: "",
            description: "",
            short_description: "",
            price: "",
            composition: "",
            type: "",
            type_name: "",
            image: ""
        });
    };

    if (loading) {
        return <div className="loading">Բեռնում...</div>;
    }

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
                <h1>Ապրանքներ</h1>
                <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary">
                    + Ավելացնել ապրանք
                </button>
            </div>

            <div className="products-grid">
                {products.map(product => (
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
                            <p className="product-type">Տեսակ: {product.type_name}</p>
                            <div className="product-actions">
                                <button onClick={() => handleEdit(product)} className="btn-edit">
                                    Խմբագրել
                                </button>
                                <button onClick={() => handleDelete(product.item_id)} className="btn-delete">
                                    Ջնջել
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingProduct(null); }}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>{editingProduct ? "Խմբագրել ապրանքը" : "Նոր ապրանք"}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Անուն (հայերեն)</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Նկարագրություն</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Կարճ նկարագրություն</label>
                                <input
                                    type="text"
                                    value={formData.short_description}
                                    onChange={(e) => setFormData({...formData, short_description: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Գին</label>
                                <input
                                    type="text"
                                    value={formData.price}
                                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Բաղադրություն (ստորակետով առանձնացված)</label>
                                <input
                                    type="text"
                                    value={formData.composition}
                                    onChange={(e) => setFormData({...formData, composition: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Տեսակ (անգլերեն)</label>
                                <input
                                    type="text"
                                    value={formData.type}
                                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Տեսակի անուն (հայերեն)</label>
                                <input
                                    type="text"
                                    value={formData.type_name}
                                    onChange={(e) => setFormData({...formData, type_name: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Նկար (ֆայլի անուն)</label>
                                <input
                                    type="text"
                                    value={formData.image}
                                    onChange={(e) => setFormData({...formData, image: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="submit" className="btn-primary">Պահպանել</button>
                                <button type="button" onClick={() => { setShowModal(false); setEditingProduct(null); }} className="btn-secondary">
                                    Չեղարկել
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
