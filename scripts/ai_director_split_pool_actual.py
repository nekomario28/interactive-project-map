from __future__ import annotations

import csv, json, subprocess
from pathlib import Path
from huggingface_hub import hf_hub_download

ROOT=Path('.tmp/ai-director-split-pool')
ROOT.mkdir(parents=True,exist_ok=True)
REPO='UBC-ViL/Spotlight-VideoGen-Errors'
TARGET=3.0
CASES={
 'sid_001':('seedance',[(0,0.8),(1.5,1.6),(2.3,5.042)]),
 'sid_002':('ltx2',[(1.6,1.9),(2.8,3.1),(3.7,6.12)]),
 'sid_008':('ltx2',[(0,0.01),(3.0,4.0),(6.0,8.04)]),
 'sid_010':('veo3',[(0,1.6),(3.3,6.0)]),
 'sid_014':('veo3',[(1.9,3.0),(4.0,6.0)]),
 'sid_015':('ltx2',[(0,0.5),(2.5,4.5),(7.2,8.04)]),
}

def probe(path):
 cp=subprocess.run(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames,r_frame_rate','-show_entries','format=duration,size','-of','json',str(path)],text=True,capture_output=True,check=True)
 return json.loads(cp.stdout)

def select(intervals,target):
 out=[]; rem=target
 for s,e in intervals:
  if rem<=1e-9: break
  d=e-s
  if d<=0: continue
  take=min(d,rem); out.append((s,s+take)); rem-=take
 return out if rem<=1e-6 else []

rows=[]
for pid,(model,intervals) in CASES.items():
 src=Path(hf_hub_download(repo_id=REPO,repo_type='dataset',filename=f'test/spotlight/{model}/{pid}.mp4',local_dir=str(ROOT/'raw')))
 chosen=select(intervals,TARGET)
 out=ROOT/f'{pid}_{model}_split_3s.mp4'
 filters=[]; labels=[]
 for i,(s,e) in enumerate(chosen):
  filters.append(f'[0:v]trim=start={s}:end={e},setpts=PTS-STARTPTS[v{i}]'); labels.append(f'[v{i}]')
 filters.append(''.join(labels)+f'concat=n={len(chosen)}:v=1:a=0[outv]')
 subprocess.run(['ffmpeg','-y','-v','error','-i',str(src),'-filter_complex',';'.join(filters),'-map','[outv]','-an','-c:v','libx264','-preset','veryfast','-crf','18',str(out)],check=True)
 pr=probe(out)
 rows.append({'pid':pid,'model':model,'selected_intervals':chosen,'source_probe':probe(src),'output':str(out),'output_probe':pr})
 print(json.dumps(rows[-1],default=str),flush=True)
(ROOT/'results.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
# raw source videos are intentionally not part of final artifact
