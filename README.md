# KidsLog · 家庭成长记录

![CI](https://github.com/yysdaddy/kidslog/actions/workflows/ci.yml/badge.svg)

自托管的家庭育儿记录系统。给家里的小宝宝记喂养、睡眠、身高体重、就医用药和日常出行，
照片视频一起留档，多设备多家人共用同一份账本。

前后端一体打包，一个 Docker 容器 + 一个 SQLite 文件就能跑起来，数据完全在自己手里。

## 功能

**记录**（10 类，按年龄段动态排序）

| 分类 | 内容 |
| --- | --- |
| 喂养 | 母乳 / 瓶喂 / 辅食，奶量、食物、时长 |
| 睡眠 | 入睡起床时间、睡眠质量 |
| 换尿布 | 类型、性状、颜色 |
| 体温 | 温度值、测量方式，超阈值标红 |
| 用药 | 药名、剂量、单位、给药途径 |
| 户外 | 地点、同行人、时长 |
| 接送 | 方向、执行人、地点 |
| 生长发育 | 身高、体重、头围，自动绘制曲线 |
| 就医 | 医院、科室、医生、诊断、处置、费用、复诊日期 |
| 随手记 | 自由文本 |

**其他**

- 孩子档案（生日、性别、头像），多孩切换
- 家庭协作：邀请码加入，成员角色与权限区分
- 今日时间轴 + 日历视图（按月打点）
- 媒体附件：记录内可上传图片/视频，服务端统一转码为 JPEG 与 720p MP4，随记录详情预览
- 统计：喂养/睡眠频次、生长发育曲线、健康概览
- 疫苗计划参考（按月龄提示）
- 管理员后台：成员管理、重置密码、账号停用、存储配额与自动清理
- PWA 可安装到手机桌面

## 技术栈

- 后端：Node.js 22 + Fastify 5 + `node:sqlite`（Node 内置 SQLite，无需编译原生模块）
- 前端：React 18 + TypeScript + Vite 6 + Tailwind CSS 3
- 媒体处理：sharp（图片）+ ffmpeg（视频）
- 部署：单容器，Dockerfile 多阶段构建（前端构建 → 运行时）

## 目录结构

```
.
├─ docker-compose.yml     # 一键部署（默认拉取预构建镜像）
├─ docker-compose.noenv.yml # 零配置部署：不需要 .env，密钥自动生成
├─ docker-compose.build.yml # 可选：从源码本地构建的 override
├─ Dockerfile             # 多阶段：前端构建 → 运行时（含 ffmpeg）
├─ .env.example           # 环境变量模板
├─ server/
│  └─ src/
│     ├─ index.js         # Fastify 入口，静态文件 + API + 鉴权钩子
│     ├─ db.js            # SQLite 表结构与迁移
│     ├─ auth.js          # scrypt 密码哈希、JWT Cookie
│     ├─ media.js         # 图片/视频转码与缩略图
│     ├─ vaccinePlan.js   # 疫苗计划数据
│     └─ routes/          # auth / children / records / media / stats / account / admin / health
├─ web/
│  └─ src/
│     ├─ App.tsx          # 路由与导航
│     ├─ recordTypes.tsx  # 记录类型与表单字段定义
│     ├─ pages/           # Home / Calendar / Growth / Health / Me / Admin / Login
│     └─ components/      # RecordSheet / RecordDetail / Timeline / Lightbox / MediaPicker / StatsView ...
└─ tests/                 # 接口与端到端测试脚本（bash / python）
```

## 快速开始（Docker）

```bash
git clone <your-repo-url> kidslog
cd kidslog
cp .env.example .env
# 填入必填的 JWT 密钥
openssl rand -hex 32          # 把输出粘到 .env 的 JWT_SECRET
docker compose up -d          # 默认拉取预构建镜像 yysdaddy/kidslog:0.6.7
```

### 零配置启动（不需要 .env）

```bash
docker compose -f docker-compose.noenv.yml up -d
```

`docker-compose.noenv.yml` 里所有参数都写了默认值，**不依赖 `.env`，也不需要手动设置 `JWT_SECRET`**：
首次启动时服务会自动生成随机密钥并写入 `./data/.jwt_secret`（权限 600），之后重启沿用同一密钥。
注意该文件是登录态的唯一凭证，删除会让所有人退出登录；迁移实例时记得连 `data` 目录一起搬。

想改端口、关掉自助注册等，取消该文件里的注释行即可，或在旁边放一个 `.env` 覆盖（同名变量优先）。

`docker-compose.yml` 默认**不含 `build:` 段**，直接使用 Docker Hub 上的预构建镜像，
启动时不再编译，秒级起服。想换版本或换源，在 `.env` 里设置即可：

```bash
KIDSLOG_IMAGE=yysdaddy/kidslog:latest   # 或指定版本，如 :0.6.7
# 也可用 GHCR：ghcr.io/yysdaddy/kidslog:0.6.7（私有仓库需先 docker login ghcr.io）
```

需要从源码构建（改了代码、想打自己的镜像）时，叠加 build override：

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

> 镜像由 tag 推送自动触发构建：打 `v*` 标签即会产出对应版本号与 `latest` 两个标签。

打开 `http://<服务器地址>:8080`。首次访问会引导创建管理员账号（第一个注册者自动成为管理员），
随后可在「我的 → 家庭」里拿到邀请码，让其他家人加入。

> 关于 `JWT_SECRET`：**未设置**时服务会自动生成 32 字节随机密钥并写入 `DATA_DIR/.jwt_secret`（权限 600），
> 重启后沿用，无需手填；**设置了但短于 32 位**时才会拒绝启动（避免弱密钥可被离线暴力破解）。
> 删除 `data/.jwt_secret` 会让所有人的登录态失效，备份时请一并保留。

本地构建时默认从 npmmirror 安装 npm 依赖（国内友好）。海外或 CI 环境可切换官方源：

```bash
NPM_REGISTRY=https://registry.npmjs.org \
  docker compose -f docker-compose.yml -f docker-compose.build.yml build
```

## 本地开发

需要 Node.js 22+（依赖内置 `node:sqlite`，启动时带 `--experimental-sqlite`，Node 22 会打印实验性警告，属正常）。

```bash
# 后端
cd server
npm install
DATA_DIR=./data JWT_SECRET=$(openssl rand -hex 32) npm run dev   # http://127.0.0.1:8080

# 前端（另开终端，Vite 开发服务器，API 代理到 8080）
cd web
npm install
npm run dev
```

生产构建：`cd web && npm run build`，产物输出到 `web/dist`，运行时由后端作为静态目录托管。

## 安全默认值

- **登录限流已内置**：`/api/auth/login` 每 IP 每分钟 10 次、`/api/auth/register` 5 次、`/api/auth/join` 10 次，
  超限返回 `429` 并带 `Retry-After`。阈值可用 `RATE_LIMIT_*` 调整，单进程内存计数（单实例部署适用）。
- **密码哈希为异步 scrypt**（N=16384/r=8/p=1），不会阻塞事件循环。
- **邀请码 10 位 base32（约 50 bit 熵）**，家庭页可随时重置；旧版 8 位邀请码仍可加入。
- 部署在反代之后时请保持 `TRUST_PROXY` 开启（默认），让限流按真实客户端 IP 计数；
  容器端口直接暴露公网时改为 `false`。

## 环境变量

| 变量 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| `JWT_SECRET` | 否 | 自动生成 | 登录令牌签名密钥，≥ 32 位随机串；未设置时自动生成到 `DATA_DIR/.jwt_secret`（0600），设置但过短会拒绝启动 |
| `DATA_DIR` | 否 | `/data` | 数据库、媒体、备份的存放目录 |
| `PORT` | 否 | `8080` | 服务端口 |
| `ALLOW_REGISTRATION` | 否 | `true` | 设为 `false` 关闭自助注册（首个管理员不受限，其余走邀请码） |
| `MEDIA_QUOTA_GB` | 否 | `20` | 媒体存储配额 |
| `LOG_LEVEL` | 否 | `info` | Fastify 日志级别 |
| `TRUST_PROXY` | 否 | 开启 | 信任 `X-Forwarded-For` 取真实客户端 IP（登录限流用）；服务直接暴露公网、前面没有反代时设为 `false` |
| `RATE_LIMIT_LOGIN` | 否 | `10` | 登录接口每 IP 每分钟上限，`0` 关闭 |
| `RATE_LIMIT_REGISTER` | 否 | `5` | 注册接口每 IP 每分钟上限，`0` 关闭 |
| `RATE_LIMIT_JOIN` | 否 | `10` | 邀请码加入接口每 IP 每分钟上限，`0` 关闭 |
| `TZ` | 否 | `Asia/Shanghai` | 容器时区，影响日期归属 |

## 数据与备份

所有状态都在 `DATA_DIR`（默认容器内 `/data`，compose 已映射到 `./data`）：

```
data/
├─ app.db            # SQLite 主库
├─ media/<childId>/  # 转码后的图片与视频、缩略图
└─ backups/          # 自动备份
```

备份只需打包整个 `data/` 目录：

```bash
tar czf kidslog-$(date +%F).tar.gz -C . data
```

## 限制与约定

- 单文件：图片 ≤ 30MB，视频 ≤ 200MB 且时长 ≤ 5 分钟，超限直接拒绝
- 原始文件不保留，图片统一转 JPEG（长边 2048）、视频转 720p MP4，以控制体积
- 媒体附件仅在所属记录详情内展示；记录删除后附件一并清理；未保存就关闭表单的上传会被自动清理
- 面向家庭自托管，未做多租户隔离与水平扩展；单实例、SQLite 单写入者

## 安全

部署到公网前请阅读 [SECURITY.md](SECURITY.md) 的检查清单（HTTPS、关闭自助注册、备份等）。
安全问题请通过 GitHub 私有安全公告上报，不要开公开 Issue。

## License

[MIT](LICENSE)
