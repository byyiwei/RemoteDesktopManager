/**
 * 预加载脚本
 * 通过 contextBridge 安全地将 API 暴露给渲染进程
 * 这是渲染进程访问 Electron API 的唯一安全通道
 */

import { contextBridge, ipcRenderer } from 'electron'

// ======================== 类型定义（供渲染进程 TypeScript 使用）========================

export interface TraySettings {
  enableTray: boolean
  minimizeToTray: boolean
  closeToTray: boolean
  shortcutKey: string
  shortcutEnabled: boolean
}

export interface RDM_API {
  crypto: {
    check: () => Promise<{ available: boolean; message: string }>
  }
  connection: {
    list: () => Promise<{
      success: boolean
      data?: ConnectionDisplay[]
      error?: string
    }>
    save: (input: CreateConnectionInput) => Promise<{
      success: boolean
      data?: ConnectionDisplay
      error?: string
    }>
    update: (input: UpdateConnectionInput) => Promise<{
      success: boolean
      data?: ConnectionDisplay
      error?: string
    }>
    delete: (id: string) => Promise<{
      success: boolean
      message?: string
      error?: string
    }>
    connect: (id: string) => Promise<{
      success: boolean
      message?: string
      error?: string
    }>
  }
  settings: {
    getAutoStart: () => Promise<{ enabled: boolean }>
    setAutoStart: (enabled: boolean) => Promise<{ success: boolean; error?: string }>
    createDesktopShortcut: () => Promise<{ success: boolean; message?: string; error?: string }>
    getTraySettings: () => Promise<{ success: boolean; data?: TraySettings; error?: string }>
    setTraySettings: (settings: Partial<TraySettings>) => Promise<{ success: boolean; data?: TraySettings; error?: string }>
  }
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
  }
  shortcut: {
    list: () => Promise<{ success: boolean; data?: Shortcut[]; error?: string }>
    add: (input: { name: string; exePath: string; arguments?: string; iconData?: string }) => Promise<{ success: boolean; data?: Shortcut; error?: string }>
    delete: (id: string) => Promise<{ success: boolean; error?: string }>
    batchDelete: (ids: string[]) => Promise<{ success: boolean; data?: number; error?: string }>
    reorder: (orderedIds: string[]) => Promise<{ success: boolean; error?: string }>
    launch: (id: string) => Promise<{ success: boolean; message?: string; error?: string }>
    pickFile: () => Promise<{ success: boolean; data?: { name: string; exePath: string; iconData?: string }; error?: string }>
  }
}

/**
 * 前端展示用的连接数据
 */
export interface ConnectionDisplay {
  id: string
  clientName: string
  ipAddress: string
  port: number
  username: string
  hasPassword: boolean
  bastionHosts: string[]
  createdAt: string
  updatedAt: string
}

/**
 * 新建连接输入
 */
export interface CreateConnectionInput {
  clientName: string
  ipAddress: string
  port: number
  username: string
  password: string
  bastionHosts: string[]
}

/**
 * 更新连接输入
 */
export interface UpdateConnectionInput {
  id: string
  clientName?: string
  ipAddress?: string
  port?: number
  username?: string
  password?: string
  bastionHosts?: string[]
}

export interface Shortcut {
  id: string
  name: string
  exePath: string
  arguments?: string
  iconData?: string
  createdAt: string
}

// ======================== 暴露 API ========================

contextBridge.exposeInMainWorld('rdm', {
  crypto: {
    check: () => ipcRenderer.invoke('crypto:check')
  },
  connection: {
    list: () => ipcRenderer.invoke('connection:list'),
    save: (input: CreateConnectionInput) =>
      ipcRenderer.invoke('connection:save', input),
    update: (input: UpdateConnectionInput) =>
      ipcRenderer.invoke('connection:update', input),
    delete: (id: string) =>
      ipcRenderer.invoke('connection:delete', id),
    connect: (id: string) =>
      ipcRenderer.invoke('connection:connect', id),
    exportList: (passphrase: string) =>
      ipcRenderer.invoke('connection:export', passphrase),
    importList: (passphrase: string) =>
      ipcRenderer.invoke('connection:import', passphrase),
    getPassword: (id: string) =>
      ipcRenderer.invoke('connection:getPassword', id)
  },
  auth: {
    verifyWindowsPassword: (password: string) =>
      ipcRenderer.invoke('auth:verifyWindowsPassword', password)
  },
  settings: {
    getAutoStart: () => ipcRenderer.invoke('settings:getAutoStart'),
    setAutoStart: (enabled: boolean) => ipcRenderer.invoke('settings:setAutoStart', enabled),
    createDesktopShortcut: () => ipcRenderer.invoke('settings:createDesktopShortcut'),
    getTraySettings: () => ipcRenderer.invoke('settings:getTraySettings'),
    setTraySettings: (settings: Partial<TraySettings>) => ipcRenderer.invoke('settings:setTraySettings', settings)
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized')
  },
  shortcut: {
    list: () => ipcRenderer.invoke('shortcut:list'),
    add: (input: { name: string; exePath: string; arguments?: string; iconData?: string }) =>
      ipcRenderer.invoke('shortcut:add', input),
    delete: (id: string) => ipcRenderer.invoke('shortcut:delete', id),
    batchDelete: (ids: string[]) => ipcRenderer.invoke('shortcut:batchDelete', ids),
    reorder: (orderedIds: string[]) => ipcRenderer.invoke('shortcut:reorder', orderedIds),
    launch: (id: string) => ipcRenderer.invoke('shortcut:launch', id),
    pickFile: () => ipcRenderer.invoke('shortcut:pickFile')
  }
})