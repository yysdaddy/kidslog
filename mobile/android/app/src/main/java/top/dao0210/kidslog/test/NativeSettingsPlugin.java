package top.dao0210.kidslog.test;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;

import androidx.core.content.pm.PackageInfoCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** 暴露给前端 JS 的原生能力：读取服务器地址、打开原生设置页、读取版本号 */
@CapacitorPlugin(name = "NativeSettings")
public class NativeSettingsPlugin extends Plugin {

    @PluginMethod
    public void getServer(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("url", ServerStore.getServer(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("activity unavailable");
            return;
        }
        Intent intent = new Intent(activity, ServerSetupActivity.class);
        activity.startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void getAppInfo(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            PackageInfo pi = getContext().getPackageManager()
                    .getPackageInfo(getContext().getPackageName(), 0);
            ret.put("versionName", pi.versionName);
            ret.put("versionCode", PackageInfoCompat.getLongVersionCode(pi));
        } catch (Exception e) {
            ret.put("versionName", "");
            ret.put("versionCode", 0);
        }
        ret.put("packageName", getContext().getPackageName());
        call.resolve(ret);
    }
}
