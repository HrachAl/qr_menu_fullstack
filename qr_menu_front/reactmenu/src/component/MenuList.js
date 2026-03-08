import { useState, useMemo } from "react";
import { useCart } from "../CartContext";
import { useLang } from "../LangContext";

export default function MenuList({showMenu, setSelectedProduct, setShowProduct}) {
    const {langItems, add, amd, lang} = useLang()
    const [searchQuery, setSearchQuery] = useState('');

    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return langItems;
        const q = searchQuery.trim().toLowerCase();
        return langItems.filter((item) => {
            const name = (item.name || '').toLowerCase();
            const short = (item.short_description || '').toLowerCase();
            const desc = (item.description || '').toLowerCase();
            return name.includes(q) || short.includes(q) || desc.includes(q);
        });
    }, [langItems, searchQuery]);

    const grouped = useMemo(() => {
        return filteredItems.reduce((acc, item) => {
            acc[item.type] = acc[item.type] || [];
            acc[item.type].push(item);
            return acc;
        }, {});
    }, [filteredItems]);

    const {addToCart, removeFromCart, cartItems} = useCart()

    const getCount = (id) => {
        const found = cartItems.find((i) => i.id === id);
        return found ? found.count : 0;
    };

    const { menuTypes} = useLang()

    const handleAdd = (id) => {
        addToCart(id)
    }
    const handleRemove = (id) => {
        removeFromCart(id)
    }

    return (
        <div className="menuList-container" style={{padding: showMenu ? '' : '130px 0px 75px 0px'}}>
            <div className="menu-search-wrap">
                <input
                    type="search"
                    className="menu-search-input"
                    placeholder={lang === 'EN' ? 'Search menu…' : lang === 'RU' ? 'Поиск…' : 'Փնտրել մենյու…'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            {Object.entries(grouped).map(([type, items]) => (
                <div key={type} id={type} className="bigestBox">
                    <p className="type-heading">{
                        menuTypes.map((pro) => {
                            if( type === pro.type) {
                                return pro.type_name;
                            }
                        })
                        }</p>
                    {items.map((item, index) => (
                        <div key={index} className="menu-item">
                            <div className="image">
                                <img 
                                    src={`new_menu/${item.image}`} 
                                    alt={item.name} 
                                    onClick={() => {
                                        setSelectedProduct(item);
                                        setShowProduct(true);
                                    }} 
                                    style={{cursor: 'pointer'}}
                                />
                            </div>
                            <div className="text">
                                <div className="name">
                                    <h4>{item.name.slice(0, 12)}{item.name.length > 11 ? '...' : ''}</h4>
                                    <p>
                                        {item.short_description}
                                    </p>
                                </div>
                                <div className="menuItem-priceBox">
                                    <p className="menuItem-price">
                                        {item.price}
                                        <span>{amd}</span>
                                    </p>
                                    <div className="buy">
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
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}