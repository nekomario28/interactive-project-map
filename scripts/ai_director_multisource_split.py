from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from huggingface_hub import hf_hub_download

ROOT = Path('.tmp/ai-director-multisource-split')
RAW = ROOT / 'raw'
ROOT.mkdir(parents=True, exist_ok=True)

REPO = 'UBC-ViL/Spotlight-VideoGen-Errors'

PLANS = {
    'sid_013': [
        {'model': 'ltx2', 'start': 6.10, 'duration': 1.94},
        {'model': 'seedance', 'start': 0.00, 'duration': 1.06},
    ],
    'sid_017': [
        {'model': 'ltx2', 'start': 0.00, 'duration': 1.50},
        {'model': 'veo3', 'start': 0.00, 'duration': 0.80},
        {'model': 'veo3', 'start': 6.80, 'duration': 0.70},
    ],
}

results = []
for pid, plan in PLANS.items():
    case_dir = ROOT / pid
    case_dir.mkdir(parents=True, exist_ok=True)
    segments = []
    for i, item in enumerate(plan, 1):
        filename = f'test/spotlight/{item["model"]}/{pid}.mp4'
        src = Path(hf_hub_download(
            repo_id=REPO,
            repo_type='dataset',
            filename=filename,
            local_dir=str(RAW),
        ))
        seg = case_dir / f'seg_{i}_{item["model"]}.mp4'
        subprocess.run([
            'ffmpeg', '-y', '-v', 'error',
            '-ss', str(item['start']), '-i', str(src), '-t', str(item['duration']),
            '-an', '-vf', 'scale=768:512:force_original_aspect_ratio=decrease,pad=768:512:(ow-iw)/2:(oh-ih)/2,fps=24',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', str(seg)
        ], check=True)
        segments.append(seg)

    inputs = []
    filters = []
    labels = []
    for i, seg in enumerate(segments):
        inputs += ['-i', str(seg)]
        filters.append(f'[{i}:v]setpts=PTS-STARTPTS[v{i}]')
        labels.append(f'[v{i}]')
    filters.append(''.join(labels) + f'concat=n={len(segments)}:v=1:a=0[outv]')
    out = case_dir / f'{pid}_multisource_split_3s.mp4'
    subprocess.run([
        'ffmpeg', '-y', '-v', 'error', *inputs,
        '-filter_complex', ';'.join(filters), '-map', '[outv]',
        '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', str(out)
    ], check=True)
    probe = subprocess.run([
        'ffprobe', '-v', 'error', '-count_frames',
        '-show_entries', 'format=duration,size:stream=avg_frame_rate,nb_read_frames,width,height',
        '-of', 'json', str(out)
    ], text=True, capture_output=True, check=True)
    results.append({
        'pid': pid,
        'action': 'MULTISOURCE_SPLIT_EDIT',
        'plan': plan,
        'output': str(out),
        'probe': json.loads(probe.stdout),
    })

(ROOT / 'results.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
shutil.rmtree(RAW, ignore_errors=True)
print(json.dumps(results, indent=2))
