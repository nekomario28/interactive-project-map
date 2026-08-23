from __future__ import annotations
import csv, json
from pathlib import Path
from huggingface_hub import hf_hub_download

ROOT=Path('.tmp/ai-director-event-manifest'); ROOT.mkdir(parents=True,exist_ok=True)
repo='UBC-ViL/Spotlight-VideoGen-Errors'
meta=Path(hf_hub_download(repo_id=repo,repo_type='dataset',filename='test/metadata.jsonl',local_dir=str(ROOT/'raw')))
want={f'sid_{i:03d}' for i in range(1,22)}-{'sid_016'}
seen={}
with meta.open(encoding='utf-8') as f:
    for line in f:
        r=json.loads(line)
        pid=r.get('pid')
        if pid not in want or pid in seen: continue
        src=r.get('source_data') or '{}'
        if isinstance(src,str):
            try: src=json.loads(src)
            except Exception: src={'raw':src}
        events=src.get('event_list') or []
        cls=src.get('class') or []
        seen[pid]={
            'pid':pid,
            'prompt':r.get('prompt'),
            'orig_dataset':r.get('orig_dataset'),
            'event_list':events,
            'class':cls,
            'refvideo_exists':r.get('refvideo_exists'),
        }
rows=[seen[p] for p in sorted(want) if p in seen]
(ROOT/'event_manifest_20.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
with (ROOT/'event_manifest_20.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.writer(f); w.writerow(['pid','prompt','orig_dataset','event_count','event_list_json','class_json','refvideo_exists'])
    for r in rows:
        w.writerow([r['pid'],r['prompt'],r['orig_dataset'],len(r['event_list']),json.dumps(r['event_list'],ensure_ascii=False),json.dumps(r['class'],ensure_ascii=False),r['refvideo_exists']])
summary={
  'requested':len(want),'found':len(rows),'missing':sorted(want-set(seen)),
  'storyeval_count':sum(r['orig_dataset']=='storyeval' for r in rows),
  'event_count_distribution':{},
}
for r in rows:
    k=str(len(r['event_list'])); summary['event_count_distribution'][k]=summary['event_count_distribution'].get(k,0)+1
(ROOT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False,indent=2))
