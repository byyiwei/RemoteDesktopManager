/**
 * 软件快捷方式区域
 * 支持：编辑模式（勾选删除）、拖拉排序、点击启动
 */

import React, { useState, useRef, useCallback } from 'react'
import { Tooltip, Switch, Input } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  AppstoreOutlined,
  RocketOutlined,
  HolderOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import type { Shortcut } from '../types'

interface Props {
  shortcuts: Shortcut[]
  launchingId: string | null
  selectedIndex: number
  onAdd: () => void
  onBatchDelete: (ids: string[]) => void
  onLaunch: (id: string) => void
  onReorder: (orderedIds: string[]) => void
  onSearch?: (keyword: string) => void
  onSearchConnect?: () => void
  onSearchNavigate?: (direction: 'up' | 'down' | 'activate') => void
}

/** 根据名称生成稳定的颜色（无图标时回退） */
function nameToColor(name: string): string {
  const colors = [
    '#6366f1', '#2563eb', '#0d9488', '#16a34a',
    '#dc2626', '#ea580c', '#7c3aed', '#0891b2',
    '#b91c1c', '#1e40af', '#059669', '#d97706'
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  }
  return colors[Math.abs(hash) % colors.length]
}

const ShortcutGrid: React.FC<Props> = ({
  shortcuts, launchingId, selectedIndex, onAdd, onBatchDelete, onLaunch, onReorder, onSearch, onSearchConnect, onSearchNavigate
}) => {
  const [editMode, setEditMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchValue, setSearchValue] = useState('')

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchValue(value)
    onSearch?.(value)
  }, [onSearch])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearchConnect?.()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      onSearchNavigate?.('up')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      onSearchNavigate?.('down')
    }
  }, [onSearchConnect, onSearchNavigate])

  // 拖拉排序状态
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === shortcuts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(shortcuts.map(s => s.id)))
    }
  }, [selectedIds.size, shortcuts])

  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size === 0) return
    onBatchDelete(Array.from(selectedIds))
    setSelectedIds(new Set())
    setEditMode(false)
  }, [selectedIds, onBatchDelete])

  // ---- 拖拉排序 ----
  const handleDragStart = useCallback((index: number) => {
    dragItem.current = index
    setDragIndex(index)
  }, [])

  const handleDragEnter = useCallback((index: number) => {
    dragOverItem.current = index
  }, [])

  const handleDragEnd = useCallback(() => {
    if (dragItem.current === null || dragOverItem.current === null) {
      setDragIndex(null)
      return
    }
    if (dragItem.current === dragOverItem.current) {
      setDragIndex(null)
      return
    }

    const items = [...shortcuts]
    const draggedItem = items[dragItem.current]
    items.splice(dragItem.current, 1)
    items.splice(dragOverItem.current, 0, draggedItem)

    onReorder(items.map(s => s.id))
    dragItem.current = null
    dragOverItem.current = null
    setDragIndex(null)
  }, [shortcuts, onReorder])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const exitEditMode = useCallback(() => {
    setEditMode(false)
    setSelectedIds(new Set())
  }, [])

  return (
    <div className="shortcut-section">
      <div className="shortcut-header">
        <span className="shortcut-title">
          <AppstoreOutlined /> 快捷启动
        </span>
        <div className="shortcut-header-actions">
          {editMode && (
            <>
              <button
                className={`shortcut-select-all-btn ${selectedIds.size === shortcuts.length && shortcuts.length > 0 ? 'active' : ''}`}
                onClick={toggleSelectAll}
              >
                {selectedIds.size === shortcuts.length && shortcuts.length > 0 ? '取消全选' : '全选'}
              </button>
              {selectedIds.size > 0 && (
                <button className="shortcut-batch-delete-btn" onClick={handleBatchDelete}>
                  <DeleteOutlined /> 删除 ({selectedIds.size})
                </button>
              )}
              <button className="shortcut-edit-done-btn" onClick={exitEditMode}>
                完成
              </button>
            </>
          )}
          {!editMode && shortcuts.length > 0 && (
            <Tooltip title="编辑快捷方式（排序/删除）">
              <button className="shortcut-edit-toggle-btn" onClick={() => setEditMode(true)}>
                编辑
              </button>
            </Tooltip>
          )}
          <Tooltip title="添加软件快捷方式">
            <button className="shortcut-add-btn" onClick={onAdd}>
              <PlusOutlined />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* 快捷启动搜索框 */}
      <div className="shortcut-search-wrapper">
        <Input
          className="shortcut-search-input"
          placeholder="搜索快捷启动"
          prefix={<SearchOutlined />}
          value={searchValue}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
        />
      </div>

      {shortcuts.length === 0 ? (
        <div className="shortcut-empty">
          <RocketOutlined className="shortcut-empty-icon" />
          <span>点击 + 添加常用软件，快速启动</span>
        </div>
      ) : (
        <div className={`shortcut-grid ${editMode ? 'shortcut-grid-edit' : ''}`}>
          {shortcuts.map((s, index) => {
            const isLaunching = launchingId === s.id
            const isSelected = selectedIds.has(s.id)
            const isDragging = dragIndex === index
            const color = nameToColor(s.name)

            return (
              <div
                key={s.id}
                className={[
                  'shortcut-item',
                  isLaunching ? 'shortcut-item-launching' : '',
                  editMode ? 'shortcut-item-edit' : '',
                  isSelected ? 'shortcut-item-selected' : '',
                  isDragging ? 'shortcut-item-dragging' : '',
                  selectedIndex === index ? 'shortcut-item-keyboard-selected' : '',
                ].filter(Boolean).join(' ')}
                draggable={editMode}
                onDragStart={() => handleDragStart(index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onClick={() => {
                  if (editMode) {
                    toggleSelect(s.id)
                  } else if (!launchingId) {
                    onLaunch(s.id)
                  }
                }}
                onContextMenu={(e) => {
                  if (!editMode) {
                    e.preventDefault()
                    setEditMode(true)
                    setSelectedIds(new Set([s.id]))
                  }
                }}
              >
                {/* 编辑模式：拖拽手柄 */}
                {editMode && (
                  <div className="shortcut-drag-handle">
                    <HolderOutlined />
                  </div>
                )}

                {/* 编辑模式：勾选框 */}
                {editMode && (
                  <div className={`shortcut-checkbox ${isSelected ? 'checked' : ''}`}>
                    {isSelected && <span className="shortcut-check-icon">✓</span>}
                  </div>
                )}

                {/* 图标 */}
                {s.iconData ? (
                  <div className="shortcut-icon shortcut-icon-img">
                    <img src={s.iconData} alt={s.name} draggable={false} />
                  </div>
                ) : (
                  <div className="shortcut-icon" style={{ background: color }}>
                    {isLaunching ? (
                      <span className="shortcut-icon-loading" />
                    ) : (
                      <span className="shortcut-icon-letter">
                        {s.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                )}
                <span className="shortcut-name">{s.name}</span>
              </div>
            )
          })}

          {/* 添加按钮占位 */}
          {!editMode && (
            <div className="shortcut-item shortcut-item-add" onClick={onAdd}>
              <div className="shortcut-icon shortcut-icon-add">
                <PlusOutlined />
              </div>
              <span className="shortcut-name">添加</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ShortcutGrid
