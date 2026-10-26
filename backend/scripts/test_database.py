#!/usr/bin/env python3
"""从本地 Docker PostgreSQL 创建独立临时库，运行 Rust 集成测试后删除；不修改业务库。"""
import json
import os
from pathlib import Path
import subprocess
import uuid
import socket
import tempfile
import time
import urllib.request
import urllib.error
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
CONTAINER = os.environ.get('POSTGRES_TEST_CONTAINER', 'personal-website-db')

def capture(command, **kwargs):
    result = subprocess.run(command, text=True, capture_output=True, check=False, **kwargs)
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    return result.stdout

def main():
    # 只在进程内存中读取容器凭据，不打印、写入文件或放入命令行参数。
    values = json.loads(capture(['docker', 'inspect', '--format', '{{json .Config.Env}}', CONTAINER]))
    config = dict(value.split('=', 1) for value in values if '=' in value)
    username = config.get('POSTGRES_USER', 'postgres')
    password = config.get('POSTGRES_PASSWORD')
    if not password:
        raise RuntimeError('测试助手需要容器的 POSTGRES_PASSWORD；秘密文件部署请自行设置独立 TEST_DATABASE_URL 运行测试')
    ports = json.loads(capture(['docker', 'inspect', '--format', '{{json .NetworkSettings.Ports}}', CONTAINER]))
    port = ports['5432/tcp'][0]['HostPort']
    name = 'pw_backend_test_' + uuid.uuid4().hex[:12]
    def sql(statement):
        return capture(['docker', 'exec', '-i', CONTAINER, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', username, '-d', 'postgres'], input=statement)
    sql(f'CREATE DATABASE "{name}";')
    try:
        env = os.environ.copy()
        prefix = f'postgres://{quote(username, safe="")}:{quote(password, safe="")}@127.0.0.1:{port}/'
        env['TEST_DATABASE_URL'] = prefix + name
        env['DATABASE_URL'] = prefix + 'postgres'
        env['APP_ENV'] = 'test'
        env.pop('DATABASE_URL_FILE', None)
        env.pop('MIGRATIONS_DIR', None)
        result = subprocess.run(['cargo', 'test', '--manifest-path', str(ROOT / 'Cargo.toml'), '--offline', '--test', 'backend_flow', '--', '--ignored', '--nocapture'], env=env, check=False)
        if result.returncode:
            raise SystemExit(result.returncode)

        # 额外启动真实 TCP 服务验证监听器和 ConnectInfo，而不仅是 Router oneshot。
        subprocess.run(['cargo','build','--manifest-path',str(ROOT/'Cargo.toml'),'--offline','--bin','backend'],check=True)
        with tempfile.TemporaryDirectory(prefix='personal-website-http-') as media:
            with socket.socket() as probe:
                probe.bind(('127.0.0.1',0))
                port = probe.getsockname()[1]
            server_env=env.copy()
            server_env['DATABASE_URL']=env['TEST_DATABASE_URL']
            server_env['BIND_ADDR']=f'127.0.0.1:{port}'
            server_env['MEDIA_ROOT']=media
            server_env['PUBLIC_ORIGIN']='http://localhost:5173'
            server_env['LOG_LEVEL']='error'
            server_env.pop('GEOIP_FILE',None)
            server_env.pop('VISITOR_HMAC_KEY_FILE',None)
            server_env.pop('TRUSTED_PROXIES',None)
            server=subprocess.Popen([str(ROOT/'target/debug/backend')],env=server_env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
            opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
            try:
                deadline=time.monotonic()+20
                while True:
                    try:
                        with opener.open(f'http://127.0.0.1:{port}/health/ready',timeout=1) as response:
                            assert response.status==200
                            break
                    except (urllib.error.URLError,TimeoutError):
                        if server.poll() is not None or time.monotonic()>deadline:
                            raise RuntimeError('真实 HTTP 服务启动失败')
                        time.sleep(0.1)
                with opener.open(f'http://127.0.0.1:{port}/api/v1/profile',timeout=3) as response:
                    assert response.status==200
                    assert response.headers['X-Request-Id']
                    assert response.headers['Cache-Control']=='no-store'
                    assert json.load(response)['data']['headline']=='已更新'
                print('真实 TCP HTTP 健康检查及资料查询通过。',flush=True)
            finally:
                server.terminate()
                try:
                    server.communicate(timeout=10)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.communicate()
    finally:
        sql(f'DROP DATABASE "{name}" WITH (FORCE);')
        print('独立测试数据库已清理。', flush=True)

if __name__ == '__main__':
    main()
