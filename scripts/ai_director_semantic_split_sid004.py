from __future__ import annotations

import json, shutil, subprocess, time, traceback
from pathlib import Path
from gradio_client import Client

ROOT=Path('.tmp/ai-director-semantic-split-sid004')
ROOT.mkdir(parents=True,exist_ok=True)
subprompts=[
    'Close-up shot of a realistic hand cleanly inserting one coin into the slot of a street parking meter. Physically correct hand and coin contact.',
    'Close-up shot of a street parking meter digital display visibly increasing the remaining parking time after a coin was inserted.',
    'Close-up shot of the same kind of street parking meter display naturally beginning to count down the remaining time.'
]
result={'pid':'sid_004','action':'SEMANTIC_SPLIT_REGEN','duration_each_sec':1.0,'subprompts':subprompts,'segments':[]}
client=Client('Lightricks/LTX-2-3',verbose=False)
outputs=[]
for i,prompt in enumerate(subprompts,1):
    item={'index':i,'prompt':prompt,'seed':4040+i}
    t0=time.time()
    try:
        out=client.predict(None,prompt,1.0,False,4040+i,False,448,768,api_name='/generate_video')
        item['raw_result']=repr(out)
        candidates=[]
        def walk(x):
            if isinstance(x,str): candidates.append(x)
            elif isinstance(x,(list,tuple)):
                for v in x: walk(v)
            elif isinstance(x,dict):
                for v in x.values(): walk(v)
            else:
                q=getattr(x,'path',None)
                if q: candidates.append(str(q))
        walk(out)
        copied=None
        for c in candidates:
            q=Path(c)
            if q.exists() and q.suffix.lower() in {'.mp4','.mov','.webm'}:
                copied=ROOT/f'subshot_{i}.mp4'; shutil.copy2(q,copied); break
        if copied:
            item['status']='EXECUTED_SUCCESS'; item['output']=str(copied); outputs.append(copied)
        else:
            item['status']='EXECUTED_NO_MEDIA'
    except Exception as exc:
        item['status']='EXECUTOR_FAILURE'; item['error']=f'{type(exc).__name__}: {exc}'; item['traceback']=traceback.format_exc()
    item['elapsed_sec']=time.time()-t0
    result['segments'].append(item)
    # Do not continue spending provider quota after an infrastructure/resource failure.
    if item['status']!='EXECUTED_SUCCESS':
        result['stop_reason']=f'subshot_{i}_{item["status"]}'
        break

if len(outputs)==3:
    # Normalize independent generated shots into one 3-shot visual sequence.
    filter_parts=[]; labels=[]
    cmd=['ffmpeg','-y','-v','error']
    for p in outputs: cmd += ['-i',str(p)]
    for i in range(3):
        filter_parts.append(f'[{i}:v]scale=768:448:force_original_aspect_ratio=decrease,pad=768:448:(ow-iw)/2:(oh-ih)/2,fps=24,setpts=PTS-STARTPTS[v{i}]')
        labels.append(f'[v{i}]')
    filter_parts.append(''.join(labels)+'concat=n=3:v=1:a=0[outv]')
    final=ROOT/'sid_004_semantic_split_regen.mp4'
    cmd += ['-filter_complex',';'.join(filter_parts),'-map','[outv]','-an','-c:v','libx264','-preset','veryfast','-crf','18',str(final)]
    subprocess.run(cmd,check=True)
    result['final_output']=str(final)
    result['status']='EXECUTED_SUCCESS'
else:
    result['status']='INCOMPLETE'

(ROOT/'result.json').write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(result,indent=2,ensure_ascii=False))
