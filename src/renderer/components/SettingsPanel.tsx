/**
 * 设置面板组件
 * 用于配置托盘图标、快捷键等选项
 */

import { useState, useEffect } from 'react'
import { Form, Switch, Input, Button, message } from 'antd'
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

export default function SettingsPanel({ visible, onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<TraySettings>({
    enableTray: true,
    minimizeToTray: true,
    closeToTray: false,
    shortcutKey: 'Ctrl+Shift+R',
    shortcutEnabled: true
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
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
        }
      } catch (e) {
        console.warn('加载设置失败:', e)
      } finally {
        setLoading(false)
      }
    }
    
    loadSettings()
  }, [visible])

  const handleSave = async () => {
    if (!window.rdm) {
      messageApi.info('当前为浏览器预览模式，无法保存设置')
      return
    }
    
    setSaving(true)
    try {
      const result = await window.rdm.settings.setTraySettings(settings)
      if (result.success) {
        messageApi.success('设置已保存')
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
      shortcutEnabled: true
    })
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
          <Form layout="vertical" initialValues={settings}>
            {/* 托盘图标设置 */}
            <div className="settings-section">
              <h4>托盘图标设置</h4>
              
              <Form.Item
                label="启用托盘图标"
                name="enableTray"
                valuePropName="checked"
              >
                <Switch
                  checked={settings.enableTray}
                  onChange={(checked) => setSettings(prev => ({ ...prev, enableTray: checked }))}
                />
              </Form.Item>

              <Form.Item
                label="最小化到托盘"
                name="minimizeToTray"
                valuePropName="checked"
              >
                <Switch
                  checked={settings.minimizeToTray}
                  onChange={(checked) => setSettings(prev => ({ ...prev, minimizeToTray: checked }))}
                  disabled={!settings.enableTray}
                />
              </Form.Item>

              <Form.Item
                label="关闭到托盘"
                name="closeToTray"
                valuePropName="checked"
              >
                <Switch
                  checked={settings.closeToTray}
                  onChange={(checked) => setSettings(prev => ({ ...prev, closeToTray: checked }))}
                  disabled={!settings.enableTray}
                />
              </Form.Item>
            </div>

            {/* 快捷键设置 */}
            <div className="settings-section">
              <h4>快捷键设置</h4>
              
              <Form.Item
                label="启用快捷键唤起"
                name="shortcutEnabled"
                valuePropName="checked"
              >
                <Switch
                  checked={settings.shortcutEnabled}
                  onChange={(checked) => setSettings(prev => ({ ...prev, shortcutEnabled: checked }))}
                />
              </Form.Item>

              <Form.Item
                label="唤起快捷键"
                name="shortcutKey"
              >
                <select
                  className="shortcut-select"
                  value={settings.shortcutKey}
                  onChange={(e) => setSettings(prev => ({ ...prev, shortcutKey: e.target.value }))}
                  disabled={!settings.shortcutEnabled}
                >
                  {shortcutOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Form.Item>
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
          </Form>
        )}
      </div>
    </div>
  )
}