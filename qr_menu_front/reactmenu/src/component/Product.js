import { useCart } from "../CartContext";
import { useEffect, useState } from "react";
import { useLang } from "../LangContext";
import { RiArrowDownWideLine } from "react-icons/ri";
import { IoClose } from "react-icons/io5";
import { menuImageUrl } from "../imageUrl";

export default function Product({ product, show, setShow, clearProduct}) {
    const [count, setCount] = useState(1)
    const [isDesktop, setIsDesktop] = useState(() => window.matchMedia("(min-width: 900px)").matches);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(min-width: 900px)");
        const handleMediaChange = (event) => {
            setIsDesktop(event.matches);
        };

        setIsDesktop(mediaQuery.matches);
        mediaQuery.addEventListener("change", handleMediaChange);

        return () => {
            mediaQuery.removeEventListener("change", handleMediaChange);
        };
    }, []);

    const handleClose = () => {
        setShow(false);
        clearProduct();
        setCount(1);
    };
    
    const {addMoreToCart} = useCart()
    const {add, amd} = useLang()

    const handlePlus = () => {
        setCount((prev) => prev + 1)
    }
    const handleMin = () => {
        setCount((prev) => Math.max(1, prev - 1))
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
        const safeCount = Math.max(1, Number(count) || 1);
        addMoreToCart(product.item_id, safeCount);
        setShow(prev => !prev)
    }

    if (isDesktop) {
        return (
            <>
                {show && (
                    <div className="prodOverlay" onClick={handleClose}>
                        <div className="prodDesktop" onClick={(e) => e.stopPropagation()}>
                            <button className="prodDesktopClose" onClick={handleClose}>
                                <IoClose />
                            </button>
                            {product && (
                                <>
                                    <div className="prodDesktopImage">
                                        <img src={menuImageUrl(product.image)} alt={product.name} />
                                    </div>
                                    <div className="prodDesktopInfo">
                                        <h2 className="prodDesktopName">{product.name}</h2>
                                        <p className="prodDesktopDesc">{product.description}</p>
                                        <div className="prodDesktopPrice">
                                            <span className="prodDesktopPriceNum">{product.price}</span>
                                            <span className="prodDesktopPriceCur">{amd}</span>
                                        </div>
                                        <div className="prodDesktopActions">
                                            <div className="prodDesktopCounter">
                                                <button className="prodDesktopCountBtn" onClick={handleMin}>−</button>
                                                <span className="prodDesktopCountNum">{count}</span>
                                                <button className="prodDesktopCountBtn" onClick={handlePlus}>+</button>
                                            </div>
                                            <button className="prodDesktopAdd" onClick={handleClick}>{add}</button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </>
        );
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
                            <img src={menuImageUrl(product.image)} alt={product.name} />
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
