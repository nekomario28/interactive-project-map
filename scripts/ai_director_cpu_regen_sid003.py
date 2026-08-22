from __future__ import annotations
import argparse, json, shutil, subprocess, time, traceback
from pathlib import Path
from gradio_client import Client, handle_file
from huggingface_hub import hf_hub_download

ap=argparse.ArgumentParser(); ap.add_argument('--mode',choices=['fresh','backtrack'],required=True); args=ap.parse_args()
ROOT=Path(f'.tmp/ai-director-cpu-{args.mode}-sid003'); ROOT.mkdir(parents=True,exist_ok=True)
prompt='A bicycle pedals itself down the street, stops at a red light, and then continues when it turns green.'
image=None
if args.mode=='backtrack':
 raw=Path(hf_hub_download(repo_id='UBC-ViL/Spotlight-VideoGen-Errors',repo_type='dataset',filename='test/spotlight/ltx2/sid_003.mp4',local_dir=str(ROOT/'raw')))
 anchor=ROOT/'sid_003_anchor_1.12s.jpg'
 subprocess.run(['ffmpeg','-y','-v','error','-ss','1.12','-i',str(raw),'-frames:v','1','-q:v','2',str(anchor)],check=True)
 image=handle_file(str(anchor))

out={'mode':args.mode,'space':'WeReCooking/ltx-2.3-cpu','endpoint':'/generate','prompt':prompt,'duration_sec':2.0,'steps':4,'seed':33003,'anchor_sec':1.12 if args.mode=='backtrack' else None}
t0=time.time()
try:
 c=Client('WeReCooking/ltx-2.3-cpu',verbose=False)
 result=c.predict(prompt,image,[],0.6,False,2.0,4,33003,api_name='/generate')
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
   dest=ROOT/f'sid_003_{args.mode}_cpu_ltx23.mp4'; shutil.copy2(p,dest); out['output']=str(dest)
   cp=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size','-of','json',str(dest)],text=True,capture_output=True,check=True)
   out['output_probe']=json.loads(cp.stdout); break
 out['status']='EXECUTED_SUCCESS' if out.get('output') else 'EXECUTED_NO_MEDIA'
except Exception as e:
 out['status']='EXECUTOR_FAILURE'; out['execution_error']=f'{type(e).__name__}: {e}'; out['traceback']=traceback.format_exc()
out['elapsed_sec']=time.time()-t0
(ROOT/'result.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print(json.dumps(out,indent=2))
