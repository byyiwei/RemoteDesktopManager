/**
 * RDP 远程桌面连接模块
 * 工作流程：
 * 1. 使用 cmdkey 将凭据注入 Windows 凭据管理器（直接调用，避免 PowerShell 引号嵌套）
 * 2. 生成临时 .rdp 文件（含地址、用户名，启用 NLA/CredSSP，禁止弹窗）
 * 3. 启动 mstsc.exe 加载 .rdp 文件，mstsc 自动读取 cmdkey 凭据完成免密登录
 * 4. 监控 mstsc 进程，关闭后自动清除凭据和临时文件
 */

import { spawn, exec, execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

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

function generateRdpFile(
  ip: string,
  port: number,
  username: string,
  encryptedPasswordHex?: string
): string {
  let rdpUsername = username
  let domain = '.'
  
  if (username.includes('\\')) {
    const parts = username.split('\\')
    if (parts.length === 2) {
      domain = parts[0]
      rdpUsername = parts[1]
    }
  } else if (username.includes('@')) {
    rdpUsername = username
    domain = '.'
  }
  
  let content = 'full address:s:' + ip + ':' + port + '\n' +
    'username:s:' + rdpUsername + '\n' +
    'domain:s:' + domain + '\n' +
    'prompt for credentials:i:0\n' +
    'promptcredentialonce:i:0\n' +
    'enablecredsspsupport:i:1\n' +
    'authentication level:i:2\n' +
    'negotiate security layer:i:1\n' +
    'disable wallpaper:i:0\n' +
    'disable full window drag:i:1\n' +
    'disable menu anims:i:1\n' +
    'disable themes:i:0\n' +
    'disable cursor setting:i:0\n' +
    'bitmapcachepersistenable:i:1\n' +
    'audiomode:i:0\n' +
    'redirectprinters:i:0\n' +
    'redirectcomports:i:0\n' +
    'redirectsmartcards:i:0\n' +
    'redirectclipboard:i:1\n' +
    'redirectdrives:i:0\n' +
    'keyboardhook:i:2\n' +
    'displayconnectionbar:i:1\n' +
    'autoreconnection enabled:i:1\n' +
    'compression:i:1\n' +
    'audiocapturemode:i:0\n' +
    'videoplaybackmode:i:1\n' +
    'connection type:i:2\n' +
    'networkautodetect:i:1\n' +
    'bandwidthautodetect:i:1\n' +
    'screen mode id:i:2\n' +
    'smart sizing:i:1\n' +
    'desktopwidth:i:1280\n' +
    'desktopheight:i:720\n' +
    'session bpp:i:32\n' +
    'winposstr:s:0,3,0,0,800,600\n' +
    'use redirection server name:i:0'

  // 直接在 RDP 文件中嵌入 DPAPI 加密的密码（绕过 cmdkey，兼容所有服务器）
  if (encryptedPasswordHex) {
    content += '\n' + 'password 51:b:' + encryptedPasswordHex
  }
  return content
}

/**
 * 使用 Windows DPAPI 加密密码，生成 RDP 文件 password 51:b: 格式的十六进制字符串
 * 直接嵌入 RDP 文件，绕过 cmdkey，兼容所有 Windows Server 版本
 */
async function encryptRdpPassword(password: string): Promise<string> {
  // 将密码 base64 编码以避免 shell 转义问题
  const passBase64 = Buffer.from(password, 'utf-8').toString('base64')

  const psScript = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$plainText = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${passBase64}'))
$bytes = [System.Text.Encoding]::Unicode.GetBytes($plainText)
$encrypted = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
-join ($encrypted | ForEach-Object { $_.ToString('X2') })
`

  return new Promise((resolve, reject) => {
    const proc = execFile('powershell', [
      '-NoProfile', '-NonInteractive', '-Command', psScript
    ], { timeout: 15000, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error('RDP 密码加密失败: ' + error.message))
        return
      }
      const hex = stdout.trim()
      if (!hex || hex.length < 10) {
        reject(new Error('RDP 密码加密结果为空'))
        return
      }
      console.log('[RDP] DPAPI 密码加密成功，hex长度:', hex.length)
      resolve(hex)
    })
  })
}

/**
 * 清除指定目标的旧凭据（忽略不存在的情况）
 */
async function deleteCredential(targetName: string): Promise<void> {
  return new Promise((resolve) => {
    execFile('cmdkey', [`/delete:${targetName}`], { timeout: 5000 }, (err) => {
      if (err) {
        console.log('[RDP] 清除旧凭据:', targetName, '(不存在或已清除)')
      } else {
        console.log('[RDP] 已清除旧凭据:', targetName)
      }
      resolve()
    })
  })
}

/**
 * 写入单条凭据
 */
async function writeCredential(targetName: string, username: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      `/add:${targetName}`,
      `/user:${username}`,
      `/pass:${password}`
    ]
    execFile('cmdkey', args, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error('cmdkey 注入凭据失败: ' + error.message))
        return
      }
      console.log('[RDP] 凭据已写入:', targetName)
      if (stderr) console.warn('[RDP] cmdkey 警告:', stderr)
      resolve()
    })
  })
}

/**
 * 注入凭据：同时存储多种目标名格式，兼容不同服务器的 mstsc 查找方式
 * 某些 Windows Server（如 2012 R2）使用 TERMSRV/ip:port 格式查找凭据
 */
async function addCredential(ip: string, port: number, username: string, password: string): Promise<string[]> {
  // 构建所有可能的目标名格式
  const targets = ['TERMSRV/' + ip]
  // 如果端口不是默认 3389，也添加带端口的目标名
  targets.push('TERMSRV/' + ip + ':' + port)
  // 去重
  const uniqueTargets = [...new Set(targets)]

  // cmdkey 必须使用纯用户名，不能带 .\ 前缀（否则 cmdkey 命令会执行失败）
  // .\ 前缀仅在 RDP 文件的 domain 字段和 DPAPI 嵌入密码中处理
  console.log('[RDP] 凭据注入目标:', uniqueTargets, '用户:', username, '密码长度:', password.length)

  // 第一步：清除所有目标的旧凭据
  for (const target of uniqueTargets) {
    await deleteCredential(target)
  }
  await new Promise(r => setTimeout(r, 200))

  // 第二步：为所有目标写入新凭据
  for (const target of uniqueTargets) {
    try {
      await writeCredential(target, username, password)
    } catch (e) {
      console.warn('[RDP] 写入凭据失败:', target, (e as Error).message)
    }
  }

  return uniqueTargets
}

async function verifyCredential(targetName: string): Promise<boolean> {
  try {
    const { stdout, stderr } = await execFileAsync('cmdkey', ['/list'], { encoding: 'utf-8', timeout: 10000 })
    console.log('[RDP] 当前凭据列表:', stdout)
    if (stderr) {
      console.warn('[RDP] cmdkey /list 警告:', stderr)
    }
    // 检查目标名称是否出现在凭据列表中（不区分大小写）
    const found = stdout.toLowerCase().includes(targetName.toLowerCase())
    console.log('[RDP] 凭据验证:', targetName, '=>', found ? '已找到' : '未找到')
    return found
  } catch (error) {
    console.error('[RDP] 验证凭据失败:', error)
    return false
  }
}

export function startRdpConnection(
  ip: string,
  port: number,
  username: string,
  password: string
): Promise<{ message: string }> {
  return new Promise(async (resolve, reject) => {
    if (!validateIp(ip)) {
      return reject(new Error('无效的 IP 地址: ' + ip))
    }
    if (!validatePort(port)) {
      return reject(new Error('无效的端口号: ' + port + '，端口范围 1-65535'))
    }
    if (!username || username.trim() === '') {
      return reject(new Error('用户名不能为空'))
    }

    let rdpFilePath = ''
    let allTargets: string[] = []

    console.log('[RDP] 启动连接: ' + username + '@' + ip + ':' + port)

    try {
      // 方案一：直接在 RDP 文件中嵌入 DPAPI 加密的密码（最可靠，绕过 cmdkey）
      let encryptedPasswordHex: string | undefined
      try {
        encryptedPasswordHex = await encryptRdpPassword(password)
        console.log('[RDP] 密码已 DPAPI 加密，将嵌入 RDP 文件')
      } catch (e) {
        console.warn('[RDP] DPAPI 密码加密失败，回退到 cmdkey 方式:', (e as Error).message)
      }

      // 方案二：同时通过 cmdkey 注入凭据（作为备用）
      console.log('[RDP] 用户名: ' + username)
      console.log('[RDP] 密码长度: ' + password.length)
      allTargets = await addCredential(ip, port, username, password)

      await new Promise(resolve => setTimeout(resolve, 500))

      rdpFilePath = join(tmpdir(), 'rdm_' + randomUUID() + '.rdp')
      const rdpContent = generateRdpFile(ip, port, username, encryptedPasswordHex)
      await writeFile(rdpFilePath, rdpContent, 'utf-8')
      console.log('[RDP] 临时配置文件已生成: ' + rdpFilePath, encryptedPasswordHex ? '(含嵌入式密码)' : '(仅 cmdkey)')

    } catch (error) {
      console.error('[RDP] 连接准备失败:', error)
      return reject(
        new Error('连接准备失败: ' + (error as Error).message)
      )
    }

    console.log('[RDP] 启动 mstsc.exe "' + rdpFilePath + '"')

    const mstscProcess = spawn('mstsc', [rdpFilePath], {
      detached: false,
      stdio: 'ignore',
      windowsHide: false
    })

    mstscProcess.on('error', async (err) => {
      console.error('[RDP] mstsc 启动失败:', err.message)
      await cleanupAll(allTargets, rdpFilePath)
      reject(new Error('启动远程桌面失败: ' + err.message))
    })

    mstscProcess.on('close', async (code) => {
      console.log('[RDP] mstsc 已退出，退出码: ' + code)
      await cleanupAll(allTargets, rdpFilePath)
    })

    resolve({ message: '远程桌面连接已启动 (' + ip + ':' + port + ')' })
  })
}

async function cleanupAll(targets: string[], rdpFilePath: string): Promise<void> {
  for (const target of targets) {
    try {
      await execAsync('cmdkey /delete:"' + target + '"')
      console.log('[RDP] 已清除凭据:', target)
    } catch {
    }
  }

  if (rdpFilePath) {
    try {
      await unlink(rdpFilePath)
      console.log('[RDP] 临时文件已删除')
    } catch {
    }
  }
}
