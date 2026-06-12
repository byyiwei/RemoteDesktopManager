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
 * 加密明文密码
 * @param plaintext 明文密码字符串
 * @returns base64 编码的密文
 * @throws 当 safeStorage 不可用时抛出错误
 */
export function encryptPassword(plaintext: string): string {
  if (!isEncryptionAvailable()) {
    throw new Error(
      '系统加密服务不可用（safeStorage 不可用）。' +
      '请确保在 Windows 环境下运行，且用户已登录。'
    )
  }

  if (!plaintext) {
    return ''
  }

  const encryptedBuffer = safeStorage.encryptString(plaintext)
  return encryptedBuffer.toString('base64')
}

/**
 * 解密 base64 密文为明文密码
 * @param encryptedBase64 base64 编码的密文
 * @returns 明文密码字符串
 * @throws 当 safeStorage 不可用或解密失败时抛出错误
 */
export function decryptPassword(encryptedBase64: string): string {
  if (!encryptedBase64) {
    return ''
  }

  if (!isEncryptionAvailable()) {
    throw new Error(
      '系统加密服务不可用（safeStorage 不可用）。' +
      '请确保在 Windows 环境下运行，且用户已登录。'
    )
  }

  try {
    const encryptedBuffer = Buffer.from(encryptedBase64, 'base64')
    return safeStorage.decryptString(encryptedBuffer)
  } catch (error) {
    throw new Error(`密码解密失败: ${(error as Error).message}`)
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
  const username = userInfo().username

  return new Promise((resolve) => {
    // 使用 spawn 并通过 Base64 编码传递密码，避免命令注入风险
    const encodedPassword = Buffer.from(password).toString('base64')
    
    const psProcess = spawn('powershell', [
      '-NoProfile',
      '-Command',
      // 使用 Base64 解码安全传递密码，避免命令注入
      `$password = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedPassword}')) | ConvertTo-SecureString -AsPlainText -Force; ` +
      `$cred = New-Object System.Management.Automation.PSCredential('${username}', $password); ` +
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