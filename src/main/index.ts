/**
 * 主进程入口
 * 负责创建窗口、初始化应用、注册 IPC 处理器
 */

import { app, BrowserWindow, shell, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { registerIpcHandlers } from './ipcHandlers'
import { initStore } from './store'
import { isEncryptionAvailable } from './crypto'

const APP_NAME = 'Windows运维远程桌面管理工具'
const APP_ID = 'com.rdm.manager'

let mainWindow: BrowserWindow | null = null

/**
 * 获取图标文件路径
 * Windows 任务栏需要 ICO 格式，优先使用 ICO
 */
function getIconPath(): string {
  // Windows 任务栏优先使用 ICO（包含多尺寸），其他平台用 PNG
  const candidates = process.platform === 'win32'
    ? ['icon.ico', 'icon.png']
    : ['icon.png', 'icon.ico']
  const base = join(app.getAppPath(), 'resources')
  
  for (const name of candidates) {
    const p = join(base, name)
    if (existsSync(p)) {
      console.log('[icon] 加载图标:', p)
      return p
    }
  }
  console.warn('[icon] 未找到图标文件，appPath:', app.getAppPath(), 'base:', base)
  return ''
}

/**
 * 获取安全的窗口位置（确保在屏幕范围内）
 * 竖屏布局：500 x 650
 */
function getSafeWindowBounds() {
  const { screen } = require('electron')
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
  
  const windowWidth = Math.min(500, screenWidth - 100)
  const windowHeight = Math.min(650, screenHeight - 50)
  const x = Math.max(0, Math.floor((screenWidth - windowWidth) / 2))
  const y = Math.max(0, Math.floor((screenHeight - windowHeight) / 2))
  
  return { width: windowWidth, height: windowHeight, x, y }
}

/**
 * 创建主窗口（无边框 + 自定义标题栏）
 */
function createWindow(): void {
  const iconPath = getIconPath()
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : undefined

  if (icon && icon.isEmpty()) {
    console.warn('[icon] 图标加载后为空，使用默认图标')
  }

  const validIcon = icon && !icon.isEmpty() ? icon : undefined
  
  // 获取安全的窗口位置和大小
  const { width, height, x, y } = getSafeWindowBounds()

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 400,
    minHeight: 300,
    show: true,
    title: APP_NAME,
    frame: false,  // 无边框窗口，使用自定义 TitleBar
    icon: validIcon,
    backgroundColor: '#f5f7fa',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 设置任务栏图标和应用名称
  if (validIcon) {
    mainWindow.setIcon(validIcon)
  }
  
  if (process.platform === 'win32') {
    app.setAppUserModelId(APP_ID)
  }

  // 渲染进程加载完成后确保窗口可见
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[window] 渲染进程加载完成')
    // 确保窗口在屏幕范围内
    const bounds = mainWindow?.getBounds()
    if (bounds) {
      const { screen } = require('electron')
      const primaryDisplay = screen.getPrimaryDisplay()
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
      
      let newX = bounds.x
      let newY = bounds.y
      
      // 如果窗口超出屏幕，调整位置
      if (bounds.x < 0) newX = 0
      if (bounds.y < 0) newY = 0
      if (bounds.x + bounds.width > screenWidth) newX = screenWidth - bounds.width
      if (bounds.y + bounds.height > screenHeight) newY = screenHeight - bounds.height
      
      if (newX !== bounds.x || newY !== bounds.y) {
        mainWindow?.setPosition(newX, newY)
        console.log('[window] 调整窗口位置:', { x: newX, y: newY })
      }
    }
    
    // 确保窗口可见
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show()
      mainWindow.focus()
      console.log('[window] 窗口已显示并聚焦')
    }
  })

  // 渲染进程加载失败处理
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[window] 渲染进程加载失败:', errorCode, errorDescription)
    // 尝试重新加载
    setTimeout(() => {
      mainWindow?.webContents.reload()
    }, 2000)
  })

  // 主进程崩溃处理
  mainWindow.webContents.on('crashed', () => {
    console.error('[window] 渲染进程崩溃')
    // 尝试重新加载
    setTimeout(() => {
      mainWindow?.webContents.reload()
    }, 2000)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  
  console.log('[window] 窗口创建完成，位置:', { x, y }, '大小:', { width, height })
}

app.whenReady().then(async () => {
  // 设置应用名称和用户模型ID（影响任务管理器显示）
  app.setName(APP_NAME)
  app.setAppUserModelId('com.rdm.manager')
  await initStore()

  if (!isEncryptionAvailable()) {
    console.warn('⚠️ safeStorage 不可用！')
  } else {
    console.log('✅ safeStorage 加密模块可用')
  }

  Menu.setApplicationMenu(null)
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})