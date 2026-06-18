/**
 * IPC 事件处理器
 * 注册所有主进程与渲染进程之间的 IPC 通信通道
 */

import { ipcMain, app, BrowserWindow, dialog, shell } from 'electron'
import { join, dirname } from 'path'
import { readFile, writeFile } from 'fs/promises'
import {
  getAllConnections,
  getRawConnections,
  getConnectionById,
  saveConnection,
  updateConnection,
  deleteConnection,
  batchImportConnections,
  getAllShortcuts,
  addShortcut,
  deleteShortcut,
  batchDeleteShortcuts,
  reorderShortcuts,
  getSettings,
  updateSettings
} from './store'
import { encryptPassword, decryptPassword, portableEncrypt, portableDecrypt, isEncryptionAvailable, verifyWindowsPassword } from './crypto'
import { startRdpConnection, validateIp, validatePort } from './rdp'

// ======================== 图标提取工具 ========================

/**
 * 使用 PowerShell + System.Drawing 提取 exe 图标，返回 base64 PNG data URL
 */
async function extractExeIcon(exePath: string): Promise<string> {
  const { execFile } = require('child_process')
  const { promisify } = require('util')
  const execFileAsync = promisify(execFile)

  const psScript = `
Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Icon]::ExtractAssociatedIcon('${exePath.replace(/'/g, "''")}')
if ($icon -ne $null) {
    $bmp = $icon.ToBitmap()
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
    $bmp.Dispose()
    $ms.Dispose()
    $icon.Dispose()
    [Convert]::ToBase64String($bytes)
} else {
    Write-Error 'NO_ICON'
}
`.trim()

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', psScript],
      { encoding: 'utf-8', timeout: 8000, maxBuffer: 1024 * 1024 }
    )
    const base64 = stdout.trim()
    if (base64 && base64.length > 100) {
      return `data:image/png;base64,${base64}`
    }
  } catch (e) {
    console.warn('PowerShell 图标提取失败:', (e as Error).message)
  }
  return ''
}

/**
 * 注册所有 IPC 处理器
 */
export function registerIpcHandlers(): void {
  console.log('📡 注册 IPC 处理器...')

  // ======================== 加密状态检查 ========================

  /**
   * 检查加密模块是否可用
   */
  ipcMain.handle('crypto:check', () => {
    return {
      available: isEncryptionAvailable(),
      message: isEncryptionAvailable()
        ? '加密模块可用（safeStorage / DPAPI）'
        : '加密模块不可用！请确保在 Windows 环境下运行，且用户已登录。'
    }
  })

  // ======================== 连接列表 ========================

  /**
   * 获取所有连接列表（不含密码）
   */
  ipcMain.handle('connection:list', () => {
    try {
      const connections = getAllConnections()
      return { success: true, data: connections }
    } catch (error) {
      return {
        success: false,
        error: `获取连接列表失败: ${(error as Error).message}`
      }
    }
  })

  // ======================== 保存连接 ========================

  /**
   * 保存新连接
   * 入参包含明文密码，主进程加密后存储
   */
  ipcMain.handle('connection:save', async (_event, input) => {
    try {
      // 验证必填字段
      if (!input.clientName || input.clientName.trim() === '') {
        return { success: false, error: '客户名称不能为空' }
      }
      if (!input.ipAddress || input.ipAddress.trim() === '') {
        return { success: false, error: 'IP 地址不能为空' }
      }
      if (!validateIp(input.ipAddress)) {
        return { success: false, error: `无效的 IP 地址: ${input.ipAddress}` }
      }
      if (input.port !== undefined && !validatePort(input.port)) {
        return { success: false, error: `无效的端口号: ${input.port}，范围 1-65535` }
      }
      // 用户名不填默认使用 Administrator
      if (!input.username || input.username.trim() === '') {
        input.username = 'Administrator'
      }

      const result = await saveConnection(input, encryptPassword)
      return { success: true, data: result }
    } catch (error) {
      return {
        success: false,
        error: `保存连接失败: ${(error as Error).message}`
      }
    }
  })

  // ======================== 更新连接 ========================

  /**
   * 更新已有连接
   * 如果提供了新密码则加密后更新，否则保持原密码不变
   */
  ipcMain.handle('connection:update', async (_event, input) => {
    try {
      if (!input.id) {
        return { success: false, error: '连接 ID 不能为空' }
      }

      // 验证可选字段
      if (input.ipAddress !== undefined) {
        if (!input.ipAddress.trim()) {
          return { success: false, error: 'IP 地址不能为空' }
        }
        if (!validateIp(input.ipAddress)) {
          return { success: false, error: `无效的 IP 地址: ${input.ipAddress}` }
        }
      }
      if (input.port !== undefined && !validatePort(input.port)) {
        return { success: false, error: `无效的端口号: ${input.port}，范围 1-65535` }
      }

      const result = await updateConnection(input, encryptPassword)
      if (!result) {
        return { success: false, error: '未找到指定的连接' }
      }
      return { success: true, data: result }
    } catch (error) {
      return {
        success: false,
        error: `更新连接失败: ${(error as Error).message}`
      }
    }
  })

  // ======================== 删除连接 ========================

  /**
   * 删除连接
   */
  ipcMain.handle('connection:delete', async (_event, id: string) => {
    try {
      if (!id) {
        return { success: false, error: '连接 ID 不能为空' }
      }
      const deleted = await deleteConnection(id)
      if (!deleted) {
        return { success: false, error: '未找到指定的连接' }
      }
      return { success: true, message: '连接已删除' }
    } catch (error) {
      return {
        success: false,
        error: `删除连接失败: ${(error as Error).message}`
      }
    }
  })

  // ======================== RDP 连接 ========================

  /**
   * 启动 RDP 远程桌面连接
   * 根据 ID 获取连接详情，解密密码，然后启动 RDP
   */
  ipcMain.handle('connection:connect', async (_event, id: string) => {
    try {
      if (!id) {
        return { success: false, error: '连接 ID 不能为空' }
      }

      // 获取连接信息
      const connection = getConnectionById(id)
      if (!connection) {
        return { success: false, error: '未找到指定的连接' }
      }

      // 检查是否有密码
      if (!connection.encryptedPassword) {
        return { success: false, error: '该连接未设置密码，无法自动登录' }
      }

      // 解密密码
      let decryptedPassword: string
      try {
        decryptedPassword = decryptPassword(connection.encryptedPassword)
      } catch (error) {
        return {
          success: false,
          error: `密码解密失败: ${(error as Error).message}。请尝试重新保存连接密码。`
        }
      }

      if (!decryptedPassword) {
        return { success: false, error: '密码为空，无法连接' }
      }

      // 启动 RDP 连接（此操作为异步阻塞，等待 mstsc 关闭）
      const result = await startRdpConnection(
        connection.ipAddress,
        connection.port,
        connection.username,
        decryptedPassword
      )

      return { success: true, message: result.message }
    } catch (error) {
      return {
        success: false,
        error: `RDP 连接失败: ${(error as Error).message}`
      }
    }
  })

  // ======================== 设置：开机自启动 ========================

  ipcMain.handle('settings:getAutoStart', () => {
    try {
      const settings = app.getLoginItemSettings()
      return { enabled: settings.openAtLogin }
    } catch (error) {
      return { enabled: false }
    }
  })

  ipcMain.handle('settings:setAutoStart', (_event, enabled: boolean) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        path: process.execPath,
        args: []
      })
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // ======================== 设置：创建桌面快捷方式 ========================
  
  // ======================== 设置：托盘配置 ========================

ipcMain.handle('settings:getTraySettings', () => {
  try {
    const settings = getSettings()
    return { success: true, data: settings }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('settings:setTraySettings', async (_event, settings: any) => {
  try {
    const result = await updateSettings(settings)
    
    // 如果快捷键被修改或启用状态变化，重新注册
    if (settings.shortcutKey !== undefined || settings.shortcutEnabled !== undefined) {
      const { reRegisterGlobalShortcut } = require('./index')
      if (result.shortcutEnabled && result.shortcutKey) {
        reRegisterGlobalShortcut(result.shortcutKey)
      } else {
        const { globalShortcut } = require('electron')
        globalShortcut.unregisterAll()
      }
    }
    
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('settings:createDesktopShortcut', async () => {
    try {
      const { exec } = require('child_process')
      const { promisify } = require('util')
      const { writeFile: fsWriteFile } = require('fs/promises')
      const { unlink: fsUnlink } = require('fs/promises')
      const { tmpdir } = require('os')
      const { randomUUID } = require('crypto')
      const execAsync = promisify(exec)
  
      const desktopPath = join(app.getPath('desktop'), 'Windows运维远程桌面管理工具.lnk')
  
      const targetPath = process.execPath
      const workingDir = app.isPackaged ? dirname(process.execPath) : app.getAppPath()

      // 图标源：打包后使用 exe 自身嵌入的图标，开发模式使用 resources/icon.ico
      const iconPath = app.isPackaged
        ? `${targetPath},0`
        : join(app.getAppPath(), 'resources', 'icon.ico')
  
      // 将 PowerShell 脚本写入临时文件，避免命令行引号嵌套问题
      const psFilePath = join(tmpdir(), `rdm_shortcut_${randomUUID()}.ps1`)
      const psScript = [
        '$WshShell = New-Object -ComObject WScript.Shell',
        `$Shortcut = $WshShell.CreateShortcut('${desktopPath}')`,
        `$Shortcut.TargetPath = '${targetPath}'`,
        `$Shortcut.WorkingDirectory = '${workingDir}'`,
        // 使用 exe 本身作为图标源（exe 已嵌入正确图标，,0 表示第一个图标资源）
        `$Shortcut.IconLocation = '${iconPath}'`,
        "$Shortcut.Description = 'Windows运维远程桌面管理工具 v1.0.0'",
        '$Shortcut.Save()'
      ].join('\r\n')
  
      // 关键：PowerShell 默认以系统编码（中文 Windows 为 GBK）读取脚本文件
      // 必须写入 UTF-8 BOM 头，否则脚本中的中文路径会乱码
      const BOM = Buffer.from([0xEF, 0xBB, 0xBF])
      const content = Buffer.from(psScript, 'utf-8')
      await fsWriteFile(psFilePath, Buffer.concat([BOM, content]))
  
      try {
        // 使用 -File 执行脚本文件，避免引号转义问题
        await execAsync(`powershell -ExecutionPolicy Bypass -File "${psFilePath}"`)
      } finally {
        // 清理临时脚本
        try { await fsUnlink(psFilePath) } catch { /* ignore */ }
      }
  
      return { success: true, message: `桌面快捷方式已创建: ${desktopPath}` }
    } catch (error) {
      return { success: false, error: `创建桌面快捷方式失败: ${(error as Error).message}` }
    }
  })

  // ======================== 导入 / 导出连接列表（带密码） ========================

  /**
   * 导出连接列表为 JSON 文件（含密码，使用 portableEncrypt 加密）
   * 前端先弹窗输入 passphrase，然后传入此 handler
   */
  ipcMain.handle('connection:export', async (event, passphrase: string) => {
    try {
      if (!passphrase) {
        return { success: false, error: '请输入导出密码' }
      }

      const win = BrowserWindow.fromWebContents(event.sender)
      const rawConnections = getRawConnections()

      // 用 portableEncrypt 加密密码（可跨机器使用）
      const exportData = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        count: rawConnections.length,
        connections: rawConnections.map(c => {
          let encryptedPwd = ''
          if (c.encryptedPassword) {
            try {
              const plaintext = decryptPassword(c.encryptedPassword)
              encryptedPwd = portableEncrypt(plaintext, passphrase)
            } catch (e) {
              console.warn(`⚠️ 导出密码失败: ${c.clientName}, 跳过密码`)
            }
          }
          return {
            clientName: c.clientName,
            ipAddress: c.ipAddress,
            port: c.port,
            username: c.username,
            bastionHosts: c.bastionHosts || [],
            encryptedPassword: encryptedPwd
          }
        })
      }

      const result = await dialog.showSaveDialog(win!, {
        title: '导出连接列表',
        defaultPath: `RDM连接列表_${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON 文件', extensions: ['json'] }]
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: '用户取消导出' }
      }

      const json = JSON.stringify(exportData, null, 2)
      await writeFile(result.filePath, json, 'utf-8')
      return { success: true, message: `已导出 ${rawConnections.length} 条连接（含加密密码）`, path: result.filePath }
    } catch (error) {
      return { success: false, error: `导出失败: ${(error as Error).message}` }
    }
  })

  /**
   * 从 JSON 文件导入连接列表（含密码，需提供导出时设置的 passphrase）
   * 流程：选择文件 → 输入 passphrase → 解密密码 → 用 safeStorage 重新加密
   */
  ipcMain.handle('connection:import', async (event, passphrase: string) => {
    try {
      if (!passphrase) {
        return { success: false, error: '请输入导入密码（导出时设置的密码）' }
      }

      const win = BrowserWindow.fromWebContents(event.sender)

      const result = await dialog.showOpenDialog(win!, {
        title: '导入连接列表',
        filters: [{ name: 'JSON 文件', extensions: ['json'] }],
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: '用户取消导入' }
      }

      const filePath = result.filePaths[0]
      const content = await readFile(filePath, 'utf-8')
      const data = JSON.parse(content)

      // 验证数据格式
      if (!data.connections || !Array.isArray(data.connections)) {
        return { success: false, error: '无效的连接列表文件：缺少 connections 数组' }
      }

      // 过滤有效连接
      const validItems = data.connections.filter((c: any) =>
        c.clientName && c.ipAddress && c.username
      )

      if (validItems.length === 0) {
        return { success: false, error: '文件中没有有效的连接数据' }
      }

      // 解密 portableEncrypt 密码并用 safeStorage 重新加密
      const decryptAndReencrypt = (portableEncrypted: string): string => {
        const plaintext = portableDecrypt(portableEncrypted, passphrase)
        return encryptPassword(plaintext)
      }

      const imported = await batchImportConnections(validItems, decryptAndReencrypt)
      return { success: true, data: imported, message: `成功导入 ${imported.length} 条连接（含密码）` }
    } catch (error) {
      const msg = (error as Error).message
      if (msg.includes('解密失败') || msg.includes('口令')) {
        return { success: false, error: '密码不正确，请确认导出时设置的密码' }
      }
      return { success: false, error: `导入失败: ${msg}` }
    }
  })

  // ======================== 查看密码（需 Windows 登录验证） ========================

  /**
   * 验证 Windows 登录密码
   */
  ipcMain.handle('auth:verifyWindowsPassword', async (_event, password: string) => {
    return verifyWindowsPassword(password)
  })

  /**
   * 获取指定连接的解密密码（需先通过 OS 验证）
   */
  ipcMain.handle('connection:getPassword', (_event, id: string) => {
    try {
      const connection = getConnectionById(id)
      if (!connection) {
        return { success: false, error: '未找到连接' }
      }
      if (!connection.encryptedPassword) {
        return { success: false, error: '该连接未设置密码' }
      }
      const plaintext = decryptPassword(connection.encryptedPassword)
      return { success: true, data: plaintext }
    } catch (error) {
      return { success: false, error: `解密失败: ${(error as Error).message}` }
    }
  })

  // ======================== 窗口控制（无边框标题栏）========================

  /**
   * 最小化窗口
   */
  ipcMain.handle('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })

  /**
   * 最大化 / 还原窗口
   */
  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })

  /**
   * 关闭窗口
   */
  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })

  /**
   * 查询窗口是否已最大化
   */
  ipcMain.handle('window:isMaximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win?.isMaximized() ?? false
  })

  console.log('✅ IPC 处理器注册完成')

  // ======================== 快捷方式 ========================

  ipcMain.handle('shortcut:list', () => {
    try {
      return { success: true, data: getAllShortcuts() }
    } catch (error) {
      return { success: false, error: `获取快捷方式失败: ${(error as Error).message}` }
    }
  })

  ipcMain.handle('shortcut:add', async (_event, input: { name: string; exePath: string; arguments?: string; iconData?: string }) => {
    try {
      if (!input.name || !input.exePath) {
        return { success: false, error: '名称和程序路径不能为空' }
      }
      const result = await addShortcut(input)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: `添加快捷方式失败: ${(error as Error).message}` }
    }
  })

  ipcMain.handle('shortcut:delete', async (_event, id: string) => {
    try {
      if (!id) return { success: false, error: 'ID 不能为空' }
      const deleted = await deleteShortcut(id)
      if (!deleted) return { success: false, error: '未找到快捷方式' }
      return { success: true }
    } catch (error) {
      return { success: false, error: `删除快捷方式失败: ${(error as Error).message}` }
    }
  })

  ipcMain.handle('shortcut:batchDelete', async (_event, ids: string[]) => {
    try {
      if (!ids || ids.length === 0) return { success: false, error: '未选择任何项' }
      const count = await batchDeleteShortcuts(ids)
      return { success: true, data: count }
    } catch (error) {
      return { success: false, error: `批量删除失败: ${(error as Error).message}` }
    }
  })

  ipcMain.handle('shortcut:reorder', async (_event, orderedIds: string[]) => {
    try {
      if (!orderedIds || orderedIds.length === 0) return { success: false, error: '排序列表为空' }
      await reorderShortcuts(orderedIds)
      return { success: true }
    } catch (error) {
      return { success: false, error: `排序失败: ${(error as Error).message}` }
    }
  })

  ipcMain.handle('shortcut:launch', async (_event, id: string) => {
    try {
      if (!id) return { success: false, error: 'ID 不能为空' }
      const shortcuts = getAllShortcuts()
      const shortcut = shortcuts.find(s => s.id === id)
      if (!shortcut) return { success: false, error: '未找到快捷方式' }

      const { existsSync } = require('fs')
      if (!existsSync(shortcut.exePath)) {
        return { success: false, error: `程序不存在: ${shortcut.exePath}` }
      }

      // 使用 shell.openPath 启动程序，支持 .exe / .lnk / .bat / .cmd
      const errMsg = await shell.openPath(shortcut.exePath)
      if (errMsg) {
        return { success: false, error: `启动失败: ${errMsg}` }
      }

      return { success: true, message: `已启动: ${shortcut.name}` }
    } catch (error) {
      return { success: false, error: `启动失败: ${(error as Error).message}` }
    }
  })

  ipcMain.handle('shortcut:pickFile', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      const result = await dialog.showOpenDialog(win!, {
        title: '选择程序文件',
        filters: [
          { name: '可执行文件', extensions: ['exe', 'lnk', 'bat', 'cmd'] },
          { name: '所有文件', extensions: ['*'] }
        ],
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: '用户取消' }
      }

      let filePath = result.filePaths[0]
      const { basename } = require('path')
      let name = basename(filePath).replace(/\.(exe|lnk|bat|cmd)$/i, '')

      // 如果是 .lnk 文件，解析实际目标路径
      let actualExePath = filePath
      if (filePath.toLowerCase().endsWith('.lnk')) {
        try {
          const linkInfo = shell.readShortcutLink(filePath)
          if (linkInfo && linkInfo.target) {
            actualExePath = linkInfo.target
          }
        } catch (e) {
          console.warn('解析 lnk 失败:', e)
        }
      }

      // 提取软件图标
      let iconData = ''
      try {
        const iconTarget = actualExePath || filePath
        iconData = await extractExeIcon(iconTarget)
      } catch (e) {
        console.warn('提取图标失败:', e)
        iconData = ''
      }

      return { success: true, data: { name, exePath: filePath, iconData } }
    } catch (error) {
      return { success: false, error: `选择文件失败: ${(error as Error).message}` }
    }
  })
}