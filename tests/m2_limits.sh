#!/usr/bin/env bash
set -u
B=http://127.0.0.1:8080
J=/tmp/ckl.txt
rm -f $J
U=m2l_$(date +%s)
curl -s -c $J -X POST $B/api/auth/register -H 'Content-Type: application/json' \
  -d "{\"username\":\"$U\",\"password\":\"kidslog123\",\"displayName\":\"分页测试\"}" >/dev/null
CID=$(curl -s -b $J -X POST $B/api/children -H 'Content-Type: application/json' \
  -d '{"name":"分页宝宝","birthDate":"2024-03-01"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["child"]["id"])')

docker exec kidslog mkdir -p /data/_tmp
docker exec kidslog ffmpeg -v error -y -f lavfi -i testsrc=size=640x480:duration=1:rate=1 -frames:v 1 /data/_tmp/p.jpg
docker cp kidslog:/data/_tmp/p.jpg /tmp/p.jpg >/dev/null
docker exec kidslog rm -f /data/_tmp/p.jpg

echo '--- 上传 5 张并各自绑定记录 ---'
IDS=""
for i in 1 2 3 4 5; do
  A=$(curl -s -b $J -X POST "$B/api/media?childId=$CID" -F "file=@/tmp/p.jpg" | python3 -c 'import sys,json;print(json.load(sys.stdin)["attachment"]["id"])')
  IDS="$IDS $A"
  NOW=$(date -Iseconds)
  curl -s -b $J -X POST $B/api/records -H 'Content-Type: application/json' \
    -d "{\"childId\":\"$CID\",\"type\":\"note\",\"occurredAt\":\"$NOW\",\"payload\":{\"content\":\"第${i}张\"},\"attachmentIds\":[\"$A\"]}" >/dev/null
  sleep 0.2
done
echo "ids:$IDS"

page1=$(curl -s -b $J "$B/api/media?childId=$CID&limit=2")
echo "$page1" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("page1",len(d["attachments"]),[a["createdAt"] for a in d["attachments"]])'
CUR=$(echo "$page1" | python3 -c 'import sys,json;print(json.load(sys.stdin)["attachments"][-1]["createdAt"])')
page2=$(curl -s -b $J "$B/api/media?childId=$CID&limit=2&before=$CUR")
echo "$page2" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("page2",len(d["attachments"]),[a["createdAt"] for a in d["attachments"]])'
page3=$(curl -s -b $J "$B/api/media?childId=$CID&limit=2&before=$(echo "$page2" | python3 -c 'import sys,json;print(json.load(sys.stdin)["attachments"][-1]["createdAt"])')")
echo "$page3" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("page3",len(d["attachments"]))'
echo -n 'total: '; curl -s -b $J "$B/api/media?childId=$CID&limit=100" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["attachments"]))'

echo '--- 超 5 分钟视频应被拒绝 ---'
docker exec kidslog ffmpeg -v error -y -f lavfi -i testsrc=size=320x240:duration=301:rate=1 -c:v libx264 -preset ultrafast -pix_fmt yuv420p /data/_tmp/long.mp4
docker cp kidslog:/data/_tmp/long.mp4 /tmp/long.mp4 >/dev/null
docker exec kidslog rm -f /data/_tmp/long.mp4
ls -l /tmp/long.mp4 | awk '{print "long video bytes:",$5}'
curl -s -b $J -X POST "$B/api/media?childId=$CID" -F "file=@/tmp/long.mp4" | head -c 200; echo

echo '--- 目录残留检查（失败上传不应留文件）---'
docker exec kidslog sh -c 'ls /data/media/*/ 2>/dev/null | wc -l; du -sh /data/media 2>/dev/null'
