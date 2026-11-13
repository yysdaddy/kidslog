package top.dao0210.kidslog.test;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** 原生服务器配置页（首启必填，也可从「我的 → 服务器设置」进入） */
public class ServerSetupActivity extends Activity {

    private EditText input;
    private TextView status;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService pool = Executors.newSingleThreadExecutor();

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.parseColor("#F7FAFC"));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(24), dp(40), dp(24), dp(32));
        scroll.addView(root, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView title = new TextView(this);
        title.setText("服务器地址");
        title.setTextSize(22);
        title.setTextColor(Color.parseColor("#0F172A"));
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        root.addView(title);

        TextView desc = new TextView(this);
        desc.setText("填写你已部署的「成长记录」服务地址，例如 http://192.168.1.10:8080 或 https://kids.example.com");
        desc.setTextSize(13);
        desc.setTextColor(Color.parseColor("#64748B"));
        desc.setPadding(0, dp(10), 0, dp(20));
        desc.setLineSpacing(dp(4), 1f);
        root.addView(desc);

        input = new EditText(this);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setHint("http://192.168.1.10:8080");
        input.setTextSize(15);
        input.setPadding(dp(14), dp(12), dp(14), dp(12));
        GradientDrawable box = new GradientDrawable();
        box.setColor(Color.WHITE);
        box.setCornerRadius(dp(12));
        box.setStroke(dp(1), Color.parseColor("#E2E8F0"));
        input.setBackground(box);
        input.setText(ServerStore.getServer(this));
        root.addView(input, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        status = new TextView(this);
        status.setTextSize(12);
        status.setTextColor(Color.parseColor("#64748B"));
        status.setPadding(dp(4), dp(10), dp(4), dp(10));
        root.addView(status);

        Button test = makeButton("测试连接", Color.WHITE, Color.parseColor("#0EA5A4"), "#E2E8F0");
        test.setTextColor(Color.parseColor("#0F766E"));
        root.addView(test, btnParams());

        Button save = makeButton("保存并使用", Color.WHITE, Color.parseColor("#10B981"), null);
        root.addView(save, btnParams());

        Button clear = makeButton("清除已保存地址", Color.parseColor("#E11D48"), Color.WHITE, "#FECDD3");
        clear.setVisibility(ServerStore.getServer(this).isEmpty() ? View.GONE : View.VISIBLE);
        LinearLayout.LayoutParams clearParams = btnParams();
        clearParams.topMargin = dp(28);
        root.addView(clear, clearParams);

        test.setOnClickListener(v -> testConnection());
        save.setOnClickListener(v -> {
            String url = ServerStore.normalize(input.getText().toString());
            if (url.isEmpty()) {
                setStatus("请先填写服务器地址", true);
                return;
            }
            ServerStore.setServer(this, url);
            setResult(RESULT_OK, new Intent());
            finish();
        });
        clear.setOnClickListener(v -> {
            ServerStore.clear(this);
            input.setText("");
            setResult(RESULT_OK, new Intent());
            finish();
        });

        setContentView(scroll);
    }

    private LinearLayout.LayoutParams btnParams() {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.topMargin = dp(12);
        return p;
    }

    private Button makeButton(String text, int textColor, int bgColor, String strokeColor) {
        Button b = new Button(this);
        b.setText(text);
        b.setAllCaps(false);
        b.setTextSize(15);
        b.setTextColor(textColor);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(bgColor);
        bg.setCornerRadius(dp(12));
        if (strokeColor != null) bg.setStroke(dp(1), Color.parseColor(strokeColor));
        b.setBackground(bg);
        b.setPadding(0, dp(12), 0, dp(12));
        b.setGravity(Gravity.CENTER);
        return b;
    }

    private void setStatus(String text, boolean error) {
        status.setText(text);
        status.setTextColor(Color.parseColor(error ? "#E11D48" : "#0F766E"));
    }

    private void testConnection() {
        final String url = ServerStore.normalize(input.getText().toString());
        if (url.isEmpty()) {
            setStatus("请先填写服务器地址", true);
            return;
        }
        setStatus("正在连接…", false);
        pool.execute(() -> {
            String result;
            boolean ok = false;
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(url + "/api/health").openConnection();
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);
                conn.setRequestMethod("GET");
                int code = conn.getResponseCode();
                InputStream in = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
                StringBuilder sb = new StringBuilder();
                if (in != null) {
                    BufferedReader br = new BufferedReader(new InputStreamReader(in, "UTF-8"));
                    String line;
                    while ((line = br.readLine()) != null) sb.append(line);
                    br.close();
                }
                String body = sb.toString();
                ok = code == 200 && body.toLowerCase().contains("ok");
                result = ok ? "连接成功，可以保存" : "已连通但不像成长记录服务（HTTP " + code + "）";
            } catch (Exception e) {
                result = "连接失败：" + (e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
            } finally {
                if (conn != null) conn.disconnect();
            }
            final String r = result;
            final boolean success = ok;
            main.post(() -> setStatus(r, !success));
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        pool.shutdownNow();
    }
}
