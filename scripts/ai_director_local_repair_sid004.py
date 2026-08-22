from __future__ import annotations

import json
import shutil
import subprocess
import traceback
from pathlib import Path

from gradio_client import Client, handle_file
from huggingface_hub import hf_hub_download

ROOT=Path('.tmp/ai-director-local-repair-sid004')
ROOT.mkdir(parents=True,exist_ok=True)
raw=Path(hf_hub_download(repo_id='UBC-ViL/Spotlight-VideoGen-Errors',repo_type='dataset',filename='test/spotlight/ltx2/sid_004.mp4',local_dir=str(ROOT/'raw')))
source=ROOT/'source_73f.mp4'
mask=ROOT/'mask_73f.mp4'
result_json=ROOT/'repair_result.json'

subprocess.run(['ffmpeg','-y','-v','error','-i',str(raw),'-t','3.041667','-vf','fps=24','-an','-c:v','libx264','-preset','veryfast','-crf','18',str(source)],check=True)
subprocess.run(['ffmpeg','-y','-v','error','-f','lavfi','-i','color=c=black:s=1920x1080:r=24:d=3.041667','-vf','drawbox=x=620:y=150:w=1300:h=720:color=white:t=fill','-frames:v','73','-an','-c:v','libx264','-pix_fmt','yuv420p',str(mask)],check=True)

prompt=('A realistic hand inserts coins cleanly into the parking meter slot. '
        'After insertion, the digital parking time visibly increases in a physically plausible way. '
        'Preserve the parking meter, pole, street background, camera framing, and natural hand-object contact.')
out={'source':str(source),'mask':str(mask),'space':'ltx-community/ltx-2.3-inpaint','endpoint':'/inpaint','prompt':prompt,'preset':'Fast (768×448)','frames':73,'seed':404}

try:
    client=Client('ltx-community/ltx-2.3-inpaint',verbose=False)
    try:
        result=client.predict(handle_file(str(source)),handle_file(str(mask)),prompt,'Fast (768×448)',73,404,False,api_name='/inpaint')
    except Exception as first:
        # Some Gradio schema revisions expose the frame dropdown as string literals.
        out['first_call_error']=f'{type(first).__name__}: {first}'
        result=client.predict(handle_file(str(source)),handle_file(str(mask)),prompt,'Fast (768×448)','73',404,False,api_name='/inpaint')
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
            dest=ROOT/'sid_004_local_repair.mp4'
            shutil.copy2(p,dest)
            out['output']=str(dest)
            cp=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size','-of','json',str(dest)],text=True,capture_output=True,check=True)
            out['output_probe']=json.loads(cp.stdout)
            break
except Exception as exc:
    out['execution_error']=f'{type(exc).__name__}: {exc}'
    out['traceback']=traceback.format_exc()

result_json.write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(out,indent=2,ensure_ascii=False))
