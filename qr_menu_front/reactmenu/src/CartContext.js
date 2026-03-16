import { createContext, useContext, useState } from "react";
import { useLang } from "./LangContext";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";

const CartContext = createContext();

export const CartProvider = ({ children }) => {
    const [cartItems, setCartItems] = useState([]);
    const [buyItems, setBuyItems] = useState([]);
    const [confirmError, setConfirmError] = useState(null);
    const { langItems } = useLang();

    const getAuthHeader = () => {
        const t = localStorage.getItem("customer_token");
        return t ? { Authorization: `Bearer ${t}` } : {};
    };

    const confirm = async () => {
        setConfirmError(null);
        setBuyItems(cartItems);
        if (cartItems.length === 0) {
            deleteAll();
            return;
        }
        const items = cartItems.map(({ id, count }) => ({ item_id: id, count }));
        try {
            const res = await fetch(`${API_BASE}/api/orders`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getAuthHeader() },
                body: JSON.stringify({ items }),
            });
            if (!res.ok) throw new Error(await res.text().then(t => t || res.statusText));
            deleteAll();
        } catch (err) {
            setConfirmError(err.message);
        }
    };

    const addToCart = (id) => {
        setCartItems((prev) => {
            const existingItem = prev.find((item) => item.id === id);
            if (existingItem) {
                return prev.map((item) =>
                    item.id === id
                        ? { ...item, count: item.count + 1 }
                        : item
                );
            } else {
                return [...prev, { id, count: 1, timestamp: new Date() }];
            }
        });
    };

    const addMoreToCart = (id, x) => {
        const delta = Math.max(0, Number(x) || 0);
        if (delta <= 0) return;
        setCartItems((prev) => {
            const existingItem = prev.find((item) => item.id === id);
            if (existingItem) {
                return prev.map((item) =>
                    item.id === id
                        ? { ...item, count: Math.max(0, item.count + delta) }
                        : item
                ).filter((item) => item.count > 0);
            } else {
                return [...prev, { id, count: delta, timestamp: new Date()}];
            }
        });
    };

    const addAllToCart = (arr) => {
        setCartItems((prevCart) => {
            let updatedCart = [...prevCart];
            arr.forEach(({ item_id, count }) => {
                const safeCount = Math.max(0, Number(count) || 0);
                if (safeCount <= 0) return;
                const pro = langItems.find(prod => prod.item_id === item_id);
                if (!pro) return;
                const existingIndex = updatedCart.findIndex(item => item.id === item_id);
                if (existingIndex !== -1) {
                    updatedCart[existingIndex].count += safeCount;
                } else {
                    updatedCart.push({ id: item_id, count: safeCount, timestamp: new Date() });
                }
            });
            return updatedCart;
        });
    };

    const removeFromCart = (id) => {
        setCartItems((prev) =>
            prev
                .map((item) =>
                    item.id === id
                        ? { ...item, count: Math.max(0, item.count - 1) }
                        : item
                )
                .filter((item) => item.count > 0)
        );
    };

    const deleteAll = () => setCartItems([]);

    return (
        <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, deleteAll, addMoreToCart, confirm, buyItems, addAllToCart, confirmError }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => useContext(CartContext)
