from __future__ import annotations
import json, os, shutil, subprocess, time, traceback
from pathlib import Path
from gradio_client import Client

KEY=os.environ['SUBSHOT_KEY']
TASKS={
 'sid005_1':('sid_005',1,'A flamingo stands still on one leg, balanced naturally, full body visible, no walking, realistic flamingo anatomy.',50051),
 'sid005_2':('sid_005',2,'A flamingo calmly preens its feathers with its beak while remaining mostly in place, realistic bird anatomy and natural feather grooming.',50052),
 'sid018_1':('sid_018',1,'A closed book on a table opens itself naturally, with no hands or people touching it. The book is clearly closed first and then opens.',18001),
 'sid018_2':('sid_018',2,'An open book on a table with printed words visibly lifting up off the pages into the air as distinct floating text, stable camera.',18002),
 'sid018_3':('sid_018',3,'Floating words above an open book transform into clear visual images in the air, magical but coherent transformation, stable book and camera.',18003),
}
pid,idx,prompt,seed=TASKS[KEY]
ROOT=Path(f'.tmp/ai-director-wave2-{KEY}'); ROOT.mkdir(parents=True,exist_ok=True)
result={'key':KEY,'pid':pid,'subshot_index':idx,'prompt':prompt,'seed':seed,'space':'Upsampler/ltx-video','endpoint':'/generate_video','duration_sec':1.0}
t0=time.time()
try:
 c=Client('Upsampler/ltx-video',verbose=False)
 out=c.predict(None,prompt,1.0,False,seed,False,512,768,api_name='/generate_video')
 result['raw_result']=repr(out)
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
 walk(out)
 for x in candidates:
  p=Path(x)
  if p.exists() and p.suffix.lower() in {'.mp4','.mov','.webm'}:
   dest=ROOT/f'{KEY}.mp4'; shutil.copy2(p,dest); result['output']=str(dest)
   cp=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size','-of','json',str(dest)],text=True,capture_output=True,check=True)
   result['output_probe']=json.loads(cp.stdout); break
 result['status']='EXECUTED_SUCCESS' if result.get('output') else 'EXECUTED_NO_MEDIA'
except Exception as e:
 result['status']='EXECUTOR_FAILURE'; result['error']=f'{type(e).__name__}: {e}'; result['traceback']=traceback.format_exc()
result['elapsed_sec']=time.time()-t0
(ROOT/'result.json').write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(result,indent=2,ensure_ascii=False))
