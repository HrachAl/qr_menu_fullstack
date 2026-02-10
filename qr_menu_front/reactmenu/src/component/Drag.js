import {useEffect, useRef, useState } from "react";
import { SlActionRedo } from "react-icons/sl";
import { useLang } from "../LangContext";
import { useWebSocketForm } from "../WebSocketProvider";
import { useCart } from "../CartContext";

export default function Draq({setSelectedProduct, setShowProduct, show}) {
    const { write, langItems, add, tot, amd, addAll } = useLang()
    const position = useRef({ x: 5, y: 241 });
    const [dragging, setDragging] = useState(false);
    const offset = useRef({ x: 0, y: 0 });
    const divRef = useRef(null);
    const [active, setActive] = useState(false);
    const wasDragged = useRef(false);
    const [delayedActive, setDelayedActive] = useState(false);
    const timeoutRef = useRef(null);
    const {messages,sendMessage, connectChat, disconnectChat, setMessages} = useWebSocketForm()
    const [input, setInput] = useState("");
    const {addAllToCart} = useCart()
    const [click, setClick] = useState(false)

    const handleStart = (e) => {
        setDragging(true);
        wasDragged.current = false;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        offset.current = {
            x: clientX - position.current.x,
            y: clientY - position.current.y,
        };
    };

    useEffect(() => {
        connectChat();
      
        return () => {
          disconnectChat();
        };
      }, []);

    useEffect(() => {
        const isIOS = /iP(ad|hone|od)/.test(navigator.userAgent);
    
        if (active || show) {
            if (isIOS) {
                const scrollY = window.scrollY;
                document.body.style.position = 'fixed';
                document.body.style.top = `-${scrollY}px`;
                document.body.style.width = '100%';
                document.body.dataset.scrollY = scrollY;
            } else {
                document.body.style.overflow = 'hidden';
                document.documentElement.style.overflow = 'hidden';
            }
        } else {
            if (isIOS) {
                const scrollY = document.body.dataset.scrollY || '0';
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';
                window.scrollTo(0, parseInt(scrollY));
            } else {
                document.body.style.overflow = 'auto';
                document.documentElement.style.overflow = 'auto';
            }
        }
    
        return () => {
            if (isIOS) {
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';
            } else {
                document.body.style.overflow = 'auto';
                document.documentElement.style.overflow = 'auto';
            }
        };
    }, [active, show]);
    

    const handleMove = (e) => {
        if (!dragging) return;
        wasDragged.current = true;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        position.current = {
            x: clientX - offset.current.x,
            y: clientY - offset.current.y,
        };

        requestAnimationFrame(() => {
            if (divRef.current) {
                divRef.current.style.left = `${position.current.x}px`;
                divRef.current.style.bottom = `calc(100vh - ${position.current.y}px)`;
            }
        });
    };

    const handleClick = (e) => {
        e.preventDefault();
        if (wasDragged.current) return;
        setActive((prev) => !prev);
    };

    const handleEnd = () => {
        if (!divRef.current) return;
    
        const blockWidth = divRef.current.offsetWidth;
        const blockHeight = divRef.current.offsetHeight;
    
        const maxX = window.innerWidth - blockWidth - 5;
        const maxY = window.innerHeight - blockHeight - 50;
    
        if (position.current.x < window.innerWidth / 2) {
            position.current.x = 10;
        } else {
            position.current.x = maxX;
        }
    
        if (position.current.y < 55) {
            position.current.y = 55; 
        } else if (position.current.y > maxY) {
            position.current.y = maxY; 
        }

        requestAnimationFrame(() => {
            divRef.current.style.left = `${position.current.x}px`;
            divRef.current.style.bottom = `calc(100vh - ${position.current.y}px)`;
        });
    
        setDragging(false);
    };
    

    useEffect(() => {
        clearTimeout(timeoutRef.current);

        if (active) {
            timeoutRef.current = setTimeout(() => {
                setDelayedActive(true);
            }, 100);
        } else {
            setDelayedActive(false);
        }

        return () => clearTimeout(timeoutRef.current);
    }, [active]);



    const detectLanguage = (text) => {
        if (/^[a-zA-Z0-9.,!?()\s]+$/.test(text)) return "en";
        if (/^[а-яА-ЯёЁ0-9.,!?()\s]+$/.test(text)) return "ru";
        if (/^[ա-ֆԱ-Ֆ0-9.,!?()\s]+$/.test(text)) return "am";
        return "unknown";
    };
    

    const handleSend = () => {
        if (input.trim() !== "") {
            const lang = detectLanguage(input);
            sendMessage(input, lang);
            setInput("");
            setClick(false)
        }
    };

    const updateCount = (id, count) => {
        const updatedMessages = messages.map(msg => ({
            ...msg,
            menuItem: Array.isArray(msg.menuItem)
                ? msg.menuItem.map(pro =>
                    pro.item_id === id ? { ...pro, count } : pro
                )
                : msg.menuItem
        }));
    
        setMessages(updatedMessages);
    }

    const total = (arr) => {
        let total = 0;
        arr.map(({item_id, count}) => {
            const item = langItems.find(pro => pro.item_id === item_id)
            if(!item) return null;

            total += item.price * count
        })
        return total;
    }

    const handleAdd = (arr) => {
        if(!click) {
            addAllToCart(arr)
        }
        setClick(true)
    }
    

    return (
        <>
            {active && <div className="dragBg" onClick={handleClick}></div>}
            <div
                ref={divRef}
                onClick={handleClick}
                className={`dragContainer ${active ? "chatActive" : ""}`}
                onMouseDown={handleStart}
                onMouseMove={handleMove}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={handleStart}
                onTouchMove={handleMove}
                onTouchEnd={handleEnd}
                style={{
                    left: `${position.current.x}px`,
                    bottom: `calc(100vh - ${position.current.y}px)`,
                    touchAction: "none",
                }}
            >
                <img src="dragLogo.png" alt='AI bot' />
            </div>

            <div className={`chatBox ${delayedActive ? 'activeChat' : ''}`}>
                <div className="Chat">
                    <div className="ChatScrollBox">
                        {messages.map((msg, index) => (
                            <div className="smallBox" key={index}>
                                <div className={`message ${msg.type}`}>
                                    <div className="messageBox">
                                        <p>{msg.text}</p>
                                        <small>{msg.time}</small>
                                    </div>
                                </div>
                                {(msg.type === 'received' && msg.menuItem.length > 0) && (
                                <div className="botChat-recommendBox">
                                    <div className="botChatRec-scroll">
                                        {msg.type === 'received' && (
                                            <>
                                                {(!Array.isArray(msg.menuItem) || msg.menuItem.length === 0) ? (
                                                <div></div>
                                                ) : (
                                                msg.menuItem.map(({ item_id, count }) => {
                                                    const item = langItems.find(prod => prod.item_id === item_id);
                                                    if (!item) return null;
                                                    return (
                                                    <div className="botChat-recommend" key={item_id}>
                                                        <div className="backRecomend_item">
                                                            <div className="image"><img src={`new_menu/${item.image}`} alt={item.name} onClick={() => {
                                                                setSelectedProduct(item);
                                                                setShowProduct(true);
                                                                setActive(!active)
                                                            }}/></div>
                                                            <div className="itemName"><p>{item.name.slice(0, 12)}{item.name.length > 11 ? '...' : ''}</p></div>
                                                        </div>
                                                        <div className="backRec_sub">
                                                            <p className="backRec_price">{item.price} <span>{amd}</span></p>
                                                            <div className="backItem_add">
                                                            {count <= 0 ?  <p style={{cursor : 'pointer'}} onClick={() => updateCount(item_id, count + 1)}>{add}</p> :
                                                                <>
                                                                    <button className="min" onClick={() => updateCount(item_id, count - 1)}>-</button>
                                                                    <p>{count}</p>
                                                                    <button className="plus" onClick={() => updateCount(item_id, count + 1)}>+</button>
                                                                </>
                                                            }
                                                            </div>
                                                        </div>
                                                    </div>
                                                    );
                                                })
                                                )}
                                            </>
                                        )}
                                        </div>
                                        <div className="addAll">
                                            <button >
                                                {total(msg.menuItem) > 0 ? (<>
                                            <div className="priceAll" onClick={() => handleAdd(msg.menuItem)}>
                                                <small className="allTot">{tot}</small>
                                                <p>{total(msg.menuItem)} <small>{amd}</small></p>
                                            </div>
                                            <div className="button" onClick={() => handleAdd(msg.menuItem)}>
                                                <div>{addAll}</div>
                                            </div>
                                        </>) : (<div>{addAll}</div>)}
                                                
                                            </button>
                                            <div className="handle" style={{scale: click ? '1' : '0'}}></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    {messages.length % 2 === 1 ?
                        (<div className="chatWait">
                            <div className="circle first"></div>
                            <div className="circle second"></div>
                            <div className="circle third"></div>
                        </div>) :
                        (<div></div>)
                    }
                </div>
                <div className="chatInput">
                    <form onSubmit={(e) => e.preventDefault()}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && handleSend()}
                            placeholder={write}
                        />
                        <button onClick={handleSend} type="button">
                            <SlActionRedo />
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}
