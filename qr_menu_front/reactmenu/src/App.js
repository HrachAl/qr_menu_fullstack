import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import MainApp from './AppRoutes';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Products from './pages/admin/Products';
import MenuControl from './pages/admin/MenuControl';
import Users from './pages/admin/Users';
import Stats from './pages/admin/Stats';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<MainApp />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="menu" element={<MenuControl />} />
            <Route path="users" element={<Users />} />
            <Route path="stats" element={<Stats />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
