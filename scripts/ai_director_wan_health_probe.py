from __future__ import annotations
import json, time, traceback, shutil, urllib.request
from pathlib import Path
from gradio_client import Client

ROOT=Path('.tmp/ai-director-wan-health-probe'); ROOT.mkdir(parents=True,exist_ok=True)
prompt='A flamingo stands still on exactly one leg, balanced naturally, full body visible, no walking or preening, realistic flamingo anatomy.'
out={'space':'Wan-AI/Wan2.1','action':'sid005_semantic_split_event1','prompt':prompt,'status':'UNKNOWN','seed':50051,'size':'1280*720'}

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
    if src.startswith(('http://','https://')):
        urllib.request.urlretrieve(src,dest)
    else:
        shutil.copy2(src,dest)
    return dest

t0=time.time()
try:
    c=Client('Wan-AI/Wan2.1', verbose=False)
    start=c.predict(prompt,'1280*720',True,50051,api_name='/t2v_generation_async')
    out['start_result']=repr(start)
    out['status']='SUBMITTED'
    polls=[]; process_changes=[]
    deadline=time.time()+12*60
    while time.time()<deadline:
        time.sleep(5)
        r=c.predict(api_name='/status_refresh')
        polls.append(repr(r))
        src=extract_path_or_url(r)
        if src:
            dest=save_media(src); out['output']=str(dest); out['status']='EXECUTED_SUCCESS_FROM_STATUS'; break
        # The official Space updates task_status in status_refresh, then process_bar.change
        # calls online_process_change to surface the final video URL. State inputs are
        # Gradio session state and are omitted from the public client API, same as status_refresh.
        rr=repr(r)
        if '100' in rr:
            try:
                pc=c.predict(api_name='/online_process_change')
                process_changes.append(repr(pc))
                src=extract_path_or_url(pc)
                if src:
                    dest=save_media(src); out['output']=str(dest); out['status']='EXECUTED_SUCCESS_FROM_PROCESS_CHANGE'; break
            except Exception as pe:
                process_changes.append(f'{type(pe).__name__}: {pe}')
    out['poll_count']=len(polls)
    out['last_polls']=polls[-5:]
    out['process_change_calls']=process_changes[-5:]
    if out['status'].startswith('EXECUTED_SUCCESS'):
        import subprocess
        cp=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size','-of','json',out['output']],capture_output=True,text=True,check=True)
        out['output_probe']=json.loads(cp.stdout)
    else:
        out['status']='POLL_TIMEOUT_NO_MEDIA'
except Exception as e:
    out['status']='EXECUTOR_FAILURE'
    out['error']=f'{type(e).__name__}: {e}'
    out['traceback']=traceback.format_exc()
out['elapsed_sec']=time.time()-t0
(ROOT/'result.json').write_text(json.dumps(out,indent=2,ensure_ascii=False,default=str),encoding='utf-8')
print(json.dumps(out,indent=2,ensure_ascii=False,default=str))
