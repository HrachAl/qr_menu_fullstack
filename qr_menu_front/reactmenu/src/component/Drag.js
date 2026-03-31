import {useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SlActionRedo } from "react-icons/sl";
import { HiOutlineChatBubbleLeftRight, HiOutlineMicrophone, HiStop } from "react-icons/hi2";
import { useLang } from "../LangContext";
import { useWebSocketForm } from "../WebSocketProvider";
import { useCart } from "../CartContext";
import { menuImageUrl } from "../imageUrl";

export default function Draq({setSelectedProduct, setShowProduct, show}) {
    const { write, langItems, add, tot, amd, addAll, lang } = useLang()
    const position = useRef({ x: 5, y: 241 });
    const [dragging, setDragging] = useState(false);
    const offset = useRef({ x: 0, y: 0 });
    const divRef = useRef(null);
    const scrollRef = useRef(null);
    const [active, setActive] = useState(false);
    const wasDragged = useRef(false);
    const [delayedActive, setDelayedActive] = useState(false);
    const timeoutRef = useRef(null);
    const {
        messages, sendMessage, connectChat, disconnectChat, setMessages,
        streamingText, isStreaming,
        suggestions, setSuggestions,
        messagesInfo, resetChat,
        switchToSession, getSavedSessions, saveSessionToHistory,
    } = useWebSocketForm()
    const [input, setInput] = useState("");
    const {addAllToCart} = useCart()
    const [click, setClick] = useState(false)

    // Voice input
    const recognitionRef = useRef(null);
    const [isListening, setIsListening] = useState(false);

    // Chat history — only for logged-in users
    const isLoggedIn = !!localStorage.getItem('customer_token');
    const [showHistory, setShowHistory] = useState(false);
    const [savedSessions, setSavedSessions] = useState([]);

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
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, streamingText]);

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



    const toggleVoice = () => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return;
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }
        const speechLang = lang === 'AM' ? 'hy-AM' : lang === 'RU' ? 'ru-RU' : 'en-US';
        const recognition = new SR();
        recognitionRef.current = recognition;
        recognition.lang = speechLang;
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);
        recognition.onresult = (e) => {
            const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
            setInput(transcript);
            if (e.results[e.results.length - 1].isFinal) recognition.stop();
        };
        try { recognition.start(); } catch {}
    };

    const openHistory = () => {
        setSavedSessions(getSavedSessions());
        setShowHistory(true);
    };

    const handleSwitchSession = (session) => {
        switchToSession(session);
        setShowHistory(false);
    };

    const handleNewChat = () => {
        resetChat();
    };

    const detectLanguage = (text) => {
        if (/^[a-zA-Z0-9.,!?()\s]+$/.test(text)) return "en";
        if (/^[а-яА-ЯёЁ0-9.,!?()\s]+$/.test(text)) return "ru";
        if (/^[ա-ֆԱ-Ֆ0-9.,!?()\s]+$/.test(text)) return "am";
        return "unknown";
    };
    

    const handleSend = (text) => {
        const msg = typeof text === "string" ? text : input;
        if (msg.trim() !== "") {
            const lang = detectLanguage(msg);
            sendMessage(msg, lang);
            setInput("");
            setClick(false)
        }
    };

    const updateCount = (id, count) => {
        const safeCount = Math.max(0, Number(count) || 0);
        const updatedMessages = messages.map(msg => ({
            ...msg,
            menuItem: Array.isArray(msg.menuItem)
                ? msg.menuItem.map(pro =>
                    pro.item_id === id ? { ...pro, count: safeCount } : pro
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

            const safeCount = Math.max(0, Number(count) || 0);
            total += item.price * safeCount
        })
        return total;
    }

    const handleAdd = (arr) => {
        if(!click) {
            addAllToCart(arr)
        }
        setClick(true)
    }
    

    return createPortal(
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
                <div className="chatHeader">
                    <div className="chatHeader-counter">
                        <span className="chatHeader-counter-dot" style={{background: messagesInfo.remaining > 50 ? '#4caf50' : messagesInfo.remaining > 10 ? '#ff9800' : '#f44336'}}></span>
                        <span>{messagesInfo.remaining} / 500</span>
                    </div>
                    <div className="chatHeader-actions">
                        {isLoggedIn && (
                            <button className="chatHeader-history-btn" onClick={openHistory} title="Chat history">
                                &#9776;
                            </button>
                        )}
                        <button className="chatHeader-reset" onClick={handleNewChat}>
                            <HiOutlineChatBubbleLeftRight />
                            <span>New Chat</span>
                        </button>
                    </div>
                </div>

                {showHistory && (
                    <div className="chatHistory-panel">
                        <div className="chatHistory-header">
                            <span>Chat History</span>
                            <button className="chatHistory-close" onClick={() => setShowHistory(false)}>✕</button>
                        </div>
                        <div className="chatHistory-list">
                            {savedSessions.length === 0 ? (
                                <p className="chatHistory-empty">No saved chats yet</p>
                            ) : savedSessions.map((s) => (
                                <button key={s.id} className="chatHistory-item" onClick={() => handleSwitchSession(s)}>
                                    <span className="chatHistory-item-time">
                                        {new Date(s.timestamp).toLocaleDateString([], {month:'short', day:'numeric'})}
                                        {' '}
                                        {new Date(s.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                    </span>
                                    <span className="chatHistory-item-preview">{s.preview || 'Empty chat'}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <div className="Chat">
                    <div className="ChatScrollBox" ref={scrollRef}>
                        {messages.map((msg, index) => {
                            const isLast = index === messages.length - 1;
                            return (
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
                                                            <div className="image"><img src={menuImageUrl(item.image)} alt={item.name} onClick={() => {
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
                                {(msg.type === 'received' && msg.menuItem.length > 0 && msg.options_description) && (
                                    <div className="message received options-description-bubble">
                                        <div className="messageBox">
                                            <p>{msg.options_description}</p>
                                        </div>
                                    </div>
                                )}
                                {isLast && !isStreaming && suggestions.length > 0 && msg.type === 'received' && (
                                    <div className="chat-suggestions">
                                        {suggestions.map((s, i) => (
                                            <button key={i} className="chat-suggestion-chip" onClick={() => handleSend(s)}>
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            );
                        })}
                        {isStreaming && (
                            <div className="smallBox">
                                <div className="message received streaming-bubble">
                                    <div className="messageBox">
                                        <p>{streamingText}<span className="streaming-cursor">▋</span></p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    {!isStreaming && messages.length % 2 === 1 ?
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
                        <button
                            type="button"
                            className={`chatInput-mic ${isListening ? 'listening' : ''}`}
                            onClick={toggleVoice}
                            title={isListening ? 'Stop listening' : 'Voice input'}
                        >
                            {isListening ? <HiStop /> : <HiOutlineMicrophone />}
                        </button>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && handleSend()}
                            placeholder={isListening ? '...' : write}
                        />
                        <button onClick={() => handleSend()} type="button">
                            <SlActionRedo />
                        </button>
                    </form>
                </div>
            </div>
        </>,
        document.body
    );
}
