from __future__ import annotations
import json, shutil, subprocess, time, traceback
from pathlib import Path
from gradio_client import Client

ROOT=Path('.tmp/ai-director-sid007-cpu-event3'); ROOT.mkdir(parents=True,exist_ok=True)
prompt='A small robot dances on top of a table while repeatedly moving both arms vertically up and down, clearly not side to side. Full robot visible, stable table, static camera.'
out={'case':'sid_007','canonical_event':'And then the robot starts dancing by moving its arms up and down','action':'SEMANTIC_SPLIT_EVENT3_RESHOOT','space':'WeReCooking/ltx-2.3-cpu','prompt':prompt,'duration_sec':1.0,'steps':4,'seed':70073}
t0=time.time()
try:
    c=Client('WeReCooking/ltx-2.3-cpu',verbose=False)
    result=c.predict(prompt,None,[],0.6,False,1.0,4,70073,api_name='/generate')
    out['raw_result']=repr(result)
    candidates=[]
    def walk(x):
        if isinstance(x,str): candidates.append(x)
        elif isinstance(x,(list,tuple)):
            for v in x: walk(v)
        elif isinstance(x,dict):
            for v in x.values(): walk(v)
        else:
            p=getattr(x,'path',None)
            if p: candidates.append(str(p))
    walk(result)
    for x in candidates:
        p=Path(x)
        if p.exists() and p.suffix.lower() in {'.mp4','.mov','.webm'}:
            dest=ROOT/'sid007_event3_cpu_ltx23.mp4'; shutil.copy2(p,dest); out['output']=str(dest)
            cp=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size','-of','json',str(dest)],text=True,capture_output=True,check=True)
            out['output_probe']=json.loads(cp.stdout); break
    out['status']='EXECUTED_SUCCESS' if out.get('output') else 'EXECUTED_NO_MEDIA'
except Exception as e:
    out['status']='EXECUTOR_FAILURE'; out['execution_error']=f'{type(e).__name__}: {e}'; out['traceback']=traceback.format_exc()
out['elapsed_sec']=time.time()-t0
(ROOT/'result.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print(json.dumps(out,indent=2))
