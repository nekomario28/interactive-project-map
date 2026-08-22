from __future__ import annotations

import json
import shutil
import subprocess
import traceback
from pathlib import Path

from gradio_client import Client, handle_file
from huggingface_hub import hf_hub_download

ROOT = Path('.tmp/ai-director')
RAW = ROOT / 'raw'
OUT = ROOT / 'outcomes'
ROOT.mkdir(parents=True, exist_ok=True)
RAW.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

CASES = ['sid_003','sid_004','sid_005','sid_007','sid_008','sid_013','sid_015','sid_017','sid_018','sid_021']
SAFE = {
    'sid_003': [(0.0, 1.2), (7.6, 8.0)],
    'sid_004': [(0.0, 1.1), (6.1, 8.0)],
    'sid_005': [(6.0, 8.0)],
    'sid_007': [(0.0, 0.5), (6.1, 8.0)],
    'sid_008': [(0.0, 0.01), (3.0, 4.0), (6.0, 8.0)],
    'sid_013': [(0.0, 0.4), (4.5, 4.8), (6.1, 8.0)],
    'sid_015': [(0.0, 0.5), (2.5, 4.5), (7.2, 8.0)],
    'sid_017': [(0.0, 1.5), (6.0, 8.0)],
    'sid_018': [],
    'sid_021': [(0.0, 1.0), (2.0, 2.1), (6.1, 8.0)],
}
TARGET = 3.0


def run(cmd: list[str], *, check: bool = True) -> subprocess.CompletedProcess:
    print('+', ' '.join(cmd), flush=True)
    return subprocess.run(cmd, text=True, check=check, capture_output=False)


def ffprobe(path: Path) -> dict:
    cp = subprocess.run([
        'ffprobe','-v','error','-show_entries','format=duration,size',
        '-show_entries','stream=codec_name,width,height,r_frame_rate',
        '-of','json',str(path)
    ], text=True, capture_output=True, check=True)
    return json.loads(cp.stdout)


def select_until_target(intervals: list[tuple[float,float]], target: float) -> list[tuple[float,float]]:
    selected = []
    remaining = target
    for s,e in intervals:
        if remaining <= 1e-6:
            break
        d = e-s
        if d <= 0:
            continue
        take = min(d, remaining)
        selected.append((s, s+take))
        remaining -= take
    return selected if remaining <= 1e-6 else []


def create_split(input_path: Path, output_path: Path, intervals: list[tuple[float,float]]) -> dict:
    selected = select_until_target(intervals, TARGET)
    if not selected:
        return {'status':'insufficient_clean_total','selected':[], 'output':None}
    filters=[]
    labels=[]
    for i,(s,e) in enumerate(selected):
        filters.append(f'[0:v]trim=start={s}:end={e},setpts=PTS-STARTPTS[v{i}]')
        labels.append(f'[v{i}]')
    filters.append(''.join(labels)+f'concat=n={len(selected)}:v=1:a=0[outv]')
    output_path.parent.mkdir(parents=True, exist_ok=True)
    run([
        'ffmpeg','-y','-v','error','-i',str(input_path),
        '-filter_complex',';'.join(filters),'-map','[outv]','-an',
        '-t',f'{TARGET:.3f}','-c:v','libx264','-preset','veryfast','-crf','18',str(output_path)
    ])
    return {'status':'created','selected':selected,'output':str(output_path),'probe':ffprobe(output_path)}


def copy_generated(result, dest: Path) -> str | None:
    candidates=[]
    def walk(x):
        if isinstance(x, str):
            candidates.append(x)
        elif isinstance(x, dict):
            for v in x.values(): walk(v)
        elif isinstance(x, (list,tuple)):
            for v in x: walk(v)
        else:
            p = getattr(x, 'path', None)
            if p: candidates.append(str(p))
    walk(result)
    for c in candidates:
        p=Path(c)
        if p.exists() and p.suffix.lower() in {'.mp4','.mov','.webm'}:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p,dest)
            return str(dest)
    return None


# Download canonical metadata and all ten real LTX-2 clips.
meta_path = Path(hf_hub_download(
    repo_id='UBC-ViL/Spotlight-VideoGen-Errors', repo_type='dataset',
    filename='test/metadata.jsonl', local_dir=str(RAW)
))
records={}
for line in meta_path.read_text(encoding='utf-8').splitlines():
    row=json.loads(line)
    if row.get('pid') in CASES and row.get('video_from') == 'ltx2':
        records[row['pid']] = row

raw_paths={}
for pid in CASES:
    raw_paths[pid] = Path(hf_hub_download(
        repo_id='UBC-ViL/Spotlight-VideoGen-Errors', repo_type='dataset',
        filename=f'test/spotlight/ltx2/{pid}.mp4', local_dir=str(RAW)
    ))

# Real split-shot edits.
split_results={}
for pid in CASES:
    split_results[pid] = {
        'source_probe': ffprobe(raw_paths[pid]),
        **create_split(raw_paths[pid], OUT/'split-shot'/f'{pid}.mp4', SAFE[pid]),
    }
(ROOT/'split_results.json').write_text(json.dumps(split_results, indent=2), encoding='utf-8')

# Extract a real clean-prefix anchor for sid_003 immediately before the first annotated failure (1.2 s).
anchor = OUT/'backtrack'/'sid_003_anchor_1.12s.jpg'
anchor.parent.mkdir(parents=True, exist_ok=True)
run(['ffmpeg','-y','-v','error','-ss','1.12','-i',str(raw_paths['sid_003']),'-frames:v','1','-q:v','2',str(anchor)])

# Probe exact current Gradio API schemas and attempt one true fresh generation + one anchor-conditioned generation.
provider_results={}
for space in ['Lightricks/LTX-2-3','ltx-community/ltx-2.3-inpaint']:
    try:
        c=Client(space, verbose=False)
        provider_results[space]={'api': c.view_api(all_endpoints=True, print_info=False, return_format='dict')}
    except Exception as exc:
        provider_results[space]={'probe_error':f'{type(exc).__name__}: {exc}'}

ltx = provider_results.get('Lightricks/LTX-2-3', {})
api = ltx.get('api') or {}
named = api.get('named_endpoints') or {}
endpoint = '/generate_video' if '/generate_video' in named else next((k for k in named if 'generate' in k.lower()), None)
provider_results['selected_generation_endpoint']=endpoint

prompt = records['sid_003']['prompt']
if endpoint:
    client=Client('Lightricks/LTX-2-3', verbose=False)
    attempts=[
        ('fresh_regenerate', None, OUT/'fresh-regenerate'/'sid_003_ltx23.mp4', 31003),
        ('backtrack_i2v', handle_file(str(anchor)), OUT/'backtrack'/'sid_003_ltx23_from_clean_prefix.mp4', 32003),
    ]
    for name,image,dest,seed in attempts:
        try:
            # Exact app input order: image, prompt, duration, enhance, seed, randomize, height, width.
            result=client.predict(image, prompt, 3.0, False, seed, False, 512, 768, api_name=endpoint)
            copied=copy_generated(result,dest)
            provider_results[name]={'raw_result':repr(result),'copied_output':copied}
            if copied:
                provider_results[name]['probe']=ffprobe(Path(copied))
        except Exception as exc:
            provider_results[name]={'error':f'{type(exc).__name__}: {exc}','traceback':traceback.format_exc()}
else:
    provider_results['fresh_regenerate']={'error':'no callable named generation endpoint discovered'}
    provider_results['backtrack_i2v']={'error':'no callable named generation endpoint discovered'}

(ROOT/'provider_results.json').write_text(json.dumps(provider_results, indent=2, default=str), encoding='utf-8')
(ROOT/'prompts.json').write_text(json.dumps({p: records[p]['prompt'] for p in CASES}, indent=2), encoding='utf-8')
print(json.dumps({'split':split_results,'provider':provider_results}, indent=2, default=str))
