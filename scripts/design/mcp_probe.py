"""Bounded localhost-only stdio MCP smoke check; no personal Chrome profile."""
from __future__ import annotations
import argparse, base64, json, queue, subprocess, threading, time, sys, os, tomllib
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]

class Client:
    def __init__(self, provider=None, command=None):
        environment = os.environ.copy()
        if command is None:
            servers = tomllib.loads((ROOT / '.codex/config.toml').read_text(encoding='utf-8'))['mcp_servers']
            config = servers['deadlock_playwright' if provider == 'playwright' else 'deadlock_devtools']
            command = [config['command'], *config.get('args', [])]
            environment.update(config.get('env', {}))
        self.process = subprocess.Popen(
            command,
            cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, encoding='utf-8', env=environment, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
        self.inbox, self.errors, self.counter = queue.Queue(), [], 0
        def stdout():
            for line in self.process.stdout:
                try: self.inbox.put(json.loads(line))
                except json.JSONDecodeError: self.errors.append(line.strip()[:400])
        def stderr():
            for line in self.process.stderr:
                if len(self.errors) < 20: self.errors.append(line.strip()[:400])
        threading.Thread(target=stdout, daemon=True).start()
        threading.Thread(target=stderr, daemon=True).start()

    def send(self, payload):
        self.process.stdin.write(json.dumps({'jsonrpc': '2.0', **payload}) + '\n')
        self.process.stdin.flush()

    def request(self, method, params=None, timeout=45):
        self.counter += 1
        identifier = self.counter
        self.send({'id': identifier, 'method': method, 'params': params or {}})
        until = time.monotonic() + timeout
        while time.monotonic() < until:
            try: message = self.inbox.get(timeout=min(1, max(.01, until-time.monotonic())))
            except queue.Empty:
                if self.process.poll() is not None: raise RuntimeError('MCP exited: ' + '\n'.join(self.errors[-4:]))
                continue
            if 'method' in message and 'id' in message:
                self.send({'id': message['id'], 'error': {'code': -32601, 'message': 'Client method unavailable'}})
            if message.get('id') != identifier: continue
            if 'error' in message: raise RuntimeError(json.dumps(message['error']))
            return message.get('result')
        raise TimeoutError(f'MCP timeout: {method}')

    def tool(self, name, arguments=None):
        result = self.request('tools/call', {'name': name, 'arguments': arguments or {}})
        if result.get('isError'): raise RuntimeError(f'{name}: ' + json.dumps(result)[:1600])
        return result

    def close(self):
        self.process.stdin.close()
        try: self.process.wait(timeout=12)
        except subprocess.TimeoutExpired:
            self.process.terminate()
            self.process.wait(timeout=5)

def texts(result):
    return '\n'.join(item.get('text', '') for item in result.get('content', []) if item.get('type') == 'text')

def observed_object(result):
    text = texts(result)
    return json.JSONDecoder().raw_decode(text[text.index('{'):])[0]

def run(provider, url, output, list_only):
    client = Client(provider)
    try:
        hello = client.request('initialize', {'protocolVersion': '2025-06-18', 'capabilities': {}, 'clientInfo': {'name': 'deadlock-design-check', 'version': '1.0.0'}})
        client.send({'method': 'notifications/initialized'})
        tools = client.request('tools/list')['tools']
        output.mkdir(parents=True, exist_ok=True)
        (output / f'{provider}-tools.json').write_text(json.dumps(tools, ensure_ascii=False, indent=2), encoding='utf-8')
        result = {'provider': provider, 'protocol': hello.get('protocolVersion'), 'tools': len(tools)}
        if list_only: return result
        if provider == 'playwright':
            client.tool('browser_navigate', {'url': url})
            client.tool('browser_wait_for', {'text': 'Найдено предметов'})
            snapshot = client.tool('browser_snapshot')
            client.tool('browser_click', {'element': 'Оружие category filter', 'target': '.item-category-button.weapon'})
            interaction = client.tool('browser_evaluate', {'function': "() => ({cards: document.querySelectorAll('.shop-card').length, theme: document.documentElement.dataset.theme})"})
            console = client.tool('browser_console_messages', {'level': 'error'})
            screen = client.tool('browser_take_screenshot', {'type': 'png', 'scale': 'css'})
            client.tool('browser_resize', {'width': 390, 'height': 844})
            narrow = client.tool('browser_snapshot')
            geometry = client.tool('browser_evaluate', {'function': "() => ({width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth})"})
            client.tool('browser_close')
        else:
            pages = client.tool('list_pages')
            (output / 'devtools-pages.json').write_text(json.dumps(pages, ensure_ascii=False, indent=2), encoding='utf-8')
            # The pinned server identifies its initial isolated page as1; confirm from actual listing.
            import re
            match = re.search(r'(\d+):\s+about:blank', texts(pages))
            if not match: raise RuntimeError('Could not identify the isolated initial page; inspect recorded list_pages')
            page_id = int(match.group(1))
            client.tool('navigate_page', {'pageId': page_id, 'type': 'url', 'url': url})
            client.tool('wait_for', {'pageId': page_id, 'text': ['Найдено предметов']})
            snapshot = client.tool('take_snapshot', {'pageId': page_id})
            interaction = client.tool('evaluate_script', {'pageId': page_id, 'function': "() => ({cards: document.querySelectorAll('.shop-card').length, theme: document.documentElement.dataset.theme})"})
            console = client.tool('list_console_messages', {'pageId': page_id, 'types': ['error']})
            screen = client.tool('take_screenshot', {'pageId': page_id, 'format': 'png'})
            client.tool('emulate', {'pageId': page_id, 'viewport': '390x844x1,mobile,touch'})
            narrow = client.tool('take_snapshot', {'pageId': page_id})
            geometry = client.tool('evaluate_script', {'pageId': page_id, 'function': "() => ({width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth})"})
            client.tool('emulate', {'pageId': page_id, 'viewport': '390x844x1,mobile,touch', 'prefersReducedMotion': 'reduce'})
            reduced = client.tool('evaluate_script', {'pageId': page_id, 'function': "() => ({reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches})"})
            (output / 'devtools-reduced-motion.json').write_text(json.dumps(reduced, ensure_ascii=False, indent=2), encoding='utf-8')
            client.tool('emulate', {'pageId': page_id, 'prefersReducedMotion': 'auto'})
            trace = client.tool('performance_start_trace', {'pageId': page_id, 'reload': True, 'autoStop': True})
            (output / 'devtools-performance.json').write_text(json.dumps(trace, ensure_ascii=False, indent=2), encoding='utf-8')
            console = client.tool('list_console_messages', {'pageId': page_id, 'types': ['error']})
        for name, data in [('snapshot', snapshot), ('console', console), ('narrow', narrow), ('geometry', geometry), ('interaction', interaction)]:
            (output / f'{provider}-{name}.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
        for item in screen.get('content', []):
            if item.get('type') == 'image':
                (output / f'{provider}.png').write_bytes(base64.b64decode(item['data']))
        observed = observed_object(interaction)
        bounds = observed_object(geometry)
        expected_cards = 53 if provider == 'playwright' else 156
        if observed.get('cards') != expected_cards or observed.get('theme') != 'heritage':
            raise AssertionError(f'Unexpected rendered page: {observed}')
        if bounds.get('width') != 390 or bounds.get('scroll') > bounds['width']:
            raise AssertionError(f'Unexpected mobile geometry: {bounds}')
        import re
        if re.search(r'Errors:\s*[1-9]|\[error\]', texts(console)):
            raise AssertionError('Console errors: ' + texts(console)[:1000])
        if not (output / f'{provider}.png').is_file(): raise AssertionError('No screenshot returned')
        result.update({'pageObserved': bool(texts(snapshot)), 'interaction': texts(interaction)[:800], 'console': texts(console)[:800], 'output': str(output)})
        return result
    finally: client.close()

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser()
    parser.add_argument('provider', choices=['playwright', 'devtools'])
    parser.add_argument('--url', default='http://127.0.0.1:5173/#/items')
    parser.add_argument('--output', type=Path, default=ROOT / 'outputs/design-tools')
    parser.add_argument('--list-only', action='store_true')
    args = parser.parse_args()
    parsed = urlparse(args.url)
    if parsed.scheme != 'http' or parsed.hostname not in ['localhost', '127.0.0.1']:
        parser.error('Smoke checks only support explicit local HTTP targets')
    print(json.dumps(run(args.provider, args.url, args.output.resolve(), args.list_only), ensure_ascii=False))
