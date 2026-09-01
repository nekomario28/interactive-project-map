# Three.js Galaxy — restart prompt v1

`nekomario28/interactive-project-map` の **Three.js Galaxy 3D研究・実装だけ**を、最新状態からappend-only / forward-reconcileで再開する。

## 最上位scope

このchatで担当するのは、Interactive Project Map の **native Three.js `Galaxy` style** の morphology / motion / readability / astronomy boundary / rendered evidence だけ。

2D全体、他3D style、release/stable-v1、setup、performance最適化は、Galaxyの変更が直接影響する範囲以外では触らない。

古いchat、最後に触ったbranch、最大PR番号、保存checkpointのSHAだけを正本としない。

## 最初に必ず行う

1. fresh `interactive-project-map/main` のexact SHAを取得する。
2. 次を読む。
   - `docs/current-roadmap.md`
   - `docs/research-decision-ledger.md`
   - `docs/threejs-galaxy-astronomy.md`
   - `docs/threejs-galaxy-corotation.md`
   - `docs/threejs-galaxy-save-checkpoint-20260902.md`
   - この `docs/THREEJS_GALAXY_RESTART_PROMPT_V1.md`
3. save後にmainが進んでいる可能性が高いので、Galaxy関連の新しいPR / commit / test / result / negative / docsを検索してforward-reconcileする。
4. 特に **PR #332 `Add a subtle stellar bulge to Three.js Galaxy`** の現在状態を確認する。保存時点ではopen/head `8386e1040fc44fa151e0b9b43953db006e636a94` だったが、再開時に同じとは限らない。
5. 保存時点main `db568c4bb718e6f8887c6f482304239ccdda3457` を参考にはしてよいが、fresh mainより優先しない。

## 保存時点で既に実装済みのもの

これらを再実装しない。

- native Three.js `Galaxy` style
- Cosmic / Galaxy / Aurora / Wireframe のrenderer-local style軸
- flattened finite-thickness semantic disc
- owner at nucleus
- category countに応じた2/3/4 arm family
- trailing logarithmic spiral
- generic visual pitch 22°
- category-arm skeletonとspiral dustの初期pitch整合
- Galaxyだけのhigher initial camera angle
- category systemsのco-rotation
- bounded flat-curve-inspired differential rotation (`T ~ r`)
- outer systemのlower angular speed
- 2D Galaxy Hybridに近い数分scaleのrepository-local orbit
- external Contributed laneのco-rotationとauthority separation
- independent slower arm/dust pattern
- arm pattern period 2400 s
- visual corotation radius `r = 150` renderer units under `T ~ 16r`
- Galaxy decorative far/mid/near star shellsのinertial world frame
- Motion Off freeze
- reduced-motion-derived behavior
- moving labels / selection / selected camera target synchronization
- rich Chromium multi-category + Contributed rendered evidence
- astronomy/non-astronomy boundary docs

## 宇宙的な妥当性についての現在結論

現在のGalaxyは、**semantic visualizationとしては十分にastronomy-informed / qualitatively plausible**。

妥当な点:

- flattened disc
- trailing logarithmic arms
- finite thickness
- co-rotation
- radial differential angular speed
- roughly flat-curve-inspired visual tangential behavior
- arm patternとmaterialを別速度にすること
- visual corotation point
- inertial background stars
- central concentrationを検討する方向

ただしphysical simulatorではない。

明示的に物理主張しないもの:

- renderer unitからkpc/Myrへの変換
- N-body gravity
- category-local repository orbitの実天体力学
- Contributed external laneの物理的halo解釈
- 22°をMilky Wayの正確なpitchとすること
- 2400 s / r=150を実銀河のpattern speed/corotationに対応させること
- 単一density-wave modelを全spiral galaxyへ一般化すること

今後のastronomy refinementは、**見た目・理解を実際に改善する場合だけ**採用する。物理的に高度だからという理由だけで追加しない。

## 次の最優先ユーザー決定: Galaxyのnode間persistent直線を全部なくす

ユーザーの最新判断:

> node同士を結ぶ直線はないほうがきれい

保存時点mainではGalaxyのpersistent edgeは既に `membership-only` まで減っているが、これは次にsupersedeする。

### 目標

`style3d=galaxy` では **常時表示されるnode-to-node straight lineを0にする**。

- category -> repository membership線も常時表示しない
- owner -> category / contribution / other relation線は引き続き常時表示しない
- graph semantic自体は消さない
- 2Dのedge semanticsは変えない
- Cosmic / Aurora / Wireframeは別判断なので触らない
- category membershipはspatial grouping、labels/category navigator、search/focus、selection/details等で理解できる状態を維持する
- 必要ならrelationはselected/focused時のcontextual表現として後で検討してよいが、persistent chordへ戻さない

### 実装時に探すもの

- Galaxy edge policy (`membership-only` / `structural-only` の歴史を含む)
- `rebuildEdges` / Galaxy-specific edge filtering
- moving edge endpoint synchronization
- `ProjectMapThreejsGalaxyMotion.snapshot().edgePolicy`
- astronomy docsの `Edge / line contract`
- rich Galaxy E2E / screenshot assertions

### acceptance

最低限:

1. Galaxy sceneにpersistent graph edge objectが存在しないことをrenderer-levelに検証する。
2. semantic graph / category membership countは保持される。
3. Search / Local Graph / Category Navigator / selection/detailsは退行しない。
4. Motion Onでcategory/repository/Contributed motionは従来どおり動く。
5. Motion Offでfreezeする。
6. rich Chromium screenshotを保存し、線なしの方がspiral morphology / owner / category groupingを読みやすくすることを目視確認する。
7. WebKit smokeとPages deployを通す。
8. qualified後にroadmap / astronomy / decision ledgerの `membership-only persistent lines` を `no persistent Galaxy lines` へ更新する。

## PR #332 central bulge

保存時点ではopen experiment。

目的:

- non-semantic / non-pickableなwarm central stellar concentration + glow
- ownerを隠さない
- motion / graph / line / arm / corotationを変えない

再開時はfresh stateを確認し、既にmerge済みならその結果を使う。openならrendered evidenceを見て判断する。line-free Galaxyとは独立なので、bulgeの有無に関係なくpersistent line removalは進める。

## 2Dの星表現について

以前の案「3D Cosmic/Galaxyの星を2Dへ逆輸入」は、現状そのまま実装しない。

2Dは既に:

- far/mid/near star layers
- camera-depth parallax
- haze
- scene-aware galaxy envelope/dust
- reduced-motion handling

を持つため、duplicate runtimeを作らない。

必要なら具体的rendered deficiencyを先に示し、既存2D cosmic backgroundをrefineする。

## 明示的non-goals

- N-body
- exact Milky Way simulator
- physical unit conversion
- fast/chaotic orbit
- autonomous camera movement
- InstancedMesh / halo optimizationをsynthetic CI FPSだけで再開
- Render Auto/High/Low復活
- 2D starfield duplicate implementation
- 3Dを2Dの13番目styleとして扱う

## 推奨再開順

`fresh main SHA`
→ `roadmap / ledger / astronomy / corotation / saveを読む`
→ `newer Galaxy PR/commitをforward-reconcile`
→ `#332 state確認`
→ `current rendered Galaxy evidence確認`
→ **persistent Galaxy linesを全撤去**
→ focused unit/runtime tests
→ rich Chromium visual evidence
→ WebKit
→ Pages deploy
→ docs reconcile
→ 宇宙的妥当性/可読性を再評価
→ 次のrefinementが本当に必要か判断

COMMONIZE SEMANTICS; KEEP RENDERER-SPECIFIC PRESENTATION. PRESERVE OWNER / CONTRIBUTED AUTHORITY. DO NOT CONFUSE ASTRONOMY-INSPIRED VISUALS WITH PHYSICAL TRUTH.