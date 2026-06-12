/**
 * 测试组件 - 用于诊断白板问题
 */

import React from 'react'

export default function TestApp() {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '48px',
        boxShadow: '0 16px 48px rgba(99, 102, 241, 0.12)'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)'
        }}>
          <span style={{ fontSize: '40px', color: 'white' }}>🖥️</span>
        </div>
        <h1 style={{
          fontSize: '24px',
          color: '#1e1b4b',
          textAlign: 'center',
          margin: '0 0 12px'
        }}>Remote Desktop Manager</h1>
        <p style={{
          fontSize: '14px',
          color: '#6b7280',
          textAlign: 'center',
          margin: '0'
        }}>测试页面 - 如果能看到这个，说明基本渲染正常</p>
        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: '#ecfdf5',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <span style={{ color: '#10b981', fontWeight: '500' }}>✓ 渲染成功!</span>
        </div>
      </div>
    </div>
  )
}