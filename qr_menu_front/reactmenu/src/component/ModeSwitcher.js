import { useViewMode } from "../ViewModeContext";
import { IoMdMoon } from "react-icons/io";
import { IoSunny } from "react-icons/io5";

export default function ModeSwitcher() {
    const { theme, toggleTheme } = useViewMode();

    return (
        <div className="mode-switcher">
            <button
                className="mode-btn theme-btn"
                onClick={toggleTheme}
                title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
                {theme === "dark" ? <IoMdMoon /> : <IoSunny />}
            </button>
        </div>
    );
}
