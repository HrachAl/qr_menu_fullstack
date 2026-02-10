import { createContext, useContext,useState } from "react";
import { useLang } from "./LangContext";

const CartContext = createContext();

export const CartProvider = ({ children }) => {
    const [cartItems, setCartItems] = useState([]);
    const [buyItems, setBuyItems] = useState([])
    const {langItems} = useLang()

    const confirm = () => {
        setBuyItems(cartItems)
        deleteAll()
    }

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
        setCartItems((prev) => {
            const existingItem = prev.find((item) => item.id === id);
            if (existingItem) {
                return prev.map((item) =>
                    item.id === id
                        ? { ...item, count: item.count + x }
                        : item
                );
            } else {
                return [...prev, { id, count: x, timestamp: new Date()}];
            }
        });
    };

const addAllToCart = (arr) => {
  setCartItems((prevCart) => {
    let updatedCart = [...prevCart];

    arr.forEach(({ item_id, count }) => {
      if (count <= 0) return;

      const pro = langItems.find(prod => prod.item_id === item_id);
      if (!pro) return;

      const existingIndex = updatedCart.findIndex(item => item.id === item_id);

      if (existingIndex !== -1) {
        updatedCart[existingIndex].count += count;
      } else {
        updatedCart.push({ id: item_id, count: count, timestamp: new Date() });
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
                        ? { ...item, count: item.count - 1 }
                        : item
                )
                .filter((item) => item.count > 0)
        );
    };

    const deleteAll = () => setCartItems([]);

    return (
        <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, deleteAll, addMoreToCart, confirm, buyItems, addAllToCart }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => useContext(CartContext)
