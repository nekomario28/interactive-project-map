from __future__ import annotations
import csv,json,subprocess
from pathlib import Path
from huggingface_hub import hf_hub_download

ROOT=Path('.tmp/ai-director-storyeval25-burden'); ROOT.mkdir(parents=True,exist_ok=True)
REPO='UBC-ViL/Spotlight-VideoGen-Errors'
meta=Path(hf_hub_download(repo_id=REPO,repo_type='dataset',filename='test/metadata.jsonl',local_dir=str(ROOT/'rawmeta')))
rows=[]

def merge_sec(ann,duration):
    ints=sorted((max(0.0,float(a['segment'][0])),min(duration,float(a['segment'][1]))) for a in ann if a.get('segment'))
    out=[]
    for s,e in ints:
        if e<=s: continue
        if not out or s>out[-1][1]: out.append([s,e])
        else: out[-1][1]=max(out[-1][1],e)
    return sum(e-s for s,e in out)

with meta.open(encoding='utf-8') as f:
    for line in f:
        r=json.loads(line)
        if r.get('orig_dataset')!='storyeval': continue
        model=r['video_from']; pid=r['pid']
        filename=f'test/spotlight/{model}/{pid}.mp4'
        p=Path(hf_hub_download(repo_id=REPO,repo_type='dataset',filename=filename,local_dir=str(ROOT/'rawvideo')))
        cp=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(p)],capture_output=True,text=True,check=True)
        dur=float(cp.stdout.strip())
        ann=json.loads(r['annotation']) if isinstance(r.get('annotation'),str) else (r.get('annotation') or [])
        src=json.loads(r['source_data']) if isinstance(r.get('source_data'),str) else (r.get('source_data') or {})
        union=merge_sec(ann,dur)
        rows.append({
          'pid':pid,'model':model,'duration_sec':dur,'union_error_sec':union,
          'error_fraction':union/dur if dur else None,'n_errors':len(ann),
          'creative':'creative' in (src.get('class') or []),
          'event_count':len(src.get('event_list') or []),
          'class_json':json.dumps(src.get('class') or [],ensure_ascii=False)
        })
        print(rows[-1],flush=True)

with (ROOT/'storyeval25_model_rows.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.DictWriter(f,fieldnames=rows[0].keys()); w.writeheader(); w.writerows(rows)

by={}
for r in rows:
    x=by.setdefault(r['pid'],{'pid':r['pid'],'creative':r['creative'],'event_count':r['event_count'],'fractions':[],'union':[],'durations':[],'errors':[]})
    x['fractions'].append(r['error_fraction']); x['union'].append(r['union_error_sec']); x['durations'].append(r['duration_sec']); x['errors'].append(r['n_errors'])
summary=[]
for pid,x in sorted(by.items()):
    summary.append({
      'pid':pid,'creative':x['creative'],'event_count':x['event_count'],
      'mean_error_fraction_3models':sum(x['fractions'])/len(x['fractions']),
      'total_union_error_sec':sum(x['union']),
      'total_duration_sec':sum(x['durations']),
      'pooled_error_fraction':sum(x['union'])/sum(x['durations']),
      'total_error_annotations':sum(x['errors'])
    })
with (ROOT/'storyeval25_prompt_rows.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.DictWriter(f,fieldnames=summary[0].keys()); w.writeheader(); w.writerows(summary)
(ROOT/'storyeval25_prompt_rows.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
print('DONE rows',len(rows),'prompts',len(summary))
