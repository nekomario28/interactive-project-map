from __future__ import annotations
import json, time, traceback
from pathlib import Path
from gradio_client import Client

ROOT=Path('.tmp/ai-director-wan-health-probe'); ROOT.mkdir(parents=True,exist_ok=True)
out={'space':'Wan-AI/Wan2.1','status':'UNKNOWN'}
t0=time.time()
try:
    c=Client('Wan-AI/Wan2.1', verbose=False)
    # Query the live Gradio API contract only; do not launch generation in this probe.
    try:
        api=c.view_api(return_format='dict')
    except TypeError:
        api=c.view_api()
    out['api']=api
    out['status']='API_DISCOVERED'
except Exception as e:
    out['status']='EXECUTOR_FAILURE'
    out['error']=f'{type(e).__name__}: {e}'
    out['traceback']=traceback.format_exc()
out['elapsed_sec']=time.time()-t0
(ROOT/'result.json').write_text(json.dumps(out,indent=2,ensure_ascii=False,default=str),encoding='utf-8')
print(json.dumps(out,indent=2,ensure_ascii=False,default=str))
