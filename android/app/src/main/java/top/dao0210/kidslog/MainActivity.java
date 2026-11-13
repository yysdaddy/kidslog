package top.dao0210.kidslog;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.view.KeyEvent;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * 轻量 WebView 壳：加载用户配置的 KidsLog 服务器地址。
 * 交互入口：
 *   - 首次启动 / 未配置地址：进入服务器设置页
 *   - 长按返回键：随时重新进入服务器设置页
 *   - 加载失败页：提供「重试」「修改服务器地址」
 */
public class MainActivity extends Activity {

    private static final int REQ_SETTINGS = 1001;
    private static final int REQ_FILE = 1002;

    private WebView web;
    private String loadedUrl;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        configureWebView(web);
        setContentView(web);

        if (ServerConfig.get(this) == null) {
            openSettings();
        } else {
            loadConfigured();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            String configured = ServerConfig.get(this);
            if (configured != null && !configured.equals(loadedUrl)) {
                loadConfigured();
            }
        }
    }

    private void configureWebView(WebView w) {
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        // 允许 https 页面内嵌 http 资源（部分局域网混合部署场景）
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(w, true);

        w.setWebViewClient(new ShellWebViewClient());
        w.setWebChromeClient(new ShellChromeClient());
        w.setDownloadListener(new ShellDownloadListener());
        w.setBackgroundColor(0xFFFFFFFF);
    }

    private void loadConfigured() {
        String url = ServerConfig.get(this);
        if (url == null) {
            openSettings();
            return;
        }
        loadedUrl = url;
        if (web != null) {
            web.loadUrl(url);
        }
    }

    private void openSettings() {
        startActivityForResult(new Intent(this, ServerSettingsActivity.class), REQ_SETTINGS);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_SETTINGS) {
            if (resultCode == RESULT_OK) {
                loadConfigured();
            } else if (ServerConfig.get(this) == null) {
                // 测试版不预填地址：用户未填写且取消，直接退出，不写入任何默认地址
                Toast.makeText(this, "尚未设置服务器地址", Toast.LENGTH_SHORT).show();
                finish();
            }
        } else if (requestCode == REQ_FILE) {
            if (fileCallback == null) {
                return;
            }
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    results = new Uri[]{data.getData()};
                }
            }
            fileCallback.onReceiveValue(results);
            fileCallback = null;
        }
    }

    /** 加载失败时展示内置错误页。 */
    private void showErrorPage(String failedUrl, String message) {
        if (web == null) {
            return;
        }
        String page = "file:///android_asset/error.html"
                + "?u=" + Uri.encode(failedUrl == null ? "" : failedUrl)
                + "&m=" + Uri.encode(message == null ? "" : message)
                + "&s=" + Uri.encode(ServerConfig.currentOrDefault(this));
        web.loadUrl(page);
    }

    private boolean handleInternalScheme(Uri uri) {
        String host = uri.getHost();
        if (host == null) {
            host = uri.getAuthority();
        }
        if (host == null) {
            return false;
        }
        if ("retry".equals(host)) {
            loadConfigured();
            return true;
        }
        if ("settings".equals(host)) {
            openSettings();
            return true;
        }
        return false;
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
                event.startTracking();
            }
            if (event.getRepeatCount() == 0 && web != null && web.canGoBack()) {
                web.goBack();
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public boolean onKeyLongPress(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            openSettings();
            return true;
        }
        return super.onKeyLongPress(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    private class ShellWebViewClient extends WebViewClient {

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();

            if ("kidslog".equals(scheme)) {
                return handleInternalScheme(uri);
            }
            if ("http".equals(scheme) || "https".equals(scheme)) {
                return false; // 内部加载
            }
            // tel / mailto / market / 第三方 App 交给系统
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException e) {
                Toast.makeText(MainActivity.this, "未找到可处理该链接的应用", Toast.LENGTH_SHORT).show();
            }
            return true;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) {
                CharSequence desc = error == null ? "" : error.getDescription();
                showErrorPage(request.getUrl() == null ? "" : request.getUrl().toString(),
                        desc == null ? "" : desc.toString());
            }
        }
    }

    private class ShellChromeClient extends WebChromeClient {

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                         FileChooserParams params) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(null);
            }
            fileCallback = callback;
            Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            if (params != null && params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            }
            try {
                startActivityForResult(Intent.createChooser(intent, "选择文件"), REQ_FILE);
                return true;
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                Toast.makeText(MainActivity.this, "没有可用的文件选择器", Toast.LENGTH_SHORT).show();
                return false;
            }
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            try {
                request.grant(request.getResources());
            } catch (Exception ignored) {
                try {
                    request.deny();
                } catch (Exception ignored2) {
                }
            }
        }

        @Override
        public void onGeolocationPermissionsShowPrompt(String origin,
                                                       android.webkit.GeolocationPermissions.Callback callback) {
            callback.invoke(origin, false, false);
        }
    }

    private class ShellDownloadListener implements DownloadListener {

        @Override
        public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                    String mimeType, long contentLength) {
            try {
                String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                req.setMimeType(mimeType);
                req.addRequestHeader("User-Agent", userAgent);
                String cookie = CookieManager.getInstance().getCookie(url);
                if (cookie != null) {
                    req.addRequestHeader("Cookie", cookie);
                }
                req.setTitle(fileName);
                req.setDescription("正在下载");
                req.setNotificationVisibility(
                        DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(req);
                    Toast.makeText(MainActivity.this, "开始下载：" + fileName, Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                Toast.makeText(MainActivity.this, "下载失败：" + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        }
    }
}
