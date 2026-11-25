"""Regression tests for fira/*/mini-server.py.

Run from the repository root:  python3 -m unittest discover -s tests -v
"""
import contextlib
import importlib.util
import io
import json
import os
import shutil
import socketserver
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERVER_COPIES = [ROOT / 'fira' / 'docker-deploy' / 'mini-server.py',
                 ROOT / 'fira' / 'web' / 'mini-server.py']


def load_server(path):
    spec = importlib.util.spec_from_file_location(f"mini_server_{path.parent.name.replace('-', '_')}", path)
    module = importlib.util.module_from_spec(spec)
    os.environ.setdefault('FIRA_ADMIN_PASSWORD', 'test-only-password')
    with contextlib.redirect_stdout(io.StringIO()):
        spec.loader.exec_module(module)
    return module


class ServerCopyTests:
    """Mixed into one TestCase per server copy (see bottom of file)."""

    server_path = None

    @classmethod
    def setUpClass(cls):
        cls.mod = load_server(cls.server_path)
        cls.tmp = Path(tempfile.mkdtemp())
        cls.projects = cls.tmp / 'projects'
        cls.projects.mkdir()
        (cls.tmp / 'secret.md').write_text('SECRET')
        cls.mod.PROJECTS_BASE_DIR = str(cls.projects)

        handler = cls.mod.FiraRequestHandler
        handler.log_message = lambda *a, **k: None
        cls.httpd = socketserver.ThreadingTCPServer(('127.0.0.1', 0), handler)
        cls.base_url = f'http://127.0.0.1:{cls.httpd.server_address[1]}'
        cls._quiet = contextlib.redirect_stdout(io.StringIO())
        cls._quiet.__enter__()
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        cls.request('POST', '/api/projects', {'id': 'demo', 'name': 'Demo', 'description': 'd'})

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls._quiet.__exit__(None, None, None)
        shutil.rmtree(cls.tmp)

    @classmethod
    def request(cls, method, path, payload=None, body=None, headers=None):
        if payload is not None:
            body = json.dumps(payload).encode()
            headers = {'Content-Type': 'application/json'}
        req = urllib.request.Request(cls.base_url + path, data=body, method=method, headers=headers or {})
        try:
            with urllib.request.urlopen(req) as resp:
                return resp.status, resp.read()
        except urllib.error.HTTPError as e:
            with e:
                return e.code, e.read()

    # --- safe_join -------------------------------------------------------

    def test_safe_join_allows_nested_paths(self):
        self.assertEqual(self.mod.safe_join(self.projects, 'demo', 'backlog'),
                         (self.projects / 'demo' / 'backlog').resolve())

    def test_safe_join_rejects_escapes(self):
        for parts in (('..',), ('demo', '../../secret.md'), ('/etc/passwd',), ('a/../../x',)):
            with self.subTest(parts=parts), self.assertRaises(self.mod.UnsafePathError):
                self.mod.safe_join(self.projects, *parts)

    def test_safe_join_rejects_symlink_escape(self):
        link = self.projects / 'link-out'
        link.symlink_to(self.tmp)
        self.addCleanup(link.unlink)
        with self.assertRaises(self.mod.UnsafePathError):
            self.mod.safe_join(self.projects, 'link-out', 'secret.md')

    # --- multipart parsing (cgi replacement) -----------------------------

    def test_parse_multipart_form(self):
        boundary = 'XyZ'
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="task_id"\r\n\r\nT-1\r\n'
                f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="a b.png"\r\n'
                f'Content-Type: image/png\r\n\r\n').encode() + b'\x89PNG\x00\x01' + f'\r\n--{boundary}--\r\n'.encode()
        headers = {'Content-Type': f'multipart/form-data; boundary={boundary}', 'Content-Length': str(len(body))}
        form = self.mod.parse_multipart_form(headers, io.BytesIO(body))
        self.assertEqual(form.getvalue('task_id'), 'T-1')
        self.assertEqual(form['image'].filename, 'a b.png')
        self.assertEqual(form['image'].file.read(), b'\x89PNG\x00\x01')
        self.assertIsNone(form.getvalue('missing'))

    # --- HTTP behaviour --------------------------------------------------

    def test_traversal_requests_return_400_and_touch_nothing(self):
        cases = [
            ('GET', '/api/projects/demo/attachments/..%2F..%2F..%2F/secret.md', None),
            ('DELETE', '/api/projects/demo/tasks/..%2F..%2Fsecret', None),
            ('DELETE', '/api/projects/..%2F..%2Fx', None),
            ('POST', '/api/projects/demo/tasks', {'id': 'pwn', 'title': 't', 'folder': '../../..', 'content': 'x'}),
            ('POST', '/api/create-directory', {'project_id': 'demo', 'parent_dir': '../..', 'dir_name': 'pwn'}),
        ]
        for method, path, payload in cases:
            with self.subTest(method=method, path=path):
                status, _ = self.request(method, path, payload)
                self.assertEqual(status, 400)
        self.assertEqual((self.tmp / 'secret.md').read_text(), 'SECRET')
        self.assertFalse(list(self.tmp.rglob('pwn*')))

    def test_task_lifecycle_still_works(self):
        status, _ = self.request('POST', '/api/projects/demo/tasks',
                                 {'id': 'T-9', 'title': 't', 'folder': 'backlog', 'content': 'x'})
        self.assertEqual(status, 200)
        status, body = self.request('GET', '/api/projects/demo/tasks')
        self.assertIn('T-9', [t['id'] for t in json.loads(body)['tasks']])
        status, _ = self.request('DELETE', '/api/projects/demo/tasks/T-9')
        self.assertEqual(status, 200)

    def test_image_upload_works_without_cgi(self):
        boundary = 'B0undary'
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="pic.png"\r\n'
                f'Content-Type: image/png\r\n\r\n').encode() + b'\x89PNG fake' + f'\r\n--{boundary}--\r\n'.encode()
        status, resp = self.request('POST', '/api/projects/demo/tasks/T-1/images', body=body,
                                    headers={'Content-Type': f'multipart/form-data; boundary={boundary}'})
        self.assertEqual(status, 200, resp)
        self.assertTrue(list((self.projects / 'demo' / 'images' / 'T-1').glob('*pic.png')))

    def test_empty_password_is_rejected(self):
        original = self.mod.load_users
        self.mod.load_users = lambda: [{'username': 'editor', 'password': '', 'role': 'editor'}]
        self.addCleanup(setattr, self.mod, 'load_users', original)
        self.assertFalse(self.mod.validate_admin_credentials('editor', ''))
        self.assertFalse(self.mod.validate_admin_credentials('editor', None))


class DockerDeployServerTests(ServerCopyTests, unittest.TestCase):
    server_path = SERVER_COPIES[0]


class WebServerTests(ServerCopyTests, unittest.TestCase):
    server_path = SERVER_COPIES[1]


if __name__ == '__main__':
    unittest.main()
