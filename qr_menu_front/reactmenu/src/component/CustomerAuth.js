import { useState, useRef, useEffect } from "react";
import { useLang } from "../LangContext";
import { HiOutlineUserCircle } from "react-icons/hi2";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";

export default function CustomerAuth({ onOpenOrdersHistory, onOpenCart }) {
  const [show, setShow] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullname, setFullname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [userFullname, setUserFullname] = useState("");
  const token = localStorage.getItem("customer_token");
  const { refetchMenu } = useLang();

  useEffect(() => {
    if (!token) {
      setUserFullname("");
      return;
    }
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((res) => {
        if (res.status === 401) {
          localStorage.removeItem("customer_token");
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        if (data && data.fullname != null) setUserFullname(data.fullname || "");
      })
      .catch(() => setUserFullname(""));
  }, [token]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    if (menuOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [menuOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login"
        ? { email, password }
        : { fullname: fullname || email, email, password };
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text().then((t) => t || res.statusText));
      const data = await res.json();
      localStorage.setItem("customer_token", data.access_token);
      setShow(false);
      setEmail("");
      setPassword("");
      setFullname("");
      refetchMenu();
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setMenuOpen(false);
    setUserFullname("");
    localStorage.removeItem("customer_token");
    setShow(false);
    refetchMenu();
  };

  const openOrdersHistory = () => {
    setMenuOpen(false);
    onOpenOrdersHistory?.();
  };

  const openUnconfirmedOrder = () => {
    setMenuOpen(false);
    onOpenCart?.();
  };

  if (token) {
    return (
      <div className="customer-auth" ref={menuRef}>
        {userFullname && (
          <span className="customer-auth-fullname">{userFullname}</span>
        )}
        <button
          type="button"
          className="customer-auth-user-btn"
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          <HiOutlineUserCircle />
        </button>
        {menuOpen && (
          <div className="customer-auth-dropdown">
            <button type="button" onClick={openOrdersHistory}>
              Orders history
            </button>
            <button type="button" onClick={openUnconfirmedOrder}>
              Unconfirmed order
            </button>
            <button type="button" onClick={logout}>
              Logout
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="customer-auth">
      <button
        type="button"
        onClick={() => { setShow(true); setMode("login"); setError(""); }}
        className="customer-auth-btn"
      >
        Login
      </button>
      <button
        type="button"
        onClick={() => { setShow(true); setMode("register"); setError(""); }}
        className="customer-auth-btn"
      >
        Register
      </button>
      {show && (
        <div className="customer-auth-modal" onClick={() => setShow(false)}>
          <div className="customer-auth-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{mode === "login" ? "Login" : "Register"}</h3>
            <form onSubmit={handleSubmit} className="customer-auth-form">
              {mode === "register" && (
                <input
                  type="text"
                  placeholder="Full name"
                  value={fullname}
                  onChange={(e) => setFullname(e.target.value)}
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error && <p className="customer-auth-error">{error}</p>}
              <button type="submit" disabled={loading} className="customer-auth-submit">
                {loading ? "..." : mode === "login" ? "Login" : "Register"}
              </button>
              <button type="button" onClick={() => setShow(false)} className="customer-auth-cancel">
                Cancel
              </button>
            </form>
            <p className="customer-auth-switch">
              {mode === "login" ? "No account? " : "Have an account? "}
              <button
                type="button"
                onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              >
                {mode === "login" ? "Register" : "Login"}
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
