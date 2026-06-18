/**
 * 应用主布局
 * 结构：TitleBar（无边框标题栏）+ Toolbar（工具栏）+ Content（主体）
 * 竖屏优化：紧凑工具栏，次要功能收纳进下拉菜单
 */

import React, { useState, useEffect } from 'react'
import { Button, Input, Switch, Tooltip, message, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  ExportOutlined,
  ImportOutlined,
  SunOutlined,
  MoonOutlined,
  DesktopOutlined,
  SettingOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import TitleBar from './TitleBar'

type ThemeMode = 'light' | 'dark' | 'system'

interface LayoutProps {
  children: React.ReactNode
  onAdd: () => void
  onServerSearch?: (keyword: string) => void
  onServerSearchConnect?: () => void
  onServerSearchNavigate?: (direction: 'up' | 'down' | 'activate') => void
  onExport?: () => void
  onImport?: () => void
  onSettings?: () => void
  theme?: ThemeMode
  onThemeChange?: (theme: ThemeMode) => void
}

const Layout: React.FC<LayoutProps> = ({ children, onAdd, onServerSearch, onServerSearchConnect, onServerSearchNavigate, onExport, onImport, onSettings, theme, onThemeChange }) => {
  const [autoStart, setAutoStart] = useState(false)
  const [autoStartLoading, setAutoStartLoading] = useState(true)
  const [messageApi, contextHolder] = message.useMessage()
  const isElectron = !!window.rdm

  useEffect(() => {
    if (window.rdm) {
      window.rdm.settings.getAutoStart().then((r) => {
        setAutoStart(r.enabled)
        setAutoStartLoading(false)
      })
    } else {
      setAutoStartLoading(false)
    }
  }, [])

  const handleAutoStartChange = async (checked: boolean) => {
    if (!window.rdm) return
    setAutoStart(checked)
    const r = await window.rdm.settings.setAutoStart(checked)
    if (!r.success) messageApi.error(r.error || '设置失败')
  }

  const handleCreateDesktopShortcut = async () => {
    if (!window.rdm) return
    try {
      const r = await window.rdm.settings.createDesktopShortcut()
      if (r.success) messageApi.success('桌面快捷方式已创建！')
      else messageApi.error(r.error || '创建失败')
    } catch (e) {
      messageApi.error(`创建失败: ${(e as Error).message}`)
    }
  }

  // 设置下拉菜单（主题、开机启动、桌面快捷方式）
  const settingsMenuItems: MenuProps['items'] = [
    {
      key: 'theme-group',
      type: 'group',
      label: '主题',
      children: [
        {
          key: 'light',
          icon: <SunOutlined />,
          label: '亮色',
          onClick: () => onThemeChange?.('light'),
        },
        {
          key: 'dark',
          icon: <MoonOutlined />,
          label: '暗色',
          onClick: () => onThemeChange?.('dark'),
        },
        {
          key: 'system',
          icon: <DesktopOutlined />,
          label: '跟随系统',
          onClick: () => onThemeChange?.('system'),
        },
      ],
    },
    { type: 'divider' },
    {
      key: 'autostart',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span>开机自启动</span>
          <Switch
            size="small"
            checked={autoStart}
            loading={autoStartLoading}
            onChange={handleAutoStartChange}
            onClick={(_, e) => e.stopPropagation()}
          />
        </div>
      ),
    },
    {
      key: 'shortcut',
      icon: <LinkOutlined />,
      label: '创建桌面快捷方式',
      onClick: handleCreateDesktopShortcut,
    },
    { type: 'divider' },
    {
      key: 'system-settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      onClick: onSettings,
    },
  ]

  return (
    <div className="app-layout">
      {contextHolder}

      {/* 无边框自定义标题栏（仅 Electron 环境） */}
      {isElectron && <TitleBar />}

      {/* 工具栏 */}
      <div className="app-toolbar">
        <div className="app-toolbar-left">
          <div className="search-group">
            {onServerSearch && (
              <div className="search-input-wrapper">
                <Input
                  placeholder="搜索服务器（回车连接）"
                  prefix={<SearchOutlined />}
                  allowClear
                  onChange={(e) => onServerSearch?.(e.target.value)}
                  onPressEnter={onServerSearchConnect}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      onServerSearchNavigate?.('up')
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      onServerSearchNavigate?.('down')
                    } else if (e.key === 'Enter') {
                      e.preventDefault()
                      onServerSearchNavigate?.('activate')
                    }
                  }}
                  size="small"
                />
              </div>
            )}
          </div>
        </div>

        <div className="app-toolbar-right">
          {/* 导入/导出 */}
          {isElectron && onExport && onImport && (
            <>
              <Tooltip title="导出连接列表">
                <Button
                  type="text"
                  size="small"
                  icon={<ExportOutlined />}
                  onClick={onExport}
                  className="toolbar-ghost-btn"
                />
              </Tooltip>
              <Tooltip title="导入连接列表">
                <Button
                  type="text"
                  size="small"
                  icon={<ImportOutlined />}
                  onClick={onImport}
                  className="toolbar-ghost-btn"
                />
              </Tooltip>
            </>
          )}

          {/* 设置菜单 */}
          <Dropdown menu={{ items: settingsMenuItems, selectedKeys: [theme || 'system'] }} placement="bottomRight" trigger={['click']}>
            <Tooltip title="设置">
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                className="toolbar-ghost-btn"
              />
            </Tooltip>
          </Dropdown>

          {/* 新建连接 */}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onAdd}
            size="small"
            className="btn-primary"
          >
            新建连接
          </Button>
        </div>
      </div>

      {/* 主体内容区 */}
      <div className="app-content">
        {children}
      </div>
    </div>
  )
}

export default Layout
