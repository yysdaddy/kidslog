# KidsLog Android 壳（自定义服务器地址）

纯 WebView 壳，无第三方依赖（仅 Android Framework），用于把 KidsLog 网页打包成 APK，并允许用户自行填写服务器地址。

## 功能

| 能力 | 说明 |
|---|---|
| 首启配置 | 未配置地址时进入「服务器设置」页，预填默认地址 |
| 地址输入 | 支持 `https://域名:端口/` 与 `http://192.168.x.x:8085/`；无 scheme 自动补 `http://` |
| 测试连接 | 请求 `<地址>api/health`，显示 HTTP 状态与失败原因 |
| 应用内修改 | 长按返回键进入设置；错误页也有「修改服务器地址」 |
| 错误页 | 主框架加载失败时展示内置错误页（含当前地址、失败 URL、原因、重试） |
| 文件上传 | WebView 文件选择器（图片/文件） |
| 下载 | 交给系统 DownloadManager，带 Cookie |
| 权限 | 相机/麦克风请求自动授予；定位拒绝 |
| 局域网明文 | `usesCleartextTraffic=true` + network-security-config |

## 目录

```
android/
├── app/src/main/
│   ├── java/top/dao0210/kidslog/
│   │   ├── MainActivity.java           # WebView 壳
│   │   ├── ServerSettingsActivity.java # 地址配置页
│   │   └── ServerConfig.java           # 地址存取/规范化/校验
│   ├── assets/error.html               # 内置错误页
│   ├── res/                            # 图标、主题、网络安全配置
│   └── AndroidManifest.xml
├── build.gradle / settings.gradle / gradle.properties
└── keystore/                           # 正式签名（git 忽略）
```

## 本地构建

```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/opt/android-sdk
cd android
gradle :app:assembleRelease
# 产物：app/build/outputs/apk/release/app-release.apk
```

正式签名读取 `android/keystore.properties`：

```properties
storeFile=keystore/kidslog-release.jks
storePassword=***
keyAlias=kidslog
keyPassword=***
```

无该文件时自动回退 debug 签名，保证可直接出包。

## CI 构建

`.github/workflows/android.yml`，push `android/**` 或手动触发即出 APK；打 `android-v*` 标签会附到 Release。

需在仓库 Secrets 配置（可选，缺省用 debug 签名）：

| Secret | 内容 |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 kidslog-release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore 密码 |
| `ANDROID_KEY_ALIAS` | `kidslog` |
| `ANDROID_KEY_PASSWORD` | key 密码 |

## 签名说明

- 包名沿用 `top.dao0210.kidslog`，与 1.1.0 相同但签名不同，**覆盖安装会失败，需先卸载旧版**。
- 签名密钥丢失将无法升级已安装的版本，务必离线备份 `kidslog-release.jks` 与密码。
