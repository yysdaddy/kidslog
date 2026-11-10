#!/usr/bin/env bash
set -u
B=http://127.0.0.1:8080
J=/tmp/ck.txt
rm -f $J
TS=$(date +%s)
U=m2_$TS
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; }

# 1 注册
R=$(curl -s -c $J -X POST $B/api/auth/register -H 'Content-Type: application/json' \
  -d "{\"username\":\"$U\",\"password\":\"kidslog123\",\"displayName\":\"测试爸爸\",\"familyName\":\"测试家庭\"}")
echo "register: $R" | head -c 300; echo
R2=$(curl -s -b $J $B/api/me)
CODE=$(echo "$R2" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"].get("inviteCode") or "")')
echo "me: $R2" | head -c 300; echo
[ -n "$CODE" ] && pass "注册+邀请码 $CODE" || fail "注册"

# 2 建孩子
C=$(curl -s -b $J -X POST $B/api/children -H 'Content-Type: application/json' \
  -d '{"name":"测试宝宝","nickname":"小宝","birthDate":"2024-05-01"}')
CID=$(echo "$C" | python3 -c 'import sys,json;print(json.load(sys.stdin)["child"]["id"])')
[ -n "$CID" ] && pass "创建孩子 $CID" || fail "创建孩子"

# 3 造测试图
docker exec kidslog mkdir -p /data/_tmp
docker exec kidslog ffmpeg -v error -y -f lavfi -i testsrc=size=2400x1800:duration=1:rate=1 -frames:v 1 /data/_tmp/t.jpg
docker cp kidslog:/data/_tmp/t.jpg /tmp/t.jpg
docker exec kidslog rm -f /data/_tmp/t.jpg
ls -l /tmp/t.jpg | awk '{print "test image bytes:", $5}'

# 4 上传图片
M=$(curl -s -b $J -X POST "$B/api/media?childId=$CID" -F "file=@/tmp/t.jpg")
echo "upload: $M" | head -c 400; echo
AID=$(echo "$M" | python3 -c 'import sys,json;print(json.load(sys.stdin)["attachment"]["id"])' 2>/dev/null || echo '')
THUMB=$(echo "$M" | python3 -c 'import sys,json;print(json.load(sys.stdin)["attachment"]["thumbUrl"])' 2>/dev/null || echo '')
[ -n "$AID" ] && pass "上传图片 $AID" || fail "上传图片"
echo "$M" | python3 -c 'import sys,json;a=json.load(sys.stdin)["attachment"];print("  size",a["sizeBytes"],"wh",a["width"],a["height"])' 2>/dev/null

# 5 缩略图可访问
TCODE=$(curl -s -o /tmp/th.jpg -w '%{http_code} %{content_type}' -b $J "$B$THUMB")
echo "thumb: $TCODE"; case "$TCODE" in 200*) pass "缩略图";; *) fail "缩略图";; esac

# 6 创建带附件记录
NOW=$(date -Iseconds)
REC=$(curl -s -b $J -X POST $B/api/records -H 'Content-Type: application/json' \
  -d "{\"childId\":\"$CID\",\"type\":\"feeding\",\"occurredAt\":\"$NOW\",\"payload\":{\"method\":\"formula\",\"amountMl\":180},\"note\":\"M2测试\",\"attachmentIds\":[\"$AID\"]}")
RID=$(echo "$REC" | python3 -c 'import sys,json;print(json.load(sys.stdin)["record"]["id"])')
echo "$REC" | python3 -c 'import sys,json;r=json.load(sys.stdin)["record"];print("record atts:",len(r["attachments"]))'
[ -n "$RID" ] && pass "创建记录 $RID" || fail "创建记录"

# 7 列表带附件
L=$(curl -s -b $J "$B/api/records?childId=$CID&date=$(date +%F)")
echo "$L" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("list count",len(d["records"]),"atts",len(d["records"][0]["attachments"]) if d["records"] else 0)'

# 8 相册
G=$(curl -s -b $J "$B/api/media?childId=$CID")
echo "$G" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("gallery",len(d["attachments"]),"recordId set:",bool(d["attachments"]) and d["attachments"][0]["recordId"] is not None)'

# 9 日历
CAL=$(curl -s -b $J "$B/api/calendar?childId=$CID&month=$(date +%Y-%m)")
echo "calendar: $CAL" | head -c 300; echo

# 10 存储
S=$(curl -s -b $J "$B/api/storage"); echo "storage: $S"

# 11 编辑记录（改备注，保留附件）
P=$(curl -s -b $J -X PATCH $B/api/records/$RID -H 'Content-Type: application/json' \
  -d "{\"note\":\"已编辑\",\"attachmentIds\":[\"$AID\"]}")
echo "$P" | python3 -c 'import sys,json;r=json.load(sys.stdin)["record"];print("patched note:",r["note"],"atts",len(r["attachments"]))'

# 12 删除记录 → 附件应 404
D=$(curl -s -b $J -X DELETE $B/api/records/$RID); echo "delete: $D"
S2=$(curl -s -o /dev/null -w '%{http_code}' -b $J "$B$THUMB"); echo "thumb after delete: $S2"
[ "$S2" = "404" ] && pass "删除记录连带清理附件" || fail "删除记录后附件仍存在"

# 13 未登录拦截
U0=$(curl -s -o /dev/null -w '%{http_code}' "$B/api/records?childId=$CID"); echo "unauth records: $U0"
