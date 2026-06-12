/**
 * 应用根组件 - 简化版，避免函数定义顺序问题
 */

import { useState, useEffect, useCallback } from 'react'
import { ConfigProvider, App as AntdApp, message, theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import Layout from './components/Layout'
import ConnectionTable from './components/ConnectionTable'
import ConnectionForm from './components/ConnectionForm'
import ShortcutGrid from './components/ShortcutGrid'
import { useTheme } from './hooks/useTheme'
import type {
  ConnectionDisplay,
  CreateConnectionInput,
  UpdateConnectionInput,
  Shortcut
} from './types'

// 示例数据
const sampleConnections: ConnectionDisplay[] = [
  { id: '1', clientName: '生产服务器-A', ipAddress: '10.0.0.10', port: 3389, username: 'admin', hasPassword: true, bastionHosts: [], createdAt: '2026-01-15T08:00:00Z', updatedAt: '2026-06-10T10:00:00Z' },
  { id: '2', clientName: '测试服务器-B', ipAddress: '10.0.0.20', port: 3389, username: 'testuser', hasPassword: true, bastionHosts: ['ops'], createdAt: '2026-02-20T09:00:00Z', updatedAt: '2026-06-09T14:00:00Z' },
  { id: '3', clientName: '开发服务器-C', ipAddress: '192.168.1.100', port: 3389, username: 'dev', hasPassword: false, bastionHosts: [], createdAt: '2026-03-10T11:00:00Z', updatedAt: '2026-06-08T09:00:00Z' },
]

export default function App() {
  const { theme: currentTheme, setTheme, isDark } = useTheme()
  const [connections, setConnections] = useState<ConnectionDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [encryptionOk, setEncryptionOk] = useState(true)
  const [formVisible, setFormVisible] = useState(false)
  const [editingConnection, setEditingConnection] = useState<ConnectionDisplay | null>(null)
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [messageApi, contextHolder] = message.useMessage()
  const [searchKeyword, setSearchKeyword] = useState('')

  // 快捷方式相关状态
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([])
  const [launchingShortcutId, setLaunchingShortcutId] = useState<string | null>(null)

  // 密码查看相关状态
  const [osPasswordModalVisible, setOsPasswordModalVisible] = useState(false)
  const [osPassword, setOsPassword] = useState('')
  const [osVerifying, setOsVerifying] = useState(false)
  const [pendingPasswordId, setPendingPasswordId] = useState<string | null>(null)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({})

  // 导出/导入 passphrase 弹窗
  const [exportModalVisible, setExportModalVisible] = useState(false)
  const [exportPassphrase, setExportPassphrase] = useState('')
  const [exporting, setExporting] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [importPassphrase, setImportPassphrase] = useState('')
  const [importing, setImporting] = useState(false)

  // ---- 初始化 ----
  useEffect(() => {
    if (!window.rdm) {
      setConnections(sampleConnections)
      setLoading(false)
      return
    }

    const initApp = async () => {
      try {
        const cryptoResult = await window.rdm.crypto.check()
        if (!cryptoResult.available) {
          setEncryptionOk(false)
          messageApi.warning({ content: cryptoResult.message, duration: 0 })
        }
        
        const listResult = await window.rdm.connection.list()
        if (listResult.success && listResult.data) {
          setConnections(listResult.data)
        } else {
          messageApi.info('使用示例数据')
          setConnections(sampleConnections)
        }

        // 加载快捷方式
        const shortcutResult = await window.rdm.shortcut.list()
        if (shortcutResult.success && shortcutResult.data) {
          setShortcuts(shortcutResult.data)
        }
      } catch (e) {
        console.warn('初始化失败，使用示例数据:', e)
        setConnections(sampleConnections)
      } finally {
        setLoading(false)
      }
    }

    initApp()
  }, [])

  // ---- 加载列表 ----
  const loadConnections = useCallback(async () => {
    if (!window.rdm) return
    setLoading(true)
    try {
      const r = await window.rdm.connection.list()
      if (r.success && r.data) setConnections(r.data)
      else messageApi.error(r.error || '获取连接列表失败')
    } catch (e) {
      messageApi.error(`加载异常: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  // ---- 搜索过滤 ----
  const filteredConnections = searchKeyword
    ? connections.filter(c =>
        c.clientName.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        c.ipAddress.toLowerCase().includes(searchKeyword.toLowerCase())
      )
    : connections

  const filteredShortcuts = searchKeyword
    ? shortcuts.filter(s => s.name.toLowerCase().includes(searchKeyword.toLowerCase()))
    : shortcuts

  // ---- 所有处理函数使用 useCallback 但避免互相引用 ----
  const handlers = {
    add: useCallback(() => {
      setEditingConnection(null)
      setFormVisible(true)
    }, []),

    edit: useCallback((c: ConnectionDisplay) => {
      setEditingConnection(c)
      setFormVisible(true)
    }, []),

    delete: useCallback(async (id: string) => {
      if (!window.rdm) return
      const r = await window.rdm.connection.delete(id)
      if (r.success) {
        messageApi.success('已删除')
        loadConnections()
      } else {
        messageApi.error(r.error || '删除失败')
      }
    }, [loadConnections]),

    save: useCallback(async (v: CreateConnectionInput & { id?: string }) => {
      if (!window.rdm) {
        messageApi.info('当前为浏览器预览模式，无法保存')
        setFormVisible(false)
        setEditingConnection(null)
        return
      }
      const r = v.id
        ? await window.rdm.connection.update({
            ...v,
            id: v.id,
            password: (v as UpdateConnectionInput).password || undefined
          })
        : await window.rdm.connection.save(v)
      if (r.success) {
        messageApi.success(v.id ? '已更新' : '已保存')
        setFormVisible(false)
        setEditingConnection(null)
        loadConnections()
      } else {
        messageApi.error(r.error || '保存失败')
      }
    }, [loadConnections]),

    cancel: useCallback(() => {
      setFormVisible(false)
      setEditingConnection(null)
    }, []),

    search: useCallback((keyword: string) => {
      setSearchKeyword(keyword.trim())
    }, []),

    searchConnect: useCallback(() => {
      if (!searchKeyword.trim()) {
        messageApi.info('请先输入搜索关键词')
        return
      }
      const kw = searchKeyword.toLowerCase()

      // 搜索连接
      const filteredConn = connections.filter(c =>
        c.clientName.toLowerCase().includes(kw) ||
        c.ipAddress.toLowerCase().includes(kw)
      )

      // 搜索快捷方式
      const filteredShortcuts = shortcuts.filter(s =>
        s.name.toLowerCase().includes(kw)
      )

      // 优先启动快捷方式（只有一个匹配时）
      if (filteredShortcuts.length === 1 && filteredConn.length === 0) {
        handlers.launchShortcut(filteredShortcuts[0].id)
        return
      }

      // 直接连接（只有一个连接匹配时）
      if (filteredConn.length === 1 && filteredShortcuts.length === 0) {
        handlers.connect(filteredConn[0].id)
        return
      }

      const total = filteredConn.length + filteredShortcuts.length
      if (total === 0) {
        messageApi.info('未找到匹配的连接或软件')
      } else {
        messageApi.info(`找到 ${total} 个匹配项，请选择后操作`)
      }
    }, [searchKeyword, connections, shortcuts]),

    connect: useCallback(async (id: string) => {
      if (connectingId) {
        messageApi.warning('请等待当前连接完成')
        return
      }
      if (!window.rdm) {
        messageApi.info('当前为浏览器预览模式，RDP 连接仅在桌面客户端可用')
        return
      }
      setConnectingId(id)
      const start = Date.now()
      try {
        const r = await window.rdm.connection.connect(id)
        if (r.success) {
          messageApi.success(`会话结束 (${((Date.now() - start) / 1000).toFixed(0)}s)`)
        } else {
          messageApi.error(r.error || '连接失败')
        }
      } catch (e) {
        messageApi.error(`连接异常: ${(e as Error).message}`)
      } finally {
        setConnectingId(null)
      }
    }, [connectingId]),

    // ---- 快捷方式操作 ----
    addShortcut: useCallback(async () => {
      if (!window.rdm) return
      const pickResult = await window.rdm.shortcut.pickFile()
      if (!pickResult.success || !pickResult.data) return

      const r = await window.rdm.shortcut.add({
        name: pickResult.data.name,
        exePath: pickResult.data.exePath,
        iconData: pickResult.data.iconData
      })
      if (r.success && r.data) {
        messageApi.success(`已添加: ${r.data.name}`)
        setShortcuts(prev => [...prev, r.data!])
      } else {
        messageApi.error(r.error || '添加失败')
      }
    }, []),

    batchDeleteShortcut: useCallback(async (ids: string[]) => {
      if (!window.rdm) return
      const r = await window.rdm.shortcut.batchDelete(ids)
      if (r.success) {
        messageApi.success(`已删除 ${r.data || ids.length} 个快捷方式`)
        setShortcuts(prev => prev.filter(s => !ids.includes(s.id)))
      } else {
        messageApi.error(r.error || '批量删除失败')
      }
    }, []),

    reorderShortcuts: useCallback(async (orderedIds: string[]) => {
      if (!window.rdm) return
      const r = await window.rdm.shortcut.reorder(orderedIds)
      if (r.success) {
        // 重新排序本地状态
        setShortcuts(prev => {
          const map = new Map(prev.map(s => [s.id, s]))
          const reordered: typeof prev = []
          for (const id of orderedIds) {
            const item = map.get(id)
            if (item) reordered.push(item)
          }
          for (const item of prev) {
            if (!orderedIds.includes(item.id)) reordered.push(item)
          }
          return reordered
        })
      } else {
        messageApi.error(r.error || '排序失败')
      }
    }, []),

    launchShortcut: useCallback(async (id: string) => {
      if (!window.rdm || launchingShortcutId) return
      setLaunchingShortcutId(id)
      try {
        const r = await window.rdm.shortcut.launch(id)
        if (r.success) {
          messageApi.success(r.message || '已启动')
        } else {
          messageApi.error(r.error || '启动失败')
        }
      } catch (e) {
        messageApi.error(`启动异常: ${(e as Error).message}`)
      } finally {
        setTimeout(() => setLaunchingShortcutId(null), 1000)
      }
    }, [launchingShortcutId]),

    export: useCallback(() => {
      setExportPassphrase('')
      setExportModalVisible(true)
    }, []),

    confirmExport: useCallback(async () => {
      if (!exportPassphrase.trim()) {
        messageApi.warning('请输入导出密码')
        return
      }
      if (!window.rdm) return
      setExporting(true)
      try {
        const r = await window.rdm.connection.exportList(exportPassphrase)
        if (r.success) {
          messageApi.success(r.message || '导出成功')
          setExportModalVisible(false)
        } else if (r.error && !r.error.includes('取消')) {
          messageApi.error(r.error)
        }
      } finally {
        setExporting(false)
      }
    }, [exportPassphrase]),

    import: useCallback(() => {
      setImportPassphrase('')
      setImportModalVisible(true)
    }, []),

    confirmImport: useCallback(async () => {
      if (!importPassphrase.trim()) {
        messageApi.warning('请输入导入密码（导出时设置的密码）')
        return
      }
      if (!window.rdm) return
      setImporting(true)
      try {
        const r = await window.rdm.connection.importList(importPassphrase)
        if (r.success) {
          messageApi.success(r.message || '导入成功')
          setImportModalVisible(false)
          loadConnections()
        } else if (r.error && !r.error.includes('取消')) {
          messageApi.error(r.error)
        }
      } finally {
        setImporting(false)
      }
    }, [importPassphrase, loadConnections]),

    viewPassword: useCallback((id: string) => {
      if (revealedPasswords[id]) {
        setRevealedPasswords(prev => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        return
      }
      setPendingPasswordId(id)
      setOsPassword('')
      setOsPasswordModalVisible(true)
    }, [revealedPasswords]),

    osPasswordConfirm: useCallback(async () => {
      if (!osPassword && osPassword !== '') {
        messageApi.warning('请输入 Windows 登录密码')
        return
      }
      if (!window.rdm || !pendingPasswordId) return
      setOsVerifying(true)
      try {
        const authResult = await window.rdm.auth.verifyWindowsPassword(osPassword)
        if (!authResult.valid) {
          messageApi.error(authResult.error || 'Windows 密码不正确')
          return
        }
        const r = await window.rdm.connection.getPassword(pendingPasswordId)
        if (r.success && r.data !== undefined) {
          setRevealedPasswords(prev => ({ ...prev, [pendingPasswordId]: r.data! }))
          setOsPasswordModalVisible(false)
          setTimeout(() => {
            setRevealedPasswords(prev => {
              const next = { ...prev }
              delete next[pendingPasswordId]
              return next
            })
          }, 30000)
        } else {
          messageApi.error(r.error || '获取密码失败')
        }
      } finally {
        setOsVerifying(false)
      }
    }, [osPassword, pendingPasswordId])
  }

  // ---- 统一渲染 ----
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#2563eb',
          borderRadius: 8,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
        },
      }}
    >
      <AntdApp>
        {contextHolder}
        {!encryptionOk && (
          <div className="crypto-warning">
            加密服务不可用（safeStorage），密码将以不安全的方式存储
          </div>
        )}
        <Layout
          onAdd={handlers.add}
          onSearch={handlers.search}
          onSearchConnect={handlers.searchConnect}
          onExport={handlers.export}
          onImport={handlers.import}
          theme={currentTheme}
          onThemeChange={setTheme}
        >
          <ShortcutGrid
            shortcuts={filteredShortcuts}
            launchingId={launchingShortcutId}
            onAdd={handlers.addShortcut}
            onBatchDelete={handlers.batchDeleteShortcut}
            onLaunch={handlers.launchShortcut}
            onReorder={handlers.reorderShortcuts}
          />
          <ConnectionTable
            connections={filteredConnections}
            loading={loading}
            connectingId={connectingId}
            revealedPasswords={revealedPasswords}
            onEdit={handlers.edit}
            onDelete={handlers.delete}
            onConnect={handlers.connect}
            onViewPassword={handlers.viewPassword}
          />
        </Layout>

        <ConnectionForm
          visible={formVisible}
          editingConnection={editingConnection}
          onCancel={handlers.cancel}
          onSave={handlers.save}
        />

        {/* 导出弹窗 */}
        {exportModalVisible && (
          <div className="modal-overlay" onClick={() => setExportModalVisible(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3>导出连接列表</h3>
              <p>请设置导出密码（用于加密保护）：</p>
              <input
                type="password"
                placeholder="请输入导出密码"
                value={exportPassphrase}
                onChange={e => setExportPassphrase(e.target.value)}
                className="modal-input"
                autoFocus
              />
              <div className="modal-actions">
                <button onClick={() => setExportModalVisible(false)}>取消</button>
                <button onClick={handlers.confirmExport} disabled={exporting}>
                  {exporting ? '导出中...' : '导出'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 导入弹窗 */}
        {importModalVisible && (
          <div className="modal-overlay" onClick={() => setImportModalVisible(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3>导入连接列表</h3>
              <p>请输入导出时设置的密码：</p>
              <input
                type="password"
                placeholder="请输入导入密码"
                value={importPassphrase}
                onChange={e => setImportPassphrase(e.target.value)}
                className="modal-input"
                autoFocus
              />
              <div className="modal-actions">
                <button onClick={() => setImportModalVisible(false)}>取消</button>
                <button onClick={handlers.confirmImport} disabled={importing}>
                  {importing ? '导入中...' : '导入'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Windows 密码验证弹窗 */}
        {osPasswordModalVisible && (
          <div className="modal-overlay" onClick={() => setOsPasswordModalVisible(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3>验证身份</h3>
              <p>请输入当前 Windows 用户的登录密码以查看连接密码：</p>
              <input
                type="password"
                placeholder="请输入 Windows 密码"
                value={osPassword}
                onChange={e => setOsPassword(e.target.value)}
                className="modal-input"
                autoFocus
              />
              <div className="modal-actions">
                <button onClick={() => setOsPasswordModalVisible(false)}>取消</button>
                <button onClick={handlers.osPasswordConfirm} disabled={osVerifying}>
                  {osVerifying ? '验证中...' : '验证'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AntdApp>
    </ConfigProvider>
  )
}