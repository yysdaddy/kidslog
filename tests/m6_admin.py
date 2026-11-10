import json, os, urllib.request, urllib.error, http.cookiejar, time

BASE = os.environ.get('BASE', 'http://127.0.0.1:8099')
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
        with op.open(req, timeout=15) as r:
            return r.status, json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or '{}')
        except Exception:
            return e.code, {}


def check(name, cond, extra=''):
    (ok if cond else fail).append(name)
    print(('PASS ' if cond else 'FAIL ') + name + (' ' + str(extra) if extra else ''))


ts = str(int(time.time()))[-6:]
admin, userB, userC = client(), client(), client()

# ---------- 初始化 ----------
s, r = call(admin, 'GET', '/api/auth/setup')
check('空库 needsSetup', s == 200 and r.get('needsSetup') is True and r.get('userCount') == 0, r)

s, r = call(admin, 'POST', '/api/auth/register', {
    'username': f'adm_{ts}', 'password': 'pass1234', 'displayName': '管理员', 'familyName': '管理员家'})
check('首个注册者为管理员', s == 200 and r['user'].get('isAdmin') is True and r.get('isFirstAdmin') is True, s)
admin_family = r['user']['familyId']
invite = r['user']['inviteCode']

s, r = call(admin, 'GET', '/api/auth/setup')
check('有管理员后 needsSetup=false', s == 200 and r.get('needsSetup') is False, r)

s, r = call(userB, 'POST', '/api/auth/register', {
    'username': f'b_{ts}', 'password': 'pass1234', 'displayName': 'B', 'familyName': 'B的家'})
check('第二个注册者非管理员', s == 200 and r['user'].get('isAdmin') is False, s)
b_id, b_family = r['user']['id'], r['user']['familyId']

s, r = call(userC, 'POST', '/api/auth/join', {
    'username': f'c_{ts}', 'password': 'pass1234', 'displayName': 'C', 'inviteCode': invite})
check('邀请码加入为 member', s == 200 and r['user']['role'] == 'member' and r['user']['familyId'] == admin_family, s)
c_id = r['user']['id']

# ---------- 权限 ----------
s, r = call(userB, 'GET', '/api/admin/users')
check('普通用户访问账号管理 403', s == 403, s)
s, r = call(userB, 'GET', '/api/admin/families')
check('普通用户访问家庭管理 403', s == 403, s)
s, r = call(admin, 'GET', '/api/admin/users')
check('管理员可列出账号', s == 200 and len(r.get('users', [])) == 3, len(r.get('users', [])))
check('列表含家庭统计与 isMe', all('familyChildCount' in u and 'isMe' in u for u in r['users']), '')

# ---------- 改昵称 / 家庭 ----------
s, r = call(admin, 'PATCH', f'/api/admin/users/{b_id}', {'displayName': 'B改'})
check('管理员改昵称', s == 200, s)
s, r = call(userB, 'GET', '/api/me')
check('被改昵称生效', s == 200 and r['user']['displayName'] == 'B改', s)

s, r = call(admin, 'PATCH', f'/api/admin/users/{c_id}', {'familyId': b_family})
check('管理员调整成员家庭', s == 200, s)
s, r = call(userC, 'GET', '/api/me')
check('调整家庭后旧会话失效', s == 401, s)
s, r = call(userC, 'POST', '/api/auth/login', {'username': f'c_{ts}', 'password': 'pass1234'})
check('重新登录后进入新家庭', s == 200 and r['user']['familyId'] == b_family and r['user']['role'] == 'member',
      r.get('user', {}).get('familyId'))
call(admin, 'PATCH', f'/api/admin/users/{c_id}', {'familyId': admin_family})

# ---------- 重置密码 + 强制改密 ----------
s, r = call(admin, 'POST', f'/api/admin/users/{b_id}/password', {'newPassword': 'temp5678'})
check('管理员重置密码', s == 200, s)
b2 = client()
s, r = call(b2, 'POST', '/api/auth/login', {'username': f'b_{ts}', 'password': 'pass1234'})
check('旧密码失效', s == 401, s)
s, r = call(b2, 'POST', '/api/auth/login', {'username': f'b_{ts}', 'password': 'temp5678'})
check('临时密码可登录且要求改密', s == 200 and r['user'].get('mustChangePw') is True, s)
s, r = call(b2, 'GET', '/api/records')
check('未改密前业务接口被拦', s == 403 and r.get('code') == 'must_change_pw', r)
s, r = call(b2, 'POST', '/api/me/password', {'oldPassword': 'temp5678', 'newPassword': 'newpass99'})
check('完成改密', s == 200 and r['user'].get('mustChangePw') is False, s)
s, r = call(b2, 'GET', '/api/me')
check('改密后可正常使用', s == 200, s)

# ---------- 停用 / 启用 ----------
s, r = call(admin, 'PATCH', f'/api/admin/users/{b_id}', {'status': 'disabled'})
check('停用账号', s == 200, s)
s, r = call(b2, 'GET', '/api/me')
check('停用后在线会话立即失效', s == 401, s)
b3 = client()
s, r = call(b3, 'POST', '/api/auth/login', {'username': f'b_{ts}', 'password': 'newpass99'})
check('停用后无法登录', s == 403 and '停用' in r.get('error', ''), r)
s, r = call(admin, 'PATCH', f'/api/admin/users/{b_id}', {'status': 'active'})
check('重新启用', s == 200, s)
s, r = call(b3, 'POST', '/api/auth/login', {'username': f'b_{ts}', 'password': 'newpass99'})
check('启用后可登录', s == 200, s)

# ---------- 管理员自我与末管理员保护 ----------
me_id = None
s, r = call(admin, 'GET', '/api/admin/users')
for u in r['users']:
    if u['isMe']:
        me_id = u['id']
check('识别自身账号', bool(me_id), '')
s, r = call(admin, 'PATCH', f'/api/admin/users/{me_id}', {'status': 'disabled'})
check('不能停用自己', s == 400, r.get('error'))
s, r = call(admin, 'PATCH', f'/api/admin/users/{me_id}', {'isAdmin': False})
check('不能取消自己的管理员', s == 400, r.get('error'))
s, r = call(admin, 'PATCH', f'/api/admin/users/{me_id}', {'familyId': b_family})
check('不能调整自己的家庭', s == 400, r.get('error'))

s, r = call(admin, 'PATCH', f'/api/admin/users/{c_id}', {'isAdmin': True})
check('可提升他人为管理员', s == 200, s)
s, r = call(admin, 'PATCH', f'/api/admin/users/{c_id}', {'isAdmin': False})
check('可取消他人管理员', s == 200, s)

# ---------- 管理员不越界读数据 ----------
s, r = call(b3, 'POST', '/api/children', {'name': 'B家宝宝', 'birthDate': '2024-05-01'})
check('B 建孩子', s == 200 and r['child'].get('id'), s)
b_kid = r['child']['id']
s, r = call(admin, 'GET', f'/api/records?childId={b_kid}')
check('管理员不能读取别家记录', s == 403, s)
s, r = call(admin, 'GET', f'/api/children/{b_kid}/growth')
check('管理员不能读取别家成长数据', s in (403, 404), s)

# ---------- 家庭管理 ----------
s, r = call(admin, 'POST', '/api/admin/families', {'name': '临时空家庭'})
check('新建家庭', s == 200 and r['family'].get('id'), s)
tmp_fam = r['family']['id']
s, r = call(admin, 'DELETE', f'/api/admin/families/{tmp_fam}')
check('解散空家庭', s == 200, s)
s, r = call(admin, 'DELETE', f'/api/admin/families/{b_family}')
check('有成员家庭禁止解散', s == 400, r.get('error'))

# ---------- 日志 ----------
s, r = call(admin, 'GET', '/api/admin/logs')
actions = [l['action'] for l in r.get('logs', [])]
check('操作日志可查', s == 200 and 'user.reset_password' in actions and 'family.create' in actions, actions[:6])
check('日志记录操作者', all(l.get('actorName') for l in r['logs']), '')

print(f'\n{len(ok)} passed, {len(fail)} failed')
if fail:
    print('FAILED:', fail)
    raise SystemExit(1)
