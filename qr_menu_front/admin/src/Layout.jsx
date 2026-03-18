import { Outlet, NavLink } from 'react-router-dom';
import { Bell, ChevronRight, LayoutDashboard, LogOut, Menu, Package, ShoppingCart, Users, BarChart3, Boxes, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/statistics', label: 'Statistics', icon: BarChart3 },
];

export default function Layout() {
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const pageTitle = useMemo(() => {
    const current = navItems.find((item) => {
      if (item.end) return location.pathname === item.to;
      return location.pathname.startsWith(item.to);
    });
    return current?.label ?? 'Admin';
  }, [location.pathname]);

  const linkClasses = ({ isActive }) => (
    [
      'group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all',
      isActive
        ? 'bg-slate-800/70 text-white shadow-[inset_3px_0_0_0_theme(colors.indigo.500)]'
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100',
    ].join(' ')
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="lg:hidden fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-slate-800/90 bg-slate-950/95 px-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40">Q</div>
          <p className="text-sm font-semibold tracking-wide text-slate-100">QR Menu Admin</p>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {menuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-30 w-72 border-r border-slate-800 bg-slate-900/95 p-6 transition-transform duration-300 lg:translate-x-0',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40">Q</div>
          <div>
            <p className="text-sm font-semibold text-slate-100">QR Menu Admin</p>
            <p className="text-xs text-slate-400">Control Center</p>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={linkClasses}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={17} className="text-slate-500 transition-colors group-hover:text-slate-300" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight size={14} className="text-slate-600 transition-colors group-hover:text-slate-400" />
              </NavLink>
            );
          })}
        </nav>

        <div className="absolute inset-x-6 bottom-6">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 mt-16 border-b border-slate-800/90 bg-slate-950/80 backdrop-blur lg:mt-0">
          <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8">
            <div>
              <p className="text-xs text-slate-400">Admin / {pageTitle}</p>
              <h1 className="text-lg font-semibold text-slate-100">{pageTitle}</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-100"
                aria-label="Notifications"
              >
                <Bell size={18} />
              </button>
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-1.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-semibold text-indigo-300">AD</div>
                <span className="hidden text-sm text-slate-300 sm:block">Administrator</span>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 pb-8 pt-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
