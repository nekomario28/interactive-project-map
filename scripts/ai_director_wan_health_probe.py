from __future__ import annotations
import json, time, traceback, shutil
from pathlib import Path
from gradio_client import Client

ROOT=Path('.tmp/ai-director-wan-health-probe'); ROOT.mkdir(parents=True,exist_ok=True)
prompt='A flamingo stands still on exactly one leg, balanced naturally, full body visible, no walking or preening, realistic flamingo anatomy.'
out={'space':'Wan-AI/Wan2.1','action':'sid005_semantic_split_event1','prompt':prompt,'status':'UNKNOWN','seed':50051,'size':'1280*720'}
t0=time.time()
try:
    c=Client('Wan-AI/Wan2.1', verbose=False)
    start=c.predict(prompt,'1280*720',True,50051,api_name='/t2v_generation_async')
    out['start_result']=repr(start)
    out['status']='SUBMITTED'
    polls=[]
    deadline=time.time()+8*60
    while time.time()<deadline:
        time.sleep(5)
        r=c.predict(api_name='/status_refresh')
        polls.append(repr(r))
        # Expected first item: Gradio VideoData dict or None.
        video=None
        if isinstance(r,(list,tuple)) and r:
            video=r[0]
        elif isinstance(r,dict):
            video=r
        path=None
        if isinstance(video,dict):
            v=video.get('video',video)
            if isinstance(v,dict): path=v.get('path')
            elif isinstance(v,str): path=v
        elif isinstance(video,str):
            path=video
        if path and Path(path).exists():
            dest=ROOT/'sid005_event1_wan21.mp4'; shutil.copy2(path,dest)
            out['output']=str(dest); out['status']='EXECUTED_SUCCESS'; break
    out['poll_count']=len(polls)
    out['last_polls']=polls[-5:]
    if out['status']!='EXECUTED_SUCCESS':
        out['status']='POLL_TIMEOUT_NO_MEDIA'
except Exception as e:
    out['status']='EXECUTOR_FAILURE'
    out['error']=f'{type(e).__name__}: {e}'
    out['traceback']=traceback.format_exc()
out['elapsed_sec']=time.time()-t0
(ROOT/'result.json').write_text(json.dumps(out,indent=2,ensure_ascii=False,default=str),encoding='utf-8')
print(json.dumps(out,indent=2,ensure_ascii=False,default=str))
