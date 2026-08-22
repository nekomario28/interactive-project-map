from __future__ import annotations

import json
import shutil
import subprocess
import time
import traceback
from pathlib import Path

from gradio_client import Client, handle_file
from huggingface_hub import hf_hub_download

ROOT=Path('.tmp/ai-director-local-repair-sid004')
ROOT.mkdir(parents=True,exist_ok=True)
raw=Path(hf_hub_download(repo_id='UBC-ViL/Spotlight-VideoGen-Errors',repo_type='dataset',filename='test/spotlight/ltx2/sid_004.mp4',local_dir=str(ROOT/'raw')))
source=ROOT/'source_49f_from_1.1s.mp4'
mask=ROOT/'mask_49f.mp4'
result_json=ROOT/'repair_result.json'

# First-failure refinement: 73 frames requested an estimated 418 GPU seconds, above the Space maximum.
# Reduce to the minimum supported 49 frames and target only the first failing region, beginning at 1.1s.
subprocess.run(['ffmpeg','-y','-v','error','-ss','1.1','-i',str(raw),'-t','2.041667','-vf','fps=24','-an','-frames:v','49','-c:v','libx264','-preset','veryfast','-crf','18',str(source)],check=True)
subprocess.run(['ffmpeg','-y','-v','error','-f','lavfi','-i','color=c=black:s=1920x1080:r=24:d=2.041667','-vf','drawbox=x=620:y=150:w=1300:h=720:color=white:t=fill','-frames:v','49','-an','-c:v','libx264','-pix_fmt','yuv420p',str(mask)],check=True)

prompt=('A realistic hand inserts coins cleanly into the parking meter slot. '
        'After insertion, the digital parking time visibly increases in a physically plausible way. '
        'Preserve the parking meter, pole, street background, camera framing, and natural hand-object contact.')
out={'source':str(source),'source_start_sec':1.1,'mask':str(mask),'space':'ltx-community/ltx-2.3-inpaint','endpoint':'/inpaint','prompt':prompt,'preset':'Fast (768×448)','frames':49,'seed':404}
t0=time.time()
try:
    client=Client('ltx-community/ltx-2.3-inpaint',verbose=False)
    result=client.predict(handle_file(str(source)),handle_file(str(mask)),prompt,'Fast (768×448)',49,404,False,api_name='/inpaint')
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
    for c in candidates:
        p=Path(c)
        if p.exists() and p.suffix.lower() in {'.mp4','.mov','.webm'}:
            dest=ROOT/'sid_004_local_repair_49f.mp4'
            shutil.copy2(p,dest)
            out['output']=str(dest)
            cp=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size','-of','json',str(dest)],text=True,capture_output=True,check=True)
            out['output_probe']=json.loads(cp.stdout)
            break
    out['status']='EXECUTED_SUCCESS' if out.get('output') else 'EXECUTED_NO_MEDIA'
except Exception as exc:
    out['status']='EXECUTOR_FAILURE'
    out['execution_error']=f'{type(exc).__name__}: {exc}'
    out['traceback']=traceback.format_exc()
out['elapsed_sec']=time.time()-t0
result_json.write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(out,indent=2,ensure_ascii=False))
