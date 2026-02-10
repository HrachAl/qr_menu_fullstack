import { useCart } from "../CartContext";
import { useLang } from "../LangContext";

export default function MenuList({showMenu, setSelectedProduct, setShowProduct}) {
    const {langItems, add, amd} = useLang()
    const grouped = langItems.reduce((acc, item) => {
        acc[item.type] = acc[item.type] || [];
        acc[item.type].push(item);
        return acc;
    }, {});

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
            {Object.entries(grouped).map(([type, items]) => (
                <div key={type} id={type} className="bigestBox">
                    <h2 className="type-heading">{
                        menuTypes.map((pro) => {
                            if( type === pro.type) {
                                return pro.type_name;
                            }
                        })
                        }</h2>
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