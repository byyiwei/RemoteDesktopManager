/**
 * 连接列表 - 单列横向卡片布局
 * 适配竖屏 1000x1300 窗口，每行一个连接，信息横向排列
 */

import React from 'react'
import { Spin, Tag, Tooltip } from 'antd'
import {
  EditOutlined,
  DeleteOutlined,
  LoadingOutlined,
  LockOutlined,
  UnlockOutlined,
  GlobalOutlined,
  UserOutlined,
  DesktopOutlined,
  PlayCircleOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons'
import type { ConnectionDisplay } from '../types'
import { BASTION_HOST_OPTIONS } from '../types'

const getBastionHost = (key: string) => BASTION_HOST_OPTIONS.find(o => o.key === key)

interface Props {
  connections: ConnectionDisplay[]
  loading: boolean
  connectingId: string | null
  selectedIndex: number
  revealedPasswords: Record<string, string>
  onEdit: (c: ConnectionDisplay) => void
  onDelete: (id: string) => void
  onConnect: (id: string) => void
  onViewPassword: (id: string) => void
}

const ConnectionTable: React.FC<Props> = ({
  connections, loading, connectingId, selectedIndex, revealedPasswords,
  onEdit, onDelete, onConnect, onViewPassword
}) => {

  if (loading) {
    return (
      <div className="empty-state">
        <div className="empty-state-wrapper">
          <Spin size="large" tip="加载中..." />
          <div className="empty-state-desc" style={{ marginTop: 16 }}>正在加载连接列表...</div>
        </div>
      </div>
    )
  }

  if (connections.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-wrapper">
          <div className="empty-state-icon">
            <DesktopOutlined />
          </div>
          <div className="empty-state-title">暂无远程桌面连接</div>
          <div className="empty-state-desc">点击工具栏「新建连接」开始管理您的远程服务器</div>
        </div>
      </div>
    )
  }

  return (
    <div className="connection-grid">
      {connections.map((r, i) => {
        const isConnecting = connectingId === r.id
        const isDisabled = connectingId !== null && !isConnecting

        return (
          <div
            key={r.id}
            className={`connection-card ${isConnecting ? 'connection-card-connecting' : ''} ${selectedIndex === i ? 'connection-card-selected' : ''}`}
            onDoubleClick={() => {
              if (!connectingId) onConnect(r.id)
            }}
            style={{ opacity: isDisabled ? 0.6 : 1 }}
          >
            <div className="connection-card-inner">
              {/* 左侧：连接信息 */}
              <div className="connection-card-main">
                <div className="connection-card-header">
                  <span className="connection-card-name" title={r.clientName}>
                    {r.clientName}
                  </span>
                  <div className="connection-card-actions">
                    <button
                      className="connection-card-action-btn"
                      onClick={(e) => { e.stopPropagation(); onEdit(r) }}
                      title="编辑"
                    >
                      <EditOutlined style={{ fontSize: 12 }} />
                    </button>
                    <button
                      className="connection-card-action-btn connection-card-action-btn-delete"
                      onClick={(e) => { e.stopPropagation(); onDelete(r.id) }}
                      title="删除"
                    >
                      <DeleteOutlined style={{ fontSize: 12 }} />
                    </button>
                  </div>
                </div>

                <div className="connection-card-meta">
                  <span className="connection-card-meta-item">
                    <GlobalOutlined />
                    <span className="connection-card-ip">{r.ipAddress}:{r.port}</span>
                  </span>
                  <span className="connection-card-meta-item">
                    <UserOutlined />
                    <span>{r.username}</span>
                  </span>
                  <span className="connection-card-meta-item">
                    {r.hasPassword
                      ? <Tag icon={<LockOutlined />} color="success" className="tag-modern" style={{ margin: 0, fontSize: 11 }}>已设密码</Tag>
                      : <Tag icon={<UnlockOutlined />} color="warning" className="tag-modern" style={{ margin: 0, fontSize: 11 }}>无密码</Tag>
                    }
                    {r.hasPassword && (
                      <Tooltip title={revealedPasswords[r.id] ? '隐藏密码' : '查看密码'}>
                        <button
                          className="connection-card-action-btn"
                          style={{ width: 24, height: 24 }}
                          onClick={(e) => { e.stopPropagation(); onViewPassword(r.id) }}
                        >
                          {revealedPasswords[r.id]
                            ? <EyeInvisibleOutlined style={{ color: '#6366f1', fontSize: 12 }} />
                            : <EyeOutlined style={{ color: '#9ca3af', fontSize: 12 }} />}
                        </button>
                      </Tooltip>
                    )}
                  </span>
                </div>

                {/* 堡垒机 / VPN 色块标签 */}
                {r.bastionHosts && r.bastionHosts.length > 0 && (
                  <div className="connection-card-bastions">
                    {r.bastionHosts.map((key) => {
                      const host = getBastionHost(key)
                      if (!host) return null
                      return (
                        <span
                          key={key}
                          className="bastion-tag"
                          style={{
                            background: host.color + '18',
                            color: host.color,
                            borderColor: host.color + '40',
                          }}
                        >
                          <span className="bastion-tag-dot" style={{ background: host.color }} />
                          {host.label}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* 显示已解密的密码 */}
                {revealedPasswords[r.id] && (
                  <div className="password-reveal-box">
                    <LockOutlined className="password-reveal-icon" />
                    <span className="password-reveal-text">{revealedPasswords[r.id]}</span>
                    <span className="password-reveal-timer">（30秒后隐藏）</span>
                  </div>
                )}
              </div>

              {/* 右侧：连接按钮 */}
              <div className="connection-card-right">
                {isConnecting ? (
                  <span className="connection-connect-btn" style={{ cursor: 'default', background: 'rgba(99,102,241,0.15)', color: '#6366f1', boxShadow: 'none' }}>
                    <LoadingOutlined spin /> 连接中
                  </span>
                ) : (
                  <button
                    className="connection-connect-btn"
                    onClick={(e) => { e.stopPropagation(); onConnect(r.id) }}
                    disabled={connectingId !== null}
                  >
                    <PlayCircleOutlined />
                    连接
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ConnectionTable
