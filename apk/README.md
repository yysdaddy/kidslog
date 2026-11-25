# 安卓安装包

> 本目录的 `*.apk` 已被 `.gitignore` 排除，不随仓库分发。正式包请从 GitHub Releases 下载（tag `android-v*`）。

| 文件 | 版本 | versionCode | 说明 |
| --- | --- | --- | --- |
| `kidslog-1.3.0.apk` | 1.3.0 | 8 | 当前正式版，版本名去掉 `-test` 后缀；应用 ID 统一为 `top.yysdaddy.kidslog`，release 签名证书重签（O=yysdaddy） |

正式版自 1.3.0 起：

- 安装包文件名、应用名（成长记录）、版本名均不再带「测试」字样。
- 应用 ID 去掉 `.test` 后缀，统一为 `top.yysdaddy.kidslog`，Java 包路径同步为 `top/yysdaddy/kidslog`。
- 签名证书 DN 为 `CN=yysdaddy, OU=KidsLog, O=yysdaddy`，
  SHA-256：`76:17:F9:DA:E7:41:AC:D9:66:8A:00:28:E1:72:1D:67:D7:62:FC:67:39:33:5C:5E:D2:93:AF:34:CB:1D:EA:FD`。
- 与早期测试包签名、包名均不同，覆盖安装会失败，需先卸载旧版；服务端数据不受影响。

校验：

```bash
sha256sum -c SHA256SUMS.txt
```
