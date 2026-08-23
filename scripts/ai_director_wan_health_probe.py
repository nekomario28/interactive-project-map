from __future__ import annotations
import json, time, traceback, shutil, urllib.request, subprocess
from pathlib import Path
from gradio_client import Client

ROOT=Path('.tmp/ai-director-wan-health-probe'); ROOT.mkdir(parents=True,exist_ok=True)
prompt='A flamingo stands still on exactly one leg, balanced naturally, full body visible, no walking or preening, realistic flamingo anatomy.'
out={'space':'Wan-AI/Wan2.1','action':'sid005_semantic_split_event1','prompt':prompt,'status':'UNKNOWN','seed':50051,'size':'1280*720'}
checkpoint=ROOT/'checkpoint.json'

def persist():
    checkpoint.write_text(json.dumps(out,indent=2,ensure_ascii=False,default=str),encoding='utf-8')

def extract_path_or_url(x):
    vals=[]
    def walk(v):
        if isinstance(v,str): vals.append(v)
        elif isinstance(v,(list,tuple)):
            for q in v: walk(q)
        elif isinstance(v,dict):
            for key in ('path','url','video','value'):
                if key in v: walk(v[key])
            for key,q in v.items():
                if key not in {'path','url','video','value'}: walk(q)
        else:
            p=getattr(v,'path',None)
            if p: vals.append(str(p))
            u=getattr(v,'url',None)
            if u: vals.append(str(u))
    walk(x)
    for v in vals:
        if v.startswith(('http://','https://')) or Path(v).exists(): return v
    return None

def save_media(src):
    dest=ROOT/'sid005_event1_wan21.mp4'
    if src.startswith(('http://','https://')): urllib.request.urlretrieve(src,dest)
    else: shutil.copy2(src,dest)
    return dest

t0=time.time(); persist()
try:
    c=Client('Wan-AI/Wan2.1', verbose=False)
    start=c.predict(prompt,'1280*720',True,50051,api_name='/t2v_generation_async')
    out['start_result']=repr(start); out['status']='SUBMITTED'; persist()
    polls=[]; deadline=time.time()+25*60
    while time.time()<deadline:
        time.sleep(5)
        r=c.predict(api_name='/status_refresh')
        polls.append(repr(r))
        out['poll_count']=len(polls)
        out['last_polls']=polls[-5:]
        out['elapsed_sec']=time.time()-t0
        src=extract_path_or_url(r)
        if src:
            out['video_source']=src
            dest=save_media(src); out['output']=str(dest); out['status']='EXECUTED_SUCCESS'; persist(); break
        # Important: progress value may reach 100 before task_status is actually complete.
        # Completion is defined only by a returned video path/URL from status_refresh.
        persist()
    if out['status']=='EXECUTED_SUCCESS':
        cp=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size','-of','json',out['output']],capture_output=True,text=True,check=True)
        out['output_probe']=json.loads(cp.stdout)
    else:
        out['status']='POLL_TIMEOUT_NO_MEDIA'
except Exception as e:
    out['status']='EXECUTOR_FAILURE'; out['error']=f'{type(e).__name__}: {e}'; out['traceback']=traceback.format_exc()
out['elapsed_sec']=time.time()-t0
persist()
(ROOT/'result.json').write_text(json.dumps(out,indent=2,ensure_ascii=False,default=str),encoding='utf-8')
print(json.dumps(out,indent=2,ensure_ascii=False,default=str))
