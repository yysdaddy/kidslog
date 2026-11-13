package top.dao0210.kidslog;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.text.InputType;
import android.util.TypedValue;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 服务器地址配置页：输入 / 测试连接 / 保存 / 恢复默认。
 */
public class ServerSettingsActivity extends Activity {

    private EditText input;
    private TextView status;
    private ProgressBar progress;
    private Button testButton;

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v,
                getResources().getDisplayMetrics()));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(buildUi());
    }

    private View buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.WHITE);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(28), dp(20), dp(24));
        scroll.addView(root, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView title = new TextView(this);
        title.setText("服务器地址");
        title.setTextSize(22);
        title.setTextColor(0xFF111827);
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        root.addView(title);

        TextView hint = new TextView(this);
        hint.setText("填写 KidsLog 服务的访问地址。支持域名或局域网 IP，例如：\n"
                + "https://kids.dao0210.top:52006/\n"
                + "http://192.168.0.113:8085/");
        hint.setTextSize(13);
        hint.setTextColor(0xFF6B7280);
        hint.setLineSpacing(dp(3), 1f);
        LinearLayout.LayoutParams hintLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        hintLp.topMargin = dp(10);
        hintLp.bottomMargin = dp(16);
        root.addView(hint, hintLp);

        input = new EditText(this);
        input.setText(ServerConfig.currentOrDefault(this));
        input.setHint("http://192.168.0.113:8085/");
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setTextSize(15);
        root.addView(input, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams btnRowLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        btnRowLp.topMargin = dp(20);
        root.addView(buttons, btnRowLp);

        testButton = new Button(this);
        testButton.setText("测试连接");
        LinearLayout.LayoutParams lp1 = new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        lp1.rightMargin = dp(8);
        testButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                testConnection();
            }
        });
        buttons.addView(testButton, lp1);

        Button save = new Button(this);
        save.setText("保存并进入");
        save.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                save();
            }
        });
        buttons.addView(save, new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(true);
        progress.setVisibility(View.GONE);
        LinearLayout.LayoutParams progressLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(4));
        progressLp.topMargin = dp(14);
        root.addView(progress, progressLp);

        status = new TextView(this);
        status.setTextSize(13);
        status.setTextColor(0xFF374151);
        LinearLayout.LayoutParams statusLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        statusLp.topMargin = dp(12);
        root.addView(status, statusLp);

        TextView reset = new TextView(this);
        reset.setText("恢复默认地址");
        reset.setTextSize(13);
        reset.setTextColor(0xFF2563EB);
        reset.setPadding(0, dp(20), 0, dp(8));
        reset.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                input.setText(ServerConfig.DEFAULT_URL);
                input.setSelection(input.getText().length());
                status.setText("");
            }
        });
        root.addView(reset);

        TextView tip = new TextView(this);
        tip.setText("提示：进入应用后长按返回键，可随时修改服务器地址。");
        tip.setTextSize(12);
        tip.setTextColor(0xFF9CA3AF);
        LinearLayout.LayoutParams tipLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        tipLp.topMargin = dp(16);
        root.addView(tip, tipLp);

        return scroll;
    }

    private void save() {
        String norm = ServerConfig.normalize(input.getText().toString());
        if (!ServerConfig.isValid(norm)) {
            input.setError("地址格式不正确");
            return;
        }
        ServerConfig.set(this, norm);
        Toast.makeText(this, "已保存：" + norm, Toast.LENGTH_SHORT).show();
        setResult(RESULT_OK);
        finish();
    }

    private void testConnection() {
        final String norm = ServerConfig.normalize(input.getText().toString());
        if (!ServerConfig.isValid(norm)) {
            input.setError("地址格式不正确");
            return;
        }
        testButton.setEnabled(false);
        progress.setVisibility(View.VISIBLE);
        status.setTextColor(0xFF374151);
        status.setText("正在连接 " + norm + " …");

        new Thread(new Runnable() {
            @Override
            public void run() {
                final String[] result = new String[1];
                final boolean[] ok = new boolean[1];
                HttpURLConnection conn = null;
                try {
                    URL url = new URL(norm + "api/health");
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(6000);
                    conn.setReadTimeout(6000);
                    conn.setRequestMethod("GET");
                    conn.setInstanceFollowRedirects(true);
                    conn.setRequestProperty("Accept", "application/json");
                    int code = conn.getResponseCode();
                    if (code >= 200 && code < 400) {
                        ok[0] = true;
                        result[0] = "连接成功（HTTP " + code + "）";
                    } else if (code == 401 || code == 403) {
                        ok[0] = true;
                        result[0] = "服务器可达（HTTP " + code + "，需登录）";
                    } else {
                        ok[0] = false;
                        result[0] = "服务器返回 HTTP " + code + "，请确认地址与服务状态";
                    }
                } catch (Exception e) {
                    ok[0] = false;
                    String msg = e.getMessage();
                    result[0] = "连接失败：" + (msg == null ? e.getClass().getSimpleName() : msg);
                } finally {
                    if (conn != null) {
                        conn.disconnect();
                    }
                }
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        testButton.setEnabled(true);
                        progress.setVisibility(View.GONE);
                        status.setTextColor(ok[0] ? 0xFF059669 : 0xFFDC2626);
                        status.setText(result[0]);
                        if (ok[0]) {
                            input.setText(norm);
                        }
                    }
                });
            }
        }, "conn-test").start();
    }
}
