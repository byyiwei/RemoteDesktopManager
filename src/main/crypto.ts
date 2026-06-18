/**
 * 密码加解密模块
 * 1. safeStorage (DPAPI) 加密：本机绑定，用于本地存储
 * 2. portable AES-256-GCM 加密：口令绑定，用于导入/导出（可跨机器）
 * 3. Windows 登录密码验证：使用 PowerShell Start-Process -Credential
 */

import { safeStorage } from 'electron'
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  pbkdf2Sync
} from 'crypto'
import { spawn } from 'child_process'
import { userInfo } from 'os'

/**
 * 检查 safeStorage 是否可用
 * safeStorage 在某些环境下不可用（如 Linux 无密钥环、无头环境等）
 */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/**
 * 加密明文密码（取消加密，直接返回明文）
 * @param plaintext 明文密码字符串
 * @returns 明文密码（不加密）
 */
export function encryptPassword(plaintext: string): string {
  return plaintext || ''
}

/**
 * 解密密文为明文密码（兼容新旧数据）
 * 新数据：直接返回明文
 * 旧数据：尝试用safeStorage解密base64编码的加密数据
 * @param encryptedBase64 密文或明文
 * @returns 明文密码字符串
 */
export function decryptPassword(encryptedBase64: string): string {
  if (!encryptedBase64) return ''
  
  try {
    const buffer = Buffer.from(encryptedBase64, 'base64')
    const decrypted = safeStorage.decryptString(buffer)
    return decrypted
  } catch {
    return encryptedBase64
  }
}

// ======================== 可移植加密（用于导入/导出） ========================

/**
 * 使用 AES-256-GCM + PBKDF2 对明文进行可移植加密
 * 加密结果与机器无关，只要有口令即可在任何机器上解密
 *
 * 数据格式: base64( salt(32) + iv(16) + ciphertext + tag(16) )
 */
export function portableEncrypt(plaintext: string, passphrase: string): string {
  if (!plaintext) return ''

  const salt = randomBytes(32)
  const iv = randomBytes(16)
  const key = pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256')

  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()

  // salt(32) + iv(16) + ciphertext + tag(16)
  const combined = Buffer.concat([salt, iv, encrypted, tag])
  return combined.toString('base64')
}

/**
 * 解密可移植加密的数据
 */
export function portableDecrypt(encryptedBase64: string, passphrase: string): string {
  if (!encryptedBase64) return ''

  try {
    const data = Buffer.from(encryptedBase64, 'base64')

    const salt = data.subarray(0, 32)
    const iv = data.subarray(32, 48)
    const tag = data.subarray(data.length - 16)
    const ciphertext = data.subarray(48, data.length - 16)

    const key = pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256')

    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return decrypted.toString('utf-8')
  } catch (error) {
    throw new Error(`解密失败（口令可能不正确）: ${(error as Error).message}`)
  }
}

// ======================== Windows 登录密码验证 ========================

/**
 * 验证 Windows 登录密码是否正确
 * 通过 PowerShell Start-Process -Credential 尝试以给定密码启动进程
 * @param password Windows 登录密码
 * @returns 验证结果
 */
export async function verifyWindowsPassword(password: string): Promise<{ valid: boolean; error?: string }> {
  // 使用 .\username 格式表示本地账户，否则 Start-Process -Credential 会失败
  const username = userInfo().username
  const domain = '.\\'  // .\ 表示本地计算机

  return new Promise((resolve) => {
    const encodedPassword = Buffer.from(password).toString('base64')
    
    const psProcess = spawn('powershell', [
      '-NoProfile',
      '-Command',
      `$password = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedPassword}')) | ConvertTo-SecureString -AsPlainText -Force; ` +
      `$cred = New-Object System.Management.Automation.PSCredential('${domain}${username}', $password); ` +
      `try { Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','exit' -Credential $cred -WindowStyle Hidden -Wait; Write-Output 'SUCCESS' } catch { Write-Error $_.Exception.Message }`
    ], {
      timeout: 15000,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stderr = ''
    let stdout = ''

    psProcess.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    psProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    psProcess.on('close', (code) => {
      if (stdout.includes('SUCCESS') && code === 0) {
        resolve({ valid: true })
      } else {
        const msg = stderr || stdout || '验证失败'
        if (msg.includes('1326') || msg.includes('not valid') || msg.includes('不正确') || msg.includes('denied')) {
          resolve({ valid: false, error: '密码不正确' })
        } else {
          resolve({ valid: false, error: `验证失败: ${msg}` })
        }
      }
    })

    psProcess.on('error', (error) => {
      resolve({ valid: false, error: `验证失败: ${error.message}` })
    })
  })
}