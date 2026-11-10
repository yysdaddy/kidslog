import json, urllib.request, urllib.error, http.cookiejar, time, os

BASE = os.environ.get('BASE', 'http://127.0.0.1:8080')
ok, fail = [], []

def client():
    cj = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def call(op, method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    if data:
        req.add_header('Content-Type', 'application/json')
    try:
        with op.open(req, timeout=10) as r:
            return r.status, json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or '{}')
        except Exception:
            return e.code, {}

def check(name, cond, extra=''):
    (ok if cond else fail).append(f'{name} {extra}')
    print(('PASS ' if cond else 'FAIL ') + name + (' ' + str(extra) if extra else ''))

ts = str(int(time.time()))[-6:]
owner, member = client(), client()

s, r = call(owner, 'POST', '/api/auth/register', {
    'username': f'e2e_owner_{ts}', 'password': 'pass1234', 'displayName': '测试爸爸', 'familyName': '验收家庭'})
check('注册 owner', s == 200 and r.get('user', {}).get('role') == 'owner', s)
invite = (r.get('user') or {}).get('inviteCode')

s, r = call(owner, 'GET', '/api/me/account')
check('账号信息含注册时间/成员数', s == 200 and r['user'].get('memberCount') == 1 and r['user'].get('createdAt'), r.get('user'))

s, r = call(owner, 'PATCH', '/api/me', {'displayName': '新昵称'})
check('改昵称', s == 200 and r['user']['displayName'] == '新昵称', s)

s, r = call(member, 'POST', '/api/auth/join', {
    'username': f'e2e_mem_{ts}', 'password': 'pass1234', 'displayName': '测试妈妈', 'inviteCode': invite})
check('邀请码加入家庭', s == 200 and r['user']['role'] == 'member', s)
mid = (r.get('user') or {}).get('id')

s, r = call(owner, 'GET', '/api/family/members')
check('成员列表 2 人且可管理', s == 200 and len(r['members']) == 2 and r['canManage'] is True, [m['displayName'] for m in r.get('members', [])])

s, r = call(member, 'GET', '/api/family/members')
check('普通成员 canManage=false', s == 200 and r['canManage'] is False, s)

s, r = call(member, 'PATCH', '/api/family', {'name': '篡改家庭'})
check('普通成员改家庭名被拒 403', s == 403, s)

s, r = call(owner, 'PATCH', '/api/family', {'name': '验收家庭2'})
check('owner 改家庭名', s == 200 and r['familyName'] == '验收家庭2', s)

s, r = call(owner, 'POST', '/api/family/invite/rotate')
new_invite = (r or {}).get('inviteCode')
check('重置邀请码并变更', s == 200 and new_invite and new_invite != invite, new_invite)

s, r = call(member, 'POST', '/api/auth/join', {
    'username': f'e2e_old_{ts}', 'password': 'pass1234', 'inviteCode': invite})
check('旧邀请码失效 404', s == 404, s)

s, r = call(owner, 'POST', '/api/me/password', {'oldPassword': 'wrong', 'newPassword': 'newpass123'})
check('错误原密码被拒 400', s == 400, r.get('error'))

s, r = call(owner, 'POST', '/api/me/password', {'oldPassword': 'pass1234', 'newPassword': 'newpass123'})
check('改密码成功', s == 200 and r.get('ok'), s)

s, r = call(owner, 'GET', '/api/me/account')
check('改密后当前会话仍有效', s == 200, s)

fresh = client()
s, r = call(fresh, 'POST', '/api/auth/login', {'username': f'e2e_owner_{ts}', 'password': 'pass1234'})
check('旧密码登录失败 401', s == 401, s)
s, r = call(fresh, 'POST', '/api/auth/login', {'username': f'e2e_owner_{ts}', 'password': 'newpass123'})
check('新密码登录成功', s == 200, s)

s, r = call(member, 'DELETE', f'/api/family/members/{mid}')
check('非 owner 移除成员被拒 403', s == 403, s)

s, r = call(owner, 'DELETE', f'/api/family/members/{mid}')
check('owner 移除成员', s == 200 and r.get('ok'), s)

s, r = call(owner, 'GET', '/api/family/members')
check('移除后成员数 1', s == 200 and len(r['members']) == 1, len(r.get('members', [])))

s, r = call(member, 'GET', '/api/children')
check('被移除成员已无家庭数据', s == 200 and r.get('children') == [], r)

print('\nOK=%d FAIL=%d' % (len(ok), len(fail)))
