import { Swiper, SwiperSlide } from "swiper/react";
import 'swiper/css';
import { useEffect, useRef, useState } from "react";
import { MdStarRate } from "react-icons/md";
import { HiDotsHorizontal } from "react-icons/hi";
import { useCart } from "../CartContext";
import { useLang } from "../LangContext";
import { useWebSocketForm } from "../WebSocketProvider";

export default function MainRec({setSelectedProduct, setShowProduct}) {
    const {langItems, add, min, amd, lang} = useLang()
    const [menu, setMenu] = useState([]);
    const [activeSlide, setActiveSlide] = useState(0);
    const swiperRef = useRef(null);

    const {requestRecommendTime, recommendTimeResponse, recommendTimeLoading, recommendTimeError} = useWebSocketForm() 

    const recTexts = {
        AM: { title: "Առաջարկվող ապրանքներ", loading: "Առաջարկվում են ապրանքներ..." },
        RU: { title: "Рекомендуемые товары", loading: "Рекомендуем товары..." },
        EN: { title: "Recommended items", loading: "Recommending items..." },
    };

    const uiText = recTexts[lang] || recTexts.AM;

    const buildFallbackMenu = () => {
        const fallback = (langItems || []).slice(0, 4).map((item) => ({
            ...item,
            reason: "",
        }));
        return fallback;
    };

    useEffect(() => {
        requestRecommendTime(lang);
        setMenu([])
    }, [lang]);

    useEffect(() => {
        if (recommendTimeLoading) return;

        if (recommendTimeError) {
            setMenu(buildFallbackMenu());
            return;
        }

        if (!Array.isArray(recommendTimeResponse) || recommendTimeResponse.length === 0) {
            setMenu(buildFallbackMenu());
            return;
        }

        const nextMenu = [];
        recommendTimeResponse.forEach(({ item_id, reason }) => {
            const item = langItems.find((prev) => prev.item_id === item_id);
            if (!item) return;

            const itemWithReason = { ...item, reason: reason || "" };
            nextMenu.push(itemWithReason);
        });

        setMenu(nextMenu.length > 0 ? nextMenu : buildFallbackMenu());
    }, [recommendTimeResponse, recommendTimeLoading, recommendTimeError, langItems]);

    const handleSlideChange = (swiper) => {
        setActiveSlide(swiper.activeIndex);
    };

    const handleClick = (index) => {
        if (swiperRef.current) {
            swiperRef.current.swiper.slideTo(index);
        }
    };

    const {addToCart, removeFromCart, cartItems} = useCart()

    const getCount = (id) => {
        const found = cartItems.find((i) => i.id === id);
        return found ? found.count : 0;
    };

    return (
        <main>
            <div className="mainRecTitle">{uiText.title}</div>
            {recommendTimeLoading ? (
                <div className="mainRecLoading">
                    <div className="mainLoad"></div>
                    <div className="mainRecLoadingText">{uiText.loading}</div>
                </div>
            ) : menu.length > 0 ? (
                <Swiper
                ref={swiperRef}
                grabCursor={true}
                slidesPerView={1}
                onSlideChange={handleSlideChange}
            >
                {menu.map((item, index) => (
                    <SwiperSlide key={index}>
                        <div className="mainSlide">
                            <div className="slideTop">
                                <div className="slideLeft">
                                    <img src={`new_menu/${item.image}`} alt={item.name} onClick={() => {
                                        setSelectedProduct(item);
                                        setShowProduct(true);
                                    }} />
                                </div>
                                <div className="slideRight">
                                    <h3>{item.name}</h3>
                                    <p>{item.reason}</p>
                                </div>
                            </div>
                            <div className="slideBottom">
                                <div className="bottomBlock">
                                    <div className="block first">
                                        <p className="blockNumber">10-15</p>
                                        <p className="blockText">{min}</p>
                                    </div>
                                    <div className="block second">
                                        <MdStarRate /> 4.4
                                    </div>
                                    <div className="block third">
                                        <HiDotsHorizontal />
                                    </div>
                                </div>
                                <div className="bottomPrice">
                                    <p className="price">2,500 <span>{amd}</span></p>
                                    <div className="buy">
                                        {!getCount(item.item_id) ?  <p style={{cursor : 'pointer'}} onClick={() => addToCart(item.item_id)}>{add}</p> : 
                                                <>
                                                    <button className="min" onClick={() => removeFromCart(item.item_id)}>-</button>
                                                    <p>{getCount(item.item_id)}</p>
                                                    <button className="plus" onClick={() => addToCart(item.item_id)}>+</button>
                                                </>
                                            }
                                    </div>
                                </div>
                            </div>
                        </div>
                    </SwiperSlide>
                    ))}
                </Swiper>) : (
                    <div style={{ width: "100%", height: "100%" }}></div>
                )
            }

            <div className="checkBox">
                {menu.map((_, index) => (
                    <div
                        key={index}
                        onClick={() => handleClick(index)}
                        className={`check ${activeSlide === index ? 'active' : ''}`}
                    ></div>
                ))}
            </div>
        </main>
    );
}