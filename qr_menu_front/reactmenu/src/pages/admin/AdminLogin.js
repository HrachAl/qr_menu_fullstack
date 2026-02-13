import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import "../Auth.css";

export default function AdminLogin() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const result = await login(username, password);
        
        if (result.success) {
            if (result.user?.role === "admin") {
                navigate("/admin");
            } else {
                setError("Մուտքը թույլատրված է միայն ադմինիստրատորների համար");
                setLoading(false);
            }
        } else {
            setError(result.error || "Սխալ մուտքանուն կամ գաղտնաբառ");
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-box">
                <h1>Admin Panel</h1>
                <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>
                    Մուտք ադմինիստրատորի համար
                </p>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Օգտանուն</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            disabled={loading}
                            autoComplete="username"
                        />
                    </div>
                    <div className="form-group">
                        <label>Գաղտնաբառ</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                            autoComplete="current-password"
                        />
                    </div>
                    {error && <div className="error-message">{error}</div>}
                    <button type="submit" disabled={loading}>
                        {loading ? "Բեռնում..." : "Մուտք"}
                    </button>
                </form>
                <p className="auth-link" style={{ textAlign: 'center', marginTop: '20px' }}>
                    <a href="/" style={{ color: '#667eea', textDecoration: 'none' }}>
                        ← Վերադառնալ գլխավոր էջ
                    </a>
                </p>
            </div>
        </div>
    );
}
