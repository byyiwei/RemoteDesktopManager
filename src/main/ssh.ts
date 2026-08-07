/**
 * SSH 连接模块（Linux 服务器）
 * 支持多种终端工具：
 *   1. Xshell   -url "ssh://<user>:<password>@<host>:<port>"（自动登录）
 *   2. OpenSSH  系统自带 ssh.exe，打开独立终端窗口手动输入密码
 *   3. 自定义    任意终端工具 + 参数模板（支持 {host} {port} {username} {password} 占位符）
 */

import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { validateIp, validatePort } from './rdp'
import { getSettings } from './store'

const execFileAsync = promisify(execFile)

/** 常见 Xshell 安装路径（按版本和位数兜底探测） */
const XSHELL_COMMON_PATHS = [
  'C:/Program Files/NetSarang/Xshell 7/Xshell.exe',
  'C:/Program Files/NetSarang/Xshell 6/Xshell.exe',
  'C:/Program Files (x86)/NetSarang/Xshell 7/Xshell.exe',
  'C:/Program Files (x86)/NetSarang/Xshell 6/Xshell.exe'
]

/**
 * 探测 Xshell.exe 路径
 * 1. 设置中配置的路径
 * 2. 常见安装目录
 * 3. 注册表卸载信息中的 InstallLocation
 */
export async function findXshellPath(): Promise<string> {
  const settings = getSettings()
  if (settings.xshellPath && existsSync(settings.xshellPath)) {
    return settings.xshellPath
  }

  for (const p of XSHELL_COMMON_PATHS) {
    if (existsSync(p)) return p
  }

  const psScript = `
$exe = ''
$candidates = @()
if ($env:ProgramFiles) { $candidates += "$env:ProgramFiles\\NetSarang\\Xshell 7\\Xshell.exe"; $candidates += "$env:ProgramFiles\\NetSarang\\Xshell 6\\Xshell.exe" }
if (\${env:ProgramFiles(x86)}) { $candidates += "\${env:ProgramFiles(x86)}\\NetSarang\\Xshell 7\\Xshell.exe"; $candidates += "\${env:ProgramFiles(x86)}\\NetSarang\\Xshell 6\\Xshell.exe" }
foreach ($c in $candidates) { if (Test-Path $c) { $exe = $c; break } }
if (-not $exe) {
  $regRoots = @(
    'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
  )
  :outer foreach ($root in $regRoots) {
    if (-not (Test-Path $root)) { continue }
    foreach ($child in (Get-ChildItem $root)) {
      if ($child.PSChildName -like '*Xshell*') {
        $loc = (Get-ItemProperty $child.PSPath -ErrorAction SilentlyContinue).InstallLocation
        if ($loc -and (Test-Path (Join-Path $loc 'Xshell.exe'))) {
          $exe = Join-Path $loc 'Xshell.exe'
          break outer
        }
      }
    }
  }
}
Write-Output $exe
`

  try {
    const { stdout } = await execFileAsync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', psScript],
      { encoding: 'utf-8', timeout: 8000 }
    )
    const path = stdout.trim().split(/\r?\n/).pop() || ''
    if (path && existsSync(path)) {
      console.log('[SSH] 通过注册表找到 Xshell:', path)
      return path
    }
  } catch (e) {
    console.warn('[SSH] 探测 Xshell 路径失败:', (e as Error).message)
  }

  return ''
}

/**
 * 检查 Xshell 是否已在运行（用于决定是否以新标签页方式连接）
 */
function isXshellRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', 'if (Get-Process Xshell -ErrorAction SilentlyContinue) { Write-Output 1 } else { Write-Output 0 }'],
      { timeout: 5000 },
      (err, stdout) => {
        if (err) return resolve(false)
        resolve(stdout.trim() === '1')
      }
    )
  })
}

/**
 * 将参数模板中的占位符替换为实际值，并按引号规则拆分为参数数组
 * 例: -P {port} -l {username} -pw "{password}" {host}
 */
function expandTemplate(template: string, vars: Record<string, string>): string[] {
  const expanded = template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match)
  const tokens: string[] = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(expanded))) {
    tokens.push(m[1] ?? m[2] ?? m[3])
  }
  return tokens
}

/**
 * 探测 OpenSSH 客户端 ssh.exe 路径
 * 1. 常见系统安装目录（System32 / SysWOW64 / Program Files）
 * 2. PATH 中的 ssh
 */
export async function findOpenSshPath(): Promise<string> {
  const systemRoot = process.env.SystemRoot || 'C:/Windows'
  const COMMON_PATHS = [
    `${systemRoot}/System32/OpenSSH/ssh.exe`,
    `${systemRoot}/SysWOW64/OpenSSH/ssh.exe`,
    'C:/Windows/System32/OpenSSH/ssh.exe',
    'C:/Windows/SysWOW64/OpenSSH/ssh.exe',
    'C:/Program Files/OpenSSH/ssh.exe',
    'C:/Program Files/OpenSSH-Win64/ssh.exe'
  ]
  for (const p of COMMON_PATHS) {
    try {
      if (existsSync(p)) return p
    } catch { /* ignore */ }
  }
  try {
    const { stdout } = await execFileAsync('where.exe', ['ssh'], {
      encoding: 'utf-8',
      timeout: 5000
    })
    const path = stdout.trim().split(/\r?\n/).find(p => p && existsSync(p))
    if (path) return path
  } catch { /* ssh 不在 PATH 中 */ }
  return ''
}

/**
 * 启动 SSH 连接（根据设置中的终端工具分发）
 */
export function startSshConnection(
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
    if (!password) {
      return reject(new Error('该连接未设置密码，无法自动登录'))
    }

    const settings = getSettings()
    const clientType = settings.sshClientType || 'xshell'
    console.log('[SSH] 启动连接: ' + username + '@' + ip + ':' + port + '，工具: ' + clientType)

    // ======================== 自定义终端工具 ========================
    if (clientType === 'custom') {
      const exePath = settings.sshCustomPath
      if (!exePath || !existsSync(exePath)) {
        return reject(
          new Error('未配置自定义终端工具路径，请在「系统设置」中选择终端工具')
        )
      }
      const args = expandTemplate(settings.sshCustomArgs || '', {
        host: ip,
        port: String(port),
        username: username.trim(),
        password
      })
      console.log('[SSH] 启动自定义终端:', exePath, args.join(' '))

      const proc = spawn(exePath, args, {
        detached: false,
        stdio: 'ignore',
        windowsHide: false
      })
      proc.on('error', (err) => {
        console.error('[SSH] 自定义终端启动失败:', err.message)
        reject(new Error('启动终端工具失败: ' + err.message))
      })
      return resolve({ message: `已通过自定义终端连接 (${ip}:${port})` })
    }

    // ======================== OpenSSH（系统自带） ========================
    if (clientType === 'openssh') {
      const sshPath = await findOpenSshPath()
      if (!sshPath) {
        return reject(
          new Error(
            '未找到 OpenSSH 客户端（ssh.exe）。请先安装：设置 → 应用 → 可选功能 → 添加功能 → OpenSSH 客户端，' +
            '或在「系统设置」中选择 Xshell / 自定义终端工具。'
          )
        )
      }
      const user = username.trim()
      const target = user.includes('@') ? user : `${user}@${ip}`
      // OpenSSH 不支持命令行传密码，以独立控制台窗口打开供手动输入
      const cmd = `start "SSH - ${target}" "${sshPath}" -p ${port} ${target}`
      console.log('[SSH] 打开 OpenSSH 终端:', cmd)

      const proc = spawn('cmd.exe', ['/c', cmd], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false
      })
      proc.unref()
      proc.on('error', (err) => {
        console.error('[SSH] OpenSSH 启动失败:', err.message)
        reject(new Error('启动 OpenSSH 失败: ' + err.message))
      })
      return resolve({ message: `已打开 OpenSSH 终端，请在窗口中输入密码登录 (${ip}:${port})` })
    }

    // ======================== Xshell ========================
    const xshellPath = await findXshellPath()
    if (!xshellPath) {
      return reject(
        new Error('未找到 Xshell，请安装 Xshell 或在「系统设置」中手动指定 Xshell 路径')
      )
    }

    const safeUser = encodeURIComponent(username.trim())
    const safePass = encodeURIComponent(password)
    const url = `ssh://${safeUser}:${safePass}@${ip}:${port}`

    const args = ['-url', url]
    if (await isXshellRunning()) {
      args.unshift('-newtab')
      console.log('[SSH] Xshell 已在运行，将以新标签页连接')
    }

    const proc = spawn(xshellPath, args, {
      detached: false,
      stdio: 'ignore',
      windowsHide: false
    })

    proc.on('error', (err) => {
      console.error('[SSH] Xshell 启动失败:', err.message)
      reject(new Error('启动 Xshell 失败: ' + err.message))
    })

    proc.on('close', (code) => {
      console.log('[SSH] Xshell 已退出，退出码: ' + code)
    })

    resolve({ message: `已启动 Xshell SSH 连接 (${ip}:${port})` })
  })
}
