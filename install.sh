#!/bin/bash

echo "==================================="
echo "QR Menu - Installation Script"
echo "==================================="

# Backend setup
echo ""
echo "Setting up Backend..."
cd qr_menu_backend

# Check if venv exists, if not create it
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv and install dependencies
echo "Installing backend dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "Backend setup complete!"

# Frontend setup
echo ""
echo "Setting up Frontend..."
cd ../qr_menu_front/reactmenu

# Install npm dependencies
echo "Installing frontend dependencies..."
npm install

echo ""
echo "==================================="
echo "Installation Complete!"
echo "==================================="
echo ""
echo "To start the application:"
echo ""
echo "Backend:"
echo "  cd qr_menu_backend"
echo "  source venv/bin/activate"
echo "  python main.py"
echo ""
echo "Frontend:"
echo "  cd qr_menu_front/reactmenu"
echo "  npm start"
echo ""
echo "Don't forget to create .env files:"
echo "  - qr_menu_backend/.env (OPENAI_API_KEY=your_key)"
echo "  - qr_menu_front/reactmenu/.env (REACT_APP_API_URL=http://localhost:8000)"
echo ""
echo "Admin credentials:"
echo "  Username: admin"
echo "  Password: 123456"
echo "==================================="
