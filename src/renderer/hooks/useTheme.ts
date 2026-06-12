/**
 * 主题管理 Hook
 * 支持 light / dark / system 三种模式
 * system 模式自动跟随操作系统主题变化
 */

import { useState, useEffect, useCallback } from 'react'

type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'rdm-theme'

function getSystemIsDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function applyTheme(mode: ThemeMode) {
  const isDark = mode === 'dark' || (mode === 'system' && getSystemIsDark())
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'system'
    } catch {
      return 'system'
    }
  })

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode)
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // ignore
    }
    applyTheme(mode)
  }, [])

  // 初始化 + 监听系统主题变化
  useEffect(() => {
    applyTheme(theme)

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => applyTheme('system')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  const isDark =
    theme === 'dark' || (theme === 'system' && getSystemIsDark())

  return { theme, setTheme, isDark }
}
