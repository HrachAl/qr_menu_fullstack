import { useEffect, useState } from "react";
import { useCart } from "../CartContext";
import { TbTilde } from "react-icons/tb";
import { useLang } from "../LangContext";
import { RiArrowDownWideLine } from "react-icons/ri";
import { useWebSocketForm } from "../WebSocketProvider";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function Cart({setSelectedProduct, setShowProduct, show}) {
    const { cartItems, addToCart, removeFromCart, confirm } = useCart();
    const {amd, sub, min, tot, lang} = useLang()
    const [showCart, setShowCart] = useState(false);
    const [total, setTotal]  = useState(0)
    const {langItems, add} = useLang()
    const [len, setLen] = useState(0)

    const {requestRecommendOrders, recommendOrdersResponse, recResponse} = useWebSocketForm()

    const handleClick = () => {
        setShowCart(prev => !prev);
        if(!showCart && (len < cartItems.length)) requestRecommendOrders(lang, cartItems);
        setLen(cartItems.length)
    };
    
    useEffect(() => {
        if (showCart || show) {
          document.body.style.overflow = 'hidden';
          document.documentElement.style.overflow = 'hidden';
        } else {
          document.body.style.overflow = 'auto';
          document.documentElement.style.overflow = 'auto';
        }
      
        return () => {
          document.body.style.overflow = 'auto';
          document.documentElement.style.overflow = 'auto';
        };
      }, [showCart, show]);

      useEffect(() => {
        if (cartItems && cartItems.length > 0) {
            const total = cartItems.reduce((acc, { id, count }) => {
                const item = langItems.find((prod) => prod.item_id === id);
                return item ? acc + Number(item.price) * count : acc;
            }, 0);
            setTotal(total);
        } else {
            setTotal(0);
        }
    }, [cartItems, langItems]);

    const handleConClick = async () => {
        if (cartItems.length === 0) return;
        
        try {
            const token = localStorage.getItem("token");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            
            const orderData = {
                user_id: 0,
                items: cartItems.map(item => ({ id: item.id, count: item.count })),
                total: total
            };
            
            await axios.post(`${API_URL}/api/orders/checkout`, orderData, { headers });
            
            confirm();
            setShowCart(prev => !prev);
        } catch (error) {
            console.error("Failed to create order:", error);
            confirm();
            setShowCart(prev => !prev);
        }
    }

    const getCount = (id) => {
        const found = cartItems.find((i) => i.id === id);
        return found ? found.count : 0;
    };

    const handleAdd = async (id) => {
        addToCart(id);
        
        try {
            const token = localStorage.getItem("token");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            
            await axios.post(`${API_URL}/api/cart/add`, { id, count: 1 }, { headers });
        } catch (error) {
            console.error("Failed to log cart event:", error);
        }
    }
    const handleRemove = (id) => {
        removeFromCart(id)
    }

    return (
        <>
            <div className={`cartBack ${showCart ? 'backActive' : ''}`} onClick={handleClick}>
                    <p className="cartClose"><RiArrowDownWideLine /></p>
            </div>

            <div className={`cart-box`} onClick={handleClick}>
                <div className="cartPrice">
                    <div className="totalPrice">
                        <h5>{tot}</h5>
                        <p className="total">{total}<span>{amd}</span></p>
                    </div>
                    <div className="submit">
                        <button>{sub}</button>
                    </div>
                </div>
            </div>

            <div className={`cart-content ${showCart ? 'contAct' : ''}`}>
                <div className="cartItems">
                    {cartItems.map(({id, count}) => {
                        const item = langItems.find((prod) => prod.item_id === id)
                        if(!item) return null;

                        return(
                            <div className="cartItem" key={id}>
                                <div className="cartItemImg"><img src={`new_menu/${item.image}`} alt={item.name} onClick={() => {
                                        setSelectedProduct(item);
                                        setShowProduct(true);
                                        setShowCart(!showCart)
                                    }}  /></div>
                                <div className="itemInfo">
                                    <h4 className="itemName">{item.name}</h4>
                                    <p className="itemComp">{item.short_description}</p>
                                    <p className="itemPrice">{item.price}<span>{amd}</span></p>
                                </div>
                                <div className="cartButton">
                                    <button className="remCart" onClick={() => handleRemove(item.item_id)}>-</button>
                                    <p>{count}</p>
                                    <button className="addCart" onClick={() => handleAdd(item.item_id)}>+</button>
                                </div>
                            </div>
                        )
                    })}
                </div>
                <div className="backItem">
                    <p className="rec">{recResponse}</p>
                    <div className="backItemBox">
                        <div className="backItemScroll">
                            {recommendOrdersResponse.length > 0 ? (recommendOrdersResponse.map(({item_id}) => {
                                const item = langItems.find((prod) => prod.item_id === item_id)
                                if(!item) return null;
                                return(
                                    <div className="backItem_item" key={item.item_id}>
                                        <div className="backItem_info">
                                            <div className="backItem_image"><img src={`new_menu/${item.image}`} alt={item.name} onClick={() => {
                                        setSelectedProduct(item);
                                        setShowProduct(true);
                                        setShowCart(!showCart)
                                    }} /></div>
                                            <div className="backItem_name"><p>{item.name}</p></div>
                                        </div>
                                        <div className="backItem_sub">
                                            <p className="backItem_price">{item.price} <span>{amd}</span></p>
                                            <div className="backItem_add">
                                                {!getCount(item.item_id) ?  <p style={{cursor : 'pointer'}} onClick={() => handleAdd(item.item_id)}>{add}</p> : 
                                                    <>
                                                        <button className="min" onClick={() => handleRemove(item.item_id)}>-</button>
                                                        <p>{getCount(item.item_id)}</p>
                                                        <button className="plus" onClick={() => handleAdd(item.item_id)}>+</button>
                                                    </>
                                                }
                                            </div>
                                        </div>
                                    </div>
                                )
                            })) :
                            (<div className="chatWait">
                                <div className="circle first"></div>
                                <div className="circle second"></div>
                                <div className="circle third"></div>
                            </div>)
                            }
                        </div>
                    </div>
                </div>
                <div className="cartConf" onClick={handleConClick}>
                    <p className="conPrice">{total}<span>{amd}</span></p>
                    <p className="confirm">{sub}</p>
                    <div className="confTime">
                        <p className="time">20<span><TbTilde /></span>25</p>
                        <p className="min">{min}</p>
                    </div>
                </div>
            </div>
        </>
    );
}
