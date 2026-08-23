from __future__ import annotations

import json
import shutil
import subprocess
import time
import traceback
from pathlib import Path

from gradio_client import Client, handle_file
from huggingface_hub import hf_hub_download

ROOT = Path('.tmp/ai-director-chained-i2v-sid003')
ROOT.mkdir(parents=True, exist_ok=True)
raw = Path(hf_hub_download(
    repo_id='UBC-ViL/Spotlight-VideoGen-Errors',
    repo_type='dataset',
    filename='test/spotlight/ltx2/sid_003.mp4',
    local_dir=str(ROOT / 'raw'),
))
anchor0 = ROOT / 'anchor_event0_1.12s.jpg'
subprocess.run(['ffmpeg','-y','-v','error','-ss','1.12','-i',str(raw),'-frames:v','1','-q:v','2',str(anchor0)],check=True)

prompts = [
    'The riderless bicycle in this exact intersection pedals itself forward toward the visible red traffic light and gradually slows down. It remains riderless. Preserve the exact bicycle, road, traffic light, houses, and camera framing.',
    'The same riderless bicycle completes its slowdown, comes to a complete stop at the red traffic light, and remains motionless waiting there. Preserve the exact bicycle, red light, road, houses, and camera framing.'
]
providers = ['Upsampler/ltx-video', 'Lightricks/ltx-2-distilled']
result = {'pid':'sid_003','action':'CHAINED_EVENT_I2V','anchor_sec':1.12,'events':[],'providers':providers}
current_anchor = anchor0
outputs=[]

for event_index, prompt in enumerate(prompts, 1):
    event={'event_index':event_index,'prompt':prompt,'anchor':str(current_anchor),'attempts':[]}
    for provider in providers:
        attempt={'provider':provider}
        t0=time.time()
        try:
            c=Client(provider,verbose=False)
            out=c.predict(handle_file(str(current_anchor)),prompt,1.0,False,33003+event_index-1,False,512,768,api_name='/generate_video')
            attempt['raw_result']=repr(out)
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
            copied=None
            for candidate in candidates:
                p=Path(candidate)
                if p.exists() and p.suffix.lower() in {'.mp4','.mov','.webm'}:
                    copied=ROOT/f'event_{event_index}.mp4'; shutil.copy2(p,copied); break
            if copied:
                probe=subprocess.run(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_read_frames','-show_entries','format=duration,size','-of','json',str(copied)],text=True,capture_output=True,check=True)
                attempt['status']='EXECUTED_SUCCESS'; attempt['output']=str(copied); attempt['output_probe']=json.loads(probe.stdout)
                event['selected_provider']=provider; event['output']=str(copied); event['status']='EXECUTED_SUCCESS'; outputs.append(copied)
            else:
                attempt['status']='EXECUTED_NO_MEDIA'
        except Exception as exc:
            attempt['status']='EXECUTOR_FAILURE'; attempt['error']=f'{type(exc).__name__}: {exc}'; attempt['traceback']=traceback.format_exc()
        attempt['elapsed_sec']=time.time()-t0; event['attempts'].append(attempt)
        if attempt['status']=='EXECUTED_SUCCESS': break
    result['events'].append(event)
    if event.get('status')!='EXECUTED_SUCCESS':
        result['status']='INCOMPLETE'; result['stop_reason']=f'event_{event_index}_failed'; break
    next_anchor=ROOT/f'anchor_event_{event_index}_last.jpg'
    subprocess.run(['ffmpeg','-y','-v','error','-sseof','-0.05','-i',str(outputs[-1]),'-frames:v','1','-q:v','2',str(next_anchor)],check=True)
    event['next_anchor']=str(next_anchor)
    current_anchor=next_anchor
else:
    final=ROOT/'sid_003_chained_event_i2v_2s.mp4'
    subprocess.run([
        'ffmpeg','-y','-v','error','-i',str(outputs[0]),'-i',str(outputs[1]),
        '-filter_complex','[0:v]fps=24,scale=768:512,setpts=PTS-STARTPTS[v0];[1:v]fps=24,scale=768:512,setpts=PTS-STARTPTS[v1];[v0][v1]concat=n=2:v=1:a=0[outv]',
        '-map','[outv]','-an','-c:v','libx264','-preset','veryfast','-crf','18',str(final)
    ],check=True)
    probe=subprocess.run(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_read_frames','-show_entries','format=duration,size','-of','json',str(final)],text=True,capture_output=True,check=True)
    result['status']='EXECUTED_SUCCESS'; result['final_output']=str(final); result['final_probe']=json.loads(probe.stdout)

result['elapsed_sec']=sum(a['elapsed_sec'] for e in result['events'] for a in e.get('attempts',[]))
(ROOT/'result.json').write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(result,indent=2,ensure_ascii=False))
