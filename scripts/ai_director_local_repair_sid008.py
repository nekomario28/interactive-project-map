from __future__ import annotations
import json, shutil, subprocess, time, traceback
from pathlib import Path
from gradio_client import Client, handle_file
from huggingface_hub import hf_hub_download

ROOT=Path('.tmp/ai-director-repair')
ROOT.mkdir(parents=True, exist_ok=True)
raw=Path(hf_hub_download(repo_id='UBC-ViL/Spotlight-VideoGen-Errors', repo_type='dataset', filename='test/spotlight/ltx2/sid_008.mp4', local_dir=str(ROOT/'raw')))
input_clip=ROOT/'sid_008_input_3.04s.mp4'
mask=ROOT/'sid_008_mask_3.04s.mp4'
# Normalize to the public inpaint Space fast preset geometry and 24 fps / 73 frames.
subprocess.run(['ffmpeg','-y','-v','error','-i',str(raw),'-t','3.041667','-vf','fps=24,scale=768:448','-an','-frames:v','73','-c:v','libx264','-crf','18',str(input_clip)],check=True)
# Broad spatial mask covering the mother/joey action region; intentionally preserves background edges.
subprocess.run(['ffmpeg','-y','-v','error','-f','lavfi','-i','color=c=black:s=768x448:r=24:d=3.041667','-vf','drawbox=x=150:y=55:w=500:h=393:color=white:t=fill','-frames:v','73','-an','-c:v','libx264','-crf','0',str(mask)],check=True)
result={'pid':'sid_008','action':'LOCAL_REPAIR_INPAINT','input':str(input_clip),'mask':str(mask)}
prompt='A kangaroo joey peeks naturally from its mother kangaroo pouch, hops out with anatomically correct legs and body, then begins to run away. Preserve the outdoor scene and realistic kangaroo appearance.'
t0=time.time()
try:
    c=Client('ltx-community/ltx-2.3-inpaint',verbose=False)
    out=c.predict(handle_file(str(input_clip)),handle_file(str(mask)),prompt,'Fast (768×448)',73,42008,False,api_name='/inpaint')
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
    copied=None
    for cpath in candidates:
        p=Path(cpath)
        if p.exists() and p.suffix.lower() in {'.mp4','.mov','.webm'}:
            copied=ROOT/'sid_008_local_repair.mp4'; shutil.copy2(p,copied); break
    result['copied_output']=str(copied) if copied else None
    result['status']='EXECUTED_SUCCESS' if copied else 'EXECUTED_NO_MEDIA'
except Exception as exc:
    result['status']='RESOURCE_OR_PROVIDER_FAILURE'
    result['error']=f'{type(exc).__name__}: {exc}'
    result['traceback']=traceback.format_exc()
result['elapsed_sec']=time.time()-t0
(ROOT/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
