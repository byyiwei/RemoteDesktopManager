/**
 * 数据存储模块
 * 使用原生 fs 模块存储连接元数据（避免 electron-store 的原子写入问题）
 * 密码字段已通过 safeStorage 加密，以 base64 形式存储
 */

import { randomUUID } from 'crypto'
import { mkdir, access, readFile, writeFile } from 'fs/promises'
import { homedir } from 'os'

// ======================== 类型定义 ========================

export interface Connection {
  id: string
  clientName: string
  ipAddress: string
  port: number
  username: string
  encryptedPassword: string
  bastionHosts: string[]
  createdAt: string
  updatedAt: string
}

export interface CreateConnectionInput {
  clientName: string
  ipAddress: string
  port: number
  username: string
  password: string
  bastionHosts: string[]
}

export interface UpdateConnectionInput {
  id: string
  clientName?: string
  ipAddress?: string
  port?: number
  username?: string
  password?: string
  bastionHosts?: string[]
}

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

// ======================== 快捷方式类型 ========================

export interface Shortcut {
  id: string
  name: string
  exePath: string
  arguments?: string
  iconData?: string
  createdAt: string
}

// ======================== 存储配置 ========================

const STORAGE_DIR = homedir() + '/AppData/Roaming/remote-desktop-manager'
const STORAGE_FILE = STORAGE_DIR + '/connections.json'
const SHORTCUTS_FILE = STORAGE_DIR + '/shortcuts.json'

let connectionsCache: Connection[] = []
let shortcutsCache: Shortcut[] = []
let isInitialized = false

// ======================== 辅助函数 ========================

async function ensureStoreDir(): Promise<void> {
  try {
    await access(STORAGE_DIR)
  } catch {
    await mkdir(STORAGE_DIR, { recursive: true })
    console.log('📁 创建存储目录:', STORAGE_DIR)
  }
}

function toDisplay(conn: Connection): ConnectionDisplay {
  return {
    id: conn.id,
    clientName: conn.clientName,
    ipAddress: conn.ipAddress,
    port: conn.port,
    username: conn.username,
    hasPassword: conn.encryptedPassword.length > 0,
    bastionHosts: conn.bastionHosts || [],
    createdAt: conn.createdAt,
    updatedAt: conn.updatedAt
  }
}

// ======================== 存储操作 ========================

export async function initStore(): Promise<void> {
  await ensureStoreDir()
  
  try {
    const data = await readFile(STORAGE_FILE, 'utf-8')
    const parsed = JSON.parse(data)
    connectionsCache = Array.isArray(parsed) ? parsed : []
    console.log('📁 从文件加载连接数据:', connectionsCache.length, '条')
  } catch {
    connectionsCache = []
    await writeFile(STORAGE_FILE, JSON.stringify([]), 'utf-8')
    console.log('📁 创建新的存储文件:', STORAGE_FILE)
  }

  // 加载快捷方式
  try {
    const data = await readFile(SHORTCUTS_FILE, 'utf-8')
    const parsed = JSON.parse(data)
    shortcutsCache = Array.isArray(parsed) ? parsed : []
    console.log('📁 从文件加载快捷方式:', shortcutsCache.length, '条')
  } catch {
    shortcutsCache = []
    await writeFile(SHORTCUTS_FILE, JSON.stringify([]), 'utf-8')
    console.log('📁 创建快捷方式存储文件:', SHORTCUTS_FILE)
  }
  
  isInitialized = true
  console.log('📁 数据存储已初始化')
}

function checkInitialized(): void {
  if (!isInitialized) {
    throw new Error('Store 尚未初始化，请先调用 initStore()')
  }
}

async function saveToFile(): Promise<void> {
  await writeFile(STORAGE_FILE, JSON.stringify(connectionsCache, null, 2), 'utf-8')
}

async function saveShortcutsToFile(): Promise<void> {
  await writeFile(SHORTCUTS_FILE, JSON.stringify(shortcutsCache, null, 2), 'utf-8')
}

export function getAllConnections(): ConnectionDisplay[] {
  checkInitialized()
  return connectionsCache.map(toDisplay)
}

export function getRawConnections(): Connection[] {
  checkInitialized()
  return [...connectionsCache]
}

export function getConnectionById(id: string): Connection | undefined {
  checkInitialized()
  return connectionsCache.find((c) => c.id === id)
}

export async function saveConnection(
  input: CreateConnectionInput,
  encryptPassword: (plaintext: string) => string
): Promise<ConnectionDisplay> {
  checkInitialized()
  
  const now = new Date().toISOString()
  const newConnection: Connection = {
    id: randomUUID(),
    clientName: input.clientName.trim(),
    ipAddress: input.ipAddress.trim(),
    port: input.port,
    username: input.username.trim(),
    encryptedPassword: input.password ? encryptPassword(input.password) : '',
    bastionHosts: input.bastionHosts || [],
    createdAt: now,
    updatedAt: now
  }

  connectionsCache.push(newConnection)
  await saveToFile()

  console.log(`✅ 新增连接: ${newConnection.clientName} (${newConnection.ipAddress})`)
  return toDisplay(newConnection)
}

export async function updateConnection(
  input: UpdateConnectionInput,
  encryptPassword: (plaintext: string) => string
): Promise<ConnectionDisplay | null> {
  checkInitialized()
  
  const index = connectionsCache.findIndex((c) => c.id === input.id)

  if (index === -1) {
    return null
  }

  const existing = connectionsCache[index]

  const updated: Connection = {
    ...existing,
    clientName: input.clientName !== undefined ? input.clientName.trim() : existing.clientName,
    ipAddress: input.ipAddress !== undefined ? input.ipAddress.trim() : existing.ipAddress,
    port: input.port !== undefined ? input.port : existing.port,
    username: input.username !== undefined ? input.username.trim() : existing.username,
    encryptedPassword:
      input.password !== undefined
        ? input.password
          ? encryptPassword(input.password)
          : ''
        : existing.encryptedPassword,
    bastionHosts: input.bastionHosts !== undefined ? input.bastionHosts : (existing.bastionHosts || []),
    updatedAt: new Date().toISOString()
  }

  connectionsCache[index] = updated
  await saveToFile()

  console.log(`✅ 更新连接: ${updated.clientName} (${updated.ipAddress})`)
  return toDisplay(updated)
}

export async function deleteConnection(id: string): Promise<boolean> {
  checkInitialized()
  
  const index = connectionsCache.findIndex((c) => c.id === id)
  
  if (index === -1) {
    return false
  }

  const deleted = connectionsCache[index]
  connectionsCache.splice(index, 1)
  await saveToFile()

  console.log(`🗑️ 删除连接: ${deleted.clientName} (${deleted.ipAddress})`)
  return true
}

export async function batchImportConnections(
  items: Array<{
    clientName: string
    ipAddress: string
    port: number
    username: string
    bastionHosts?: string[]
    encryptedPassword?: string
  }>,
  reencryptPassword?: (portableEncrypted: string) => string
): Promise<ConnectionDisplay[]> {
  checkInitialized()

  const results: ConnectionDisplay[] = []
  const now = new Date().toISOString()

  for (const item of items) {
    let encryptedPassword = ''
    if (item.encryptedPassword && reencryptPassword) {
      try {
        encryptedPassword = reencryptPassword(item.encryptedPassword)
      } catch (e) {
        console.warn(`⚠️ 密码解密失败: ${item.clientName}, 跳过密码`)
        encryptedPassword = ''
      }
    }

    const conn: Connection = {
      id: randomUUID(),
      clientName: (item.clientName || '').trim(),
      ipAddress: (item.ipAddress || '').trim(),
      port: item.port || 3389,
      username: (item.username || '').trim(),
      encryptedPassword,
      bastionHosts: item.bastionHosts || [],
      createdAt: now,
      updatedAt: now
    }
    connectionsCache.push(conn)
    results.push(toDisplay(conn))
  }

  await saveToFile()
  console.log(`✅ 批量导入连接: ${results.length} 条`)
  return results
}

// ======================== 快捷方式操作 ========================

export function getAllShortcuts(): Shortcut[] {
  checkInitialized()
  return [...shortcutsCache]
}

export async function addShortcut(input: { name: string; exePath: string; arguments?: string; iconData?: string }): Promise<Shortcut> {
  checkInitialized()

  const shortcut: Shortcut = {
    id: randomUUID(),
    name: input.name.trim(),
    exePath: input.exePath.trim(),
    arguments: input.arguments?.trim() || '',
    iconData: input.iconData || '',
    createdAt: new Date().toISOString()
  }

  shortcutsCache.push(shortcut)
  await saveShortcutsToFile()
  console.log(`✅ 新增快捷方式: ${shortcut.name} -> ${shortcut.exePath}`)
  return shortcut
}

export async function deleteShortcut(id: string): Promise<boolean> {
  checkInitialized()

  const index = shortcutsCache.findIndex((s) => s.id === id)
  if (index === -1) return false

  const deleted = shortcutsCache[index]
  shortcutsCache.splice(index, 1)
  await saveShortcutsToFile()
  console.log(`🗑️ 删除快捷方式: ${deleted.name}`)
  return true
}

export async function batchDeleteShortcuts(ids: string[]): Promise<number> {
  checkInitialized()
  const idSet = new Set(ids)
  const before = shortcutsCache.length
  shortcutsCache = shortcutsCache.filter(s => !idSet.has(s.id))
  const deleted = before - shortcutsCache.length
  if (deleted > 0) {
    await saveShortcutsToFile()
    console.log(`🗑️ 批量删除快捷方式: ${deleted} 条`)
  }
  return deleted
}

export async function reorderShortcuts(orderedIds: string[]): Promise<void> {
  checkInitialized()
  const map = new Map(shortcutsCache.map(s => [s.id, s]))
  const reordered: Shortcut[] = []
  for (const id of orderedIds) {
    const item = map.get(id)
    if (item) reordered.push(item)
  }
  // 补充可能遗漏的（新添加的等）
  for (const item of shortcutsCache) {
    if (!orderedIds.includes(item.id)) reordered.push(item)
  }
  shortcutsCache = reordered
  await saveShortcutsToFile()
  console.log(`🔀 快捷方式排序已更新`)
}
