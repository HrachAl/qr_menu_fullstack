let ws = new WebSocket("wss://localhost:8000/chat"); // local ws://localhost:8000/chat

function toISOStringLocal(dt) {
    if (!dt) return new Date().toISOString();
    const date = new Date(dt);
    return date.toISOString();
}

document.getElementById('entryLogForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const timestamp = document.getElementById('entryLogTimestamp').value;
    const isoTimestamp = toISOStringLocal(timestamp);
    const payload = { timestamp: isoTimestamp };
    try {
        const response = await fetch('/entry-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        document.getElementById('entryLogResponse').textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        document.getElementById('entryLogResponse').textContent = 'Error: ' + error.message;
    }
});

document.getElementById('buttonRequestsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    let data;
    try {
        data = JSON.parse(document.getElementById('buttonRequestsData').value);
        if (!Array.isArray(data)) throw new Error("Input must be a JSON array");
    } catch (error) {
        document.getElementById('buttonRequestsResponse').textContent = 'Invalid JSON: ' + error.message;
        return;
    }
    const payload = data;
    try {
        const response = await fetch('/button-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const data = await response.json();
        document.getElementById('buttonRequestsResponse').textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        document.getElementById('buttonRequestsResponse').textContent = 'Error: ' + error.message;
    }
});

document.getElementById('chatHistoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    let data;
    try {
        data = JSON.parse(document.getElementById('chatHistoryData').value);
        if (!Array.isArray(data)) throw new Error("Input must be a JSON array");
    } catch (error) {
        document.getElementById('chatHistoryResponse').textContent = 'Invalid JSON: ' + error.message;
        return;
    }
    const payload = data;
    try {
        const response = await fetch('/chat-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const data = await response.json();
        document.getElementById('chatHistoryResponse').textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        document.getElementById('chatHistoryResponse').textContent = 'Error: ' + error.message;
    }
});

document.getElementById('sendChat').addEventListener('click', () => {
    ws.onmessage = (event) => {
        try {
            const messages = JSON.parse(event.data);
            const chatHistory = document.getElementById('chatHistory');
            chatHistory.innerHTML = '';
            messages.forEach(msg => {
                const p = document.createElement('p');
                p.textContent = `${msg.role}: ${msg.content}`;
                chatHistory.appendChild(p);
            });
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            document.getElementById('chatHistory').textContent = event.data;
        }
    };
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        document.getElementById('chatHistory').textContent = 'WebSocket error';
    };
    ws.onclose = () => {
        console.log('WebSocket closed');
    };
    const message = document.getElementById('chatMessage').value;
    const time = document.getElementById('chatTime').value || new Date().toISOString();
    const language = document.getElementById('chatLanguage').value;
    const payload = { message, time, language };
    ws.send(JSON.stringify(payload));
});

document.getElementById('disconnectChat').addEventListener('click', () => {
    if (ws) {
        ws.close();
        ws = null;
    }
});

document.getElementById('recommendTimeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const language = document.getElementById('recommendTimeLang').value;
    try {
        const response = await fetch(`/recommend/time?language=${language}`);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const data = await response.json();
        document.getElementById('recommendTimeResponse').textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        document.getElementById('recommendTimeResponse').textContent = 'Error: ' + error.message;
    }
});

document.getElementById('recommendOrdersForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    let data;
    try {
        data = JSON.parse(document.getElementById('recommendOrdersData').value);
        if (!Array.isArray(data)) throw new Error("Input must be a JSON array");
    } catch (error) {
        document.getElementById('recommendOrdersResponse').textContent = 'Invalid JSON: ' + error.message;
        return;
    }
    const language = document.getElementById('recommendOrdersLang').value;
    const payload = data;
    try {
        const response = await fetch(`/recommend/orders?language=${language}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const responseData = await response.json();
        document.getElementById('recommendOrdersResponse').textContent = JSON.stringify(responseData, null, 2);
    } catch (error) {
        document.getElementById('recommendOrdersResponse').textContent = 'Error: ' + error.message;
    }
});