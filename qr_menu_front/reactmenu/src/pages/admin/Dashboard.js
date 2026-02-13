import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../AuthContext";
import "./ModernAdmin.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const { getAuthHeaders } = useAuth();

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/admin/stats`, {
                headers: getAuthHeaders()
            });
            setStats(response.data);
        } catch (error) {
            console.error("Failed to fetch stats:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading">Բեռնում...</div>;

    return (
        <div className="admin-page">
            <div className="page-header">
                <h1>Dashboard</h1>
            </div>
            
            <div className="stats-grid">
                <div className="stat-card blue">
                    <h3>Օգտատերեր</h3>
                    <div className="stat-number">{stats?.total_users || 0}</div>
                    <div className="stat-change">Ընդհանուր գրանցված</div>
                </div>
                <div className="stat-card green">
                    <h3>Պատվերներ</h3>
                    <div className="stat-number">{stats?.total_orders || 0}</div>
                    <div className="stat-change">Ընդհանուր պատվերներ</div>
                </div>
                <div className="stat-card red">
                    <h3>Իրադարձություններ</h3>
                    <div className="stat-number">{stats?.total_events || 0}</div>
                    <div className="stat-change">Օգտատերերի գործողություններ</div>
                </div>
            </div>

            <div className="card">
                <h2 style={{marginBottom: '20px', fontSize: '20px', fontWeight: '600'}}>Վերջին գործունեություն</h2>
                <p style={{color: '#6b7280'}}>Վիճակագրությունը թարմացվում է իրական ժամանակում</p>
            </div>
        </div>
    );
}
