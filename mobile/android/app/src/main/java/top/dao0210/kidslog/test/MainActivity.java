package top.dao0210.kidslog.test;

import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private String appliedServer;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeSettingsPlugin.class);
        super.onCreate(savedInstanceState);
        appliedServer = ServerStore.getServer(this);
        setupDownloader();
    }

    @Override
    public void onResume() {
        super.onResume();
        // 从原生设置页返回：地址变化则重新加载本地页面，让前端重新读取服务器地址
        String current = ServerStore.getServer(this);
        if (appliedServer != null && !appliedServer.equals(current)) {
            appliedServer = current;
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().reload();
            }
        }
    }

    /** WebView 内点击附件下载时交给系统下载器（带 Cookie，保证鉴权通过） */
    private void setupDownloader() {
        WebView webView = getBridge().getWebView();
        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                        String mimeType, long contentLength) {
                try {
                    String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                    DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                    String cookie = CookieManager.getInstance().getCookie(url);
                    if (cookie != null) req.addRequestHeader("Cookie", cookie);
                    if (userAgent != null) req.addRequestHeader("User-Agent", userAgent);
                    if (mimeType != null) req.setMimeType(mimeType);
                    req.setTitle(fileName);
                    req.setDescription("成长记录");
                    req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
                    DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    dm.enqueue(req);
                    Toast.makeText(MainActivity.this, "开始下载：" + fileName, Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "下载失败：" + e.getMessage(), Toast.LENGTH_SHORT).show();
                }
            }
        });
    }
}
