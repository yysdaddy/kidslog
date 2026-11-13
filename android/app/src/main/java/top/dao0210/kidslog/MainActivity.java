package top.dao0210.kidslog;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.TextView;
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

    private FrameLayout content;
    private TextView settingsEntry;
    private static final String UI_PREFS = "kidslog_ui";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        configureWebView(web);

        content = new FrameLayout(this);
        content.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setupSettingsEntry();
        setContentView(content);

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

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v,
                getResources().getDisplayMetrics()));
    }

    private int clamp(int v, int min, int max) {
        if (max < min) {
            return min;
        }
        return Math.max(min, Math.min(max, v));
    }

    /**
     * 常驻「设置」入口：右上角半透明小胶囊，可拖动、记忆位置，轻点即进入服务器设置。
     * 用于手势导航下不便长按返回键的场景；原长按返回键入口保留。
     */
    private void setupSettingsEntry() {
        final SharedPreferences ui = getSharedPreferences(UI_PREFS, MODE_PRIVATE);

        settingsEntry = new TextView(this);
        settingsEntry.setText("设置");
        settingsEntry.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        settingsEntry.setTextColor(0xFFFFFFFF);
        settingsEntry.setGravity(Gravity.CENTER);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xCC1F2937);
        bg.setCornerRadius(dp(14));
        settingsEntry.setBackground(bg);
        settingsEntry.setPadding(dp(10), dp(5), dp(10), dp(5));
        settingsEntry.setAlpha(0.75f);
        settingsEntry.setContentDescription("服务器设置");

        final FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.gravity = Gravity.TOP | Gravity.START;
        final int savedX = ui.getInt("btn_x", -1);
        final int savedY = ui.getInt("btn_y", -1);
        if (savedX >= 0 && savedY >= 0) {
            lp.leftMargin = savedX;
            lp.topMargin = savedY;
        } else {
            lp.topMargin = dp(10);
            settingsEntry.post(new Runnable() {
                @Override
                public void run() {
                    ViewGroup.LayoutParams raw = settingsEntry.getLayoutParams();
                    if (!(raw instanceof FrameLayout.LayoutParams)) {
                        return;
                    }
                    FrameLayout.LayoutParams p = (FrameLayout.LayoutParams) raw;
                    p.leftMargin = Math.max(0,
                            content.getWidth() - settingsEntry.getWidth() - dp(10));
                    settingsEntry.setLayoutParams(p);
                }
            });
        }

        settingsEntry.setOnTouchListener(new View.OnTouchListener() {
            private float downX;
            private float downY;
            private int startLeft;
            private int startTop;
            private boolean moved;

            @Override
            public boolean onTouch(View v, MotionEvent e) {
                switch (e.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        downX = e.getRawX();
                        downY = e.getRawY();
                        FrameLayout.LayoutParams p = (FrameLayout.LayoutParams) v.getLayoutParams();
                        startLeft = p.leftMargin;
                        startTop = p.topMargin;
                        moved = false;
                        v.setAlpha(1f);
                        return true;
                    case MotionEvent.ACTION_MOVE: {
                        int dx = (int) (e.getRawX() - downX);
                        int dy = (int) (e.getRawY() - downY);
                        if (!moved && (Math.abs(dx) > dp(6) || Math.abs(dy) > dp(6))) {
                            moved = true;
                        }
                        if (!moved) {
                            return true;
                        }
                        FrameLayout.LayoutParams p2 = (FrameLayout.LayoutParams) v.getLayoutParams();
                        p2.leftMargin = clamp(startLeft + dx, 0, content.getWidth() - v.getWidth());
                        p2.topMargin = clamp(startTop + dy, 0, content.getHeight() - v.getHeight());
                        v.setLayoutParams(p2);
                        return true;
                    }
                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        v.setAlpha(0.75f);
                        if (moved) {
                            FrameLayout.LayoutParams p3 = (FrameLayout.LayoutParams) v.getLayoutParams();
                            ui.edit()
                                    .putInt("btn_x", p3.leftMargin)
                                    .putInt("btn_y", p3.topMargin)
                                    .apply();
                        } else if (e.getActionMasked() == MotionEvent.ACTION_UP) {
                            openSettings();
                        }
                        return true;
                    default:
                        return false;
                }
            }
        });

        content.addView(settingsEntry, lp);
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
