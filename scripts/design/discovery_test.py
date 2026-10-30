import contextlib, io, json, runpy, unittest
from pathlib import Path

module = runpy.run_path(str(Path(__file__).with_name('check-discovery.py')))
ROOT, WANTED, main = module['ROOT'], module['WANTED'], module['main']

class DiscoveryChecks(unittest.TestCase):
    def run_listing(self, enabled=True, directory=None, errors=None):
        root = directory or ROOT / '.agents/skills'
        data = {'data':[{'skills':[{'name':name,'path':str(root/name/'SKILL.md'),'enabled':enabled} for name in WANTED], 'errors':errors or []}]}
        class FakeClient:
            def __init__(self, **kwargs): pass
            def request(self, method, params): return data if method == 'skills/list' else {}
            def close(self): pass
        output=io.StringIO()
        with contextlib.redirect_stdout(output): code=main(FakeClient)
        return code,json.loads(output.getvalue())

    def test_disabled_project_skills_fail_even_when_all_names_exist(self):
        code,status=self.run_listing(enabled=False)
        self.assertEqual(code,1)
        self.assertEqual(set(status['disabled']),WANTED)

    def test_global_copies_cannot_satisfy_project_installation(self):
        code,status=self.run_listing(directory=ROOT.parent/'outside/.agents/skills')
        self.assertEqual(code,1)
        self.assertEqual(set(status['missing']),WANTED)

    def test_enabled_project_skills_pass_with_separate_global_warning(self):
        warning={'path':str(ROOT.parent/'outside/SKILL.md'),'message':'old global warning'}
        code,status=self.run_listing(errors=[warning])
        self.assertEqual(code,0)
        self.assertEqual(status['otherSkillWarnings'],[warning])

    def test_project_parse_error_fails(self):
        code,status=self.run_listing(errors=[{'path':str(ROOT/'.agents/skills/example/SKILL.md'),'message':'invalid'}])
        self.assertEqual(code,1)
        self.assertEqual(len(status['projectErrors']),1)

if __name__ == '__main__': unittest.main()
