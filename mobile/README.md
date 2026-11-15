# KidsLog Android（Capacitor）

安卓端工程。Web 资源来自 `../web` 的构建产物，通过 Capacitor 6 复制进原生工程，不再手写 WebView 壳。

| 项目 | 值 |
| --- | --- |
| 应用 ID | `top.yysdaddy.kidslog` |
| 应用名 | 成长记录 |
| 当前版本 | 1.2.3-test（versionCode 5） |
| 最低系统 | Android 6.0（API 23） |
| Capacitor | 6.x |

## 构建

```bash
# 1) 构建前端
cd ../web && npm install && npm run build

# 2) 同步到 Capacitor 的 www 目录（www 被 gitignore）
rm -rf www/* && cp -rf ../web/dist/. www/

# 3) 复制进原生工程
npm install
npx cap copy android

# 4) 打包
cd android && gradle assembleRelease
# 产物：android/app/build/outputs/apk/release/app-release.apk
```

`npx cap copy` 是必须的：只替换 `www/` 不会同步到 `android/app/src/main/assets/public/`，APK 里仍是旧前端。

## 签名

`android/keystore.properties`（不入库）：

```properties
storeFile=keystore/kidslog-release.jks
storePassword=***
keyAlias=kidslog
keyPassword=***
```

`build.gradle` 判断该文件存在才启用 release 签名，否则回落 debug 签名（不可覆盖安装已发布版本）。

## 与 Web 的交互

- `web/src/native.ts`：`getAppInfo()` 读取原生版本号；`ServerStore` 等原生插件走 Capacitor 桥。
- `web/src/backStack.ts` + `hooks/useBackHandler.ts`：弹层入栈/出栈；`main.tsx` 暴露 `window.__kidslogHandleBack`，
  原生 `MainActivity.onBackPressed` 先调用它，返回 `"1"` 表示前端已消费返回事件。
- CORS 与 Bearer Token：App 直连服务端 API，服务端已放开跨域并支持 `Authorization: Bearer <token>`。

## 发布

仓库根目录 `apk/` 存放已构建安装包；CI 见 `.github/workflows/android.yml`。
