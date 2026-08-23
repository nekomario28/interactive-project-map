from __future__ import annotations
import json, traceback, shutil, subprocess, time
from pathlib import Path
from gradio_client import Client, handle_file
from huggingface_hub import hf_hub_download

ROOT=Path('.tmp/ai-director-minimax-inpaint-health'); ROOT.mkdir(parents=True,exist_ok=True)
out={'space':'linoyts/minimax-h3-inpainting','case':'sid_004','action':'LOCAL_INPAINT_REPAIR_ALT_MANUAL_MASK','start_sec':1.1,'duration_sec':2.0,'status':'UNKNOWN'}

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

def first_media(x):
    for s in candidates(x):
        p=Path(s)
        if p.exists() and p.suffix.lower() in {'.mp4','.mov','.webm'}: return p
    return None

t0=time.time()
try:
    raw=Path(hf_hub_download(repo_id='UBC-ViL/Spotlight-VideoGen-Errors',repo_type='dataset',filename='test/spotlight/ltx2/sid_004.mp4',local_dir=str(ROOT/'raw')))
    probe=subprocess.run(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate','-of','json',str(raw)],capture_output=True,text=True,check=True)
    stream=json.loads(probe.stdout)['streams'][0]; w=int(stream['width']); h=int(stream['height'])
    out['source_geometry']={'width':w,'height':h,'r_frame_rate':stream.get('r_frame_rate')}
    x=int(w*0.30); y=int(h*0.12); bw=w-x; bh=int(h*0.72)
    mask=ROOT/'manual_mask_2s.mp4'
    vf=f'drawbox=x={x}:y={y}:w={bw}:h={bh}:color=white:t=fill'
    subprocess.run(['ffmpeg','-y','-v','error','-f','lavfi','-i',f'color=c=black:s={w}x{h}:r=24:d=2.0','-vf',vf,'-frames:v','48','-an','-c:v','libx264','-pix_fmt','yuv420p',str(mask)],check=True)
    out['mask']=str(mask); out['mask_box']={'x':x,'y':y,'w':bw,'h':bh}
    prompt=('Preserve the original parking meter, pole, street background, camera framing, lighting, and person. '
            'Only repair the masked hand, coin, meter slot, and display interaction: the coin visibly enters the slot with physically correct contact, '
            'then the parking-time display visibly increases. Keep all unmasked content unchanged and temporally coherent.')
    c=Client('linoyts/minimax-h3-inpainting',verbose=False)
    gen=c.predict(handle_file(str(raw)),prompt,[],handle_file(str(mask)),404,True,8,'Full · 768 short edge',True,0.5,'Balanced · 768',False,False,1.1,2.0,None,None,True,api_name='/generate')
    out['generate_result']=repr(gen)
    media=first_media(gen)
    if not media:
        out['status']='EXECUTED_NO_MEDIA'
    else:
        dest=ROOT/'sid_004_minimax_h3_local_repair.mp4'; shutil.copy2(media,dest); out['output']=str(dest)
        cp=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size','-of','json',str(dest)],capture_output=True,text=True,check=True)
        out['output_probe']=json.loads(cp.stdout); out['status']='EXECUTED_SUCCESS'
except Exception as e:
    out['status']='EXECUTOR_FAILURE'; out['error']=f'{type(e).__name__}: {e}'; out['traceback']=traceback.format_exc()
out['elapsed_sec']=time.time()-t0
shutil.rmtree(ROOT/'raw',ignore_errors=True)
(ROOT/'result.json').write_text(json.dumps(out,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
print(json.dumps(out,ensure_ascii=False,indent=2,default=str))
