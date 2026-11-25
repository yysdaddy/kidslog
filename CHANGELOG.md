# 更新记录

版本分两条线：服务端 / Web 走语义化版本（`0.6.x`），Android 走独立版本（`1.3.x`，1.2.x 为带 `-test` 后缀的测试线）。
镜像标签与服务端版本一致，安卓安装包发布在 [GitHub Releases](https://github.com/yysdaddy/kidslog/releases)（`apk/` 仅留存校验清单）。

## 服务端 / Web

### 0.6.11 · 2026-11-15

- 仓库去内部标识：源码、脚本注释、文档中的旧账号/包名片段统一替换为 `yysdaddy`，
  Java 包路径统一到 `top/yysdaddy/kidslog`。
- 安卓应用 ID 去测试标记：`top.yysdaddy.kidslog.test` → `top.yysdaddy.kidslog`，应用名「成长记录(测试)」→「成长记录」。
- 版本号与 `docker-compose.yml`、`docker-compose.noenv.yml`、`.env.example`、镜像标签统一到 `0.6.11`。

### 0.6.10 · 2026-11-15

- 设置页存储卡片文案澄清：标题由「存储占用」改为「照片与视频占用」，右侧只显示媒体文件体积，
  避免被误解成本服务/容器占用的空间。
- 卡片底部新增一行灰色说明「服务器磁盘已用 xx% · 剩余 xx」，进度条仍按磁盘使用率显示，
  明确区分「本应用媒体数据」与「服务器整盘空间」。

### 0.6.9 · 2026-11-15

- 新增命令行重置密码脚本 `server/scripts/reset-password.mjs`：`--list` 列出账号、交互式隐藏输入、`--no-force-change`、`--yes`；非交互且未给密码时自动生成 12 位随机密码并打印一次。
- `package.json` 增加 `npm run reset-password` 入口，可在容器内直接调用。
- 重置密码会把账号 `token_version` 加一，已登录设备全部失效。
- README 增补「忘记密码 / 命令行重置密码」「安卓 App」「更新记录」章节，示例用户名脱敏为 `parent`。
- 修复安卓 App 内记录图片/视频显示损坏：媒体接口改为同时接受服务端签发的短时效签名（7 天），
  `attachmentToApi` 返回带 `exp`/`sig` 的 `url`、`thumbUrl`，`<img>`/`<video>` 无需请求头即可加载；
  Cookie 与 Bearer 鉴权保持原有行为，签名非法或过期仍返回 401。
- 健壮性：令牌缺少 `uid` 时直接按 401 处理，避免触发数据库参数绑定异常返回 500。
- 存储占用改为按磁盘剩余空间动态显示：`/api/storage` 用 `statfs` 返回 `freeBytes`/`totalBytes`，
  `quotaBytes` 默认等于「已用 + 磁盘可用」，不再固定 20GB；设置页文案改为「媒体占用 · 磁盘剩余」，
  进度条按磁盘使用率显示。`MEDIA_QUOTA_GB` 降级为可选上限（>0 时才生效，取磁盘可用的较小值）。
- 版本号与 `docker-compose*.yml`、`.env.example`、镜像标签统一到 `0.6.9`。

### 0.6.8 · 2026-11-14（内部构建）

- 媒体与备份稳定性修复，随 0.6.9 一并发布，未单独打标签。

### 0.6.7 · 2026-11-10

- 登录限流与异步密码哈希（scrypt，N=16384/r=8/p=1），修正文档中关于限流的矛盾描述。
- 版本号、镜像标签、文档版本对齐。

### 0.6.6 · 2026-11-09

- 新增零配置部署 `docker-compose.noenv.yml`：无需 `.env`，首次启动自动生成 JWT 密钥到 `data/.jwt_secret`（0600）并持久化。
- CI 覆盖免配置场景：未设置 `JWT_SECRET` 应正常启动，短密钥仍拒绝启动。

### 0.6.5 · 2026-11-08

- `docker-compose.yml` 默认拉取预构建镜像，源码构建改为独立 override（`docker-compose.build.yml`）。
- 发布工作流支持多源推送：GHCR、Docker Hub、阿里云 ACR（缺省则跳过）。
- 新增 `release.yml`，推送 `v*` 标签自动构建并推送镜像。

### 0.6.3 · 2026-11-06

- 开源初始版本：脱敏、强制 `JWT_SECRET`（≥ 32 位）、注册开关、接口限流、LICENSE / SECURITY / .env.example。
- CI：前端构建、后端冒烟测试、镜像构建。

## Android

### 1.3.0 · 2026-11-15

- 正式版：版本名去掉 `-test` 后缀（`1.2.5-test` → `1.3.0`），应用名改为「成长记录」。
- 应用 ID 统一为 `top.yysdaddy.kidslog`，Java 包路径 `top/yysdaddy/kidslog`；自定义 URL scheme 同步更新。
- release keystore 重签（DN `CN=yysdaddy, OU=KidsLog, O=yysdaddy`），SHA-256
  `76:17:F9:DA:E7:41:AC:D9:66:8A:00:28:E1:72:1D:67:D7:62:FC:67:39:33:5C:5E:D2:93:AF:34:CB:1D:EA:FD`。
- versionCode 8，versionName `1.3.0`；安装包 `apk/kidslog-1.3.0.apk`。
- 与 1.2.x 测试包包名、签名均不同，覆盖安装会失败，需先卸载旧版。

### 1.2.5-test · 2026-11-15

- 同步 0.6.10 设置页文案：存储卡片改为「照片与视频占用」，底部补「服务器磁盘已用 xx% · 剩余 xx」。
- versionCode 7，versionName `1.2.5-test`；安装包 `apk/kidslog-1.2.5-test.apk`。

### 1.2.4-test · 2026-11-15

- 同步服务端存储接口改动：`/api/storage` 改为返回磁盘 `freeBytes`/`totalBytes`，设置页按磁盘剩余动态显示。
- versionCode 6，versionName `1.2.4-test`；安装包 `apk/kidslog-1.2.4-test.apk`。

### 1.2.3-test · 2026-11-15

- 改用 Capacitor 6 打包（工程位于 `mobile/`），替换 1.2.1 之前的手写 WebView 壳。
- 新增前端返回栈（`web/src/backStack.ts`、`hooks/useBackHandler.ts`）：弹层、全屏子页面依次入栈，物理返回键先关闭栈顶，栈空才退出 App。
- 原生侧 `MainActivity` 覆写 `onBackPressed`，优先询问前端 `window.__kidslogHandleBack`；`AndroidManifest` 关闭 `enableOnBackInvokedCallback` 以走传统返回路径。
- 关闭 release 包的 `webContentsDebuggingEnabled`，避免生产包暴露 WebView 调试通道。
- versionCode 5，versionName `1.2.3-test`；安装包 `apk/kidslog-1.2.3-test.apk`。

### 1.2.2-test · 2026-11-14

- 迁移到 Capacitor 工程，`applicationId` 仍为 `top.yysdaddy.kidslog`。

### 1.2.1-test · 2026-11-13

- 手写 WebView 壳新增常驻可拖动设置入口。

### 1.2.0-test · 2026-11-12

- 首个独立包名测试版，不预填服务器地址，首启引导填写。
