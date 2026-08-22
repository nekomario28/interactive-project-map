from __future__ import annotations

import csv
import json
import subprocess
from pathlib import Path

from huggingface_hub import hf_hub_download

ROOT = Path('.tmp/ai-director-duration-audit')
ROOT.mkdir(parents=True, exist_ok=True)
REPO = 'UBC-ViL/Spotlight-VideoGen-Errors'
PIDS = list(range(1, 22))
PIDS.remove(16)
MODELS = ['ltx2', 'seedance', 'veo3']


def duration(path: str) -> float:
    cp = subprocess.run([
        'ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1', path
    ], text=True, capture_output=True, check=True)
    return float(cp.stdout.strip())

rows=[]
for pid in PIDS:
    sid=f'sid_{pid:03d}'
    for model in MODELS:
        filename=f'test/spotlight/{model}/{sid}.mp4'
        p=hf_hub_download(repo_id=REPO, repo_type='dataset', filename=filename, local_dir=str(ROOT/'raw'))
        d=duration(p)
        rows.append({'pid':sid,'model':model,'actual_duration_sec':round(d,3),'size_bytes':Path(p).stat().st_size})
        print(rows[-1], flush=True)

out=ROOT/'actual_durations_60.csv'
with out.open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.DictWriter(f,fieldnames=rows[0].keys()); w.writeheader(); w.writerows(rows)
(ROOT/'actual_durations_60.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
print(f'WROTE {out} rows={len(rows)}')
