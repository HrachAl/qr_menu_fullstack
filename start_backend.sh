#!/bin/bash

cd qr_menu_backend

if [ ! -f ".env" ]; then
    echo "Warning: .env file not found!"
    echo "Please create .env file with OPENAI_API_KEY"
    exit 1
fi

if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Run ./install.sh first"
    exit 1
fi

source venv/bin/activate
python main.py
