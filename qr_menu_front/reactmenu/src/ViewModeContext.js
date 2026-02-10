import { createContext, useContext, useState, useEffect } from "react";

const ViewModeContext = createContext();

export const ViewModeProvider = ({ children }) => {
    const [viewMode, setViewMode] = useState(() => localStorage.getItem("viewMode") || "desktop");
    const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

    useEffect(() => {
        localStorage.setItem("viewMode", viewMode);
    }, [viewMode]);

    useEffect(() => {
        localStorage.setItem("theme", theme);
    }, [theme]);

    useEffect(() => {
        document.body.classList.remove("mobile-mode", "desktop-mode", "theme-dark", "theme-light");
        document.body.classList.add(viewMode === "mobile" ? "mobile-mode" : "desktop-mode");
        document.body.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
    }, [viewMode, theme]);

    const toggleViewMode = () => setViewMode(prev => prev === "mobile" ? "desktop" : "mobile");
    const toggleTheme = () => setTheme(prev => prev === "dark" ? "light" : "dark");

    return (
        <ViewModeContext.Provider value={{ viewMode, theme, toggleViewMode, toggleTheme, setViewMode, setTheme }}>
            {children}
        </ViewModeContext.Provider>
    );
};

export const useViewMode = () => useContext(ViewModeContext);
