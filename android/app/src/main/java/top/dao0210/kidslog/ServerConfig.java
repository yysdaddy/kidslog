package top.dao0210.kidslog;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;

import java.util.Locale;

/**
 * 服务器地址存取与规范化。
 */
public final class ServerConfig {

    /**
     * 测试版不预填任何地址，空串即视为未配置，全部由用户手动填写。
     */
    public static final String DEFAULT_URL = "";

    private static final String PREFS = "kidslog_prefs";
    private static final String KEY_SERVER = "server_url";

    private ServerConfig() {
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** 未配置时返回 null。 */
    public static String get(Context ctx) {
        String v = prefs(ctx).getString(KEY_SERVER, null);
        if (v == null || v.trim().isEmpty()) {
            return null;
        }
        return v.trim();
    }

    public static void set(Context ctx, String url) {
        prefs(ctx).edit().putString(KEY_SERVER, normalize(url)).apply();
    }

    public static void reset(Context ctx) {
        prefs(ctx).edit().remove(KEY_SERVER).apply();
    }

    public static String currentOrDefault(Context ctx) {
        String v = get(ctx);
        return v == null ? DEFAULT_URL : v;
    }

    /**
     * 规范化用户输入：
     * - 去空白；空输入返回空串（表示未填写，绝不回落到任何默认地址）
     * - 无 scheme 时补 http://（局域网 IP:端口 最常见）
     * - 统一补一个末尾 "/"
     */
    public static String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        String s = raw.trim();
        if (s.isEmpty()) {
            return "";
        }
        String lower = s.toLowerCase(Locale.ROOT);
        if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
            s = "http://" + s;
        }
        if (!s.endsWith("/")) {
            s = s + "/";
        }
        return s;
    }

    /** 合法判定：需有 host，且 scheme 仅 http/https。 */
    public static boolean isValid(String normalized) {
        try {
            Uri u = Uri.parse(normalized);
            String scheme = u.getScheme();
            if (scheme == null) {
                return false;
            }
            scheme = scheme.toLowerCase(Locale.ROOT);
            if (!"http".equals(scheme) && !"https".equals(scheme)) {
                return false;
            }
            return u.getHost() != null && !u.getHost().isEmpty();
        } catch (Exception e) {
            return false;
        }
    }
}
