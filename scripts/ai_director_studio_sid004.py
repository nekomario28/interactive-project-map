from __future__ import annotations

import json
import shutil
import subprocess
import time
import traceback
from pathlib import Path

from gradio_client import Client

ROOT = Path('.tmp/ai-director-studio-sid004')
ROOT.mkdir(parents=True, exist_ok=True)
RESULT = ROOT / 'result.json'
SPACE = 'techfreakworm/LTX2.3-Studio'
PROMPTS = [
    'Close-up cinematic shot of a realistic hand cleanly inserting one coin into the slot of a street parking meter. Physically correct hand, coin, and slot contact. The coin visibly enters the slot.',
    'Close-up cinematic shot of a street parking meter digital display visibly increasing the remaining parking time after a coin was inserted. The display is stable and readable as the time increases.',
    'Close-up cinematic shot of a street parking meter digital display naturally beginning to count down the remaining parking time. Stable meter and camera, plausible digital timer change.',
]

result = {
    'pid': 'sid_004',
    'action': 'SEMANTIC_SPLIT_REGEN',
    'space': SPACE,
    'endpoint': '/handler',
    'segments': [],
}
RESULT.write_text(json.dumps(result, indent=2), encoding='utf-8')
client = Client(SPACE, verbose=False)
outputs = []

for i, prompt in enumerate(PROMPTS, 1):
    item = {'index': i, 'prompt': prompt, 'seed': 5040 + i}
    t0 = time.time()
    try:
        # t2v input order from app.py _input_keys_for_mode():
        # prompt,preset,width,height,seconds,fps,seed,randomize_seed,
        # negative_prompt,camera_lora,camera_strength,detailer_on,detailer_strength
        out = client.predict(
            prompt, 'Fast', 512, 512, 1, 24, 5040 + i, False,
            '', 'none', 0.8, False, 0.5,
            api_name='/handler',
        )
        item['raw_result'] = repr(out)
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
        for c in candidates:
            q=Path(c)
            if q.exists() and q.suffix.lower() in {'.mp4','.mov','.webm'}:
                copied=ROOT/f'subshot_{i}.mp4'; shutil.copy2(q,copied); break
        if copied:
            probe=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size','-of','json',str(copied)],text=True,capture_output=True,check=True)
            item['status']='EXECUTED_SUCCESS'; item['output']=str(copied); item['probe']=json.loads(probe.stdout); outputs.append(copied)
        else:
            # Some streaming Gradio handlers return status HTML as well as the video.
            item['status']='EXECUTED_NO_MEDIA'
    except Exception as exc:
        item['status']='EXECUTOR_FAILURE'; item['error']=f'{type(exc).__name__}: {exc}'; item['traceback']=traceback.format_exc()
    item['elapsed_sec']=time.time()-t0
    result['segments'].append(item)
    RESULT.write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps(item,indent=2,ensure_ascii=False),flush=True)
    if item['status']!='EXECUTED_SUCCESS':
        result['stop_reason']=f'subshot_{i}_{item["status"]}'; break

if len(outputs)==3:
    cmd=['ffmpeg','-y','-v','error']
    filters=[]; labels=[]
    for p in outputs: cmd += ['-i',str(p)]
    for i in range(3):
        filters.append(f'[{i}:v]scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2,fps=24,setpts=PTS-STARTPTS[v{i}]'); labels.append(f'[v{i}]')
    filters.append(''.join(labels)+'concat=n=3:v=1:a=0[outv]')
    final=ROOT/'sid_004_studio_semantic_split.mp4'
    cmd += ['-filter_complex',';'.join(filters),'-map','[outv]','-an','-c:v','libx264','-preset','veryfast','-crf','18',str(final)]
    subprocess.run(cmd,check=True)
    result['status']='EXECUTED_SUCCESS'; result['final_output']=str(final)
else:
    result['status']='INCOMPLETE'
RESULT.write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(result,indent=2,ensure_ascii=False),flush=True)
