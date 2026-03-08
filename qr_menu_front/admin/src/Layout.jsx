import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function Layout() {
  const { logout } = useAuth();

  return (
    <div className="admin-layout">
      <nav className="admin-nav">
        <h2>Admin</h2>
        <ul>
          <li><NavLink to="/admin" end className={({ isActive }) => isActive ? 'active' : ''}>Dashboard</NavLink></li>
          <li><NavLink to="/admin/users" className={({ isActive }) => isActive ? 'active' : ''}>Users</NavLink></li>
          <li><NavLink to="/admin/products" className={({ isActive }) => isActive ? 'active' : ''}>Products</NavLink></li>
          <li><NavLink to="/admin/orders" className={({ isActive }) => isActive ? 'active' : ''}>Orders</NavLink></li>
          <li><NavLink to="/admin/statistics" className={({ isActive }) => isActive ? 'active' : ''}>Statistics</NavLink></li>
        </ul>
        <button type="button" className="btn-logout" onClick={logout}>Logout</button>
      </nav>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
