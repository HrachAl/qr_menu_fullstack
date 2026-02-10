import React, { createContext, useContext, useRef, useState } from 'react';

const WebSocketFormContext = createContext();

export const useWebSocketForm = () => useContext(WebSocketFormContext);

export const WebSocketFormProvider = ({ children }) => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";
  const WS_BASE_URL = process.env.REACT_APP_WS_BASE_URL || API_BASE_URL.replace(/^http(s)?:\/\//, (m) => (m === "https://" ? "wss://" : "ws://"));
  const ws = useRef(null);
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [chatHistoryResponse, setChatHistoryResponse] = useState(null);
  const [recommendTimeResponse, setRecommendTimeResponse] = useState([]);
  const [recommendTimeLoading, setRecommendTimeLoading] = useState(false);
  const [recommendTimeError, setRecommendTimeError] = useState(null);
  const [recommendOrdersResponse, setRecommendOrdersResponse] = useState([]);
  const [recResponse, setRecResponse] = useState()

  const submitChatHistory = async (data) => {
    try {
      if (!Array.isArray(data)) throw new Error("Input must be a JSON array");
      const response = await fetch(`${API_BASE_URL}/chat-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const responseData = await response.json();
      setChatHistoryResponse(responseData);
    } catch (error) {
      setChatHistoryResponse({ error: error.message });
    }
  };

  const connectChat = () => {
    if (socket) {
        socket.close();
        setSocket(null);
    }

    if (ws.current) {
      return;
    }

    ws.current = new WebSocket(`${WS_BASE_URL}/chat`);

    ws.current.onmessage = (event) => {

        try {
            const history = JSON.parse(event.data);

            const messagesArray = Array.isArray(history) ? history : [history]; 

            messagesArray.forEach((message) => {
                const {response, options } = message;
                const id = Date.now() + Math.random();

                    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                    if (typeof message === 'object' && message !== null && response) {
                        const newMessage = {
                            id,
                            text: response,
                            type: "received",
                            time,
                            menuItem: Array.isArray(options) ? options : [],
                        };

                        setMessages((prev) => {
                            if (!prev.some((msg) => msg.id === id)) {
                                return [...prev, newMessage];
                            }
                            return prev;
                        });

                        if (Array.isArray(options)) {
                            setMenuItems(options);
                        }
                    } else if (typeof message === 'string') {
                        const newMessage = {
                            id,
                            text: response,
                            type: "received",
                            time,
                        };
                        setMessages((prev) => {
                            if (!prev.some((msg) => msg.id === id)) {
                                return [...prev, newMessage];
                            }
                            return prev;
                        });
                    }
            });

        } catch (error) {
            console.error("parsing error", error);
        }
    };

    ws.current.onerror = (error) => {
        console.error("WebSocket error:", error);
    };

    setSocket(ws.current);
};


  const disconnectChat = () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  };

  const sendMessage = (messageText, lang) => {
    if (socket && socket.readyState === WebSocket.OPEN && messageText.trim() !== "") {
        const id = Date.now();
        const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        const messageData = { id, text: messageText, type: "sent", time };
        setMessages((prev) => [...prev, messageData]);
        socket.send(JSON.stringify({ id, message: messageText, lang }));
    }
};

  const requestRecommendTime = async (language) => {
    try {
      setRecommendTimeLoading(true);
      setRecommendTimeError(null);
      const response = await fetch(`${API_BASE_URL}/recommend/time?language=${language}`);
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const data = await response.json();
      console.log(data)
      setRecommendTimeResponse(Array.isArray(data) ? data : []);
    } catch (error) {
      setRecommendTimeResponse([]);
      setRecommendTimeError(error.message);
    } finally {
      setRecommendTimeLoading(false);
    }
  };

  const requestRecommendOrders = async (language, data) => {
    try {
      if (!Array.isArray(data)) throw new Error("Input must be a JSON array");
      const response = await fetch(`${API_BASE_URL}/recommend/orders?language=${language}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const responseData = await response.json();
      setRecResponse(responseData.response)
      setRecommendOrdersResponse(responseData.options);
    } catch (error) {
      setRecommendOrdersResponse({ error: error.message });
    }
  };

  return (
    <WebSocketFormContext.Provider
      value={{
        messages,
        setMessages,
        menuItems,
        chatHistoryResponse,
        recommendTimeResponse,
        recommendTimeLoading,
        recommendTimeError,
        recommendOrdersResponse,
        recResponse,
        submitChatHistory,
        connectChat,
        disconnectChat,
        sendMessage,
        requestRecommendTime,
        requestRecommendOrders
      }}
    >
      {children}
    </WebSocketFormContext.Provider>
  );
};