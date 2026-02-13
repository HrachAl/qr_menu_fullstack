import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import "./Auth.css";

export default function Register() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { register } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Գաղտնաբառերը չեն համընկնում");
            return;
        }

        if (password.length < 6) {
            setError("Գաղտնաբառը պետք է լինի առնվազն 6 նիշ");
            return;
        }

        setLoading(true);

        const result = await register(username, password);
        
        if (result.success) {
            navigate("/");
        } else {
            setError(result.error);
        }
        
        setLoading(false);
    };

    return (
        <div className="auth-container">
            <div className="auth-box">
                <h1>Գրանցում</h1>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Օգտանուն</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            disabled={loading}
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
                        />
                    </div>
                    <div className="form-group">
                        <label>Հաստատել գաղտնաբառը</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>
                    {error && <div className="error-message">{error}</div>}
                    <button type="submit" disabled={loading}>
                        {loading ? "Բեռնում..." : "Գրանցվել"}
                    </button>
                </form>
                <p className="auth-link">
                    Արդեն ունե՞ք հաշիվ? <Link to="/login">Մուտք</Link>
                </p>
            </div>
        </div>
    );
}
