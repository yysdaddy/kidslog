package top.dao0210.kidslog.test;

import android.content.Context;
import android.content.SharedPreferences;

/** 服务器地址持久化 */
public final class ServerStore {
    private static final String PREF = "kidslog_server";
    private static final String KEY = "server_url";

    private ServerStore() {}

    public static String getServer(Context ctx) {
        SharedPreferences sp = ctx.getApplicationContext()
                .getSharedPreferences(PREF, Context.MODE_PRIVATE);
        return sp.getString(KEY, "");
    }

    public static void setServer(Context ctx, String url) {
        SharedPreferences sp = ctx.getApplicationContext()
                .getSharedPreferences(PREF, Context.MODE_PRIVATE);
        sp.edit().putString(KEY, normalize(url)).apply();
    }

    public static void clear(Context ctx) {
        SharedPreferences sp = ctx.getApplicationContext()
                .getSharedPreferences(PREF, Context.MODE_PRIVATE);
        sp.edit().remove(KEY).apply();
    }

    /** 补全协议、去掉尾部斜杠 */
    public static String normalize(String input) {
        String s = input == null ? "" : input.trim();
        if (s.isEmpty()) return "";
        if (!s.matches("(?i)^https?://.*")) s = "http://" + s;
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        return s;
    }
}
