import { useCart } from "../CartContext";
import { useEffect, useState } from "react";
import { useLang } from "../LangContext";
import { RiArrowDownWideLine } from "react-icons/ri";

export default function Product({ product, show, setShow, clearProduct}) {
    const [count, setCount] = useState(0)
    const handleClose = () => {
        setShow(false);
        clearProduct();
        setCount(0);
    };
    
    const {addMoreToCart} = useCart()
    const {add, amd} = useLang()

    const handlePlus = () => {
        setCount(count + 1)
    } 
    const handleMin = () => {
        setCount(count - 1)
    } 

    useEffect(() => {
        if (show) {
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
    }, [show]);

    const handleClick = () => {
        addMoreToCart(product.item_id, count);
        setShow(prev => !prev)
    }

    return (
        <>
            {show && (<div className="prodBG" onClick={handleClose}>
                <p><RiArrowDownWideLine /></p>
            </div>)}
            <div className={`prod ${show ? 'prodAct' : ''}`}>
                {product && (
                    <div className="prodCont">
                        <div className="prodImg">
                            <img src={`new_menu/${product.image}`} alt={product.name} />
                        </div>
                        <div className="prodInf">
                            <h5>{product.name}</h5>
                            <p>{product.description}</p>
                        </div>
                        <div className="prodBut">
                            <div className="prodCount">
                                <button className='min' onClick={handleMin}>-</button>
                                <p className="prodCountNum">{count}</p>
                                <button onClick={handlePlus}>+</button>
                            </div>
                            <div className="prodAdd">
                                <p className="prodPrice">{product.price}<span>{amd}</span></p>
                                <button className="prodSub" onClick={handleClick}>{add}</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
