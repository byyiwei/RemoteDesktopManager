"""
主题管理模块
支持亮色、暗色、跟随系统三种模式
"""
from enum import Enum
from typing import Callable, List
import platform


class ThemeMode(Enum):
    LIGHT = "light"
    DARK = "dark"
    SYSTEM = "system"


# ======================== 亮色主题配色 ========================
LIGHT_THEME = {
    "primary": "#2563eb",
    "primary_light": "#3b82f6",
    "primary_bg": "#eff6ff",
    "success": "#16a34a",
    "success_bg": "#f0fdf4",
    "warning": "#d97706",
    "warning_bg": "#fffbeb",
    "danger": "#dc2626",
    "danger_bg": "#fef2f2",
    "text": "#1a1a2e",
    "text_secondary": "#6b7280",
    "text_muted": "#9ca3af",
    "bg": "#f5f7fa",
    "bg_white": "#ffffff",
    "bg_elevated": "#ffffff",
    "border": "#e5e7eb",
    "border_light": "#f3f4f6",
    "titlebar_bg": "rgba(255, 255, 255, 0.92)",
    "titlebar_border": "rgba(0, 0, 0, 0.07)",
    "titlebar_text": "#1a1a2e",
    "btn_hover": "rgba(0, 0, 0, 0.06)",
    "scrollbar": "rgba(0, 0, 0, 0.12)",
    "scrollbar_hover": "rgba(0, 0, 0, 0.2)",
    "shadow_sm": "0 1px 2px rgba(0, 0, 0, 0.04)",
    "shadow_md": "0 4px 12px rgba(0, 0, 0, 0.06)",
    "shadow_lg": "0 8px 24px rgba(0, 0, 0, 0.08)",
    "card_hover_border": "#3b82f6",
}

# ======================== 暗色主题配色 ========================
DARK_THEME = {
    "primary": "#3b82f6",
    "primary_light": "#60a5fa",
    "primary_bg": "rgba(59, 130, 246, 0.15)",
    "success": "#22c55e",
    "success_bg": "rgba(34, 197, 94, 0.12)",
    "warning": "#f59e0b",
    "warning_bg": "rgba(245, 158, 11, 0.12)",
    "danger": "#ef4444",
    "danger_bg": "rgba(239, 68, 68, 0.12)",
    "text": "#f1f5f9",
    "text_secondary": "#94a3b8",
    "text_muted": "#64748b",
    "bg": "#0f172a",
    "bg_white": "#1e293b",
    "bg_elevated": "#334155",
    "border": "#334155",
    "border_light": "#1e293b",
    "titlebar_bg": "rgba(30, 41, 59, 0.92)",
    "titlebar_border": "rgba(255, 255, 255, 0.06)",
    "titlebar_text": "#e2e8f0",
    "btn_hover": "rgba(255, 255, 255, 0.08)",
    "scrollbar": "rgba(255, 255, 255, 0.15)",
    "scrollbar_hover": "rgba(255, 255, 255, 0.25)",
    "shadow_sm": "0 1px 2px rgba(0, 0, 0, 0.3)",
    "shadow_md": "0 4px 12px rgba(0, 0, 0, 0.4)",
    "shadow_lg": "0 8px 24px rgba(0, 0, 0, 0.5)",
    "card_hover_border": "#60a5fa",
}


class ThemeManager:
    """主题管理器"""

    def __init__(self):
        self._mode = ThemeMode.SYSTEM
        self._listeners: List[Callable[[dict], None]] = []
        self._system_is_dark = False
        self._detect_system_theme()

    def _detect_system_theme(self):
        """检测系统当前主题"""
        if platform.system() == "Windows":
            try:
                import winreg
                with winreg.OpenKey(
                    winreg.HKEY_CURRENT_USER,
                    r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"
                ) as key:
                    value, _ = winreg.QueryValueEx(key, "AppsUseLightTheme")
                    self._system_is_dark = value == 0
            except Exception:
                self._system_is_dark = False
        else:
            self._system_is_dark = False

    @property
    def mode(self) -> ThemeMode:
        return self._mode

    @mode.setter
    def mode(self, value: ThemeMode):
        self._mode = value
        self._notify()

    @property
    def is_dark(self) -> bool:
        if self._mode == ThemeMode.DARK:
            return True
        elif self._mode == ThemeMode.LIGHT:
            return False
        else:
            return self._system_is_dark

    @property
    def colors(self) -> dict:
        return DARK_THEME if self.is_dark else LIGHT_THEME

    def add_listener(self, callback: Callable[[dict], None]):
        """添加主题变化监听器"""
        self._listeners.append(callback)

    def remove_listener(self, callback: Callable[[dict], None]):
        """移除主题变化监听器"""
        if callback in self._listeners:
            self._listeners.remove(callback)

    def _notify(self):
        """通知所有监听器"""
        colors = self.colors
        for listener in self._listeners:
            try:
                listener(colors)
            except Exception:
                pass

    def refresh_system_theme(self):
        """刷新系统主题检测"""
        self._detect_system_theme()
        if self._mode == ThemeMode.SYSTEM:
            self._notify()


# 全局主题管理器实例
theme_manager = ThemeManager()
