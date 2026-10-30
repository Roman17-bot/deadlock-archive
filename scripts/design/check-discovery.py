"""Ask local Codex to discover enabled project skills, without a model turn."""
import json, shutil, sys
from pathlib import Path
from mcp_probe import Client, ROOT

WANTED = {'deadlock-design','deadlock-design-review','frontend-design','web-design-guidelines','vercel-react-best-practices','shader-dev','ui-ux-pro-max'}

def inspect_listing(result):
    found, errors = [], []
    for group in result.get('data', []):
        errors += group.get('errors', [])
        for skill in group.get('skills', []):
            name = skill.get('name')
            if name not in WANTED: continue
            expected = ROOT / '.agents/skills' / name / 'SKILL.md'
            if Path(skill.get('path','')).resolve() == expected.resolve():
                found.append({'name':name, 'path':skill['path'], 'enabled':skill.get('enabled')})
    project_errors = [error for error in errors if Path(error.get('path','')).resolve().is_relative_to(ROOT)]
    return {
        'projectSkills': found,
        'projectErrors': project_errors,
        'otherSkillWarnings': [error for error in errors if error not in project_errors],
        'missing': sorted(WANTED-{skill['name'] for skill in found}),
        'disabled': sorted({skill['name'] for skill in found if skill.get('enabled') is not True}),
    }

def main(client_factory=Client):
    client = client_factory(command=[shutil.which('codex') or 'codex', '-c', 'model_reasoning_effort="medium"', 'app-server'])
    try:
        client.request('initialize', {'clientInfo': {'name': 'deadlock-skill-check', 'version': '1.0.0'}, 'capabilities': {'experimentalApi': True}})
        result = client.request('skills/list', {'cwds': [str(ROOT)], 'forceReload': True})
        status = inspect_listing(result)
        print(json.dumps(status, ensure_ascii=False))
        return int(bool(status['missing'] or status['disabled'] or status['projectErrors']))
    finally: client.close()

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    raise SystemExit(main())
