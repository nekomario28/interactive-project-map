from __future__ import annotations
import json, traceback, shutil, subprocess, time
from pathlib import Path
from gradio_client import Client, handle_file
from huggingface_hub import hf_hub_download

ROOT=Path('.tmp/ai-director-minimax-inpaint-health'); ROOT.mkdir(parents=True,exist_ok=True)
out={
  'space':'linoyts/minimax-h3-inpainting',
  'case':'sid_004',
  'action':'LOCAL_INPAINT_REPAIR_ALT',
  'start_sec':1.1,
  'duration_sec':2.0,
  'status':'UNKNOWN'
}

def candidates(x):
    vals=[]
    def walk(v):
        if isinstance(v,str): vals.append(v)
        elif isinstance(v,(list,tuple)):
            for q in v: walk(q)
        elif isinstance(v,dict):
            for q in v.values(): walk(q)
        else:
            p=getattr(v,'path',None)
            if p: vals.append(str(p))
    walk(x); return vals

def first_media(x, suffixes):
    for s in candidates(x):
        p=Path(s)
        if p.exists() and p.suffix.lower() in suffixes: return p
    return None

t0=time.time()
try:
    raw=Path(hf_hub_download(
      repo_id='UBC-ViL/Spotlight-VideoGen-Errors',repo_type='dataset',
      filename='test/spotlight/ltx2/sid_004.mp4',local_dir=str(ROOT/'raw')))
    c=Client('linoyts/minimax-h3-inpainting',verbose=False)
    instruction=('Repair the coin insertion and parking-meter interaction. '
                 'Keep the same meter, pole, street, camera, and hand. '
                 'The coin must visibly enter the slot and the display should visibly increase afterward.')
    plan=c.predict(handle_file(str(raw)),instruction,1.1,2.0,[],24,api_name='/plan_and_mask')
    out['plan_result']=repr(plan)
    if not isinstance(plan,(list,tuple)) or len(plan)<2:
        raise RuntimeError(f'unexpected plan_and_mask result: {plan!r}')
    rendered_prompt=plan[0] if isinstance(plan[0],str) else instruction
    mask=first_media(plan[1],{'.mp4','.mov','.webm'}) or first_media(plan,{'.mp4','.mov','.webm'})
    if not mask:
        raise RuntimeError('plan_and_mask returned no local mask video')
    mask_dest=ROOT/'planned_mask.mp4'; shutil.copy2(mask,mask_dest)
    out['rendered_prompt']=rendered_prompt
    out['mask']=str(mask_dest)
    gen=c.predict(
      handle_file(str(raw)), rendered_prompt, [], handle_file(str(mask_dest)),
      404, True, 8, 'Full · 768 short edge', True, 0.5, 'Balanced · 768',
      False, False, 1.1, 2.0, None, None, True,
      api_name='/generate')
    out['generate_result']=repr(gen)
    media=first_media(gen,{'.mp4','.mov','.webm'})
    if not media:
        out['status']='EXECUTED_NO_MEDIA'
    else:
        dest=ROOT/'sid_004_minimax_h3_local_repair.mp4'; shutil.copy2(media,dest)
        out['output']=str(dest)
        cp=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size','-of','json',str(dest)],capture_output=True,text=True,check=True)
        out['output_probe']=json.loads(cp.stdout)
        out['status']='EXECUTED_SUCCESS'
except Exception as e:
    out['status']='EXECUTOR_FAILURE'; out['error']=f'{type(e).__name__}: {e}'; out['traceback']=traceback.format_exc()
out['elapsed_sec']=time.time()-t0
shutil.rmtree(ROOT/'raw',ignore_errors=True)
(ROOT/'result.json').write_text(json.dumps(out,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
print(json.dumps(out,ensure_ascii=False,indent=2,default=str))
