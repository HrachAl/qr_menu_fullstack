#!/bin/bash

cd qr_menu_front/reactmenu

if [ ! -f ".env" ]; then
    echo "Warning: .env file not found!"
    echo "Creating .env with default settings..."
    echo "REACT_APP_API_URL=http://localhost:8000" > .env
fi

if [ ! -d "node_modules" ]; then
    echo "node_modules not found. Run ./install.sh first"
    exit 1
fi

npm start
