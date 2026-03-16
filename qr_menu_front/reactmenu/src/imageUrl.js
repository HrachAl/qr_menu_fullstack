const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";

export function menuImageUrl(imageOrPath) {
    if (!imageOrPath) return "";

    const raw = String(imageOrPath).trim();
    if (!raw) return "";
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
        return raw;
    }

    const normalized = raw
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .replace(/^build\//, "")
        .replace(/^new_menu\//, "");

    return `${API_BASE}/build/new_menu/${normalized}`;
}
