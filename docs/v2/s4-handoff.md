# v2-S4 Step 0 + S4-a a-pre → S4-a a-0 handoff (2026-10-10)

본 문서는 **S4 Step 0 + S4-a a-pre는 완료, S4-a a-0 매핑 결정 대기** 상태에서 다음 세션에
넘기는 상태 요약이다. CLAUDE.md §5-4 "S3 교훈" 2번(세션이 부족하거나 결정이 필요하면
끝낸 단계까지 커밋 → handoff 작성 → push)에 따라 작성됐다.

## 멈춤 지점 — a-0 매핑 모호

프롬프트의 멈춤 조건 (4) "a-0의 에셋 매핑이 애매한 경우"에 걸려 멈춤.

- `src/assets/portable/` 안에 angled-left로 가능한 소스가 **두 개 존재**: `angled.png`
  (1024×1536 PNG, 투명 0 px, flood-fill 필요) 와 `docodemo.webp` (1300×1900 WebP,
  네이티브 alpha). `front.png` (1024×1536 PNG, 투명 0 px) 는 front-only 라 모호성 없음.
- `src/features/editor/PortableTemplateBody.tsx:51`은 production 렌더링에서
  `isAngled ? docodemoUrl : frontUrl` — 즉 **docodemo.webp 사용**. angled-right 는 같은
  docodemo 를 `scaleX={-1}`로 좌우 미러.
- `src/lib/portableTemplate.ts:48-55`의 `PORTABLE_PRESET_SCREEN_QUADS['angled-left']`
  주석은 "docodemo WebP (1300×1900)" 에서 측정했다고 명시. 현재 값은 docodemo 쪽을
  반영한 것으로 추정.
- 그러나 `scripts/measure-portable-screen-quad.mjs:40`은 측정 대상으로 `angled.png`
  (docodemo 아님) 를 사용. 실행해 보면 angled.png 에서 완전히 다른 quad 가 나옴
  (아래 a-0 보고서 표 참조). a-1 "오차 2 px 교정" 판정이 이 상태에서는 의미 없음.

### 세 가지 옵션 (사용자 결정 대기)

| 옵션 | 설명 | 작업 범위 | 영향 |
| --- | --- | --- | --- |
| **A (권장)** | measure 스크립트 소스를 `angled.png` → `docodemo.webp`로 교체 (sharp 또는 pngjs 변환 경유), angled.png는 레거시 자산으로 제거 | 스크립트 수정 + 자산 1개 삭제 + 측정 재실행 | production·측정·주석이 모두 docodemo.webp 로 통일. 가장 깨끗함. |
| **B** | production 소스를 `docodemo.webp` → `angled.png`로 교체. docodemo.webp 제거. 측정 스크립트는 유지. | PortableTemplateBody.tsx, portableTemplate.ts 주석, 자산 하나 삭제, quad 상수 재측정. | 네이티브 alpha 를 잃고 flood-fill 품질에 의존하게 됨. 바디 외곽선 품질 하락 가능. |
| **C** | 두 자산 모두 유지, 측정 스크립트와 production 이 서로 다른 소스를 쓰는 현상 유지 | 변경 없음 | a-1 측정값과 production quad 사이에 영구적 drift. 비권장. |

사용자가 A/B/C 하나를 지시한 뒤에만 a-1~a-5 를 진행할 수 있다.

## 지금까지 끝난 범위 (push 완료)

v2 브랜치 HEAD = `9c21512 docs(v2-S4): handoff — Step 0 complete, S4-a next` + 이 세션의
a-pre 커밋 (아래 "커밋 목록" 참조). origin/v2에 push 완료.

### Step 0 (이전 세션에서 완료, 커밋 `5a16c4e`)

생략 (이전 handoff 참조).

### S4-a a-pre (이번 세션에서 완료)

- **a-pre.1 canvas-freeze.spec.ts 보강**
  - 조건부 `if ((await portraitBtn.count()) > 0)` → `await expect(portraitBtn).toHaveCount(1)` 로 교체 (silent skip 금지).
  - preset 전환 확인: `portraitBtn.getAttribute('aria-pressed')` 가 `'true'` 가 될 때까지 기다림 (store-rooted 판정).
  - `page.waitForTimeout(100)` 제거 → `waitForStableBbox()` 로 교체: bbox 가 2 프레임 연속 ε<0.01 차이면 settled.
- **a-pre.2 canvas-freeze.json 재측정** — 셀렉터 `.konvajs-content` → `.editor-canvas-container` 통일 (border-box frame; L1/G/B/L2 가 이미 쓰는 것과 동일). 10 scenarios 전부 (x,y) 가 **정확히 1.00 CSS px** 안쪽으로 이동했고 (w,h) 는 **0 변화**. 1 px 이내 허용폭 안.
- **a-pre.3 check-canvas-freeze.mjs 확장** — SHA guard 외에 CSS selector guard 추가.
  - 스캔: `src/**/*.css`.
  - 매칭: `.(editor-workspace|editor-canvas-(column|wrapper|measure|container)|editor-status-area)` + 음성 lookahead `(?![\w-])` (BEM `--review` 와 `-area-hint` 는 매치 안 됨).
  - 주석 안에 적힌 프로즈는 `stripCssComments()` 로 공백으로 치환 후 매칭 (예: "collapses `.editor-canvas-wrapper`" 는 플래그 안 됨).
  - freeze zone 밖 매치는 allowlist 와 비교, 없으면 exit 1. allowlist: `canvas-freeze.json → cssSelectorGuard.allowlist` 6 entries (global.css:304,1223,1239,1245,1354,1363 — 모두 기존 코드).
  - fixture 기반 unit test `tests/unit/checkCanvasFreeze.test.ts` 5 개 (freeze 안 패스 / 밖 위반 / 주석 무시 / BEM 무시 / allowlist 적용).
- **a-pre.4 G 12 + L1 12 수치표** — 보고서 §2 참조.

### 통과 수 식 (현재)

- v2-S3-ok 기준: 155 total / 134 pass / 21 fail.
- Step 0 추가 테스트: canvas-freeze.spec.ts(10) + v2-export-disable.spec.ts(2) = 12.
- a-pre 추가 unit test: checkCanvasFreeze.test.ts(5).
- e2e core 재측정: **167 total / 146 pass / 21 fail**, L5 1280x720 1회 재실행에서 pass → flaky. 새 e2e 실패 0건. (checkCanvasFreeze는 unit test 범위, test:run 에 반영됨.)

### 알려진 실패 21건 (전부 pre-S3 debt — S4-a a-3·S5가 해소 대상)

변경 없음 — baseline.md "알려진 e2e 실패" 표 그대로.

## 남은 범위 (사용자 결정 후 다음 세션)

### a-1. 포터블 preset 4점 정합 — **a-0 결정 선행**

사용자가 옵션 A/B/C 를 지시한 뒤:
- 측정 스크립트의 소스 결정 반영.
- 각 점이 현재 상수 대비 ≤ 2 source px 안쪽인지 재측정 (피팅 잔차 RMS 포함).
- 픽셀 검증 테스트: 마젠타 cover-fit × (기본, 이동, 크기 변경, 회전 15°) × 3 preset = 12 조건.
- 디버그 오버레이 (`PortableQuadDebugOverlay`) 는 개발 플래그 뒤에 있는지 확인 (현재 CLAUDE.md §1 "일반 UI에서 PortableQuadDebugOverlay를 노출하지 마세요" 가 이미 걸려 있음).

### a-2. 포터블 비율 (S1 debt)

`WarpedScreenContent`가 `perspectiveLogicalSize` 를 쓰도록 통일. 16:9 Fit 레터박스 ±1% × 3 preset.

### a-3. 기존 실패 17건 해소

portable 14 + mobile 2 + reselection 1 = 17 건. T(테스트 전제가 compound model 이전) / R(앱 회귀) 분류 후 수정. 삭제·skip·어서션 약화 금지.

### a-4. 문서

- `docs/v2/requirements.md`: 포터블 debt + 4점 표.
- `docs/v2/baseline.md`: 알려진 실패 목록을 (a-3 완료 후) F-occlusion 4건만 남도록 갱신.
- `docs/v2/sprint-plan.md`: S4-a 완료 상태로 갱신.
- **s4-handoff.md 는 삭제**.

### a-5. 전체 검사 → push

typecheck / lint / format:check / test:run / build / build:oitemiru / check:canvas /
test:e2e:core. 통과 수 계산식 = 146 + 해소된 debt(17) + a-1 신규 픽셀 검증 테스트 수.
통과하면 `git push origin v2`. 태그 (`v2-S4a-ok`) 는 사용자 승인 후 사용자가 지시할 때만 생성.

## 현재 상태 체크

- 로컬 작업 트리 clean (이 handoff + a-pre 커밋 push 완료 가정).
- `main` 브랜치는 `origin/main` 그대로. 로컬 커밋 없음.
- 태그: 변경 없음. (`v2-S4a-ok` 는 S4-a 완료 + 사용자 지시 후에만.)
- pre-push 훅 작동 중.

## 다음 세션에서 가장 먼저 할 것

1. 사용자에게 a-0 옵션 A/B/C 결정 확인.
2. `git status -sb` → `## v2...origin/v2` 인지.
3. `npm run check:canvas` → 9 zones + CSS selector allowlist 통과.
4. `npm run test:e2e:core` 결과가 146 pass / 21 fail 유지되는지.
5. 결정에 따라 a-1 재개.
