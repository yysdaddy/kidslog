#!/usr/bin/env python3
"""M3 健康档案 + 成长 + 统计 接口回归

用法：BASE=http://127.0.0.1:8080 TEST_USER=your_user TEST_PW=your_pw python3 m3_health.py
需先有一个含孩子档案的账号。
"""
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import date, timedelta

BASE = os.environ.get("BASE", "http://127.0.0.1:8080")
TEST_USER = os.environ.get("TEST_USER", "")
TEST_PW = os.environ.get("TEST_PW", "")
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
            sc = resp.status
            for k, v in resp.headers.items():
                if k.lower() == "set-cookie":
                    COOKIE["c"] = v.split(";")[0]
            raw = resp.read().decode()
            return sc, (json.loads(raw) if raw else {})
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


today = date.today().isoformat()
y1 = (date.today() - timedelta(days=400)).isoformat()

if not TEST_USER or not TEST_PW:
    sys.exit("请通过环境变量 TEST_USER / TEST_PW 提供测试账号")

sc, r = req("POST", "/api/auth/login", {"username": TEST_USER, "password": TEST_PW})
check("登录", sc == 200, str(sc))

sc, r = req("GET", "/api/children")
kids = r.get("children", [])
check("孩子列表", sc == 200 and len(kids) > 0)
cid = kids[0]["id"]

# 预清理：删除当日遗留的成长/就医测试记录，保证可重复执行
sc, r = req("GET", f"/api/records?childId={cid}&date={today}&limit=200")
for rec in r.get("records", []):
    if rec.get("type") in ("growth", "visit"):
        req("DELETE", f"/api/records/{rec['id']}")

# 疫苗计划幂等
sc, r = req("POST", "/api/vaccines/plan", {"childId": cid})
check("生成疫苗计划", sc in (200, 201), f"{sc} {r}")
first_add = r.get("added")
sc, r = req("POST", "/api/vaccines/plan", {"childId": cid})
check("计划幂等（二次 added=0）", r.get("added") == 0, f"first={first_add} second={r.get('added')}")

sc, r = req("GET", f"/api/vaccines?childId={cid}")
vs = r.get("vaccines", [])
check("疫苗列表非空", sc == 200 and len(vs) > 0, f"n={len(vs)}")
check("状态字段合法", all(v.get("status") in ("done", "overdue", "dueSoon", "pending") for v in vs))
sc, r = req("GET", f"/api/vaccines?childId={cid}&status=pending")
check("待接种筛选", sc == 200 and all(v["status"] != "done" for v in r.get("vaccines", [])))

ov0_sc, ov0 = req("GET", f"/api/health/overview?childId={cid}")
check("健康概览", ov0_sc == 200 and "overdueCount" in ov0, str(ov0_sc))

# 登记接种
target = next((v for v in vs if v["status"] != "done"), None)
if target:
    sc, r = req("PATCH", f"/api/vaccines/{target['id']}",
                {"doneDate": today, "place": "社区卫生服务中心", "batchNo": "T2026", "reaction": "无"})
    check("登记接种", sc == 200 and r.get("vaccine", {}).get("status") == "done", f"{sc} {r}")

ov1_sc, ov1 = req("GET", f"/api/health/overview?childId={cid}")
check("已接种数 +1", ov1_sc == 200 and ov1.get("doneCount", 0) >= ov0.get("doneCount", 0) + 1,
      f"{ov0.get('doneCount')}->{ov1.get('doneCount')}")

# 自定义疫苗 + 删除
sc, r = req("POST", "/api/vaccines", {"childId": cid, "name": "流感疫苗", "doseNo": 1, "dueDate": today})
check("新增自定义疫苗", sc in (200, 201), f"{sc} {r}")
vid = r.get("vaccine", {}).get("id")
if vid:
    sc, _ = req("DELETE", f"/api/vaccines/{vid}")
    check("删除自定义疫苗", sc == 200, str(sc))

# 成长记录同日唯一
sc, r = req("POST", "/api/records", {
    "childId": cid, "type": "growth", "occurredAt": f"{today}T10:00:00.000Z",
    "payload": {"heightCm": 96.5, "weightKg": 14.8, "headCm": 48.2},
})
check("新建成长记录", sc in (200, 201), f"{sc} {r}")
gid = r.get("record", {}).get("id")
sc2, r2 = req("POST", "/api/records", {
    "childId": cid, "type": "growth", "occurredAt": f"{today}T11:00:00.000Z",
    "payload": {"heightCm": 97},
})
check("同日成长冲突 409", sc2 == 409, f"{sc2} {r2}")
if gid:
    sc, r = req("PATCH", f"/api/records/{gid}", {"payload": {"heightCm": 97, "weightKg": 15}})
    check("同日编辑自身放行", sc == 200, f"{sc} {r}")

# 就医记录
sc, r = req("POST", "/api/records", {
    "childId": cid, "type": "visit", "occurredAt": f"{today}T15:00:00.000Z",
    "payload": {"hospital": "市妇幼保健院", "department": "儿科", "diagnosis": "急性上呼吸道感染",
                "prescription": "布洛芬混悬液 5ml", "feeYuan": 128,
                "followupAt": (date.today() + timedelta(days=3)).isoformat()},
})
check("新建就医记录", sc in (200, 201), f"{sc} {r}")
visit_id = r.get("record", {}).get("id")

ov2_sc, ov2 = req("GET", f"/api/health/overview?childId={cid}")
check("概览含最近就医", ov2_sc == 200 and ov2.get("lastVisit") is not None)
check("概览含复诊提醒", ov2.get("nextFollowup") is not None, str(ov2.get("nextFollowup")))

# 统计
sc, r = req("GET", f"/api/stats/range?childId={cid}&from={today}&to={today}")
keys = ["total", "activeDays", "byType", "sleepMinutes", "maxTemp", "visitCount", "growthCount", "prev"]
check("区间统计字段齐全", sc == 200 and all(k in r for k in keys), f"{sc} keys={list(r.keys())}")
if sc == 200:
    check("统计含成长/就医", r.get("growthCount", 0) >= 1 and r.get("visitCount", 0) >= 1,
          f"growth={r.get('growthCount')} visit={r.get('visitCount')}")

sc, r = req("GET", f"/api/stats/range?childId={cid}&from={y1}&to={y1}")
check("空区间统计不报错", sc == 200 and r.get("total") == 0, f"{sc} {r}")

if visit_id:
    req("DELETE", f"/api/records/{visit_id}")
if gid:
    req("DELETE", f"/api/records/{gid}")

print("\n== 失败项:", len(fail))
for f in fail:
    print(" -", f)
sys.exit(1 if fail else 0)
