from __future__ import annotations
import json, traceback
from pathlib import Path
from gradio_client import Client

ROOT=Path('.tmp/ai-director-minimax-inpaint-health'); ROOT.mkdir(parents=True,exist_ok=True)
out={'space':'linoyts/minimax-h3-inpainting','status':'UNKNOWN'}
try:
    c=Client('linoyts/minimax-h3-inpainting',verbose=False)
    api=c.view_api(return_format='dict')
    out['status']='API_DISCOVERY_SUCCESS'
    out['api']=api
except Exception as e:
    out['status']='API_DISCOVERY_FAILURE'; out['error']=f'{type(e).__name__}: {e}'; out['traceback']=traceback.format_exc()
(ROOT/'result.json').write_text(json.dumps(out,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
print(json.dumps(out,ensure_ascii=False,indent=2,default=str))
