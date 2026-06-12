/**
 * 自定义标题栏组件
 * 用于无边框窗口，提供拖拽移动 + 最小化/最大化/关闭按钮
 */

import React, { useState, useEffect, useCallback } from 'react'

const APP_TITLE = '远程桌面管理工具'

/** 窗口控制按钮 SVG 图标 */
const MinimizeIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10">
    <rect y="4" width="10" height="1.2" fill="currentColor" />
  </svg>
)

const MaximizeIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10">
    <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.2" />
  </svg>
)

const RestoreIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10">
    <rect x="2.5" y="0.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.1" />
    <rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.1" />
    <rect x="0.5" y="2.5" width="7" height="0.8" fill="currentColor" />
  </svg>
)

const CloseIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10">
    <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1.3" />
    <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" stroke="currentColor" strokeWidth="1.3" />
  </svg>
)

/** RDM 应用图标（显示器 + 连接符号） */
const AppIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="2" width="14" height="11" rx="1.5" stroke="#fff" strokeWidth="1.5" fill="none" />
    <line x1="5" y1="5.5" x2="12" y2="5.5" stroke="#fff" strokeWidth="1" opacity="0.7" />
    <line x1="5" y1="8" x2="10" y2="8" stroke="#fff" strokeWidth="1" opacity="0.7" />
    <line x1="6" y1="13" x2="6" y2="15" stroke="#fff" strokeWidth="1.3" />
    <line x1="4" y1="15" x2="8" y2="15" stroke="#fff" strokeWidth="1.3" />
    <circle cx="17" cy="14" r="3.5" fill="#4ade80" stroke="#fff" strokeWidth="1.2" />
    <polyline points="15.5,14 16.8,15.3 19,13" stroke="#fff" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="13" y1="11" x2="15" y2="13" stroke="#fff" strokeWidth="1.2" strokeDasharray="1.5 1" />
  </svg>
)

const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false)
  const [hoverBtn, setHoverBtn] = useState<string | null>(null)

  useEffect(() => {
    if (!window.rdm?.window) return
    window.rdm.window.isMaximized().then(setIsMaximized)

    const checkMaximized = () => {
      window.rdm?.window.isMaximized().then(setIsMaximized)
    }
    window.addEventListener('resize', checkMaximized)
    return () => window.removeEventListener('resize', checkMaximized)
  }, [])

  const handleMinimize = useCallback(() => {
    window.rdm?.window.minimize()
  }, [])

  const handleMaximize = useCallback(() => {
    window.rdm?.window.maximize().then(() => {
      window.rdm?.window.isMaximized().then(setIsMaximized)
    })
  }, [])

  const handleClose = useCallback(() => {
    window.rdm?.window.close()
  }, [])

  const handleDblClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-btn]')) return
    handleMaximize()
  }, [handleMaximize])

  return (
    <div className="titlebar" onDoubleClick={handleDblClick}>
      {/* 左侧：图标 + 标题 */}
      <div className="titlebar-left">
        <span className="titlebar-icon">
          <AppIcon />
        </span>
        <span className="titlebar-title">{APP_TITLE}</span>
      </div>

      {/* 右侧：窗口控制按钮 */}
      <div className="titlebar-buttons">
        <button
          data-btn="min"
          className={`titlebar-btn ${hoverBtn === 'min' ? 'hovered' : ''}`}
          onMouseEnter={() => setHoverBtn('min')}
          onMouseLeave={() => setHoverBtn(null)}
          onClick={handleMinimize}
          aria-label="最小化"
        >
          <MinimizeIcon />
        </button>

        <button
          data-btn="max"
          className={`titlebar-btn ${hoverBtn === 'max' ? 'hovered' : ''}`}
          onMouseEnter={() => setHoverBtn('max')}
          onMouseLeave={() => setHoverBtn(null)}
          onClick={handleMaximize}
          aria-label={isMaximized ? '还原' : '最大化'}
        >
          {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
        </button>

        <button
          data-btn="close"
          className={`titlebar-btn titlebar-btn-close ${hoverBtn === 'close' ? 'hovered' : ''}`}
          onMouseEnter={() => setHoverBtn('close')}
          onMouseLeave={() => setHoverBtn(null)}
          onClick={handleClose}
          aria-label="关闭"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}

export default TitleBar
