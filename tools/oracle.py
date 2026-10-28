# tools/oracle.py: SYMBEYOND's and teslasolar's own Python, run as the oracle. It imports the vendored files
# (vendor/symbfer/, byte-pinned) and calls them unchanged; it adds nothing but the JSON in and out.
#   stdin:  {"jobs": [{"kind": "v62"|"v30", "path": "..."} | {"kind": "gen", "tier": "nano"|"core"|"state", "state": {...}, "ts": "..."}]}
#   stdout: {"results": [...]} in the same order (UTF-8)
import json, os, sys
sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
V = os.path.join(HERE, '..', 'vendor', 'symbfer')
sys.path.insert(0, os.path.join(V, 'symbeyond', 'SYMB-FER_6_2'))
sys.path.insert(0, os.path.join(V, 'symbeyond'))
sys.path.insert(0, os.path.join(V, 'teslasolar', 'source', 'SYMB-FER_3_0'))
import validate_v6_2, symbfer_engine, symb_fer_generator

def run(job):
    kind = job.get('kind')
    if kind == 'v62':
        try:
            r = validate_v6_2.validate_file(job['path'])
        except Exception as e:
            return {'status': 'FATAL', 'error': type(e).__name__}
        return {'status': r.status, 'passes': r.passes, 'warnings': r.warnings, 'failures': r.failures}
    if kind == 'v30':
        try:
            a = symbfer_engine.process_symbfer_file(job['path'])
        except Exception as e:
            return {'status': 'FATAL', 'error': type(e).__name__}
        v = a.validation
        return {'status': a.status, 'passes': v.passes, 'warnings': v.warnings, 'failures': v.failures}
    if kind == 'gen':
        st = job['state']
        return {'text': symb_fer_generator.TIER_BUILDERS[job['tier']](st, st.get('_meta', {}), job['ts'])}
    return {'error': 'unknown kind'}

jobs = json.loads(sys.stdin.buffer.read().decode('utf-8'))['jobs']
sys.stdout.buffer.write(json.dumps({'results': [run(j) for j in jobs]}, ensure_ascii=False).encode('utf-8'))
