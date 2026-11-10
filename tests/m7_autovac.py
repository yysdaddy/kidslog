#!/usr/bin/env python3
"""M7：疫苗到期自动登记 + 默认 tab 相关接口回归（本地实例）"""
import os, json
import time
import urllib.request
import urllib.error

BASE = os.environ.get("BASE", "http://127.0.0.1:8080")
COOKIE = {}
fail = []


def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    if data is not None:
        r.add_header("Content-Type", "application/json")
    if COOKIE.get("c"):
        r.add_header("Cookie", COOKIE["c"])
    try:
        with urllib.request.urlopen(r) as resp:
            for k, v in resp.headers.items():
                if k.lower() == "set-cookie":
                    COOKIE["c"] = v.split(";")[0]
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}


def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  {extra}" if extra else ""))
    if not cond:
        fail.append(name)


# 注册（本地空库首个用户即管理员）
sc, r = req("POST", "/api/auth/register",
            {"username": "t%s" % int(time.time()), "password": "test1234", "displayName": "测试"})
check("register", sc in (200, 201), str(r)[:120])

# 出生日期设为 2023-01-01（大部分剂次已到期）
sc, r = req("POST", "/api/children", {"name": "宝宝", "birthDate": "2023-01-01"})
child = (r.get("child") or {})
check("create child", sc in (200, 201) and child.get("id"), str(r)[:120])
cid = child.get("id")

# 首次拉取疫苗：3 岁以上应到期剂次应全部为 done，且 overdue = 0
sc, r = req("GET", f"/api/vaccines?childId={cid}")
vs = r.get("vaccines") or []
print("  total", len(vs), "done", sum(1 for v in vs if v["status"] == "done"),
      "overdue", sum(1 for v in vs if v["status"] == "overdue"))
check("all due are done", all(v["status"] == "done" for v in vs if v.get("dueDate") and v["dueDate"] <= "2026-11-05"))
check("no overdue", not any(v["status"] == "overdue" for v in vs))
auto = [v for v in vs if v.get("autoDone")]
check("auto done flagged", len(auto) > 0, f"autoDone={len(auto)}")
check("auto done date == due date", all(v["doneDate"] == v["dueDate"] for v in auto))

# overview 口径一致
sc, r = req("GET", f"/api/health/overview?childId={cid}")
check("overview overdueCount=0", r.get("overdueCount") == 0, str(r.get("overdueCount")))
check("overview pending only future", (r.get("nextVaccine") or {}).get("dueDate", "9999") > "2026-11-05", str((r.get("nextVaccine") or {}).get("dueDate")))

# 手动清空某条已自动登记的接种日期 -> 不应被再次自动补登
target = auto[0]
sc, r = req("PATCH", f"/api/vaccines/{target['id']}", {"doneDate": ""})
check("clear doneDate", sc == 200 and not r["vaccine"]["doneDate"], str(r)[:120])
sc, r = req("GET", f"/api/vaccines?childId={cid}")
again = [v for v in r["vaccines"] if v["id"] == target["id"]][0]
check("cleared stays cleared", not again["doneDate"], f"doneDate={again['doneDate']} status={again['status']}")

# 手动登记 -> autoDone 置 0
sc, r = req("PATCH", f"/api/vaccines/{target['id']}", {"doneDate": "2026-11-04"})
check("manual done autoDone=0", sc == 200 and r["vaccine"]["doneDate"] == "2026-11-04" and not r["vaccine"]["autoDone"], str(r.get("vaccine", {}).get("autoDone")))

print("\nFAILED:", fail if fail else "none")
