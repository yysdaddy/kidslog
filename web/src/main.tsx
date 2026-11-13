import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { NativeSettings, isNative, openServerSettings } from './native'
import { loadServerBaseFromStorage, setServerBase } from './server'

function NoServer() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
      <p className="text-base font-medium text-slate-700">尚未设置服务器地址</p>
      <p className="text-sm text-slate-400 leading-relaxed">
        请填写你部署的「成长记录」服务地址，例如 http://192.168.1.10:8080
      </p>
      <button
        onClick={() => openServerSettings()}
        className="px-6 py-2.5 rounded-xl bg-brand-500 text-white text-sm"
      >
        去设置
      </button>
    </div>
  )
}

async function boot() {
  let configured = true
  if (isNative()) {
    try {
      const r = await NativeSettings.getServer()
      if (r?.url) setServerBase(r.url)
      else configured = false
    } catch {
      configured = false
    }
  } else {
    loadServerBaseFromStorage()
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>{configured ? <App /> : <NoServer />}</React.StrictMode>,
  )

  // 浏览器（PWA）场景注册 Service Worker；Capacitor 内置本地包，无需离线缓存
  if (!isNative() && 'serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  }
}

boot()
