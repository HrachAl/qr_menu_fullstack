import { createContext, useContext, useState, useEffect } from "react";

const ViewModeContext = createContext();

export const ViewModeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

    useEffect(() => {
        localStorage.setItem("theme", theme);
    }, [theme]);

    useEffect(() => {
        document.body.classList.remove("theme-dark", "theme-light");
        document.body.classList.remove("mobile-mode");
        document.body.classList.add("desktop-mode");
        document.body.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === "dark" ? "light" : "dark");

    return (
        <ViewModeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ViewModeContext.Provider>
    );
};

export const useViewMode = () => useContext(ViewModeContext);
