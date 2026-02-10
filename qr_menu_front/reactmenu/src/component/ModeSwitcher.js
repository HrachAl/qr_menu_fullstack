import { useViewMode } from "../ViewModeContext";
import { IoMdMoon } from "react-icons/io";
import { IoSunny } from "react-icons/io5";
import { MdPhoneIphone, MdDesktopWindows } from "react-icons/md";

export default function ModeSwitcher() {
    const { viewMode, theme, toggleViewMode, toggleTheme } = useViewMode();

    return (
        <div className="mode-switcher">
            <button
                className="mode-btn theme-btn"
                onClick={toggleTheme}
                title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
                {theme === "dark" ? <IoMdMoon /> : <IoSunny />}
            </button>
            <button
                className="mode-btn view-btn"
                onClick={toggleViewMode}
                title={viewMode === "desktop" ? "Switch to Mobile View" : "Switch to Desktop View"}
            >
                {viewMode === "desktop" ? <MdPhoneIphone /> : <MdDesktopWindows />}
            </button>
        </div>
    );
}
