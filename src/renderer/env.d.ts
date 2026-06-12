/// <reference types="vite/client" />

/**
 * 渲染进程全局类型声明
 * 扩展 Window 接口，提供 rdm API 的类型提示
 */

import type {
  ConnectionDisplay,
  CreateConnectionInput,
  UpdateConnectionInput,
  Shortcut
} from './types'

declare global {
  interface Window {
    rdm: {
      crypto: {
        check: () => Promise<{ available: boolean; message: string }>
      }
      connection: {
        list: () => Promise<{
          success: boolean
          data?: ConnectionDisplay[]
          error?: string
        }>
        save: (input: CreateConnectionInput) => Promise<{
          success: boolean
          data?: ConnectionDisplay
          error?: string
        }>
        update: (input: UpdateConnectionInput) => Promise<{
          success: boolean
          data?: ConnectionDisplay
          error?: string
        }>
        delete: (id: string) => Promise<{
          success: boolean
          message?: string
          error?: string
        }>
        connect: (id: string) => Promise<{
          success: boolean
          message?: string
          error?: string
        }>
        exportList: (passphrase: string) => Promise<{
          success: boolean
          message?: string
          error?: string
          path?: string
        }>
        importList: (passphrase: string) => Promise<{
          success: boolean
          message?: string
          error?: string
          data?: ConnectionDisplay[]
        }>
        getPassword: (id: string) => Promise<{
          success: boolean
          data?: string
          error?: string
        }>
      }
      auth: {
        verifyWindowsPassword: (password: string) => Promise<{
          valid: boolean
          error?: string
        }>
      }
      settings: {
        getAutoStart: () => Promise<{ enabled: boolean }>
        setAutoStart: (enabled: boolean) => Promise<{ success: boolean; error?: string }>
        createDesktopShortcut: () => Promise<{ success: boolean; message?: string; error?: string }>
      }
      window: {
        minimize: () => Promise<void>
        maximize: () => Promise<void>
        close: () => Promise<void>
        isMaximized: () => Promise<boolean>
      }
      shortcut: {
        list: () => Promise<{ success: boolean; data?: Shortcut[]; error?: string }>
        add: (input: { name: string; exePath: string; arguments?: string; iconData?: string }) => Promise<{ success: boolean; data?: Shortcut; error?: string }>
        delete: (id: string) => Promise<{ success: boolean; error?: string }>
        batchDelete: (ids: string[]) => Promise<{ success: boolean; data?: number; error?: string }>
        reorder: (orderedIds: string[]) => Promise<{ success: boolean; error?: string }>
        launch: (id: string) => Promise<{ success: boolean; message?: string; error?: string }>
        pickFile: () => Promise<{ success: boolean; data?: { name: string; exePath: string; iconData?: string }; error?: string }>
      }
    }
  }
}