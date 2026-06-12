/**
 * 连接表单 - 添加/编辑远程桌面连接
 */

import React, { useEffect, useState } from 'react'
import { Modal, Form, Input, InputNumber, Checkbox } from 'antd'
import {
  UserOutlined,
  LockOutlined,
  GlobalOutlined,
  DesktopOutlined,
  NumberOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import type { ConnectionDisplay, CreateConnectionInput } from '../types'
import { BASTION_HOST_OPTIONS } from '../types'

interface Props {
  visible: boolean
  editingConnection: ConnectionDisplay | null
  onSave: (v: CreateConnectionInput & { id?: string }) => void
  onCancel: () => void
}

const ConnectionForm: React.FC<Props> = ({ visible, editingConnection, onSave, onCancel }) => {
  const [form] = Form.useForm()
  const [bastionExpanded, setBastionExpanded] = useState(false)
  const isEdit = editingConnection !== null

  useEffect(() => {
    if (visible) {
      if (editingConnection) {
        form.setFieldsValue({
          clientName: editingConnection.clientName,
          ipAddress: editingConnection.ipAddress,
          port: editingConnection.port,
          username: editingConnection.username,
          password: '',
          bastionHosts: editingConnection.bastionHosts || [],
          customBastion: ''
        })
        setBastionExpanded((editingConnection.bastionHosts || []).length > 0)
      } else {
        form.resetFields()
        form.setFieldsValue({ port: 3389, bastionHosts: [], customBastion: '' })
        setBastionExpanded(false)
      }
    }
  }, [visible, editingConnection])

  const handleOk = async () => {
    const v = await form.validateFields()
    // 处理堡垒机选项（包含自定义选项）
    const bastionHosts = [...(v.bastionHosts || [])]
    const customBastion = (v.customBastion || '').trim()
    if (customBastion && !bastionHosts.includes('custom')) {
      bastionHosts.push('custom')
    } else if (!customBastion && bastionHosts.includes('custom')) {
      bastionHosts.splice(bastionHosts.indexOf('custom'), 1)
    }
    onSave({
      clientName: v.clientName,
      ipAddress: v.ipAddress,
      port: v.port ?? 3389,
      username: v.username,
      password: v.password || '',
      bastionHosts,
      ...(isEdit && editingConnection ? { id: editingConnection.id } : {})
    })
  }

  return (
    <Modal
      title={isEdit ? '编辑连接' : '新建连接'}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      okText="保存"
      cancelText="取消"
      width={380}
      destroyOnClose
      maskClosable={false}
      className="modal-modern"
      okButtonProps={{ className: 'btn-primary' }}
      cancelButtonProps={{ style: { borderRadius: 6 } }}
    >
      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
        size="middle"
        className="form-modern"
      >
        <Form.Item
          name="clientName"
          label="连接名称"
          rules={[{ required: true, message: '请输入连接名称' }, { max: 60 }]}
        >
          <Input
            placeholder="如：公司服务器、数据库主机"
            prefix={<DesktopOutlined style={{ color: '#9ca3af' }} />}
            maxLength={60}
            allowClear
          />
        </Form.Item>

        <Form.Item
          name="ipAddress"
          label="IP 地址"
          rules={[
            { required: true, message: '请输入 IP 地址' },
            { pattern: /^(\d{1,3}\.){3}\d{1,3}$/, message: '请输入有效的 IPv4 地址' },
            {
              validator: (_, v) =>
                v && v.split('.').every((p: string) => +p >= 0 && +p <= 255)
                  ? Promise.resolve()
                  : Promise.reject('IP 各段需在 0-255 之间')
            }
          ]}
        >
          <Input
            placeholder="192.168.1.100"
            prefix={<GlobalOutlined style={{ color: '#9ca3af' }} />}
            maxLength={15}
            allowClear
          />
        </Form.Item>

        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item
            name="port"
            label="端口"
            initialValue={3389}
            rules={[{ required: true }, { type: 'number', min: 1, max: 65535, message: '端口 1-65535' }]}
            style={{ flex: '0 0 130px' }}
          >
            <InputNumber
              placeholder="3389"
              min={1}
              max={65535}
              style={{ width: '100%' }}
              prefix={<NumberOutlined style={{ color: '#9ca3af', marginRight: 4 }} />}
            />
          </Form.Item>

          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }, { max: 128 }]}
            style={{ flex: 1 }}
          >
            <Input
              placeholder="Administrator"
              prefix={<UserOutlined style={{ color: '#9ca3af' }} />}
              maxLength={128}
              allowClear
            />
          </Form.Item>
        </div>

        <Form.Item
          name="password"
          label={isEdit ? '密码（留空不修改）' : '密码'}
          rules={isEdit ? [] : [{ required: true, message: '请输入密码' }]}
        >
          <Input.Password
            placeholder={isEdit ? '留空则不修改密码' : '输入远程桌面密码'}
            prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
            maxLength={128}
          />
        </Form.Item>

        <Form.Item>
          <div
            className="bastion-toggle-header"
            onClick={() => setBastionExpanded(!bastionExpanded)}
          >
            <span className="bastion-toggle-icon">
              <SafetyCertificateOutlined style={{ marginRight: 4, color: '#6b7280' }} />
            </span>
            <span className="bastion-toggle-label">堡垒机 / VPN（多选）</span>
            <span className={`bastion-toggle-arrow ${bastionExpanded ? 'rotated' : ''}`}>
              ▼
            </span>
          </div>
          <div className={`bastion-content ${bastionExpanded ? 'expanded' : 'collapsed'}`}>
            <Form.Item name="bastionHosts" noStyle>
              <Checkbox.Group style={{ width: '100%' }}>
                <div className="bastion-checkbox-grid">
                  {BASTION_HOST_OPTIONS.map((opt) => (
                    <Checkbox key={opt.key} value={opt.key} className="bastion-checkbox">
                      <span className="bastion-checkbox-label">
                        <span
                          className="bastion-color-dot"
                          style={{ background: opt.color }}
                        />
                        {opt.label}
                      </span>
                    </Checkbox>
                  ))}
                  <Checkbox key="custom" value="custom" className="bastion-checkbox">
                    <span className="bastion-checkbox-label">
                      <span
                        className="bastion-color-dot"
                        style={{ background: '#8b5cf6' }}
                      />
                      其他（自定义）
                    </span>
                  </Checkbox>
                </div>
              </Checkbox.Group>
            </Form.Item>
            <Form.Item name="customBastion" noStyle>
              <div className="custom-bastion-input-wrapper">
                <Input
                  placeholder="请输入自定义堡垒机/VPN名称"
                  maxLength={30}
                  className="custom-bastion-input"
                  disabled={!form.getFieldValue('bastionHosts')?.includes('custom')}
                />
              </div>
            </Form.Item>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default ConnectionForm
