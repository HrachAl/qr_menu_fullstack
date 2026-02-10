# API Endpoints Documentation

This document outlines the API endpoints for the AI Chatbot application, including their purpose, request/response formats, and usage notes. The API is built using FastAPI and supports both WebSocket and HTTP endpoints for a restaurant chatbot system.

## Base URL
- **Base URL**: `http://localhost:8000` // local test

## WebSocket Endpoint

### `/chat`
- **Method**: WebSocket
- **Description**: Establishes a WebSocket connection for real-time chat with the AI assistant (Patrick). The assistant responds to user messages, provides recommendations, and answers menu-related questions.
- **Request**:
  - **Format**: JSON string
  - **Payload**:
    ```json
    {
      "message": "string",           // User's message or query
      "time": "string",              // ISO 8601 timestamp (e.g., "2025-04-20T09:00:00")
      "language": "string"           // Language code ("am", "en", "ru")
    }
    ```
  - **Example**:
    ```json
    {"message": "What do you recommend for breakfast?", "time": "2025-04-20T09:00:00", "language": "en"}
    ```
- **Response**:
  - **Format**: JSON array of message objects
  - **Structure**:
    ```json
    [
      {
        "role": "string",           // Role ("system", "user", "assistant")
        "content": "string"         // Message content
      }
    ]
    ```
  - **Example**:
    ```json
    [
      {"role": "system", "content": "Current time is 09:00"},
      {"role": "user", "content": "What do you recommend for breakfast?"},
      {"role": "assistant", "content": "{\"response\": \"Here are some breakfast recommendations.\", \"options\": [{\"item_id\": 1, \"reason\": \"A great morning pick-me-up\"}]}"}
    ]
    ```
- **Notes**:
  - The WebSocket connection remains open until explicitly closed by the client using the "Disconnect" button in the admin panel.
  - The assistant maintains a conversation history and includes time context in responses.

## HTTP Endpoints

### `GET /`
- **Description**: Returns a welcome message with the API version and a link to the admin panel.
- **Request**: None
- **Response**:
  - **Format**: Plain text
  - **Example**:
    ```
    Welcome to the AI Chatbot API! version 20.04, test: /admin_panel
    ```
- **Status Codes**:
  - `200 OK`: Successfully returned the welcome message.

### `GET /admin_panel`
- **Description**: Serves the admin panel HTML page for testing endpoints.
- **Request**: None
- **Response**:
  - **Format**: HTML file (`index.html`)
- **Status Codes**:
  - `200 OK`: Successfully served the admin panel.
- **Notes**:
  - This endpoint is not included in the OpenAPI schema (hidden from Swagger UI).

### `POST /entry-log`
- **Description**: Logs a site entry event with a timestamp.
- **Request**:
  - **Format**: JSON
  - **Payload**:
    ```json
    {
      "timestamp": "string"          // ISO 8601 timestamp (e.g., "2025-04-20T09:00:00")
    }
    ```
  - **Example**:
    ```json
    {"timestamp": "2025-04-20T09:00:00"}
    ```
- **Response**:
  - **Format**: JSON
  - **Structure**:
    ```json
    {
      "status": "string",           // Status message
      "received": {                 // Echo of the received payload
        "timestamp": "string"
      }
    }
    ```
  - **Example**:
    ```json
    {
      "status": "success",
      "received": {"timestamp": "2025-04-20T09:00:00"}
    }
    ```
- **Status Codes**:
  - `200 OK`: Successfully logged the entry.
  - `422 Unprocessable Entity`: Invalid payload (e.g., missing or malformed timestamp).

### `POST /button-requests`
- **Description**: Logs button press events, typically used to track user interactions with the menu.
- **Request**:
  - **Format**: JSON array
  - **Payload**:
    ```json
    [
      {
        "id": "integer",           // Button ID
        "timestamp": "string"      // ISO 8601 timestamp (e.g., "2025-04-20T09:00:00")
      }
    ]
    ```
  - **Example**:
    ```json
    [{"id": 1, "timestamp": "2025-04-20T09:00:00"}]
    ```
- **Response**:
  - **Format**: JSON
  - **Structure**:
    ```json
    {
      "status": "string",           // Status message
      "received": [                 // Echo of the received payload
        {
          "id": "integer",
          "timestamp": "string"
        }
      ]
    }
    ```
  - **Example**:
    ```json
    {
      "status": "success",
      "received": [{"id": 1, "timestamp": "2025-04-20T09:00:00"}]
    }
    ```
- **Status Codes**:
  - `200 OK`: Successfully logged the button requests.
  - `422 Unprocessable Entity`: Invalid payload (e.g., missing fields or incorrect format).

### `POST /chat-history`
- **Description**: Logs chat history entries, capturing user messages.
- **Request**:
  - **Format**: JSON array
  - **Payload**:
    ```json
    [
      {
        "id": "integer",           // Message ID
        "timestamp": "string",     // ISO 8601 timestamp (e.g., "2025-04-20T09:00:00")
        "text": "string"           // Message text
      }
    ]
    ```
  - **Example**:
    ```json
    [{"id": 1, "timestamp": "2025-04-20T09:00:00", "text": "Hello"}]
    ```
- **Response**:
  - **Format**: JSON
  - **Structure**:
    ```json
    {
      "status": "string",           // Status message
      "received": [                 // Echo of the received payload
        {
          "id": "integer",
          "timestamp": "string",
          "text": "string"
        }
      ]
    }
    ```
  - **Example**:
    ```json
    {
      "status": "success",
      "received": [{"id": 1, "timestamp": "2025-04-20T09:00:00", "text": "Hello"}]
    }
    ```
- **Status Codes**:
  - `200 OK`: Successfully logged the chat history.
  - `422 Unprocessable Entity`: Invalid payload (e.g., missing fields or incorrect format).

### `GET /recommend/time`
- **Description**: Provides recommendations based on the current time of day.
- **Request**:
  - **Query Parameters**:
    - `language` (optional, default: `"en"`): Language code (`"am"`, `"en"`, `"ru"`).
  - **Example**:
    ```
    /recommend/time?language=en
    ```
- **Response**:
  - **Format**: JSON array
  - **Structure**:
    ```json
    [
      {
        "item_id": "integer",      // ID of the recommended item
        "reason": "string"         // Reason for the recommendation
      }
    ]
    ```
  - **Example**:
    ```json
    [
      {"item_id": 1, "reason": "A great morning pick-me-up"},
      {"item_id": 2, "reason": "Light breakfast option"}
    ]
    ```
- **Status Codes**:
  - `200 OK`: Successfully returned recommendations.
- **Notes**:
  - If no recommendations are available, an empty array (`[]`) is returned.
  - The assistant uses the current time (server-side) to generate recommendations.

### `POST /recommend/orders`
- **Description**: Provides recommendations based on recent orders (button requests).
- **Request**:
  - **Query Parameters**:
    - `language` (optional, default: `"en"`): Language code (`"am"`, `"en"`, `"ru"`).
  - **Body**:
    - **Format**: JSON array
    - **Payload**:
      ```json
      [
        {
          "id": "integer",         // Button ID
          "timestamp": "string"    // ISO 8601 timestamp (e.g., "2025-04-20T09:00:00")
        }
      ]
      ```
    - **Example**:
      ```json
      [{"id": 1, "timestamp": "2025-04-20T09:00:00"}]
      ```
- **Response**:
  - **Format**: JSON array
  - **Structure**:
    ```json
    [
      {
        "item_id": "integer",      // ID of the recommended item
        "reason": "string"         // Reason for the recommendation
      }
    ]
    ```
  - **Example**:
    ```json
    [
      {"item_id": 3, "reason": "Pairs well with your previous coffee order"},
      {"item_id": 4, "reason": "A sweet treat to complement your order"}
    ]
    ```
- **Status Codes**:
  - `200 OK`: Successfully returned recommendations.
  - `422 Unprocessable Entity`: Invalid payload (e.g., missing fields or incorrect format).
- **Notes**:
  - If no recommendations are available, an empty array (`[]`) is returned.
  - Recommendations are based on the provided order history.

## Admin Panel
- **URL**: `/admin_panel`
- **Description**: A web interface to test all endpoints, including WebSocket chat and HTTP requests.
- **Features**:
  - Test `/entry-log`: Submit a timestamp to log a site entry.
  - Test `/button-requests`: Submit a JSON array of button requests.
  - Test `/chat-history`: Submit a JSON array of chat messages.
  - Test WebSocket `/chat`: Send messages and receive responses in real-time.
  - Test `/recommend/time`: Get time-based recommendations.
  - Test `/recommend/orders`: Get order-based recommendations.
- **Notes**:
  - Responses are displayed as formatted JSON in the UI.
  - The WebSocket chat includes a "Set Current Time" button for convenience.

## Notes
- **CORS**: The API allows cross-origin requests from all origins (`*`).
- **Error Handling**:
  - Validation errors return a `422 Unprocessable Entity` status with details.
  - WebSocket errors are logged and sent as text messages to the client.
- **Dependencies**:
  - The API uses the OpenAI API for chat and recommendation generation.
  - Ensure `OPENAI_API_KEY` is set in `config.py`.
  - Menu data (`menu_am.json`, `menu_en.json`, `menu_ru.json`) must be uploaded to the OpenAI assistant.
- **Running the Server**:
  - Run the server using `python main.py`.
  - The server listens on `http://localhost:8000`.