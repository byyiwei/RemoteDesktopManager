/**
 * 渲染进程共享类型定义
 */

/** 预置堡垒机 / VPN 选项 */
export interface BastionHostOption {
  key: string
  label: string
  color: string
}

export const BASTION_HOST_OPTIONS: BastionHostOption[] = [
  { key: 'v5vpn',       label: 'V5VPN',            color: '#16a34a' },
  { key: 'inode',       label: 'iNode智能客户端',    color: '#2563eb' },
  { key: 'easyconnect', label: 'EasyConnect',       color: '#0d9488' },
  { key: 'opsclient',   label: '运维客户端',         color: '#0891b2' },
  { key: 'secoclient',  label: 'SecoClient',        color: '#dc2626' },
  { key: 'rgsslvpn',    label: 'RgSSL VPN',         color: '#1e3a5f' },
  { key: 'tgfw',        label: 'tgfw',              color: '#b91c1c' },
  { key: 'atrust',      label: 'aTrust',            color: '#059669' },
  { key: 'sslvpn',      label: 'SSLVPN Client',     color: '#1d4ed8' },
  { key: 'hillstone',   label: 'Hillstone',         color: '#1e40af' },
]

/** 前端展示用的连接数据 */
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

/** 新建连接输入 */
export interface CreateConnectionInput {
  clientName: string
  ipAddress: string
  port: number
  username: string
  password: string
  bastionHosts: string[]
}

/** 更新连接输入 */
export interface UpdateConnectionInput {
  id: string
  clientName?: string
  ipAddress?: string
  port?: number
  username?: string
  password?: string
  bastionHosts?: string[]
}

/** 软件快捷方式 */
export interface Shortcut {
  id: string
  name: string
  exePath: string
  arguments?: string
  iconData?: string
  createdAt: string
}

/** 托盘设置 */
export interface TraySettings {
  enableTray: boolean
  minimizeToTray: boolean
  closeToTray: boolean
  shortcutKey: string
  shortcutEnabled: boolean
}
