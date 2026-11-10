#!/usr/bin/env bash
set -u
B=http://127.0.0.1:8080
J=/tmp/ckv.txt
rm -f $J
TS=$(date +%s)
U=m2v_$TS

R=$(curl -s -c $J -X POST $B/api/auth/register -H 'Content-Type: application/json' \
  -d "{\"username\":\"$U\",\"password\":\"kidslog123\",\"displayName\":\"视频测试\"}")
CID=$(curl -s -b $J -X POST $B/api/children -H 'Content-Type: application/json' \
  -d '{"name":"视频宝宝","birthDate":"2024-01-01"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["child"]["id"])')
echo "child: $CID"

# 生成 6 秒带音频的 1080p 测试视频
docker exec kidslog mkdir -p /data/_tmp
docker exec kidslog ffmpeg -v error -y -f lavfi -i testsrc=size=1920x1080:duration=6:rate=25 \
  -f lavfi -i sine=frequency=440:duration=6 -c:v libx264 -preset ultrafast -c:a aac -shortest /data/_tmp/v.mp4
docker cp kidslog:/data/_tmp/v.mp4 /tmp/v.mp4
docker exec kidslog rm -f /data/_tmp/v.mp4
ls -l /tmp/v.mp4 | awk '{print "video bytes:", $5}'

echo '--- upload video ---'
V=$(curl -s -b $J -X POST "$B/api/media?childId=$CID" -F "file=@/tmp/v.mp4")
echo "$V" | head -c 500; echo
VID=$(echo "$V" | python3 -c 'import sys,json;print(json.load(sys.stdin)["attachment"]["id"])' 2>/dev/null || echo '')
echo "$V" | python3 -c 'import sys,json;a=json.load(sys.stdin)["attachment"];print("kind",a["kind"],"dur_ms",a["durationMs"],"wh",a["width"],a["height"],"size",a["sizeBytes"])' 2>/dev/null

echo '--- range request ---'
curl -s -o /dev/null -D - -H 'Range: bytes=0-1023' -b $J "$B/api/media/$VID/file" | grep -Ei 'HTTP/|content-range|content-type|content-length'
echo '--- thumb ---'
curl -s -o /dev/null -w 'thumb %{http_code} %{content_type}\n' -b $J "$B/api/media/$VID/thumb"

echo '--- 记录绑定视频 + 相册筛选 ---'
NOW=$(date -Iseconds)
curl -s -b $J -X POST $B/api/records -H 'Content-Type: application/json' \
  -d "{\"childId\":\"$CID\",\"type\":\"outing\",\"occurredAt\":\"$NOW\",\"payload\":{\"place\":\"公园\"},\"attachmentIds\":[\"$VID\"]}" \
  | python3 -c 'import sys,json;r=json.load(sys.stdin)["record"];print("record ok, atts",len(r["attachments"]))'
curl -s -b $J "$B/api/media?childId=$CID&kind=video" | python3 -c 'import sys,json;print("video filter ->",len(json.load(sys.stdin)["attachments"]))'
curl -s -b $J "$B/api/media?childId=$CID&kind=image" | python3 -c 'import sys,json;print("image filter ->",len(json.load(sys.stdin)["attachments"]))'
curl -s -b $J "$B/api/storage"; echo
