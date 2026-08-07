/**
 * 设置面板组件
 * 用于配置托盘图标、快捷键等选项
 */

import { useState, useEffect } from 'react'
import { Switch, Button, message } from 'antd'
import { SettingOutlined, ExportOutlined, ImportOutlined } from '@ant-design/icons'
import type { TraySettings } from '../types'

interface SettingsPanelProps {
  visible: boolean
  onClose: () => void
}

const shortcutOptions = [
  { value: 'Ctrl+Shift+R', label: 'Ctrl + Shift + R' },
  { value: 'Ctrl+Alt+R', label: 'Ctrl + Alt + R' },
  { value: 'Ctrl+Shift+F', label: 'Ctrl + Shift + F' },
  { value: 'Ctrl+Alt+F', label: 'Ctrl + Alt + F' },
  { value: 'Ctrl+R', label: 'Ctrl + R' },
  { value: 'F12', label: 'F12' },
]
const CUSTOM_OPTION_VALUE = '__custom__'

/** Electron 支持的非字符按键名称（确保捕获的快捷键能被 globalShortcut 识别） */
const NAMED_KEYS = new Set([
  'Space', 'Enter', 'Tab', 'Up', 'Down', 'Left', 'Right',
  'Home', 'End', 'PageUp', 'PageDown', 'Backspace', 'Delete',
  'Insert', 'PrintScreen', 'Esc'
])

const KEY_ALIAS: Record<string, string> = {
  ' ': 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Escape: 'Esc'
}

const isFunctionKey = (key: string) => /^F([1-9]|1[0-9]|2[0-4])$/.test(key)

/** 校验按键组合是否为 Electron 可识别的合法加速键 */
const isValidKeyToken = (key: string) =>
  /^[A-Z0-9]$/.test(key) || NAMED_KEYS.has(key) || isFunctionKey(key)

export default function SettingsPanel({ visible, onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<TraySettings>({
    enableTray: true,
    minimizeToTray: true,
    closeToTray: false,
    shortcutKey: 'Ctrl+Shift+R',
    shortcutEnabled: true,
    xshellPath: '',
    sshClientType: 'xshell',
    sshCustomPath: '',
    sshCustomArgs: ''
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [detectingXshell, setDetectingXshell] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  useEffect(() => {
    if (!visible) return
    
    const loadSettings = async () => {
      if (!window.rdm) return
      setLoading(true)
      try {
        const result = await window.rdm.settings.getTraySettings()
        if (result.success && result.data) {
          setSettings(result.data)
          // 未配置 Xshell 路径时自动探测
          if (!result.data.xshellPath) {
            try {
              const det = await window.rdm.settings.detectXshell()
              if (det.success && det.data?.path) {
                setSettings(prev => ({ ...prev, xshellPath: det.data!.path }))
              }
            } catch { /* ignore */ }
          }
        }
      } catch (e) {
        console.warn('加载设置失败:', e)
      } finally {
        setLoading(false)
      }
    }
    
    loadSettings()
  }, [visible])

  // 自定义快捷键：监听键盘组合
  useEffect(() => {
    if (!capturing) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const parts: string[] = []
      if (e.ctrlKey) parts.push('Ctrl')
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')
      if (e.metaKey) parts.push('Super')
      const key = e.key
      // 仅按修饰键时继续等待主键；Esc 取消捕获
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return
      if (key === 'Escape') {
        setCapturing(false)
        return
      }
      // 将浏览器按键名转换为 Electron 可识别的加速键
      const keyName = KEY_ALIAS[key] ?? (key.length === 1 ? key.toUpperCase() : key)
      // 无修饰键时仅允许功能键，避免误注册普通字符
      const hasModifier = parts.length > 0
      if (!hasModifier && !isFunctionKey(keyName)) return
      // 校验是否为合法加速键，非法则继续等待（如方向键、空格已被别名转换）
      if (!isValidKeyToken(keyName)) return
      const combo = [...parts, keyName].join('+')
      setSettings(prev => ({ ...prev, shortcutKey: combo }))
      setCapturing(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [capturing])

  const handleSave = async () => {
    if (!window.rdm) {
      messageApi.info('当前为浏览器预览模式，无法保存设置')
      return
    }
    
    setSaving(true)
    try {
      const result = await window.rdm.settings.setTraySettings(settings)
      if (result.success) {
        if (result.shortcutRegistered === false) {
          messageApi.warning(result.shortcutError || '快捷键注册失败，请更换其他快捷键')
        } else {
          messageApi.success('设置已保存')
        }
        onClose()
      } else {
        messageApi.error(result.error || '保存失败')
      }
    } catch (e) {
      messageApi.error(`保存异常: ${(e as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setSettings({
      enableTray: true,
      minimizeToTray: true,
      closeToTray: false,
      shortcutKey: 'Ctrl+Shift+R',
      shortcutEnabled: true,
      xshellPath: '',
      sshClientType: 'xshell',
      sshCustomPath: '',
      sshCustomArgs: ''
    })
  }

  const handleDetectXshell = async () => {
    if (!window.rdm) return
    setDetectingXshell(true)
    try {
      const det = await window.rdm.settings.detectXshell()
      if (det.success && det.data?.path) {
        setSettings(prev => ({ ...prev, xshellPath: det.data!.path }))
        messageApi.success(`已检测到 Xshell: ${det.data.path}`)
      } else {
        messageApi.warning('未检测到 Xshell，请手动选择安装路径')
      }
    } catch (e) {
      messageApi.error(`检测失败: ${(e as Error).message}`)
    } finally {
      setDetectingXshell(false)
    }
  }

  const handlePickXshell = async () => {
    if (!window.rdm) return
    const pick = await window.rdm.settings.pickXshell()
    if (pick.success && pick.data?.path) {
      setSettings(prev => ({ ...prev, xshellPath: pick.data!.path }))
    }
  }

  const handlePickSshTool = async () => {
    if (!window.rdm) return
    const pick = await window.rdm.settings.pickFile()
    if (pick.success && pick.data?.path) {
      setSettings(prev => ({ ...prev, sshCustomPath: pick.data!.path }))
    }
  }

  const handleDetectOpenSsh = async () => {
    if (!window.rdm) return
    const det = await window.rdm.settings.detectOpenSsh()
    if (det.success && det.data?.path) {
      messageApi.success(`已找到 OpenSSH: ${det.data.path}`)
    } else {
      messageApi.warning('未找到 OpenSSH 客户端，请安装 OpenSSH 或选择其他终端工具')
    }
  }

  if (!visible) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={e => e.stopPropagation()}>
        {contextHolder}
        <div className="modal-header">
          <SettingOutlined className="modal-icon" />
          <h3>系统设置</h3>
        </div>
        
        {loading ? (
          <div className="loading">加载中...</div>
        ) : (
          <>
            {/* 托盘图标设置 */}
            <div className="settings-section">
              <h4>托盘图标设置</h4>

              <div className="setting-row">
                <span className="setting-row-label">启用托盘图标</span>
                <Switch
                  checked={settings.enableTray}
                  onChange={(checked) => setSettings(prev => ({ ...prev, enableTray: checked }))}
                />
              </div>

              <div className="setting-row">
                <span className="setting-row-label">最小化到托盘</span>
                <Switch
                  checked={settings.minimizeToTray}
                  onChange={(checked) => setSettings(prev => ({ ...prev, minimizeToTray: checked }))}
                  disabled={!settings.enableTray}
                />
              </div>

              <div className="setting-row">
                <span className="setting-row-label">关闭到托盘</span>
                <Switch
                  checked={settings.closeToTray}
                  onChange={(checked) => setSettings(prev => ({ ...prev, closeToTray: checked }))}
                  disabled={!settings.enableTray}
                />
              </div>
            </div>

            {/* 快捷键设置 */}
            <div className="settings-section">
              <h4>快捷键设置</h4>

              <div className="setting-row">
                <span className="setting-row-label">启用快捷键唤起</span>
                <Switch
                  checked={settings.shortcutEnabled}
                  onChange={(checked) => setSettings(prev => ({ ...prev, shortcutEnabled: checked }))}
                />
              </div>

              <div className="setting-row">
                <span className="setting-row-label">唤起快捷键</span>
                <select
                  className="shortcut-select"
                  value={shortcutOptions.some(o => o.value === settings.shortcutKey) ? settings.shortcutKey : CUSTOM_OPTION_VALUE}
                  onChange={(e) => {
                    if (e.target.value === CUSTOM_OPTION_VALUE) {
                      const current = settings.shortcutKey === CUSTOM_OPTION_VALUE ? '' : settings.shortcutKey
                      setSettings(prev => ({ ...prev, shortcutKey: current }))
                      setTimeout(() => setCapturing(true), 60)
                    } else {
                      setSettings(prev => ({ ...prev, shortcutKey: e.target.value }))
                      setCapturing(false)
                    }
                  }}
                  disabled={!settings.shortcutEnabled}
                >
                  {shortcutOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  <option value={CUSTOM_OPTION_VALUE}>自定义...</option>
                </select>
              </div>
              {!shortcutOptions.some(o => o.value === settings.shortcutKey) && (
                <div
                  className={`hotkey-capture ${capturing ? 'capturing' : ''}`}
                  tabIndex={0}
                  onClick={() => setCapturing(true)}
                >
                  {capturing
                    ? '请按下快捷键组合…'
                    : (settings.shortcutKey || '点击此处按下快捷键')}
                  <span className="hotkey-capture-hint">
                    {capturing ? '（按 Esc 取消）' : '点击后按键盘组合'}
                  </span>
                </div>
              )}
            </div>

            {/* Linux SSH 连接设置 */}
            <div className="settings-section">
              <h4>Linux SSH 连接设置</h4>

              <p className="settings-section-desc">
                选择用于连接 Linux 服务器的终端工具
              </p>

              <div className="setting-row">
                <span className="setting-row-label">连接工具</span>
                <select
                  className="shortcut-select"
                  value={settings.sshClientType}
                  onChange={(e) => setSettings(prev => ({ ...prev, sshClientType: e.target.value as TraySettings['sshClientType'] }))}
                >
                  <option value="xshell">Xshell（自动登录）</option>
                  <option value="openssh">OpenSSH（系统自带）</option>
                  <option value="custom">自定义终端工具</option>
                </select>
              </div>

              {settings.sshClientType === 'xshell' && (
                <>
                  <div className="setting-row">
                    <span className="setting-row-label">Xshell 可执行文件</span>
                    <div className="setting-row-control">
                      <input
                        className="shortcut-select xshell-path-input"
                        value={settings.xshellPath}
                        readOnly
                        placeholder="未设置，点击右侧按钮选择或自动检测"
                      />
                      <Button onClick={handlePickXshell}>浏览</Button>
                      <Button onClick={handleDetectXshell} loading={detectingXshell}>自动检测</Button>
                    </div>
                  </div>
                  <p className="settings-section-desc">
                    连接时通过 Xshell URL 协议自动登录
                  </p>
                </>
              )}

              {settings.sshClientType === 'openssh' && (
                <>
                  <div className="ssh-info">
                    使用 Windows 系统自带的 OpenSSH 客户端（ssh.exe）连接。<br />
                    由于 OpenSSH 不支持命令行传入密码，连接时会打开终端窗口，请手动输入密码。
                  </div>
                  <div className="setting-row">
                    <span className="setting-row-label">OpenSSH 检查</span>
                    <div className="setting-row-control">
                      <Button onClick={handleDetectOpenSsh}>检测 ssh.exe</Button>
                    </div>
                  </div>
                </>
              )}

              {settings.sshClientType === 'custom' && (
                <>
                  <div className="setting-row">
                    <span className="setting-row-label">可执行文件</span>
                    <div className="setting-row-control">
                      <input
                        className="shortcut-select xshell-path-input"
                        value={settings.sshCustomPath}
                        readOnly
                        placeholder="选择终端工具 exe（如 plink / putty / mobaxterm）"
                      />
                      <Button onClick={handlePickSshTool}>浏览</Button>
                    </div>
                  </div>
                  <div className="setting-row">
                    <span className="setting-row-label">启动参数</span>
                    <input
                      className="shortcut-select"
                      value={settings.sshCustomArgs}
                      placeholder='如: -P {port} -l {username} -pw {password} {host}'
                      onChange={(e) => setSettings(prev => ({ ...prev, sshCustomArgs: e.target.value }))}
                    />
                  </div>
                  <p className="settings-section-desc">
                    可用占位符: {'{host}'} {'{port}'} {'{username}'} {'{password}'}（密码建议用引号包裹，如 -pw "{'{password}'}"）
                  </p>
                </>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="modal-actions">
              <Button onClick={handleReset} icon={<ImportOutlined />}>
                重置
              </Button>
              <Button onClick={onClose}>取消</Button>
              <Button
                type="primary"
                onClick={handleSave}
                loading={saving}
                icon={<ExportOutlined />}
              >
                保存设置
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}