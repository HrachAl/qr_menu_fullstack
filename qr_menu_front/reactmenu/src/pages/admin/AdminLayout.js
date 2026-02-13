import { useEffect } from "react";
import { Navigate, Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import "./ModernAdmin.css";

export default function AdminLayout() {
    const { isAdmin, loading, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        document.body.classList.add("admin-mode");
        return () => {
            document.body.classList.remove("admin-mode");
        };
    }, []);

    if (loading) {
        return <div className="loading">Բեռնում...</div>;
    }

    if (!isAdmin) {
        return <Navigate to="/admin/login" />;
    }

    const handleLogout = () => {
        logout();
        navigate("/admin/login");
    };

    return (
        <div className="admin-layout">
            <aside className="admin-sidebar">
                <h2>Admin Panel</h2>
                <nav>
                    <Link to="/admin">Dashboard</Link>
                    <Link to="/admin/products">Ապրանքներ</Link>
                    <Link to="/admin/menu">Գլոբալ մենյու</Link>
                    <Link to="/admin/users">Օգտատերեր</Link>
                    <Link to="/admin/stats">Վիճակագրություն</Link>
                </nav>
                <button onClick={handleLogout} className="logout-btn">
                    Ելք
                </button>
            </aside>
            <main className="admin-content">
                <Outlet />
            </main>
        </div>
    );
}
