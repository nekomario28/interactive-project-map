from __future__ import annotations
import json, shutil, subprocess, time, traceback
from pathlib import Path
from gradio_client import Client, handle_file
from huggingface_hub import hf_hub_download

ROOT=Path('.tmp/ai-director-anatomy-i2v-sid021'); ROOT.mkdir(parents=True,exist_ok=True)
raw=Path(hf_hub_download(repo_id='UBC-ViL/Spotlight-VideoGen-Errors',repo_type='dataset',filename='test/spotlight/ltx2/sid_021.mp4',local_dir=str(ROOT/'raw')))
anchor=ROOT/'sid_021_anchor_0.90s.jpg'
subprocess.run(['ffmpeg','-y','-v','error','-ss','0.90','-i',str(raw),'-frames:v','1','-q:v','2',str(anchor)],check=True)
prompt=(
 'The exact same cat remains naturally seated inside the exact same box. '
 'It slowly pokes only its head up and out over the box edge while keeping a continuous anatomically correct neck, torso, shoulders, and forelegs. '
 'Its left forepaw lowers naturally to support its body against the box edge. '
 'No body parts disappear, merge, stretch, or detach. Preserve the same cat identity, box, room, lighting, and camera framing.'
)
providers=['Upsampler/ltx-video','Lightricks/ltx-2-distilled']
result={'pid':'sid_021','action':'ANATOMY_CONTACT_ANCHOR_I2V','anchor_sec':0.90,'prompt':prompt,'attempts':[]}
for provider in providers:
 a={'provider':provider}; t=time.time()
 try:
  c=Client(provider,verbose=False)
  out=c.predict(handle_file(str(anchor)),prompt,1.0,False,21021,False,512,768,api_name='/generate_video')
  a['raw_result']=repr(out); candidates=[]
  def walk(x):
   if isinstance(x,str): candidates.append(x)
   elif isinstance(x,(list,tuple)):
    for v in x: walk(v)
   elif isinstance(x,dict):
    for v in x.values(): walk(v)
   else:
    p=getattr(x,'path',None)
    if p: candidates.append(str(p))
  walk(out); copied=None
  for cp in candidates:
   p=Path(cp)
   if p.exists() and p.suffix.lower() in {'.mp4','.mov','.webm'}:
    copied=ROOT/'sid_021_anatomy_i2v.mp4'; shutil.copy2(p,copied); break
  if copied:
   probe=subprocess.run(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_read_frames','-show_entries','format=duration,size','-of','json',str(copied)],text=True,capture_output=True,check=True)
   a['status']='EXECUTED_SUCCESS'; a['output']=str(copied); a['output_probe']=json.loads(probe.stdout); result['status']='EXECUTED_SUCCESS'; result['selected_provider']=provider; result['output']=str(copied)
  else: a['status']='EXECUTED_NO_MEDIA'
 except Exception as e:
  a['status']='EXECUTOR_FAILURE'; a['error']=f'{type(e).__name__}: {e}'; a['traceback']=traceback.format_exc()
 a['elapsed_sec']=time.time()-t; result['attempts'].append(a)
 if a['status']=='EXECUTED_SUCCESS': break
if result.get('status')!='EXECUTED_SUCCESS': result['status']='ALL_PROVIDERS_FAILED'
result['elapsed_sec']=sum(a['elapsed_sec'] for a in result['attempts'])
(ROOT/'result.json').write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(result,indent=2,ensure_ascii=False))
