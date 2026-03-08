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
import TopBar from './component/TopBar';
import Draq from './component/Drag';
import OrderHistoryPanel from './component/OrderHistoryPanel';
import { WebSocketFormProvider } from './WebSocketProvider';
import { ViewModeProvider } from './ViewModeContext';

function App() {
  const [showMenu, setShowMenu] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProduct, setShowProduct] = useState(false);
  const [showOrdersHistory, setShowOrdersHistory] = useState(false);
  const [showCartPanel, setShowCartPanel] = useState(false);

  return (
    <ViewModeProvider>
      <LangProvider>
        <WebSocketFormProvider>
          <CartProvider>
            <div className="App">
              <TopBar
                onOpenOrdersHistory={() => setShowOrdersHistory(true)}
                onOpenCart={() => setShowCartPanel(true)}
              />
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
                showCartPanel={showCartPanel}
                onCartPanelOpened={() => setShowCartPanel(false)}
              />
              <OrderHistoryPanel
                show={showOrdersHistory}
                onClose={() => setShowOrdersHistory(false)}
              />
              <BuyHistory 
                setSelectedProduct={setSelectedProduct} 
                setShowProduct={setShowProduct}
                showProduct={showProduct}
              />
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

export default App;
