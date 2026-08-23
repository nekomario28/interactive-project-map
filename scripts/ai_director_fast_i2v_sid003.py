from __future__ import annotations

import json
import shutil
import subprocess
import time
import traceback
from pathlib import Path

from gradio_client import Client, handle_file
from huggingface_hub import hf_hub_download

ROOT = Path('.tmp/ai-director-fast-i2v-sid003')
ROOT.mkdir(parents=True, exist_ok=True)
raw = Path(hf_hub_download(
    repo_id='UBC-ViL/Spotlight-VideoGen-Errors',
    repo_type='dataset',
    filename='test/spotlight/ltx2/sid_003.mp4',
    local_dir=str(ROOT / 'raw'),
))
anchor = ROOT / 'sid_003_anchor_1.12s.jpg'
subprocess.run([
    'ffmpeg','-y','-v','error','-ss','1.12','-i',str(raw),
    '-frames:v','1','-q:v','2',str(anchor)
], check=True)

prompt = (
    'The riderless bicycle in this exact intersection pedals itself forward. '
    'It remains riderless, stops at the visible red traffic light, and waits there. '
    'Preserve the same bicycle, intersection, camera framing, road, and traffic light.'
)
providers = ['Upsampler/ltx-video', 'Lightricks/ltx-2-distilled']
result = {
    'pid': 'sid_003',
    'action': 'BACKTRACK_I2V_PROXY_FAST',
    'anchor_sec': 1.12,
    'anchor': str(anchor),
    'duration_sec': 1.0,
    'height': 512,
    'width': 768,
    'seed': 33003,
    'prompt': prompt,
    'attempts': [],
}

for provider in providers:
    attempt = {'provider': provider}
    t0 = time.time()
    try:
        c = Client(provider, verbose=False)
        out = c.predict(
            handle_file(str(anchor)),
            prompt,
            1.0,
            False,
            33003,
            False,
            512,
            768,
            api_name='/generate_video',
        )
        attempt['raw_result'] = repr(out)
        candidates = []
        def walk(x):
            if isinstance(x, str):
                candidates.append(x)
            elif isinstance(x, (list, tuple)):
                for v in x: walk(v)
            elif isinstance(x, dict):
                for v in x.values(): walk(v)
            else:
                p = getattr(x, 'path', None)
                if p: candidates.append(str(p))
        walk(out)
        copied = None
        for candidate in candidates:
            p = Path(candidate)
            if p.exists() and p.suffix.lower() in {'.mp4','.mov','.webm'}:
                copied = ROOT / 'sid_003_fast_backtrack_i2v.mp4'
                shutil.copy2(p, copied)
                break
        if copied:
            probe = subprocess.run([
                'ffprobe','-v','error','-count_frames','-select_streams','v:0',
                '-show_entries','stream=width,height,r_frame_rate,nb_read_frames',
                '-show_entries','format=duration,size','-of','json',str(copied)
            ], text=True, capture_output=True, check=True)
            attempt['status'] = 'EXECUTED_SUCCESS'
            attempt['output'] = str(copied)
            attempt['output_probe'] = json.loads(probe.stdout)
            result['selected_provider'] = provider
            result['output'] = str(copied)
            result['status'] = 'EXECUTED_SUCCESS'
        else:
            attempt['status'] = 'EXECUTED_NO_MEDIA'
    except Exception as exc:
        attempt['status'] = 'EXECUTOR_FAILURE'
        attempt['error'] = f'{type(exc).__name__}: {exc}'
        attempt['traceback'] = traceback.format_exc()
    attempt['elapsed_sec'] = time.time() - t0
    result['attempts'].append(attempt)
    if attempt['status'] == 'EXECUTED_SUCCESS':
        break

if result.get('status') != 'EXECUTED_SUCCESS':
    result['status'] = 'ALL_PROVIDERS_FAILED'
result['elapsed_sec'] = sum(a['elapsed_sec'] for a in result['attempts'])
(ROOT / 'result.json').write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')
print(json.dumps(result, indent=2, ensure_ascii=False))
