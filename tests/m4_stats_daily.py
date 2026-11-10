import json, urllib.request, urllib.error, http.cookiejar, datetime, sys, os

BASE = os.environ.get('BASE', 'http://127.0.0.1:8080')
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    if data:
        req.add_header('Content-Type', 'application/json')
    try:
        with opener.open(req) as r:
            return r.status, json.loads(r.read().decode() or 'null')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

code, me = call('POST', '/api/auth/register', {'username': 'tester1', 'password': 'pass1234', 'displayName': '测试'})
if code != 200:
    code, me = call('POST', '/api/auth/login', {'username': 'tester1', 'password': 'pass1234'})
print('auth', code)

code, child = call('POST', '/api/children', {'name': '小宝', 'nickname': '宝', 'birthDate': '2024-05-01', 'gender': 'male'})
print('child', code, child)
cid = child['child']['id']

today = datetime.date.today()
def iso(d, hour, minute=0):
    return f"{d.isoformat()}T{hour:02d}:{minute:02d}:00+08:00"

# 今天：3 次喂养（奶量 150/120/100），1 次便便+尿，1 次睡眠 90 分钟
d0 = today
recs = [
    ('feeding', iso(d0, 7), {'method': 'formula', 'amountMl': 150}, None),
    ('feeding', iso(d0, 11), {'method': 'breast', 'amountMl': 120}, None),
    ('feeding', iso(d0, 15), {'method': 'formula', 'amountMl': 100}, None),
    ('feeding', iso(d0, 18), {'method': 'solid', 'foods': '米粉'}, None),
    ('diaper', iso(d0, 9), {'kind': 'both', 'consistency': 'normal'}, None),
    ('diaper', iso(d0, 13), {'kind': 'pee'}, None),
    ('sleep', iso(d0, 12, 30), {}, iso(d0, 14, 0)),
    ('temperature', iso(d0, 20), {'value': 37.8}, None),
]
# 昨天：1 次喂养 200ml，1 次便
d1 = today - datetime.timedelta(days=1)
recs += [
    ('feeding', iso(d1, 8), {'method': 'formula', 'amountMl': 200}, None),
    ('diaper', iso(d1, 10), {'kind': 'poop'}, None),
]

for t, at, payload, end in recs:
    body = {'childId': cid, 'type': t, 'occurredAt': at, 'payload': payload}
    if end:
        body['endedAt'] = end
    code, res = call('POST', '/api/records', body)
    if code != 200:
        print('REC FAIL', code, res)

code, daily = call('GET', f'/api/stats/daily?childId={cid}&from={(today-datetime.timedelta(days=2)).isoformat()}&to={today.isoformat()}')
print('daily', code)
print(json.dumps(daily, ensure_ascii=False, indent=1))

code, rng = call('GET', f'/api/stats/range?childId={cid}&from={(today-datetime.timedelta(days=6)).isoformat()}&to={today.isoformat()}')
print('range', code, rng.get('total') if isinstance(rng, dict) else rng)

# 越界校验
code, err = call('GET', f'/api/stats/daily?childId={cid}&from=2026-01-01&to=2026-06-01')
print('span check', code, err)
