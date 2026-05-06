import {useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SlActionRedo } from "react-icons/sl";
import { HiOutlineChatBubbleLeftRight, HiOutlineMicrophone, HiStop, HiOutlineSpeakerWave, HiOutlineCamera, HiOutlineShare } from "react-icons/hi2";
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

    // Text-to-Speech
    const [speakingMsgId, setSpeakingMsgId] = useState(null);
    const [autoSpeak, setAutoSpeak] = useState(false);
    const lastSpokenIdRef = useRef(null);

    // Emoji reactions
    const [showEmojiFor, setShowEmojiFor] = useState(null);
    const REACTIONS = ['👍', '❤️', '😂', '😮', '😢'];

    // Notification badge
    const [unreadCount, setUnreadCount] = useState(0);
    const prevMsgCountRef = useRef(0);

    // Image upload
    const fileInputRef = useRef(null);
    const [imageUploading, setImageUploading] = useState(false);

    // Share card
    const [shareToast, setShareToast] = useState(false);

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

    // Notification sound
    const playNotificationSound = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            osc.type = 'sine';
            gain.gain.value = 0.15;
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            osc.stop(ctx.currentTime + 0.25);
        } catch {}
    };

    // Share recommendation as downloadable card image
    const shareCard = async (msg) => {
        const items = (msg.menuItem || [])
            .map(({ item_id }) => langItems.find(p => p.item_id === item_id))
            .filter(Boolean);
        if (items.length === 0) return;

        const CARD_W = 600;
        const PAD = 30;
        const ITEM_H = 120;
        const HEADER_H = 70;
        const FOOTER_H = 50;
        const CARD_H = HEADER_H + items.length * ITEM_H + FOOTER_H + PAD;

        const canvas = document.createElement('canvas');
        canvas.width = CARD_W;
        canvas.height = CARD_H;
        const ctx = canvas.getContext('2d');

        // Background gradient
        const grad = ctx.createLinearGradient(0, 0, 0, CARD_H);
        grad.addColorStop(0, '#1a1a2e');
        grad.addColorStop(1, '#16213e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CARD_W, CARD_H);

        // Accent stripe top
        ctx.fillStyle = '#e8752a';
        ctx.fillRect(0, 0, CARD_W, 4);

        // Header
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('🍽  Рекомендация от AI', PAD, 45);

        // Pre-load all images via CORS-enabled API endpoint
        let y = HEADER_H;
        const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";
        const imageMap = {};
        await Promise.all(items.map(async (item) => {
            try {
                const imgFile = String(item.image || '').replace(/^.*\//, '');
                if (!imgFile) return;
                const resp = await fetch(`${API_BASE}/api/image/${imgFile}`);
                if (!resp.ok) return;
                const blob = await resp.blob();
                const bitmap = await createImageBitmap(blob);
                imageMap[item.item_id] = bitmap;
            } catch {}
        }));

        for (const item of items) {
            // Item card background
            ctx.fillStyle = 'rgba(255,255,255,0.07)';
            ctx.beginPath();
            ctx.roundRect(PAD, y, CARD_W - PAD * 2, ITEM_H - 10, 12);
            ctx.fill();

            // Draw pre-loaded image
            const bitmap = imageMap[item.item_id];
            if (bitmap) {
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(PAD + 10, y + 10, 80, 80, 10);
                ctx.clip();
                ctx.drawImage(bitmap, PAD + 10, y + 10, 80, 80);
                ctx.restore();
            }

            // Item name
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px sans-serif';
            ctx.fillText(item.name.length > 30 ? item.name.slice(0, 30) + '...' : item.name, PAD + 105, y + 35);

            // Short description
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = '13px sans-serif';
            const desc = item.short_description || '';
            ctx.fillText(desc.length > 45 ? desc.slice(0, 45) + '...' : desc, PAD + 105, y + 55);

            // Price
            ctx.fillStyle = '#e8752a';
            ctx.font = 'bold 17px sans-serif';
            ctx.fillText(`${item.price} ${amd}`, PAD + 105, y + 80);

            y += ITEM_H;
        }

        // Footer
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '12px sans-serif';
        ctx.fillText('QR Menu • AI Recommendation', PAD, CARD_H - 18);

        // Download
        const link = document.createElement('a');
        link.download = 'recommendation.png';
        link.href = canvas.toDataURL('image/png');
        link.click();

        setShareToast(true);
        setTimeout(() => setShareToast(false), 2000);
    };

    // Detect new received messages when chat is closed → badge + sound
    useEffect(() => {
        const received = messages.filter(m => m.type === 'received').length;
        if (received > prevMsgCountRef.current && !active) {
            setUnreadCount(prev => prev + (received - prevMsgCountRef.current));
            playNotificationSound();
        }
        prevMsgCountRef.current = received;
    }, [messages, active]);

    // Clear badge when chat opens
    useEffect(() => {
        if (active) setUnreadCount(0);
    }, [active]);

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



    // Text-to-Speech toggle
    const ttsTimerRef = useRef(null);
    const toggleSpeak = (msg) => {
        const synth = window.speechSynthesis;
        if (speakingMsgId === msg.id) {
            synth.cancel();
            clearInterval(ttsTimerRef.current);
            setSpeakingMsgId(null);
            return;
        }
        synth.cancel();
        clearInterval(ttsTimerRef.current);
        // Include options_description in spoken text
        let fullText = msg.text || '';
        if (msg.options_description) fullText += '. ' + msg.options_description;
        const utter = new SpeechSynthesisUtterance(fullText);
        utter.lang = lang === 'AM' ? 'hy-AM' : lang === 'RU' ? 'ru-RU' : 'en-US';
        utter.rate = 1;
        const cleanup = () => { clearInterval(ttsTimerRef.current); setSpeakingMsgId(null); };
        utter.onend = cleanup;
        utter.onerror = cleanup;
        setSpeakingMsgId(msg.id);
        synth.speak(utter);
        // Chrome bug workaround: pause/resume every 10s to prevent silent cancel
        ttsTimerRef.current = setInterval(() => {
            if (synth.speaking && !synth.paused) {
                synth.pause();
                synth.resume();
            } else if (!synth.speaking) {
                clearInterval(ttsTimerRef.current);
            }
        }, 10000);
    };

    // Auto-speak new AI responses
    useEffect(() => {
        if (!autoSpeak || isStreaming || messages.length === 0) return;
        const last = messages[messages.length - 1];
        if (last.type === 'received' && last.id !== lastSpokenIdRef.current) {
            lastSpokenIdRef.current = last.id;
            toggleSpeak(last);
        }
    }, [messages, isStreaming, autoSpeak]);

    // Cleanup TTS on unmount
    useEffect(() => {
        return () => { window.speechSynthesis.cancel(); clearInterval(ttsTimerRef.current); };
    }, []);

    // Emoji reaction toggle
    const toggleReaction = (msgId, emoji) => {
        setMessages(prev => prev.map(m => {
            if (m.id !== msgId) return m;
            return { ...m, reaction: m.reaction === emoji ? null : emoji };
        }));
        setShowEmojiFor(null);
    };

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

    // Image: stage file for preview, send on handleSend
    const [pendingImage, setPendingImage] = useState(null); // { file, previewUrl }

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        const previewUrl = URL.createObjectURL(file);
        setPendingImage({ file, previewUrl });
    };

    const cancelImage = () => {
        if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl);
        setPendingImage(null);
    };

    const sendImageMessage = async (messageText) => {
        if (!pendingImage) return;
        const { file, previewUrl } = pendingImage;
        setPendingImage(null);
        const id = Date.now();
        const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setMessages(prev => [...prev, { id, text: messageText || '', type: "sent", time, imagePreview: previewUrl }]);
        setImageUploading(true);
        try {
            const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";
            const formData = new FormData();
            formData.append('file', file);
            formData.append('message', messageText || 'What is this? Do you have something similar?');
            formData.append('session_id', 'image_' + id);
            formData.append('lang', lang === 'AM' ? 'am' : lang === 'RU' ? 'ru' : 'en');
            formData.append('token', localStorage.getItem('customer_token') || '');
            const res = await fetch(`${API_BASE}/chat/image`, { method: 'POST', body: formData });
            const data = await res.json();
            const respId = Date.now() + Math.random();
            const respTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            setMessages(prev => [...prev, {
                id: respId, text: data.response || '', type: "received", time: respTime,
                menuItem: Array.isArray(data.options) ? data.options : [],
                options_description: data.options_description || '',
            }]);
        } catch {
            const errId = Date.now() + Math.random();
            const errTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            setMessages(prev => [...prev, { id: errId, text: 'Failed to analyze image', type: "received", time: errTime, menuItem: [], options_description: '', isError: true }]);
        } finally {
            setImageUploading(false);
        }
    };

    const detectLanguage = (text) => {
        if (/^[a-zA-Z0-9.,!?()\s]+$/.test(text)) return "en";
        if (/^[а-яА-ЯёЁ0-9.,!?()\s]+$/.test(text)) return "ru";
        if (/^[ա-ֆԱ-Ֆ0-9.,!?()\s]+$/.test(text)) return "am";
        return "unknown";
    };
    

    const handleSend = (text) => {
        const msg = typeof text === "string" ? text : input;
        // If there's a pending image, send image + text
        if (pendingImage) {
            sendImageMessage(msg);
            setInput("");
            setClick(false);
            return;
        }
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
                {unreadCount > 0 && (
                    <span className="chat-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
            </div>

            {shareToast && <div className="share-toast">Card downloaded!</div>}

            <div className={`chatBox ${delayedActive ? 'activeChat' : ''}`}>
                <div className="chatHeader">
                    <div className="chatHeader-counter">
                        <span className="chatHeader-counter-dot" style={{background: messagesInfo.remaining > 50 ? '#4caf50' : messagesInfo.remaining > 10 ? '#ff9800' : '#f44336'}}></span>
                        <span>{messagesInfo.remaining} / 500</span>
                    </div>
                    <div className="chatHeader-actions">
                        <button
                            className={`chatHeader-voice-toggle ${autoSpeak ? 'active' : ''}`}
                            onClick={() => { setAutoSpeak(prev => !prev); if (autoSpeak) window.speechSynthesis.cancel(); }}
                            title={autoSpeak ? 'Voice off' : 'Voice on'}
                        >
                            <HiOutlineSpeakerWave />
                        </button>
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
                                <div className={`message ${msg.type}${msg.fromChef ? ' from-chef' : ''}`}>
                                    <div className="messageBox">
                                        {msg.fromChef && <span className="chef-label">Message from Chef</span>}
                                        {msg.imagePreview && <img src={msg.imagePreview} alt="" className="sent-image-preview" />}
                                        {msg.text && <p>{msg.text}</p>}
                                        <small>{msg.time}</small>
                                    </div>
                                    {msg.type === 'received' && (
                                        <>
                                            <div className="msg-actions">
                                                <button
                                                    className={`msg-action-btn ${speakingMsgId === msg.id ? 'speaking' : ''}`}
                                                    onClick={() => toggleSpeak(msg)}
                                                    title={speakingMsgId === msg.id ? 'Stop' : 'Listen'}
                                                >
                                                    {speakingMsgId === msg.id ? <HiStop /> : <HiOutlineSpeakerWave />}
                                                </button>
                                                <button
                                                    className="msg-action-btn msg-emoji-trigger"
                                                    onClick={() => setShowEmojiFor(showEmojiFor === msg.id ? null : msg.id)}
                                                >
                                                    {msg.reaction || '☺'}
                                                </button>
                                                {msg.menuItem && msg.menuItem.length > 0 && (
                                                    <button
                                                        className="msg-action-btn"
                                                        onClick={() => shareCard(msg)}
                                                        title="Share"
                                                    >
                                                        <HiOutlineShare />
                                                    </button>
                                                )}
                                            </div>
                                            {showEmojiFor === msg.id && (
                                                <div className="emoji-picker">
                                                    {REACTIONS.map(e => (
                                                        <button
                                                            key={e}
                                                            className={`emoji-opt ${msg.reaction === e ? 'active' : ''}`}
                                                            onClick={() => toggleReaction(msg.id, e)}
                                                        >
                                                            {e}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {msg.reaction && <span className="msg-reaction-badge">{msg.reaction}</span>}
                                        </>
                                    )}
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
                            <span className="chatWait-label">AI</span>
                            <div className="circle first"></div>
                            <div className="circle second"></div>
                            <div className="circle third"></div>
                        </div>) :
                        (<div></div>)
                    }
                </div>
                {pendingImage && (
                    <div className="chatInput-preview">
                        <img src={pendingImage.previewUrl} alt="preview" />
                        <button className="chatInput-preview-close" onClick={cancelImage}>✕</button>
                    </div>
                )}
                <div className="chatInput">
                    <form onSubmit={(e) => e.preventDefault()}>
                        <button
                            type="button"
                            className="chatInput-camera"
                            onClick={() => fileInputRef.current?.click()}
                            title="Send photo"
                            disabled={imageUploading}
                        >
                            {imageUploading ? '...' : <HiOutlineCamera />}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            style={{ display: 'none' }}
                            onChange={handleImageSelect}
                        />
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
