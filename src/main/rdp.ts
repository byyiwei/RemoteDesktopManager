/**
 * RDP 远程桌面连接模块
 * 工作流程：
 * 1. 使用 cmdkey 将凭据注入 Windows 凭据管理器
 * 2. 生成临时 .rdp 文件（含地址、用户名，启用 NLA/CredSSP，禁止弹窗）
 * 3. 启动 mstsc.exe 加载 .rdp 文件，mstsc 自动读取 cmdkey 凭据完成免密登录
 * 4. 监控 mstsc 进程，关闭后自动清除凭据和临时文件
 */

import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

const execAsync = promisify(exec)

/** IP 地址验证正则（支持 IPv4） */
const IP_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

export function validateIp(ip: string): boolean {
  const match = ip.match(IP_REGEX)
  if (!match) return false
  return match.slice(1).every((octet) => {
    const num = parseInt(octet, 10)
    return num >= 0 && num <= 255
  })
}

export function validatePort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

/**
 * 生成临时 .rdp 配置文件
 *
 * 关键配置说明：
 * - enablecredsspsupport:i:1  → 启用 CredSSP/NLA（网络级身份验证），兼容大多数服务器
 * - prompt for credentials:i:0 → 禁止弹出凭据输入框
 * - authentication level:i:2  → 要求服务器身份验证（配合 NLA）
 * - promptcredentialonce:i:0  → 不弹出凭据确认
 *
 * 凭据通过 cmdkey 注入 Windows 凭据管理器，mstsc 启动时会自动读取。
 * 如果远程服务器不要求 NLA，同样可以正常连接（自动降级）。
 */
function generateRdpFile(
  ip: string,
  port: number,
  username: string
): string {
  const lines = [
    `full address:s:${ip}:${port}`,
    `username:s:${username}`,
    `prompt for credentials:i:0`,
    `promptcredentialonce:i:0`,
    `enablecredsspsupport:i:1`,
    `authentication level:i:2`,
    `negotiate security layer:i:1`,
    `disable wallpaper:i:0`,
    `disable full window drag:i:1`,
    `disable menu anims:i:1`,
    `disable themes:i:0`,
    `disable cursor setting:i:0`,
    `bitmapcachepersistenable:i:1`,
    `audiomode:i:0`,
    `redirectprinters:i:0`,
    `redirectcomports:i:0`,
    `redirectsmartcards:i:0`,
    `redirectclipboard:i:1`,
    `redirectdrives:i:0`,
    `keyboardhook:i:2`,
    `displayconnectionbar:i:1`,
    `autoreconnection enabled:i:1`,
    `compression:i:1`,
    `audiocapturemode:i:0`,
    `videoplaybackmode:i:1`,
    `connection type:i:2`,
    `networkautodetect:i:1`,
    `bandwidthautodetect:i:1`,
    `screen mode id:i:2`,
    `smart sizing:i:1`,
    `desktopwidth:i:1280`,
    `desktopheight:i:720`,
    `session bpp:i:32`,
    `winposstr:s:0,3,0,0,800,600`,
  ]
  return lines.join('\r\n')
}

/**
 * 启动 RDP 远程桌面连接（免密自动登录）
 */
export function startRdpConnection(
  ip: string,
  port: number,
  username: string,
  password: string
): Promise<{ message: string }> {
  return new Promise(async (resolve, reject) => {
    // ---- 参数验证 ----
    if (!validateIp(ip)) {
      return reject(new Error(`无效的 IP 地址: ${ip}`))
    }
    if (!validatePort(port)) {
      return reject(new Error(`无效的端口号: ${port}，端口范围 1-65535`))
    }
    if (!username || username.trim() === '') {
      return reject(new Error('用户名不能为空'))
    }

    // cmdkey 目标名称（端口非 3389 时需要加端口）
    const targetName = port === 3389
      ? `TERMSRV/${ip}`
      : `TERMSRV/${ip}:${port}`

    let rdpFilePath = ''

    console.log(`[RDP] 启动连接: ${username}@${ip}:${port}`)

    try {
      // ---- 步骤 1: 注入凭据 ----
      console.log(`[RDP] 注入凭据: ${targetName}`)
      await execAsync(
        `cmdkey /add:"${targetName}" /user:"${username}" /pass:"${password}"`
      )
      console.log('[RDP] 凭据注入成功')

      // ---- 步骤 2: 生成临时 .rdp 文件 ----
      rdpFilePath = join(tmpdir(), `rdm_${randomUUID()}.rdp`)
      const rdpContent = generateRdpFile(ip, port, username)
      await writeFile(rdpFilePath, rdpContent, 'utf-8')
      console.log(`[RDP] 临时配置文件已生成: ${rdpFilePath}`)

    } catch (error) {
      return reject(
        new Error(`连接准备失败: ${(error as Error).message}`)
      )
    }

    // ---- 步骤 3: 启动 mstsc ----
    console.log(`[RDP] 启动 mstsc.exe "${rdpFilePath}"`)

    const mstscProcess = spawn('mstsc', [rdpFilePath], {
      detached: false,
      stdio: 'ignore',
      windowsHide: false
    })

    mstscProcess.on('error', async (err) => {
      console.error('[RDP] mstsc 启动失败:', err.message)
      await cleanup(targetName, rdpFilePath)
      reject(new Error(`启动远程桌面失败: ${err.message}`))
    })

    // ---- 步骤 4: 监控进程 + 清理 ----
    mstscProcess.on('close', async (code) => {
      console.log(`[RDP] mstsc 已退出，退出码: ${code}`)
      await cleanup(targetName, rdpFilePath)

      if (code === 0 || code === null) {
        resolve({ message: `远程桌面连接已关闭 (${ip}:${port})` })
      } else {
        reject(new Error(`远程桌面异常退出，退出码: ${code}`))
      }
    })
  })
}

/**
 * 清理凭据 + 临时文件
 */
async function cleanup(targetName: string, rdpFilePath: string): Promise<void> {
  // 清除凭据
  try {
    console.log('[RDP] 清除凭据...')
    await execAsync(`cmdkey /delete:"${targetName}"`)
    console.log('[RDP] 凭据已清除')
  } catch {
    // 忽略（凭据可能已被手动删除）
  }

  // 删除临时 .rdp 文件
  if (rdpFilePath) {
    try {
      await unlink(rdpFilePath)
      console.log('[RDP] 临时文件已删除')
    } catch {
      // 忽略
    }
  }
}