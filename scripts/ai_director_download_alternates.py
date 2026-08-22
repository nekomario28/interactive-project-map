from pathlib import Path
from huggingface_hub import hf_hub_download

ROOT=Path('.tmp/ai-director-alternates')
ROOT.mkdir(parents=True, exist_ok=True)
CASES=['sid_003','sid_004','sid_005','sid_007','sid_008','sid_013','sid_015','sid_017','sid_018','sid_021']
repo='UBC-ViL/Spotlight-VideoGen-Errors'
hf_hub_download(repo_id=repo, repo_type='dataset', filename='test/metadata.jsonl', local_dir=str(ROOT))
for model in ['seedance','veo3']:
    for pid in CASES:
        p=hf_hub_download(repo_id=repo, repo_type='dataset', filename=f'test/spotlight/{model}/{pid}.mp4', local_dir=str(ROOT))
        print(p)
