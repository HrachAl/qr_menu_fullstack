import './App.css';
import './responsive.css'
import './theme.css'
import './desktop.css'
import MainRec from './component/MainRec';
import Menu from './component/Menu';
import MenuList from './component/MenuList';
import { useState } from 'react';
import Product from './component/Product';
import { CartProvider } from './CartContext';
import Cart from './component/Cart';
import BuyHistory from './component/BuyHistory';
import { LangProvider } from './LangContext';
import LangButton from './component/LangButton';
import Draq from './component/Drag';
import { WebSocketFormProvider } from './WebSocketProvider';
import { ViewModeProvider } from './ViewModeContext';
import ModeSwitcher from './component/ModeSwitcher';
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

function MainApp() {
  const { user, loading, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProduct, setShowProduct] = useState(false);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#667eea'
      }}>
        Բեռնում...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        gap: '20px',
        padding: '20px'
      }}>
        <h2 style={{ color: '#333', textAlign: 'center' }}>Անհրաժեշտ է մուտք գործել</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '12px 24px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Մուտք
          </button>
          <button
            onClick={() => navigate('/register')}
            style={{
              padding: '12px 24px',
              background: '#764ba2',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Գրանցում
          </button>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <ViewModeProvider>
      <LangProvider>
        <WebSocketFormProvider>
          <CartProvider>
            <div className="App">
              <div style={{
                position: 'fixed',
                top: '10px',
                right: '10px',
                zIndex: 1000,
                background: 'rgba(255, 255, 255, 0.95)',
                padding: '10px 15px',
                borderRadius: '12px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '14px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '16px'
                  }}>
                    {user?.username?.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontWeight: '500', color: '#333' }}>
                    {user?.username}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    padding: '6px 12px',
                    background: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500',
                    transition: 'background 0.3s'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#d32f2f'}
                  onMouseOut={(e) => e.target.style.background = '#f44336'}
                >
                  Ելք
                </button>
              </div>
              <ModeSwitcher />
              <MainRec 
                setSelectedProduct={setSelectedProduct} 
                setShowProduct={setShowProduct}/>
              <Menu showMenu = {showMenu} setShowMenu = {setShowMenu} />
              <MenuList 
                showMenu={showMenu} 
                setSelectedProduct={setSelectedProduct} 
                setShowProduct={setShowProduct}
              />
              <Product 
                product={selectedProduct} 
                show={showProduct} 
                setShow={setShowProduct} 
                clearProduct={() => setSelectedProduct(null)}   
              />
              <Cart
                setSelectedProduct={setSelectedProduct} 
                setShowProduct={setShowProduct}
                show={showProduct}
              />
              <BuyHistory 
                setSelectedProduct={setSelectedProduct} 
                setShowProduct={setShowProduct}
                showProduct={showProduct}
              />
              <LangButton />
              <Draq 
                setSelectedProduct={setSelectedProduct} 
                setShowProduct={setShowProduct}
                show={showProduct}
              />
            </div>
          </CartProvider>
        </WebSocketFormProvider>
      </LangProvider>
    </ViewModeProvider>
  );
}

export default MainApp;
