# v2-S4 Step 0 → S4-a handoff (session change, 2026-10-09)

본 문서는 **S4 Step 0은 완료, S4-a는 미착수** 상태에서 세션이 끝나 다음 세션에 넘기는
상태 요약이다. CLAUDE.md §5-4 "S3 교훈" 2번(세션이 부족하면 끝낸 단계까지 커밋 → handoff
작성 → push)에 따라 작성됐다.

## 지금까지 끝난 범위 (push 완료)

v2 브랜치 HEAD = `5a16c4e feat(v2-S4): canvas-freeze guard, L1 Stage target, L5 1-decimal
aria oracle, CI pin, export-disable spec`. origin/v2에 push 완료.

### Step 0

- **0-1**: `v2-S3-ok` annotated 태그를 `18d9fe4`에 생성·push. 커밋 `735a582`.
- **0-2**: 9개 v1 feature/chore 브랜치 삭제. 각 tip은 `archive/v1/<원래브랜치명>` 태그로
  보존. 모두 origin/main의 조상(ahead=0). 재구성 명령은
  `git switch -c <원래브랜치명> archive/v1/<원래브랜치명>`. 열린 PR 상태는 `gh` 미설치로
  미확인(사용자 사전 승인). pre-push 훅에 `V2_BRANCH_CLEANUP=1` 예외 추가(sprint-*
  브랜치 삭제만 허용). 커밋 `735a582`.
- **0-3**: 캔버스 동결 선언. CLAUDE.md §4bis 추가. `CANVAS-FREEZE:BEGIN/END` 마커 9개
  존(`preset-sizes`, `fit-scale`, `coord-convert`, `measure-container-jsx`,
  `root-overflow`, `workspace-grid`, `status-area`, `media-breakpoint-72`,
  `media-breakpoint-48`). `scripts/check-canvas-freeze.mjs` + `npm run check:canvas` +
  `e2e/canvas-freeze.spec.ts`(10 scenarios × ±0.5 CSS px). 측정값은
  `docs/v2/canvas-freeze.json`에 저장. 커밋 `5a16c4e`.
- **0-4**: L1/G/B/L2 측정 셀렉터를 `.editor-canvas-container`로 통일(Stage의 border-box
  frame; `.konvajs-content`는 1 CSS px 유출로 측정에 부적합). 커밋 `5a16c4e`.
- **0-5**: perspective 핸들 `aria-valuetext` → `toFixed(1)%` 전환. L5 gate는 store-oracle
  (ariaErr ≤ 0.1% 플로어 1.92 doc-px x / 1.08 doc-px y) + bbox 보조 oracle(1/scaleP + 1
  doc-px). 1920×1080 측정 ariaErr=(1.55, 0.08), 1280×720 측정 ariaErr=(1.04, 0.06).
  bboxErr 모두 scale-aware budget 안쪽. 커밋 `5a16c4e`.
- **0-6**: CI `runs-on: ubuntu-24.04` 고정, `actions/{checkout,setup-node,upload-artifact}`
  v5 상승, push job에 `npm run check:canvas` 추가. 커밋 `5a16c4e`.
- **0-7**: `e2e/v2-export-disable.spec.ts` 신규(2 tests). PNG 동기 export 중 4버튼 enabled
  유지 + 비디오 export in-flight 중 4버튼 disabled → 완료 후 재-enable. 커밋 `5a16c4e`.
- **0-8**: 전체 검사 통과(typecheck / lint / format:check / test:run / build /
  build:oitemiru / check:canvas / test:e2e:core 146 pass / 21 fail / 0 flaky / 167 total,
  새 실패 0건). push 완료.

### 통과 수 식

- v2-S3-ok 기준: 155 total / 134 pass / 21 fail.
- Step 0 추가 테스트: canvas-freeze.spec.ts(10) + v2-export-disable.spec.ts(2) = 12.
- 현재: 155 + 12 = **167 total / 146 pass / 21 fail** ✓.

### 알려진 실패 21건 (전부 pre-S3 debt — S4-a·S5가 해소 대상)

baseline.md의 "알려진 e2e 실패" 표 그대로:

- portable.spec.ts 14건 (B1/B2 — S4-a a-3이 해소)
- mobile.spec.ts 3건 (`adds a custom portable product` B2, `dragging the portable screen
region` B1, `draws a foreground occlusion mask via tap-to-add points` F-occlusion — S5)
- occlusion-mask.spec.ts 3건 (F-occlusion — S5)
- reselection.spec.ts 1건 (`a custom portable product is reselectable` B1 — S4-a a-3)

## 남은 범위 (다음 세션 S4-a)

### a-1. 포터블 preset 4점 정합

- `scripts/measure-portable-screen-quad.mjs`가 이미 존재. 다음 세션에서 돌려 결과를
  보고서에 표로 정리:
  - `front.png` (1024×1536) — 현재 PORTABLE_PRESET_SCREEN_QUADS.front 과 비교.
  - `angled.png` 또는 `docodemo.webp` (어떤 자산이 "실제" angled-right로 쓰이는지는
    `PortableTemplateBody.tsx`를 재확인; `portableTemplate.ts` 주석은 docodemo를
    언급하지만 측정 스크립트는 angled.png를 사용 — **다음 세션에서 자산 매핑을 먼저
    확정**).
  - angled-right(+60°)는 angled-left의 수평 미러로 유지되는지 확인.
- 각 점이 현재 상수 대비 ≤ 2 source px 안쪽인지 검사. 넘으면 값을 교정하고 그 커밋에
  `[canvas-approved]` 를 붙여야 하는지 사용자에게 확인 — **PORTABLE_PRESET_SCREEN_QUADS는
  현재 freeze 대상이 아님(마커로 감싸지 않았음)**. 따라서 `[canvas-approved]` 불필요하지만,
  "포터블 compound model" 자체는 CLAUDE.md §3-4의 핵심 모델이므로 교정 전 사용자에게
  보고하는 쪽을 권장.
- 픽셀 검증 테스트(마젠타 cover-fit): 추가 조건·측정법은 프롬프트 a-1 그대로. 신규 e2e
  spec으로 추가하면 됨.

### a-2. 포터블 콘텐츠 비율(S1 debt)

- 포터블의 콘텐츠 레터박스/커버 계산 경로가 일반 원근 사이니지와 다른 상태라고 프롬프트가
  명시. 다음 세션에서 `WarpedScreenContent`·`ScreenComposition`·`perspectiveLogicalSize`
  (lib/contentLayout.ts 추정)를 비교해 포터블이 공통 경로를 쓰도록 통일.
- 16:9 콘텐츠를 Fit으로 넣었을 때 letterbox 비율 ±1% 테스트.

### a-3. 기존 실패 17건 해소

- 위 "알려진 실패 21건" 중 S4-a 담당(portable 14 + mobile 2 + reselection 1 = **17**)을
  하나씩 열어 분류·고침.
- 어서션은 유지, T(테스트 전제가 compound model 이전)만 재작성.

### a-4. 문서

- `docs/v2/requirements.md`: 포터블 debt(1-1·1-2·1-3·3-x 중 포터블 영역 상태 갱신, a-1
  4점 표).
- `docs/v2/baseline.md`: 알려진 실패 목록을 (S4-a 완료 후) F-occlusion 4건만 남도록 갱신.
- `docs/v2/sprint-plan.md`: S4-a 완료 상태로 갱신.
- **s4-handoff.md는 삭제**.

### a-5. 전체 검사 → push

- typecheck / lint / format:check / test:run / build / build:oitemiru / check:canvas /
  test:e2e:core. 통과 수 계산식 = 146 + 해소된 debt(17) + a-1 신규 픽셀 검증 테스트 수.
- 통과하면 `git push origin v2`. 태그는 만들지 않음.

## 현재 상태 체크

- 로컬 작업 트리 clean. v2 브랜치 up-to-date with origin/v2.
- `main` 브랜치는 `origin/main`(4e9659d) 그대로. 로컬 커밋 없음.
- 태그: v2-start, v2-S1-ok, v2-S2-ok, v2-S3-ok + archive/v1/<9개> 전부 원격 반영.
- pre-push 훅 작동 중(main / NFF / 삭제 거부, `V2_BRANCH_CLEANUP=1` 예외만 sprint-* 삭제).

## 다음 세션에서 가장 먼저 확인할 것

1. `git status -sb` → `## v2...origin/v2` 인지.
2. `git rev-parse HEAD` → `5a16c4e` 또는 그 이후 push(이 handoff 커밋을 포함)인지.
3. `npm run check:canvas` → 9 zones OK.
4. `npm run test:e2e:core` 결과가 146 pass / 21 fail / 0 flaky 유지되는지.
