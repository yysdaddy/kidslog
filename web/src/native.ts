// Capacitor 原生桥：服务器配置读写、打开原生设置页、应用信息
import { registerPlugin } from '@capacitor/core'

export interface NativeSettingsPlugin {
  getServer(): Promise<{ url: string }>
  openSettings(): Promise<void>
  getAppInfo(): Promise<{ versionName: string; versionCode: number; packageName: string }>
}

export const NativeSettings = registerPlugin<NativeSettingsPlugin>('NativeSettings')

export function isNative(): boolean {
  const c = (window as any).Capacitor
  if (!c) return false
  if (typeof c.isNativePlatform === 'function') return c.isNativePlatform()
  return c.platform && c.platform !== 'web'
}

export function nativePlatform(): string {
  const c = (window as any).Capacitor
  if (!c) return 'web'
  return typeof c.getPlatform === 'function' ? c.getPlatform() : c.platform || 'web'
}

/** 原生下打开服务器设置页（未配置或需要改地址时） */
export async function openServerSettings(): Promise<void> {
  if (!isNative()) return
  try {
    await NativeSettings.openSettings()
  } catch {
    /* ignore */
  }
}
