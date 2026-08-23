from __future__ import annotations
import json, time, traceback, shutil, urllib.request, subprocess
from pathlib import Path
from gradio_client import Client

ROOT=Path('.tmp/ai-director-sid007-wan-event1'); ROOT.mkdir(parents=True,exist_ok=True)
prompt='A small robot stands upright and stable on top of a table, full body visible, static camera.'
out={'space':'Wan-AI/Wan2.1','case':'sid_007','event_index':1,'canonical_event':'A robot stands on a table','prompt':prompt,'status':'UNKNOWN','seed':70071,'size':'1280*720'}

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
    dest=ROOT/'sid007_event1_wan21.mp4'
    if src.startswith(('http://','https://')): urllib.request.urlretrieve(src,dest)
    else: shutil.copy2(src,dest)
    return dest

t0=time.time()
try:
    c=Client('Wan-AI/Wan2.1', verbose=False)
    start=c.predict(prompt,'1280*720',True,70071,api_name='/t2v_generation_async')
    out['start_result']=repr(start); out['status']='SUBMITTED'
    polls=[]; process_changes=[]; deadline=time.time()+12*60
    while time.time()<deadline:
        time.sleep(5)
        r=c.predict(api_name='/status_refresh'); polls.append(repr(r))
        src=extract_path_or_url(r)
        if src:
            dest=save_media(src); out['output']=str(dest); out['status']='EXECUTED_SUCCESS_FROM_STATUS'; break
        if '100' in repr(r):
            try:
                pc=c.predict(api_name='/online_process_change'); process_changes.append(repr(pc))
                src=extract_path_or_url(pc)
                if src:
                    dest=save_media(src); out['output']=str(dest); out['status']='EXECUTED_SUCCESS_FROM_PROCESS_CHANGE'; break
            except Exception as pe:
                process_changes.append(f'{type(pe).__name__}: {pe}')
    out['poll_count']=len(polls); out['last_polls']=polls[-5:]; out['process_change_calls']=process_changes[-5:]
    if out['status'].startswith('EXECUTED_SUCCESS'):
        cp=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size','-of','json',out['output']],capture_output=True,text=True,check=True)
        out['output_probe']=json.loads(cp.stdout)
    else: out['status']='POLL_TIMEOUT_NO_MEDIA'
except Exception as e:
    out['status']='EXECUTOR_FAILURE'; out['error']=f'{type(e).__name__}: {e}'; out['traceback']=traceback.format_exc()
out['elapsed_sec']=time.time()-t0
(ROOT/'result.json').write_text(json.dumps(out,indent=2,ensure_ascii=False,default=str),encoding='utf-8')
print(json.dumps(out,indent=2,ensure_ascii=False,default=str))
