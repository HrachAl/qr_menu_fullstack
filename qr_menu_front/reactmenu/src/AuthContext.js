import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext();

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem("token"));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            fetchUser();
        } else {
            setLoading(false);
        }
    }, [token]);

    const fetchUser = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(response.data);
        } catch (error) {
            console.error("Failed to fetch user:", error);
            logout();
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {
        try {
            const response = await axios.post(`${API_URL}/api/auth/login`, {
                username,
                password
            });
            const { access_token } = response.data;
            localStorage.setItem("token", access_token);
            setToken(access_token);
            
            const userResponse = await axios.get(`${API_URL}/api/auth/me`, {
                headers: { Authorization: `Bearer ${access_token}` }
            });
            setUser(userResponse.data);
            
            return { success: true, user: userResponse.data };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail || "Login failed" };
        }
    };

    const register = async (username, password) => {
        try {
            const response = await axios.post(`${API_URL}/api/auth/register`, {
                username,
                password
            });
            const { access_token } = response.data;
            localStorage.setItem("token", access_token);
            setToken(access_token);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail || "Registration failed" };
        }
    };

    const logout = () => {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
    };

    const getAuthHeaders = () => {
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            loading,
            login,
            register,
            logout,
            isAuthenticated: !!user,
            isAdmin: user?.role === "admin",
            getAuthHeaders
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
