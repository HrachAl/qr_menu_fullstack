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

function App() {
  const [showMenu, setShowMenu] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProduct, setShowProduct] = useState(false);

  return (
    <ViewModeProvider>
      <LangProvider>
        <WebSocketFormProvider>
          <CartProvider>
            <div className="App">
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

export default App;
