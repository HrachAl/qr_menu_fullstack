import { MdRoomService } from "react-icons/md";
import { useCart } from "../CartContext";
import { useEffect, useState } from "react";
import { useLang } from "../LangContext";
import { RiArrowDownWideLine } from "react-icons/ri";

export default function BuyHistory({setSelectedProduct, setShowProduct, showProduct}) {
    const [show, setShow] = useState(false)
    const {buyItems} = useCart()
    const [total, setTotal] = useState(0)
    const {tot, amd, cl} = useLang()
    const {langItems} = useLang()
    const handleShow = () => {
        setShow(!show)
    }
    useEffect(() => {
        if (buyItems && buyItems.length > 0) {
            const total = buyItems.reduce((acc, { id, count }) => {
                const item = langItems.find((prod) => prod.item_id === id);
                return item ? acc + Number(item.price) * count : acc;
            }, 0);
            setTotal(total);
        } else {
            setTotal(0);
        }
    }, [buyItems, langItems]);

    useEffect(() => {
        if (show || showProduct) {
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
      }, [show, showProduct]);
      
    return(
        <>
            <div className="buyHistoryOpen" onClick={handleShow}>
                <MdRoomService />
                {buyItems.length > 0 && <div className="openCount"><p className="count">!</p></div>}
            </div>
            <div className={`buyHistoryBox ${show ? 'buyHistoryShow' : ''}`}>
                <div className="buyItems">
                    {buyItems.length > 0 && buyItems.map(({id, count}) => {
                        const item = langItems.find(item => item.item_id === id)
                        return(
                            <div className="buyItem" key={id}>
                                <div className="buyItemImage"><img src={`new_menu/${item.image}`} alt={item.name} onClick={() => {
                                        setSelectedProduct(item);
                                        setShowProduct(true);
                                        setShow(!show)
                                    }}/></div>
                                <div className="buyItemInf">
                                    <h5>{item.name}</h5>
                                    <p className="info">{item.short_description}</p>
                                    <p className="itemPrice">{item.price}<span>{amd}</span></p>
                                </div>
                                <div className="buyItemButton">
                                    <p className="icon min">-</p>
                                    <p className="count">{count}</p>
                                    <p className="icon plus">+</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
                <div className="buyHistoryButton">
                    <div className="buyHistoryTotal">
                        <p className="first">{tot}</p>
                        <p className="second">{total}<span>{amd}</span></p>
                    </div>
                    <button onClick={handleShow}>{cl}</button>
                </div>
            </div>
            {show && <div className="buyHistoryBg" onClick={handleShow}><p><RiArrowDownWideLine /></p></div>}
        </>
    )
}