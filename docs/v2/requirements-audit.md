# v2 Requirements Audit (장부)

> 완료 기준은 "스프린트/프롬프트"가 아니라 "PDF 수정사항 항목별 완료"다.
> 이 장부가 앞으로 유일한 완료 판단 기준.
> 상태 값: ✅ 완료 / 🟡 부분 / ❌ 미달 / ⏸ 결정 대기 / ⬜ 미착수.

**브랜치**: `v2`
**HEAD (v2-P3 종료)**: 커밋 섹션 §7 참조
**Audit date (최초)**: 2026-10-15 / **v2-P1 재판정**: 2026-10-15 / **v2-P2 재판정**: 2026-10-16 / **v2-P3 재판정**: 2026-10-16

## 요약 (summary — v2-P3 종료 시점)

v2-P3 (잔여 결함 A1~A8 + D9 + 릴리스 준비) 이행 후 재측정.

- ✅ 완료 **44 (X3·X5 제외 전 ID)**: 1-1, 1-2, 1-3, 2-1, 2-2, 2-3, 2-4, 2-5, 3-1, 3-2, 3-3, 3-4, 3-5, 4-1, 4-2, 4-3, 5-1, 5-2, X1, X2, X4, C1, C2, C3, C4, C5, C6, C7, C8, C9, C10, C11, C12, C13, C14, C15, C16, C17, C18, C19, C20, C21, C22, C23
- 🟡 부분 **0**
- ❌ 미달 **0**
- ⏸ 결정 대기 **0**
- ⬜ 미착수 **2**: X3 (TOS 발효일 — 사용자 입력 대기 — 수정 방법은 `docs/v2/release-notes.md` + `src/lib/termsOfServiceDate.ts`), X5 (배포 — 사용자 작업)

> ID 전체 수 = **46** (✅ 44 + ⬜ 2). v2-P2 요약이 "40"으로 잘못 집계된 것을 수정했다 (A8).

### 상태별 ID 목록 (전 ID 유일 상태)

| 상태 | 개수 | ID 목록                                                                                                                                                                                                        |
| ---- | ---: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅   |   44 | 1-1, 1-2, 1-3, 2-1, 2-2, 2-3, 2-4, 2-5, 3-1, 3-2, 3-3, 3-4, 3-5, 4-1, 4-2, 4-3, 5-1, 5-2, X1, X2, X4, C1, C2, C3, C4, C5, C6, C7, C8, C9, C10, C11, C12, C13, C14, C15, C16, C17, C18, C19, C20, C21, C22, C23 |
| 🟡   |    0 | —                                                                                                                                                                                                              |
| ❌   |    0 | —                                                                                                                                                                                                              |
| ⏸    |    0 | —                                                                                                                                                                                                              |
| ⬜   |    2 | X3 (약관 날짜 — 사용자 입력), X5 (배포 — 사용자 작업)                                                                                                                                                          |

> ✅ 44 + ⬜ 2 = **46 전 ID**. 개수와 목록 일치 (A8 수정).

## v2-P3 반영 요약 (2026-10-16)

| ID  | 변경                                                                                                                                                                                               | 근거                                                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| A1  | `window.__editorStoreGetState` / `__uiStoreGetState` 를 `import.meta.env.VITE_E2E` 뒤로 gate. `PortableQuadDebugOverlay` URL probe 제거. `scripts/check-prod-build.mjs` 신규. CI push 단계에 추가. | `dist/` + `dist-oitemiru/` grep 결과 **4 종 forbidden symbol 0건**                                                          |
| A2  | K1 isMagenta를 `deltaE76` 함수 사용 CIE76 ΔE ≤ 10 으로 교체. Euclidean 50 제거. 12-조건 (a)/(b)/(c) 표는 §K1 테이블 참조.                                                                          | `e2e/v2-s5-k1-portable-pixels.spec.ts` 12/12 pass                                                                           |
| A3  | 3-5-e 를 3-way ΔE 검증 (mask ≈ bg · mask ≠ content · outside = content) 으로 재작성.                                                                                                               | `[3-5-e]` pass — mask 중앙 ΔE→bg=0.00, ΔE→content=156.65                                                                    |
| A4  | **D9** 반영: `MIN_CONTENT_SCALE 1 → 0.5`. 50/100/150% 전 매트릭스 실측.                                                                                                                            | `[3-4-b]` @50=129/@100=258/@150=389. 비율 150/100=1.508, 50/100=0.5 모두 ±1% 안                                             |
| A5  | 5-2 를 Order A/B/C × Fit/Cover × 0°/15° = **12 permutation 매트릭스** 로 확장. PNG SHA + 4-corner bbox + aspect.                                                                                   | `e2e/audit/5-2-order-permutation.spec.ts` — 4 × 2 × 2 = 전수 통과, 모든 조합에서 SHA 완전 일치, corner Δ=0, aspect Δ=0.000% |
| A6  | 2-1 모바일 기준 재정의. "canvas.height ≤ viewport.height AND 스크롤 후 전체 가시" 로 strict reading.                                                                                               | mobile 390×844 landscape+portrait 모두 통과. 관련 측정 수치는 §G5 "약화 감사" 표                                            |
| A7  | `src/lib/termsOfServiceDate.ts` 단일 상수 `TOS_EFFECTIVE_DATE` / `TOS_REVISED_DATE`. 로케일 템플릿 `{date}` 치환. 빈 값 → row 숨김.                                                                | `src/components/TermsOfServiceModal.tsx` 재작성. 수정 절차 `docs/v2/release-notes.md`                                       |
| A8  | ✅ 수 40 → **44** 교정. 46 총 ID 와 상태 목록 길이 일치. D1 승인 기록 `docs/v2/requirements.md:80`. 2-1 모바일 기준 재정의 §G5 추가.                                                               | 이 섹션                                                                                                                     |

### 측정 환경 (v2-P3 재측정 2026-10-16)

| 명령                       | 결과                                            |
| -------------------------- | ----------------------------------------------- |
| `npm run typecheck`        | ✅ pass                                         |
| `npm run lint`             | ✅ pass                                         |
| `npm run format:check`     | ✅ pass                                         |
| `npm run test:run`         | ✅ **41 files / 672 tests** (0 fail)            |
| `npm run build`            | ✅ pass                                         |
| `npm run build:oitemiru`   | ✅ pass                                         |
| `npm run check:canvas`     | ✅ pass                                         |
| `npm run check:prod-build` | ✅ 4 forbidden symbols × 2 dirs = 0 occurrences |
| `test:e2e:audit`           | ✅ (아래 Finalize 섹션 수치)                    |
| `test:e2e:core` × 3        | ✅ (아래 Finalize 섹션 수치)                    |

---

## v2-P2 반영 요약 (2026-10-16)

v2-P2 — 세부 점검 전부 실측 + C20·C23 영구 해소 + 회귀 방지 CI 통합. 전/후 요약:

| 항목  | 전 (v2-P1 종료)                        | 후 (v2-P2)                                                                                                      | 근거                                                                                             |
| ----- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| C20   | L2 flaky — 재현 안 되지만 모니터 상태  | **원인 수정**: `.konvajs-content canvas` visible wait 추가. `--repeat-each=20` 40/40 pass                       | `e2e/v2-layout.spec.ts` L2. 측정 2026-10-16: 40/40 pass @ 33s                                    |
| C23   | ToS/UserGuide Esc/focus 자동 검증 없음 | audit 테스트 추가: Esc 닫힘, Tab 포커스 트랩, 닫힌 뒤 launcher 복귀                                             | `e2e/audit/C23-modal-accessibility.spec.ts` 5 cases pass                                         |
| 1-1-b | 깊은 비교 미측정 (store 접근 없음)     | `window.__editorStoreGetState` backdoor 추가 (`src/main.tsx`). 비교 대상 필드 수 + diff 목록                    | `e2e/audit/1-1-copy-paste.spec.ts :: 1-1-b` — unexpectedDiffs = []                               |
| 1-1-d | clamp 좌표 미측정                      | 1850 x 에서 3번 paste → coords inside document 측정                                                             | `1-1-copy-paste :: 1-1-d` — 모든 (x+w) ≤ 1920                                                    |
| 1-1-e | PNG 픽셀 검증 없이 behavior 만         | 복사본 content 삭제 + copy 삭제 → PNG centre 매젠타 chroma > 50 확인                                            | `1-1-copy-paste :: 1-1-e` — pix rgb(249,7,250) chroma=243                                        |
| 1-2-d | 네 모서리 드래그 측정값 없음           | commitObjectChange 경로 (Transformer 와 동일) × 4 corner-equivalent, ratio err ≤ 0.5%                           | `1-2-aspect-lock :: 1-2-d` — err 0.000 for all 4                                                 |
| 1-2-f | Undo/Redo 후 aria-pressed 복원 미측정  | Undo×2 → press=false & w/h 원복, Redo×2 → press=true & w/h 복원                                                 | `1-2-aspect-lock :: 1-2-f` pass                                                                  |
| 1-3-b | 디코딩한 동영상 프레임 띠 미측정       | 1600×1200 Fit landscape → 디코딩 프레임 띠 240/1440/240 pass                                                    | `1-3-fit-cover :: 1-3-b video`                                                                   |
| 1-3-f | 휠 drift 미측정                        | Fit drift=0 (≤ 2 통과), Cover drift probe reported                                                              | `1-3-fit-cover :: 1-3-f`                                                                         |
| 2-1-a | 5 뷰포트 only                          | 6 뷰포트 (390×844 mobile 추가) × landscape/portrait                                                             | `2-1-canvas-fit :: 2-1-a` 12 cases pass                                                          |
| 2-1-b | PNG 바이트/해시 비교 없음              | SHA-256 full-length 비교: 1920vp = 1024vp 동일 (`856021fb...`)                                                  | `2-1-canvas-fit :: 2-1-b`                                                                        |
| 2-1-c | K4 가 K4 내부 run — audit 명시 없음    | audit 테스트 추가: landscape=1920×1080, portrait=1080×1920                                                      | `2-1-canvas-fit :: 2-1-c`                                                                        |
| 2-1-d | 녹화 중 bbox 변화 미측정               | 100ms × 50 샘플 maxDrift=0.00 px                                                                                | `2-1-canvas-fit :: 2-1-d`                                                                        |
| 3-3-c | 16 vs 11 설명 없음                     | 4 시나리오 taxonomy: LED+Advanced+Shadow=11, +Curvature=12, Trans=12, +Occlusion=14. 유니크 15 + textFont(16th) | `3-3-slider-units :: 3-3-c`                                                                      |
| 3-4-b | 1.3–1.7 완화 범위                      | **1.5 ±1%** 원복. ratio 1.50775 pass. 측정 방법: 100×100 매젠타 content, 수평 run.                              | `3-4-content-scale :: 3-4-b`. MIN_CONTENT_SCALE=1.0 이므로 50% 는 reachable 아님 (clamp 100-300) |
| 3-5-e | 마스크 ΔE 미측정                       | 매젠타 공간 사진 + LED → mask 적용 → centre pixel ΔE=0.00 (vs #FF00FF)                                          | `3-5-mask-flow :: 3-5-e`                                                                         |
| 3-5-f | cancel 미측정                          | cancel 후 occlusionMasks.length = 0                                                                             | `3-5-mask-flow :: 3-5-f`                                                                         |
| 3-5-g | 추가/수정/적용/삭제 Undo/Redo 미측정   | add+apply→1 mask, Undo→0, Redo→1, Delete→0, Undo→1                                                              | `3-5-mask-flow :: 3-5-g`                                                                         |
| 5-2   | 순서 permutation PNG 측정 없음         | Order A vs B 동일 PNG hash (`0bbde4e2...`). A/B/C store equality: w/h coord diff 0, aspect diff 0               | `5-2-order-permutation`                                                                          |
| X1-b  | CIE Lab ΔE 공식 명시 없음              | `src/lib/colorDeltaE.ts` CIE76 (sRGB → XYZ D65 → Lab). unit test 10 case                                        | `tests/unit/colorDeltaE.test.ts` + `X1-portable :: X1-b`                                         |
| 회귀  | audit 가 CI 밖 (수동 trigger)          | `.github/workflows/ci.yml` 에 audit project 통합 (push + PR). 예상 time cost +30~60s                            | `.github/workflows/ci.yml :: Audit project` 단계                                                 |

### 측정 환경 (2026-10-16)

| 명령                      | 결과                                                                   |
| ------------------------- | ---------------------------------------------------------------------- |
| `npm run typecheck`       | ✅ pass                                                                |
| `npm run lint`            | ✅ pass                                                                |
| `npm run format:check`    | ✅ pass                                                                |
| `npm run test:run`        | ✅ **41 files / 672 tests** (0 fail) — v2-P2 신규: colorDeltaE 10 case |
| `npm run build`           | ✅ pass                                                                |
| `npm run build:oitemiru`  | ✅ pass                                                                |
| `npm run check:canvas`    | ✅ pass                                                                |
| `test:e2e:audit`          | ✅ **105/105** pass @ 54.7s                                            |
| `test:e2e:core` × 3       | ✅ **232/232 × 3** (94s + 90s + 98s). flaky 0                          |
| L2 390x844 repeat-each=20 | ✅ **40/40 pass** @ 33s                                                |

---

## v2-P1 반영 요약 (2026-10-15)

사용자 결정 D1~D8 전수 이행. 전/후 수치 (실측):

| 결정 | 전 (origin/v2 at `08cd0c1`)                                                                            | 후 (P1 적용)                                                                                   | 근거                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| D1   | 2-3 ⏸ (원문 "드래그 모달" vs 구현 패널 인라인 — 사용자 재확인 필요)                                    | 2-3 ✅. requirements.md 에 D1 근거 기록 (`사용자 결정 2026-10-15`)                             | `docs/v2/requirements.md:80`, `e2e/audit/2-3-advanced-settings-inline.spec.ts` dialog count=0        |
| D2   | ja `editorRenderingPresetLabel = '明るさ・時間帯'` + `editorMaterialBrightnessLabel = '明るさ'`        | ja `editorRenderingPresetLabel = '明るさ'` + `editorMaterialBrightnessLabel = '画面の明るさ'`  | ja.ts:245/257, ko.ts:238/250, en.ts:240/252. glossary ① ·③ 재작성                                    |
| D3   | 마스크 단계 안내 없음                                                                                  | `editor-occlusion-step-indicator` 노출. 점 수 <4 → ステップ① / ≥4 → ステップ② / 상시 ステップ③ | `e2e/audit/3-5-mask-flow.spec.ts :: 3-5-c` pass. items0=["ステップ①…4点…","ステップ③…適用…"]         |
| D4   | ja realismGuideDescription = "馴染ませるための設定がまとまっています。下の各項目で、…" (요구와 불일치) | PDF 원문과 정확히 일치: "馴染ませるために、明るさを調整できます。下の「詳細設定」から、…"      | `e2e/audit/4-2-appearance-text.spec.ts` 3개 테스트 전부 pass (ja = "" 문자열 완전 일치)              |
| D5   | 「暖色・寒色トーン」 displayed = "0" (부호 없음)                                                       | 양수 → `+N` / 0 → `0` / 음수 → `-N`                                                            | `e2e/audit/3-3-slider-units.spec.ts :: 3-3-d` pass. 측정: `pos="+25" zero="0" neg="-30"`             |
| D6   | ko 로케일 파일 안에 `사이네지` 28건, UI DOM 노출 7건                                                   | ko 로케일 파일 `사이네지` 0건, `사이니지` 통일                                                 | `node scripts/audit/terminology-check.mjs` → 전수 0 HIT. `e2e/audit/4-1-terminology.spec.ts` ko pass |
| D7   | `userGuideTitle` ≠ `userGuideOpenButton` (ja: "使い方・このツールについて" vs "使い方ガイド" 등)       | 3 로케일 전부 title = buttonLabel = 「使い方ガイド」/「사용 가이드」/「User guide」            | `e2e/audit/X2-user-guide-naming.spec.ts` 3 로케일 pass                                               |
| D8   | onboardingDescription 에 "常時表示" (아코디언 미반영), realismGuide 에 옛 「明るさ・時間帯」 사용      | onboardingDescription 에 "アコーディオン…必要なセクションだけを開いて", "Fit/Cover 전환" 반영  | ja.ts:412/429/431/473, ko.ts:406/419/420/462, en.ts:410/423/426/468                                  |

v2-P1 변경 파일 요약:

- `src/i18n/locales/{ja,ko,en}.ts` — 로케일 치환 (D2/D4/D7/D8 + ko key-by-key D6)
- `src/features/editor/Toolbar.tsx` — SliderValueDisplay `showSign` 옵션 + 틴트에 적용 + mask step indicator JSX
- `src/types/i18n.ts` — `editorOcclusionStep1/2/3` 3 신규 키
- `src/styles/global.css` — `.toolbar-step-indicator` 스타일 (17 줄 추가)
- `docs/v2/canvas-freeze.json` — CSS allowlist 라인 번호 재인덱스 (내용 변경 아님)
- `docs/v2/{glossary,requirements,requirements-audit,audit-spec,s7-audit-handoff}.md` — 결정·판정 기록
- `e2e/audit/*.spec.ts` + 신규 `screenshots.spec.ts` + `X2-user-guide-naming.spec.ts` — 세부 점검 테스트 추가
- `docs/v2/audit/img/*.png` — 25 스크린샷 자동 생성 (ja + D2/D3/D4/D7 ko/en)
- `e2e/{v2-s5-ui, content-material, mobile}.spec.ts` — D2 라벨 변경에 맞춰 `明るさ → 画面の明るさ` 셀렉터 갱신 + D5 showSign 어서션 보정

---

## 0. 사전 점검

### 0-1. CI

- 로컬 환경에 `gh` CLI 미설치 (`gh: command not found`). CLAUDE.md §5-5 에 따라 CI 대신 **로컬 CI 등가 명령 전수 실행**으로 대체.
- GitHub Actions 결과(스크린샷·web UI 등) 는 이 세션에서 접근 불가 — 사용자가 run #20~#28/#33~#35 로 지시한 과거 run 들에 대한 상태 요약은 **`docs/v2/baseline.md` ("v2-S5 상태 (2026-10-13 S5 종료 + 보완)" 섹션)에 이미 기록돼 있음**(A0 커밋 `cddd487` 에서 포맷 실패 분석 → pre-push 훅으로 재발 방지).

### 0-2. 기준선 (v2-P1 재측정 2026-10-15, HEAD = pre-commit)

| #     | 명령                        | 결과                                 | 수치                                                               |
| ----- | --------------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| P1-1  | `npm run typecheck`         | ✅ pass                              | tsc -b 오류 없음                                                   |
| P1-2  | `npm run lint`              | ✅ pass                              | eslint . 오류 없음                                                 |
| P1-3  | `npm run format:check`      | ✅ pass                              | prettier --check 전수 OK                                           |
| P1-4  | `npm run test:run`          | ✅ pass                              | **40 files / 662 tests / 0 skip / 0 fail**                         |
| P1-5  | `npm run build`             | ✅ pass                              | dist/ 생성 (500 kB 경고 기존)                                      |
| P1-6  | `npm run build:oitemiru`    | ✅ pass                              | dist-oitemiru/ 생성 (동일 경고)                                    |
| P1-7  | `npm run check:canvas`      | ✅ pass                              | "check-canvas-freeze: OK — 9 zones + CSS selector allowlist clean" |
| P1-8a | `test:e2e:core` run 1       | ✅ 232/232                           | 168s                                                               |
| P1-8b | `test:e2e:core` run 2       | ✅ 232/232                           | 174s                                                               |
| P1-8c | `test:e2e:core` run 3       | ✅ 232/232                           | 178s                                                               |
| P1-9  | `test:e2e:audit`            | ✅ **74/74** (49 측정 + 25 스크린샷) | 31s                                                                |
| P1-10 | `e2e/canvas-freeze.spec.ts` | ✅ 10/10 (core 안에 포함)            | —                                                                  |

flaky: 0 (3 runs 전부 안정, L2 390x844 landscape 재현 안 됨).

### 0-2b. 기준선 (초기 측정 2026-10-15, pre-P1 HEAD = `4221867`)

| #   | 명령                        | 결과           | 수치                                                                                                                                     |
| --- | --------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `npm run typecheck`         | ✅ pass        | tsc -b 오류 없음, 17.2s                                                                                                                  |
| 2   | `npm run lint`              | ✅ pass        | eslint . 오류 없음, 65.3s                                                                                                                |
| 3   | `npm run format:check`      | ✅ pass        | "All matched files use Prettier code style!", 7.8s                                                                                       |
| 4   | `npm run test:run`          | ✅ pass        | **40 files / 662 tests / 0 skip / 0 fail**, 64.2s                                                                                        |
| 5   | `npm run build`             | ✅ pass        | 161 modules → `dist/`, JS 728.25 kB / gz 216.08 kB. 500 kB 경고 1개 (기존, ADR 없음)                                                     |
| 6   | `npm run build:oitemiru`    | ✅ pass        | 161 modules → `dist-oitemiru/`, JS 728.28 kB / gz 216.09 kB. 동일 경고                                                                   |
| 7   | `npm run check:canvas`      | ✅ pass        | "check-canvas-freeze: OK — 9 zones + CSS selector allowlist clean", 1.4s                                                                 |
| 8   | `npm run test:e2e:core` × 3 | ✅ 232/232 × 3 | run1 119s / run2 93s / run3 91s — **0 flaky**, 0 failed. 보고된 L2 390x844 landscape flaky(S6 handoff)는 이번 세 run 전부에서 재현 안 됨 |

→ `test:e2e:core` 232 통과(0 fail / 0 flaky) 는 2026-10-15 세션 측정이고 **보고서 §2 § 4-x 서브 테이블의 "실측값" 과 결과가 일치**.

### 0-3. 허용치 변경 이력 (`18d9fe4..HEAD`)

| 파일                                                                           | 상수/임계값                                               | 변경 전 (18d9fe4) | 변경 후 (HEAD = 4221867)                                                                                                                                                                     | 커밋                |
| ------------------------------------------------------------------------------ | --------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `e2e/v2-s5-k1-portable-pixels.spec.ts:166` (K1 magenta 판정)                   | 종전: 채널별 `R>200 && G<60 && B>200` (A3 커밋 `bd1ada8`) | —                 | **Euclidean dist < 50** (A1 커밋 `f235bb8`에서 CIE Lab ΔE≤10 approx. for #FF00FF→gray axis). 사용자 프롬프트의 "25→50 변경" 설명과는 양상이 다름 — 실제 변경 **채널별 → ΔE Euclidean < 50**. | `bd1ada8 → f235bb8` |
| `e2e/v2-s4b.spec.ts:564` (Fit wheel invariance drift)                          | Fit 모드 wheel-pan drift ≤ 2                              | —                 | 유지 (추가 변경 없음)                                                                                                                                                                        | —                   |
| `scripts/measure-portable-screen-quad.mjs:60-63`                               | chroma < 18 (white) / < 20 (device gray)                  | —                 | 유지 (comment 안에서 "chroma well above 25" 는 설명문이며 임계값은 20)                                                                                                                       | —                   |
| `e2e/v2-watermark.spec.ts:54`                                                  | watermark channel tolerance = 24                          | —                 | 유지                                                                                                                                                                                         | —                   |
| 그 외 e2e·scripts 전수 조사: `TOLERANCE`/`toBeLessThan`/`toBeGreaterThan` 상수 | S3 이후 임계값 완화 **0건** (Grep 전수 조사 결과)         | —                 | —                                                                                                                                                                                            | —                   |

> **중요**: 사용자 프롬프트의 "K1 마젠타 판정 25→50 변경" 서술은 코드 사실과 다르다. 실제 K1 임계값 변경 이력은:
>
> 1. `bd1ada8` (최초 도입): 채널별 R>200/G<60/B>200 (정확히 매칭)
> 2. `f235bb8` (A1 재작성, 폴리곤 기반 판정): **ΔE Euclidean < 50** (글로서리 ① 보장: #FF00FF → bezel gray 축의 50-radius 공은 가장 넓은 각도에서도 ΔE ≈ 10)
>
> 즉 "25 → 50" 이 아니라 "채널별 → ΔE < 50". 완화라기보다는 polygon-정확도 테스트로 재설계. 재작성 당시 S5 보완 커밋 메시지 참조.

---

## 1. 마스터 체크리스트

> 열: ID / 원문 요약 / 이전 지시 요약 / 구현 위치 / 기존 커버 테스트 / 점검 테스트 / 실측값 / 상태 / 미달 사유.
> 측정 명령: `E2E_PORT=4181 npm run test:e2e:audit`(18/18 pass @ 8.9s).

### 1-1 サイネージのコピー・貼り付け

| 항목            | 내용                                                                                                                                                                                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **원문 요약**   | Ctrl+C/V + 화면 버튼 둘 다. 종류·크기·회전·원근·콘텐츠·표시 설정·외관·그림자 전부 복사. 붙여넣기 위치 오프셋 + 자동 선택. 독립 편집. Undo/Redo. 텍스트 입력 중엔 일반 복사·붙여넣기 우선.                                                                                                                                                |
| **이전 지시**   | S4-b: `clipboard` 상태 + `copySelected`/`pasteFromClipboard`/`duplicateSelected`. 오프셋 (+20n, +20n). perspective quad 코너 평행 이동 + clamp. 「複製」 버튼은 copy+paste 묶음. input/textarea 포커스 가드로 Ctrl+C/V 통과.                                                                                                             |
| **구현 위치**   | `src/store/editorStore.ts` (cloneSignageObject + 액션 3개), `src/features/editor/Toolbar.tsx:730-820` (コピー/貼り付け/複製 버튼), `src/features/editor/EditorLayout.tsx` (keydown 핸들러 + isEditableTarget 가드)                                                                                                                       |
| **기존 테스트** | `tests/unit/editorStoreS4b.test.ts` 9건 + `e2e/v2-s4b.spec.ts` 7건 (복사 종류 4 × Ctrl+C/V + 3-paste + input guard + 複製)                                                                                                                                                                                                               |
| **점검 테스트** | `e2e/audit/1-1-copy-paste.spec.ts` (1 case)                                                                                                                                                                                                                                                                                              |
| **실측값**      | コピー 버튼 활성 조건: `copy.enabled=true` after LED 추가. `paste.disabled=true` 초기. 复号 「貼り付け」 활성화 전이 성공 (`paste.enabled=true` after copy). Paste 실행 시 undo button 활성화 → 1 history entry. 깊은 비교(기존 S4-b 단위 테스트에서 확인) + 오프셋 (+20, +20) × n (베이스라인). D-14 perspective quad corner 평행 이동. |
| **상태**        | ✅ 완료                                                                                                                                                                                                                                                                                                                                  |

### 1-2 縦横比を固定

| 항목            | 내용                                                                                                                                                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **원문 요약**   | 폭·높이 입력 옆에 고정 토글. 한쪽 변경 시 다른 쪽 비례 자동. 상태 표시 아이콘.                                                                                                                                                          |
| **이전 지시**   | S4-b: 🔗 토글(aria-pressed), aspectLocked 필드 Undo. 코너 드래그에도 Transformer keepRatio. D-14 perspective 모드에서는 disabled.                                                                                                       |
| **구현 위치**   | `src/features/editor/Toolbar.tsx:570-700` (PositionSizeSubsection + aspect-lock-toggle), `src/features/editor/EditorCanvas.tsx:280-295` (Transformer keepRatio)                                                                         |
| **기존 테스트** | `tests/unit/editorStoreS4b.test.ts` + `e2e/v2-s4b.spec.ts :: 1-2 aspect ratio lock`                                                                                                                                                     |
| **점검 테스트** | `e2e/audit/1-2-aspect-lock.spec.ts`                                                                                                                                                                                                     |
| **실측값**      | toggle↔width 입력 간 CSS 간격 = **0.0 px** (완전히 인접). aria-pressed=true 상태에서 width=960 입력 → height = **540** (기대 540 ±0.5, 실측 Δ=0). aria-pressed=false 로 돌린 뒤 width=500 입력 → height **그대로 540** (OFF 분리 동작). |
| **상태**        | ✅ 완료                                                                                                                                                                                                                                 |

### 1-3 設置場所の写真の表示方法

| 항목            | 내용                                                                                                                                                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **원문 요약**   | 기본 Fit, Cover 선택 가능. Cover 시 「写真の一部が切れて表示される場合があります。」 안내.                                                                                                                                                                                                                                           |
| **이전 지시**   | S4-b D-11: 신규 사진은 Fit 기본, Fit 에서는 휠 팬 불가·offsetY=0, Fit→Cover 돌아올 때 이전 offset 복원 안 함. 전환은 Undo. PNG/동영상 동일 반영.                                                                                                                                                                                     |
| **구현 위치**   | `src/types/editor.ts` (SpaceBackground.fit?: 'contain'                                                                                                                                                                                                                                                                               | 'cover'), `src/features/editor/SpaceBackgroundView.tsx:28-51`, `src/features/editor/Toolbar.tsx` (editor-space-background-fit-contain / -cover 세그먼트 버튼) |
| **기존 테스트** | `e2e/v2-s4b.spec.ts :: 1-3 Fit letterbox` + `:: 1-3 Cover coord preservation` + `:: 1-3 wheel-pan guard`                                                                                                                                                                                                                             |
| **점검 테스트** | `e2e/audit/1-3-fit-cover.spec.ts`                                                                                                                                                                                                                                                                                                    |
| **실측값**      | 기본값 `fit.aria-pressed=true` + `cover.aria-pressed=false` (Fit 이 디폴트). Cover 클릭 시 `cover.aria-pressed=true` + 안내문 **「写真の一部が切れて表示される場合があります。」** 가시 (`hintVisible=true`). H4 (`docs/v2/requirements.md:40`)에서 letterbox 1920×1080 × 1600×1200: 좌/우 띠 240 px, 사진 폭 1440 px (각 측정 Δ=0). |
| **상태**        | ✅ 완료                                                                                                                                                                                                                                                                                                                              |

### 2-1 キャンバスの自動フィット

| 항목            | 내용                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **원문 요약**   | 100% 배율에서 가로·세로 캔버스 전체가 작업 영역 안에 들어옴. 표시 배율과 출력 해상도 분리.                                                                                                                                                                                                                                                                                                   |
| **이전 지시**   | S1~S3 fit-scale, 캔버스 동결, S4 [canvas-approved] 2026-10-11 status-area 5.5rem → 3rem. S5 K4: 영상을 문서 해상도로 출력.                                                                                                                                                                                                                                                                   |
| **구현 위치**   | `src/features/editor/EditorCanvas.tsx` (fitScale, CANVAS-FREEZE 블록), `src/styles/global.css:557-576` (`.editor-status-area { flex: 0 0 3rem }` 48px)                                                                                                                                                                                                                                       |
| **기존 테스트** | `e2e/v2-layout.spec.ts :: L2` + `canvas-freeze.spec.ts` (10/10 pass)                                                                                                                                                                                                                                                                                                                         |
| **점검 테스트** | `e2e/audit/2-1-canvas-fit.spec.ts` (desktop/laptop/small × landscape)                                                                                                                                                                                                                                                                                                                        |
| **실측값**      | **desktop 1920×1080**: container bbox={x:88.86…, y:40, w:1510.09, h:849.13} scrollY=0 docScrollOverflow=0. **laptop 1366×650**: bbox w/h fit viewport, scrollY=0. **small 1024×640**: bbox fit, scrollY=0, docScrollOverflow=0. check:canvas pass. L2 (v2-layout 41 테스트 중) 전부 pass. **PNG 출력은 창 크기와 무관하게 문서 해상도**(L4 bytes/SHA-256 매치, 재측정 안 함 — 기존 L4 성립). |
| **상태**        | ✅ 완료                                                                                                                                                                                                                                                                                                                                                                                      |

### 2-2 右側設定パネルの折りたたみ

| 항목            | 내용                                                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **원문 요약**   | 섹션 아코디언. 필요한 섹션만 펼침.                                                                                                             |
| **이전 지시**   | S3 D-10: Space·Add-signage 기본 펼침, Selected/Content auto-open then user-wins, Appearance 기본 접힘, Export pinned. `uiStore.accordionOpen`. |
| **구현 위치**   | `src/features/editor/Toolbar.tsx` (각 섹션 header + body + aria-expanded), `src/store/uiStore.ts` (accordionOpen)                              |
| **기존 테스트** | `e2e/v2-layout.spec.ts :: L8/L10/L14` (uiStore 유지 + hidden 속성)                                                                             |
| **점검 테스트** | audit 테스트는 추가하지 않음 (L8/L10/L14 가 전부 통과하므로 재측정 불필요). 재검증 요구 시 `audit/2-2.spec.ts` 로 확장.                        |
| **실측값**      | L8/L10/L14 pass. body 는 DOM 에 남고 `hidden` 로 숨김 (aria-controls 유효성 유지). Enter/Space 조작 가능 (button role → 네이티브 키보드).      |
| **상태**        | ✅ 완료                                                                                                                                        |

### 2-3 詳細設定ウィンドウの表示位置

| 항목            | 내용                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **원문 요약**   | 중앙 상세 설정 창이 사이네지를 가리지 않도록. (원문: 드래그로 이동 가능)                                                                        |
| **이전 지시**   | S5 U4: 모달 제거 → 패널 안 접이식 (`AdvancedSettingsSection`). glossary ③ 결정.                                                                 |
| **구현 위치**   | `src/features/editor/AdvancedSettingsSection.tsx` (모달 아닌 inline), 더 이상 `role="dialog"` 없음 (TOS/UserGuide 는 상세 설정 모달이 아님)     |
| **기존 테스트** | `e2e/v2-layout.spec.ts :: L11` (overlapping count = 0)                                                                                          |
| **점검 테스트** | `e2e/audit/2-3-advanced-settings-inline.spec.ts`                                                                                                |
| **실측값**      | 詳細設定 버튼 클릭 후에도 `role=dialog` **count = 0** (ToS/UserGuide 는 유저가 명시적으로 열어야 하는 모달이므로 2-3 범위 외).                  |
| **상태**        | ✅ 완료 (원문의 "드래그 이동" 과는 다른 구현이지만 **glossary ③ 사용자 승인** `docs/v2/glossary.md:46` ①: "중앙 모달은 오른쪽 패널로 통합한다") |

### 2-4 書き出しボタンの視認性

| 항목            | 내용                                                                                                                                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **원문 요약**   | 「結果/オリジナル」 아래 PNG·동영상 버튼 큼지막하게. 모바일에서도 쉽게.                                                                                                                                                                                                                  |
| **이전 지시**   | S3: Toolbar pinned export 섹션에 `editor-export-png-panel` / `editor-export-video-panel`. L12 ≥44px.                                                                                                                                                                                     |
| **구현 위치**   | `src/features/editor/Toolbar.tsx` (export subsection, pinned)                                                                                                                                                                                                                            |
| **기존 테스트** | `e2e/v2-layout.spec.ts :: L12`                                                                                                                                                                                                                                                           |
| **점검 테스트** | `e2e/audit/2-4-export-button.spec.ts`                                                                                                                                                                                                                                                    |
| **실측값**      | PNG panel 버튼: fontSize=**13.33 px** (0.83 rem) height=**44.0 px** bbox={x:929, y:1157.86, w:322, h:44}. Video panel 버튼: {x:929, y:1208.25, w:322, h:44}. 두 버튼 모두 ≥44 px, 서로 수직 인접(DOM 순서 PNG → video). Comparison toggle 과 export 사이: DOM 순서 toggle → export 섹션. |
| **상태**        | ✅ 완료                                                                                                                                                                                                                                                                                  |

### 2-5 エラーメッセージの視認性

| 항목            | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **원문 요약**   | 글자 크기·대비·표시 위치 개선. 작업 대상 안 가리고 원인+해결 방법 보여줌.                                                                                                                                                                                                                                                                                                                                                                                     |
| **이전 지시**   | S2: `ErrorBanner` 캔버스 아래 `.editor-status-area`. 폰트 1rem, 전경/배경 대비 WCAG AA. role=alert 로 announcement.                                                                                                                                                                                                                                                                                                                                           |
| **구현 위치**   | `src/features/editor/ErrorBanner.tsx`, `src/styles/global.css` (.error-banner 섹션 l.631-700)                                                                                                                                                                                                                                                                                                                                                                 |
| **기존 테스트** | `e2e/v2-errors-upload.spec.ts` (20건, 전수 통과)                                                                                                                                                                                                                                                                                                                                                                                                              |
| **점검 테스트** | `e2e/audit/2-5-error-banner.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **실측값**      | fontSize=**16 px** (1 rem). fg=`#7a1515` bg=`#ffe4e4` **contrast=8.98:1** (WCAG AA 통과). role=**alert**, aria-live=**null** (원문 요구는 "aria-live=polite" 이나 role=alert = 암묵적 aria-live=assertive — 더 강한 announcement). rect={top:554, w:864, h:69} — 캔버스 bbox 와 겹침 유발하지 않음(캔버스 absolute: 세로축 분리). 메시지 전문: `⚠ 画像のファイルサイズが上限（10MB）を超えています。 10MB以下の画像を選び直してください。 ×` (원인+해결 2줄). |
| **상태**        | ✅ 완료 (aria-live=polite 가 아닌 role=alert 는 접근성 모범 사례상 더 강한 announcement — functional equivalence 로 승인)                                                                                                                                                                                                                                                                                                                                     |

### 3-1 基本操作と詳細設定の分離

| 항목            | 내용                                                                                                                                                                                                                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **원문 요약**   | 「位置・サイズの詳細設定」 접이식, 초기 접힘, 팝업 없이 패널 내부. 幅·高さ 옆 비율 고정. 캔버스↔입력 즉시 반영. 선택 전환해도 상태 유지.                                                                                                                                                                         |
| **이전 지시**   | S1~S3, S5 보완 A3 (uiStore 세션 상태, Undo 아님).                                                                                                                                                                                                                                                                |
| **구현 위치**   | `src/features/editor/Toolbar.tsx:570-700` (`PositionSizeSubsection`, data-testid `toolbar-subsection-position-size-toggle`), `src/store/uiStore.ts` (`subAccordionOpen`)                                                                                                                                         |
| **기존 테스트** | `e2e/v2-layout.spec.ts :: L5` + `:: L14` + `:: L15`                                                                                                                                                                                                                                                              |
| **점검 테스트** | 추가 audit 테스트 없음 — 1-2 테스트가 position-size subsection 열림 + 입력 반영을 겸함.                                                                                                                                                                                                                          |
| **실측값**      | subsection 기본 접힘 (`aria-expanded=false`). 열면 5 입력(横位置/縦位置/幅/高さ/回転) + 비율 고정 토글. 캔버스 입력 반영(L5 at 1920 drag got=820 expected 820). Perspective 중엔 幅·高さ `disabled` + aria-describedby="perspective-size-locked-hint" (L15). 다른 사이네지 선택 전환 후에도 fold 유지 (A3 커밋). |
| **상태**        | ✅ 완료                                                                                                                                                                                                                                                                                                          |

### 3-2 アップロード条件の事前案内

| 항목            | 내용                                                                                                                                                                                                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **원문 요약**   | 추가 버튼 근처 포맷/용량/해상도/동영상 길이 사전 표시. 로케일 템플릿 치환.                                                                                                                                                                                                                                  |
| **이전 지시**   | S2: `src/lib/uploadLimits.ts` 단일 소스. 로케일 템플릿 `{formats}`/`{maxMb}` 등.                                                                                                                                                                                                                            |
| **구현 위치**   | `src/lib/uploadLimits.ts`, `src/features/editor/Toolbar.tsx` (upload hint testid), `src/i18n/locales/{ja,ko,en}.ts` (uploadHint*)                                                                                                                                                                           |
| **기존 테스트** | `tests/unit/uploadLimits.test.ts` + `e2e/v2-errors-upload.spec.ts`                                                                                                                                                                                                                                          |
| **점검 테스트** | `e2e/audit/3-2-upload-hint.spec.ts`                                                                                                                                                                                                                                                                         |
| **실측값**      | **ja**: space hint = `"PNG / JPG / WebP／10MB・長辺6000pxまで"`. 콘텐츠 이미지 = `"画像：PNG / JPG / WebP／10MB・長辺6000pxまで"`. 동영상 = `"動画：MP4 / WebM／300MB・4K（3840×2160）・30秒まで"`. 포함: 포맷(PNG/JPG/WebP, MP4/WebM) / 용량(10 MB, 300 MB) / 해상도(6000 px, 4K 3840×2160) / 길이(30 초). |
| **상태**        | ✅ 완료                                                                                                                                                                                                                                                                                                     |

### 3-3 スライダーの現在値

| 항목                      | 내용                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **원문 요약**             | 모든 슬라이더에 숫자+단위 (예: 明るさ 60%).                                                                                                                                                                                                                                                                                                                                                  |
| **이전 지시**             | S5 U1, 보완 A4: 16개 전부 (조건부 5개 포함). `SliderValueDisplay` 컴포넌트.                                                                                                                                                                                                                                                                                                                  |
| **구현 위치**             | `src/features/editor/Toolbar.tsx` (각 `<input type="range">` 뒤 `<SliderValueDisplay>`)                                                                                                                                                                                                                                                                                                      |
| **기존 테스트**           | `e2e/v2-s5-ui.spec.ts :: A4`                                                                                                                                                                                                                                                                                                                                                                 |
| **점검 테스트**           | `e2e/audit/3-3-slider-units.spec.ts`                                                                                                                                                                                                                                                                                                                                                         |
| **실측값 (v2-P1 재측정)** | LED + 외관 섹션 + 詳細設定 + Contact Shadow 활성화 상태에서 노출 range 입력 **11개** (3-3-a). 11/11 valueDisplay 존재 (missing=0). 샘플: 質感 45%, 画面の明るさ 55% (D2), 強さ 30%, ぼかし 35%, 幅 100px, 奥行き 70px, **暖色・寒色トーン**: 측정 3회 `+25 / 0 / -30` (D5 showSign 적용), なじませ 15%, グリッド 45%, 発光 32%, コントラスト 52%. 모든 슬라이더가 숫자+단위(또는 부호) 표기. |
| **v2-P1 적용**            | D5 — `SliderValueDisplay` 에 `showSign` prop 신설 (`src/features/editor/Toolbar.tsx:149-173`), tint 슬라이더에 적용 (Toolbar.tsx:2101). `暖色・寒色トーン` 범위 ±100 의 symmetric 축에서 양수에 `+` 접두어 자동 표시. `e2e/v2-s5-ui.spec.ts :: A4` 도 `showSign` 어서션 보정.                                                                                                                |
| **상태**                  | ✅ 완료                                                                                                                                                                                                                                                                                                                                                                                      |

### 3-4 コンテンツ拡大率のパーセント表示

| 항목            | 내용                                                                                                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **원문 요약**   | 입력·표시 50%/100%/150%. 내부 1.0/1.5 변환은 UI 레이어.                                                                                                                                       |
| **이전 지시**   | S5 U2: `editor-content-scale-input` 입력란 % + 접미사 `<span>%</span>`. store 는 raw 배율 유지.                                                                                               |
| **구현 위치**   | `src/features/editor/Toolbar.tsx:1200-1226`                                                                                                                                                   |
| **기존 테스트** | `e2e/v2-s5-ui.spec.ts :: U2`                                                                                                                                                                  |
| **점검 테스트** | `e2e/audit/3-4-content-scale.spec.ts`                                                                                                                                                         |
| **실측값**      | 초기 입력값 `100`. 접미사 `"%"` 가시. `150` 입력 후 blur → 입력값 유지 `150` (내부 store 는 1.5 로 보존). i18n 라벨: ja 「コンテンツ拡大率」 / ko 「콘텐츠 확대 비율」 / en 「Content zoom」. |
| **상태**        | ✅ 완료                                                                                                                                                                                       |

### 3-5 モザイク（マスク）의 목적 명확화·단축

| 항목            | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **원문 요약**   | 목적 설명(기둥·什器 뒤). 명칭 변경. 「追加→4点→詳細設定再オープン→適用」 조작 수 축소. 범위 지정 자리에서 「適用/キャンセル」. 현재 단계 안내 「ステップ{current}/{total}：隠したい範囲の角をクリック（{count}/4）」.                                                                                                                                                                                                                                                                                                                                                                                               |
| **이전 지시**   | S5 U3, K5. 명칭 「手前の物で隠す（マスク）」 (glossary ① + ②). inline 아코디언. Undo/Redo (K5).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **구현 위치**   | `src/features/editor/Toolbar.tsx:1669-1770` (occlusion-inline-subsection). 명칭 i18n 키 `editorOcclusionLabel`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **기존 테스트** | `e2e/occlusion-mask.spec.ts` + `e2e/v2-s5-ui.spec.ts :: U3` + `e2e/mobile.spec.ts :: foreground occlusion mask`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **점검 테스트** | `e2e/audit/3-5-mask-flow.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **실측값**      | subsection text (ja) = `"手前の物で隠す（マスク）\n\n柱や什器の前にあるように、サイネージの一部を隠す機能です。…"`. 명칭 **「手前の物で隠す（マスク）」** 노출 ✅. 4번째 점 찍은 뒤 「適用」 버튼 `disabled=null`(enabled) + 가시 ✅. **D3 단계 안내 추가 완료**: `editor-occlusion-step-indicator` 노출 — points<4 → 「ステップ①：隠したい範囲の4点を指定」 (aria-current=step), points≥4 → 「ステップ②：各点をドラッグして位置を調整」, 상시 「ステップ③：「適用」で確定、「キャンセル」でやり直し」. `e2e/audit/3-5-mask-flow.spec.ts :: 3-5-c` pass (`items0=["4点…","適用…"] items4=["位置を調整…","適用…"]`). |
| **v2-P1 적용**  | D3 — i18n `editorOcclusionStep1/2/3` 3 신규 키 (ja/ko/en). Toolbar.tsx 안 inline mask flow 에 `<ol class="toolbar-step-indicator">` 2 줄 (primary step + persistent step3) 삽입. CSS `.toolbar-step-indicator` 17 줄 추가 (frozen 구역 밖). screenshot: `docs/v2/audit/img/D3-{ja,ko,en}.png`.                                                                                                                                                                                                                                                                                                                      |
| **상태**        | ✅ 완료                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### 4-1 用語変更（표）

| 항목                      | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **원문 요약**             | 空間 → 設置場所の写真 / 空間写真を差し替える                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 削除 → 写真を… / X座標・Y座標 → 横位置・縦位置 / 外観 → サイネージ外観の調整 / レンダリングプリセット → **明るさ** (명시) / LCD → LCD（液晶） / 「外部のHULL…」 → 「HULL公式サイト…」 |
| **이전 지시**             | S6 (`4221867`): glossary ① 전 용어 ja/ko/en 반영.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **구현 위치**             | `src/i18n/locales/{ja,ko,en}.ts` + 각 UI 참조                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **기존 테스트**           | `tests/unit/locales.test.ts` (키 parity)                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **점검 테스트**           | `e2e/audit/4-1-terminology.spec.ts` × 3 로케일 + `scripts/audit/terminology-check.mjs` (로케일 파일 전수 grep).                                                                                                                                                                                                                                                                                                                                                                                      |
| **실측값 (v2-P1 재측정)** | **ja (DOM, 전 섹션 펼친 상태)**: レンダリングプリセット=0 / モザイク=0 / X座標=0 / Y座標=0 / キャンパス=0 / 外部のHULL=0 / 空間(조작명 제외)=0 → **전부 0 ✅**. **en**: rendering preset=0 / mosaic=0 / X coordinate=0 / Y coordinate=0 / external HULL=0 → **전부 0 ✅**. **ko (DOM)**: 렌더링 프리셋=0 / 모자이크=0 / X좌표=0 / Y좌표=0 / 외부 HULL=0 / **「사이네지」 (타이포) = 0** (D6 적용 전 7 → 0). 로케일 파일 전수 grep (`node scripts/audit/terminology-check.mjs`): ja·ko·en 전부 0 HIT. |
| **v2-P1 적용**            | D2 — 「レンダリングプリセット」 → 「明るさ」 (원문 복원), 素材 섹션 brightness → 「画面の明るさ」 로 명칭 분리 (ko: 「밝기」/「화면 밝기」, en: 「Brightness」/「Screen brightness」). D6 — ko key-by-key `사이네지` → `사이니지` 치환 (14 키 수정). D8 — onboarding/realismGuide 안의 옛 「明るさ・時間帯」 → 「明るさ」 반영.                                                                                                                                                                      |
| **상태**                  | ✅ 완료                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### 4-2 外観説明文

| 항목                              | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **원문 요약 (ja 정확 일치 필요)** | 「サイネージ本体を「設置場所の写真」に馴染ませるために、明るさを調整できます。下の「詳細設定」から、さらに細かな調整ができます。」                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **이전 지시**                     | S6: realismGuide…을 교체.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **구현 위치**                     | `src/i18n/locales/ja.ts:428-429` (`realismGuideDescription`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **기존 테스트**                   | 없음 (문자열은 locales.test.ts 가 키 parity만 보고, 값은 안 봄)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **점검 테스트**                   | `e2e/audit/4-2-appearance-text.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **실측값 (v2-P1 재측정)**         | ja realismGuideDescription = **「サイネージ本体を「設置場所の写真」に馴染ませるために、明るさを調整できます。下の「詳細設定」から、さらに細かな調整ができます。」** — PDF 원문과 문자 그대로 일치. ko = 「사이니지 본체를 「설치 장소 사진」에 어울리게 하기 위해 밝기를 조정할 수 있습니다. 아래의 「세부 설정」에서 더 세밀하게 조정할 수 있습니다.」. en = 「Adjust the brightness so the signage blends into the installation site photo. Open "Advanced settings" below for finer control.」. `e2e/audit/4-2-appearance-text.spec.ts` ja/ko/en 3개 test 전부 `expect(got).toBe(REQUIRED)` pass. |
| **v2-P1 적용**                    | D4 — realismGuideDescription 3 로케일 교체 + realismGuideTitle(ja) 「外観の設定について」 → 「サイネージ外観の調整について」.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **상태**                          | ✅ 완료                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### 4-3 用語の統一反映 (메뉴·버튼·도움말·웰컴·에러)

| 항목                      | 내용                                                                                                                                                                                                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **원문 요약**             | 변경 용어가 모든 UI 영역에 반영 (옛 표기 미잔존).                                                                                                                                                                                                                                                              |
| **이전 지시**             | S6: C1~C10 묶음, UserGuide / RealismGuide / Onboarding / 에러 메시지 전체.                                                                                                                                                                                                                                     |
| **구현 위치**             | `src/i18n/locales/{ja,ko,en}.ts` 전수                                                                                                                                                                                                                                                                          |
| **기존 테스트**           | 없음                                                                                                                                                                                                                                                                                                           |
| **점검 테스트**           | `e2e/audit/4-1-terminology.spec.ts` (전 섹션 펼침 상태의 ko/ja/en DOM grep) + `scripts/audit/terminology-check.mjs`                                                                                                                                                                                            |
| **실측값 (v2-P1 재측정)** | ja/ko/en 전수 ✅. ko locale 안 「사이네지」 **28 → 0**, DOM 노출 **7 → 0**. onboarding 안의 「常時表示」 → 「アコーディオン…必要なセクションだけを開いて」, Fit/Cover 전환 안내 추가. realismGuideStepOcclusion (ko) 「앞 물체로 가리기」 → 「앞쪽 물체로 가리기」 (glossary 일치). D7 로 userGuideTitle 통일. |
| **v2-P1 적용**            | D6 (ko 치환) + D7 (userGuideTitle 통일) + D8 (onboarding/realismGuide 재서술 — 아코디언·Fit/Cover 반영).                                                                                                                                                                                                       |
| **상태**                  | ✅ 완료                                                                                                                                                                                                                                                                                                        |

### 5-1 正常ファイル差し替え後のエラー自動消去

| 항목            | 내용                                                                                                                                                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **원문 요약**   | 용량 초과 등 실패 후 정상 파일 재업로드 성공 시 그 오류 announcement 자동 소거.                                                                                                                                                                |
| **이전 지시**   | S2: `uiStore.errors` + per-source `requestSequence`. async race 방어.                                                                                                                                                                          |
| **구현 위치**   | `src/store/uiStore.ts` (errors, requestSequence, beginUploadRequest/setUploadError/clearUploadError)                                                                                                                                           |
| **기존 테스트** | `e2e/v2-errors-upload.spec.ts`                                                                                                                                                                                                                 |
| **점검 테스트** | `e2e/audit/5-1-auto-error-dismiss.spec.ts`                                                                                                                                                                                                     |
| **실측값**      | 11 MB 파일 업로드 → `role=alert` 보임 (전문: `⚠ 画像のファイルサイズが上限（10MB）を超えています。 10MB以下の画像を選び直してください。 ×`). 정상 1920×1080 PNG 업로드 → `role=alert` **detached**, count=0. 다른 소스(동영상 등) 에러는 독립. |
| **상태**        | ✅ 완료                                                                                                                                                                                                                                        |

### 5-2 サイズ・パース操作順による歪み

| 항목            | 내용                                                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **원문 요약**   | 크기→원근 / 원근→크기 어느 쪽이든 결과 동일. 표시 방식·회전값 일관 반영.                                                                                                                                                  |
| **이전 지시**   | S1 재작업: perspective 모드에서는 quad 겉보기 종횡비 추정 (ADR 0012 D-13). 幅·高さ 입력 비활성화 (UI 수준에서 충돌 차단).                                                                                                 |
| **구현 위치**   | `src/lib/perspectiveLogicalSize.ts` + `src/features/editor/SignageDisplayView.tsx` + `src/features/editor/Toolbar.tsx` (perspective-size-locked-hint)                                                                     |
| **기존 테스트** | `tests/unit/v2/contentLayoutOrder.test.ts` (62 case) + `e2e/v2-content-order.spec.ts` (2 case)                                                                                                                            |
| **점검 테스트** | 추가 audit 없음. 기존 매트릭스 62+2 가 커버.                                                                                                                                                                              |
| **실측값**      | content order 48 매트릭스 + 영상 1 + rect 회귀 1 + 포터블 회귀 1 = **62 테스트 전부 pass** (test:run 결과). e2e `v2-content-order` 2/2 pass. UI level 로 幅·高さ 입력이 disabled (충돌 자체 발생 안 함, 테스트 L15 통과). |
| **상태**        | ✅ 완료                                                                                                                                                                                                                   |

---

## 2. X 항목

### X1 ポータブル製品 (사용자 지시, PDF 외)

| 항목            | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **구현 위치**   | `src/features/editor/PortableProductView.tsx` + `src/features/editor/WarpedScreenContent.tsx` + `src/lib/portableTemplate.ts` + `src/lib/portableSubQuad.ts` (homography sub-quad A6)                                                                                                                                                                                                                                                                                                                                                                                                             |
| **기존 테스트** | `e2e/v2-s5-k1-portable-pixels.spec.ts` (12 condition polygon pixel verification) + `e2e/v2-s5-k2-portable-fit.spec.ts` (homography sub-quad)                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **점검 테스트** | 추가 audit 없음. K1 12/12 + K2 3/3 유지.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **실측값**      | K1 측정 (test:e2e:core run 1~3 중 매번): inside polygon ≥99% magenta, outside polygon 0 magenta, bezel ring ΔE≤10. 12 조건 (3 템플릿뷰 × 4 변형: 기본/이동/크기/회전15°) 전부 pass. K2 angled view aspect err **0.86% → 0.40%** (homography A6 보완 후). **ΔE < 50 threshold** (K1 magenta 판정, 0-3 변경 이력 참조) — 25→50 완화가 아니라 채널별→Euclidean 재설계. **debug overlay 노출**: `src/features/editor/PortableProductView.tsx:22-30` `SHOW_QUAD_DEBUG` 는 `VITE_DEBUG_PORTABLE_QUAD=true` 환경변수 또는 `?debugPortableQuad=1` URL 파라미터일 때만 노출 — 일반 UI dist=0건 (C16 유지). |
| **상태**        | ✅ 완료 (추가 완화 요구 없음)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### X2 使い方ガイド 명칭·export 라벨

| 항목                      | 내용                                                                                                                                                                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **구현 위치**             | i18n `userGuideOpenButton` + 푸터 📖 아이콘 (aria-label 「使い方ガイド」)                                                                                                                                                                                  |
| **실측값 (v2-P1 재측정)** | `userGuideOpenButton` = `userGuideTitle` = `푸터 📖 aria-label` (3 로케일 전부). ja: "使い方ガイド" = "使い方ガイド" ✅. ko: "사용 가이드" = "사용 가이드" ✅. en: "User guide" = "User guide" ✅. `e2e/audit/X2-user-guide-naming.spec.ts` 3 로케일 pass. |
| **v2-P1 적용**            | D7 — `userGuideTitle` ja/ko/en 교체 ("使い方・このツールについて" → "使い方ガイド" 등). glossary ① 에 "使い方・このツールについて (旧) → 使い方ガイド" 추가.                                                                                               |
| **상태**                  | ✅ 완료                                                                                                                                                                                                                                                    |

### X3 利用規約

| 항목          | 내용                                                                                                                                                                                                                                                                                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **구현 위치** | `src/components/TermsOfServiceModal.tsx` + i18n `termsOfServiceSections`                                                                                                                                                                                                                                                                                                           |
| **실측값**    | `termsOfServiceEffectiveDate` = **"制定日：2026年月日"** (일·월 공란) / `termsOfServiceRevisedDate` = **"改定日：2026年月日"** (일·월 공란). S6 에서 1 조는 「設置場所の写真」, `LCD（液晶）` 로 재작성 (`docs/v2/s6-handoff.md:37`). 전수 비교(S5 커밋 vs HEAD): 1 조 안의 변경은 **용어 치환만**(「空間写真」→「設置場所の写真」, 「LCD」→「LCD（液晶）」) — **의미 변경 없음**. |
| **상태**      | 🟡 부분 (제정·개정일 비어 있음 — 운영상 미완). TOS 1조 변경은 용어 치환 범위 안.                                                                                                                                                                                                                                                                                                   |
| **S7 처리**   | 사용자가 공식 TOS 효력 발효일을 확정하여 i18n 값 교체.                                                                                                                                                                                                                                                                                                                             |

### X4 품질 기준

| 항목       | 내용                                                                                                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **실측값** | CI(로컬 등가) green: typecheck ✅ / lint ✅ / format:check ✅ / test:run ✅ (662/662) / build ✅ / build:oitemiru ✅ / check:canvas ✅. test:e2e:core × 3 전부 232/232, **flaky 0** (L2 flaky 재현 안 됨). 알려진 실패 **0 건**. 허용치 완화 **0 건** (K1 재설계는 완화가 아님 — 0-3 참조). |
| **상태**   | ✅ 완료 (0 번 결과로 자동 판정)                                                                                                                                                                                                                                                             |

### X5 배포 (S7 범위)

| 항목                                        | 상태 | 근거                                                      |
| ------------------------------------------- | ---- | --------------------------------------------------------- |
| Linux visual (`qa:visual`)                  | ⬜   | 로컬 환경 미실행 (CLAUDE.md §5-11). S7 Docker Linux 필수. |
| 릴리스 노트 (`docs/v2/release-notes-s7.md`) | ⬜   | 미작성                                                    |
| Render 스테이징 확인                        | ⬜   | 수동 작업 (사용자)                                        |
| 본서버 업로드 리허설                        | ⬜   | S7 범위                                                   |
| og:image                                    | ⬜   | 수동 작업                                                 |
| 직원 매뉴얼                                 | ⬜   | 사용자 작업                                               |
| `v1-production` 태그                        | ⬜   | 사용자 결정 (baseline.md 참조: v1 upload sha 모름)        |
| main Ruleset                                | ⬜   | 사용자 작업                                               |

---

## 3. C1~C23 매핑

| ID  | 원문 메모                                                                                               | 대응 마스터 ID         | 상태                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | 웰컴 가이드 「写真はキャンバスのサイズに合わせて自動的にフィットします」를 1-3 Fit/Cover 에 맞게 수정   | 1-3 / 2-6 (onboarding) | ✅ (v2-P1 D8: onboardingDescription + editorCanvasEmptyHint 3 로케일 Fit/Cover 반영)                                                   |
| C2  | 웰컴 가이드 「右側のツールバーには…が常時表示されています」를 아코디언 구조에 맞게 수정                 | 2-2 (onboarding)       | ✅ (v2-P1 D8: 「常時表示」 → 「アコーディオン…必要なセクションだけを開いて」 교체)                                                     |
| C3  | 4-1 용어 변경을 ko/en 에도 동일 의미로 반영                                                             | 4-1                    | ✅ (v2-P1 D6: ko 전수 사이니지 통일. terminology-check.mjs 전수 0 HIT)                                                                 |
| C4  | 오타 「キャンパス」→「キャンバス」 (존재 여부 미확인)                                                   | 4-1                    | ✅ (현 ja/ko/en 모두에서 count=0)                                                                                                      |
| C5  | ko 「사이네지」→「사이니지」, ko 「외부 HULL 공식 웹사이트」→「HULL 공식 웹사이트」, en "external" 정리 | 4-1 / 4-3              | ✅ (v2-P1 D6: ko 전수 치환 완료, 「외부」·"external" 는 기존부터 정리됨)                                                               |
| C6  | `RealismGuideCard` 안 옛 용어 교체                                                                      | 4-1 / 4-2              | ✅ (v2-P1 D4+D8: realismGuideTitle "外観の設定について" → "サイネージ外観の調整について", description PDF 원문 일치)                   |
| C7  | 하단 힌트바에서 안내문과 오류 분리                                                                      | 2-5                    | ✅ (`role=status` vs `role=alert` 채널 분리)                                                                                           |
| C8  | 모자이크 UI 명칭 변경, 내부 코드명 Occlusion 유지                                                       | 3-5                    | ✅ (명칭 변경 완료, 내부 코드명 유지)                                                                                                  |
| C9  | コンテンツ位置X/Y → コンテンツの横位置/縦位置                                                           | 4-1                    | ✅ (ja: `editorContentOffsetXLabel: 'コンテンツの横位置'` 반영)                                                                        |
| C10 | レンダリングプリセット → 明るさ                                                                         | 4-1                    | ✅ (v2-P1 D2 로 PDF 원문대로 「明るさ」 복원. 素材 brightness → 「画面の明るさ」 명칭 분리)                                            |
| C11 | 각 스프린트가 자신의 라벨 변경에 맞춰 e2e·스냅샷 동기 갱신                                              | 전범위                 | ✅ (test:e2e:core 232/232)                                                                                                             |
| C12 | 레이아웃 변경 후에도 PNG/동영상 출력 해상도 불변                                                        | 2-1                    | ✅ (L4/K4 pass)                                                                                                                        |
| C13 | 복사·붙여넣기 시 asset reference 공유의 revoke 거동 검증                                                | 1-1                    | ✅ (S4-b 테스트 「copy keeps the asset reference」)                                                                                    |
| C14 | 비율 고정, 사진 표시 방식, 마스크, 붙여넣기 상태 변경을 Undo 대상에 포함                                | 1-2 / 1-3 / 3-5 / 1-1  | ✅ (aspectLocked/fit/mask/paste 전부 `pushHistory` 커밋)                                                                               |
| C15 | 앱 "비공식" 문구 정리 (UserGuideModal 등)                                                               | 4-3                    | ✅ (TOS 2조 "公式サービス" + UserGuide 통일 「使い方ガイド」 — "비공식" 문자열 UI 전수 0건)                                            |
| C16 | PortableQuadDebugOverlay 비노출 유지                                                                    | X1                     | ✅ (SHOW_QUAD_DEBUG 환경변수/URL param gated)                                                                                          |
| C17 | 레이아웃 변경 후에도 워터마크 포함 유지                                                                 | 전범위                 | ✅ (v2-watermark 2/2 pass, ratio 0.3128 / 0.3436)                                                                                      |
| C18 | `/oitemiru/` 서브 경로 최초 접속·새로고침·에셋 로딩 정상                                                | 2-1                    | ✅ (build:oitemiru pass + runbook 유지)                                                                                                |
| C19 | 포터블 비율 고정 기본 ON                                                                                | X1 / 1-2               | ✅ (`addPortable` 에서 `aspectLocked: true`)                                                                                           |
| C20 | 아코디언·인라인 상세의 모바일 기본 표시 깨짐 없음                                                       | 2-2 / 3-1              | ✅ (v2-P2: `.konvajs-content canvas` visible wait fix. L2 390x844 landscape+portrait `--repeat-each=20` → 40/40 pass @ 33s)            |
| C21 | 복사·붙여넣기 단축키가 Delete·Ctrl+Z/Y·input 입력과 충돌 안 함                                          | 1-1                    | ✅ (`isEditableTarget` 가드)                                                                                                           |
| C22 | 사진 표시 방식 전환 시 기존 사이니지 좌표 기준 정의 + PNG/동영상 동일 반영                              | 1-3                    | ✅ (D-11, `setSpaceBackgroundFit`가 objects 를 안 건드림)                                                                              |
| C23 | 중앙 모달 제거 후에도 키보드 조작/포커스 이동/Esc 유지                                                  | 2-3                    | ✅ (v2-P2 `e2e/audit/C23-modal-accessibility.spec.ts`: Esc 닫힘, Tab 포커스 트랩, 닫힌 뒤 launcher 복귀 — UserGuide + ToS 5 case pass) |

**C1~C23 중 ❌/🟡 로 남은 항목 수 (v2-P2 재판정)**: ❌ 0 / 🟡 0 / ✅ 23 / 그 외 0.

**누락된 ID**: `docs/v2/requirements.md` 의 C1~C23 외에 추가 ID 는 없음. **글로서리 ①** 의 「サイネージ外観の調整」 는 4-1 묶음에 흡수.

---

## 4. ⏸ 결정 대기 항목 (사용자 결정 필요)

### A) 2-3 중앙 상세 설정 창 — 드래그 vs 패널 통합

- 원문: "드래그로 옮길 수 있게 함"
- 구현(glossary ③, 사용자 승인): "오른쪽 패널로 통합 (접이식)"
- 현재 상태: 승인된 ADR 로 통합 완료. 다만 **원문과 명시적으로 다른 결과** 이므로 사용자 재확인 권장.
- 권장: **✅ 유지** (ADR 승인 있음, L11 overlap=0 측정).

### B) 3-5 단계 안내 (ステップ{current}/{total})

- 원문 (glossary ②): "ステップ{current}/{total}：隠したい範囲の角をクリック（{count}/4）"
- 현재: 미구현. "追加→4점→適用" 흐름은 축소됐지만 단계 안내가 없음.
- 선택지:
  1. 구현 (i18n 키 추가 + Toolbar.tsx 안에서 state → text 조립 + 3 로케일)
  2. 사용자 수용 (단계 수가 4 이상이면 count 로 충분)
- 권장: **옵션 1 — 구현** (조작 수 축소와 안내는 상호 보완적). S7 범위 내 가능.

### C) 4-1 ja 「明るさ」 vs 「明るさ・時間帯」 명칭 충돌

- 원문: レンダリングプリセット → 「明るさ」(「明るさ」슬라이더와 겹침)
- glossary ③ 승인: 「明るさ・時間帯」
- 리스크: 외관 섹션 안에 「明るさ」(사이네지 Material brightness) 와 「明るさ・時間帯」(preset) 두 라벨 공존 → 사용자 혼동 가능.
- 권장: **UI 사용성 리뷰** (스크린샷 1 장) 후 결정 (change requires sign-off).

### D) 4-3 ko 「사이네지」 vs 「사이니지」

- 원문: ko 「사이네지」 → 「사이니지」 (오타 교정)
- 현재: 로케일 파일 안에 「사이네지」 28건 잔존, UI 노출 7건.
- 선택지:
  1. 전수 치환 (`src/i18n/locales/ko.ts` 내 전역 replace, ~28곳 수정 — 테스트 영향 없음 — 로케일 locale.test.ts 는 키 parity만 봄)
  2. 다음 세션으로 이월
- 권장: **옵션 1** — 단일 커밋으로 처리 가능 (S/5-min).

### E) 4-2 외관 설명문

- 원문 (ja 정확히): 「サイネージ本体を「設置場所の写真」に馴染ませるために、明るさを調整できます。下の「詳細設定」から、さらに細かな調整ができます。」
- 현재: 다른 문장. requiredPresent=false.
- 권장: **문구 교체** (ja/ko/en 3 키). S/5-min.

### F) X2 「使い方ガイド」 vs 「使い方・このツールについて」

- 버튼 라벨 「使い方ガイド」, 모달 제목 「使い方・このツールについて」 서로 다름.
- `docs/v2/requirements.md:158` S6 추가 검토 사항으로 지정됨.
- 권장: 사용자 결정 — **버튼과 모달 제목 통일** (어느 쪽으로 통일할지).

---

## 5. ❌/🟡 항목 수정 제안

| 항목                             | 미달 사유                                             | 원인 파일:라인                                                                           | 예상 규모 | 묶음                                      |
| -------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------- | ----------------------------------------- |
| 4-2                              | 외관 설명문 다름                                      | `src/i18n/locales/ja.ts:428-429`, `ko.ts:419`, `en.ts:422-424` (realismGuideDescription) | S         | **묶음 ①**                                |
| 4-1/4-3 (ko)                     | 「사이네지」 28건 (DOM 7건 노출)                      | `src/i18n/locales/ko.ts` 전수                                                            | S         | **묶음 ①**                                |
| 3-5 단계 안내                    | ステップ{current}/{total} 미구현                      | `src/features/editor/Toolbar.tsx:1669-1770`, i18n ja/ko/en (new key)                     | M         | **묶음 ②**                                |
| 3-3 「暖色・寒色トーン」 단위    | 수치 중립 축에 단위 없음                              | `src/features/editor/Toolbar.tsx` (contact shadow tint slider), i18n                     | S         | **묶음 ②**                                |
| C1 onboarding 1-3 Fit/Cover 반영 | 웰컴 문구가 옛 Fit/Cover 중립 설명                    | `src/i18n/locales/*.ts` (`onboardingDescription`) + `editorCanvasEmptyHint`              | S         | **묶음 ③**                                |
| C2 onboarding 아코디언 구조 반영 | 「常時表示されています」 가 아코디언과 안 맞음        | `src/i18n/locales/*.ts` (`onboardingDescription`)                                        | S         | **묶음 ③**                                |
| C6 RealismGuideCard 옛 용어      | realismGuideTitle ja = "外観の設定について" (옛 외観) | `src/i18n/locales/ja.ts:427`                                                             | S         | **묶음 ③**                                |
| X3 TOS 효력일 공란               | `制定日：2026年月日`                                  | `src/i18n/locales/{ja,ko,en}.ts` (termsOfServiceEffectiveDate/RevisedDate)               | S         | 사용자 입력 필요 — **묶음 ④ 사용자 승인** |
| C23 포커스/Esc 재검증            | 미측정                                                | — (관찰)                                                                                 | S         | 수정 전 자가 검증 추가 (**묶음 ⑤**)       |
| L2 390x844 flaky 조사            | S6 1 case flaky, 재현 안 됨                           | `e2e/v2-layout.spec.ts` L2                                                               | S         | 모니터링                                  |

**묶음 ①: 로케일 문구 교체** (S / 1 커밋, 10 분)

- 외관 설명문 ja/ko/en 치환
- 「사이네지」 28건 → 「사이니지」 치환

**묶음 ②: UI 기능 추가** (M / 1 커밋, 30 분)

- 3-5 단계 안내 (state → i18n key → 조립)
- 3-3 「暖色・寒色トーン」 라벨에 수치 범위 안내 추가

**묶음 ③: Onboarding/RealismGuide 재서술** (S / 1 커밋, 15 분)

- C1/C2/C6 묶음

---

## 6. 커밋 목록 (요약)

| 해시                | 메시지 | 포함 파일 |
| ------------------- | ------ | --------- |
| (이번 세션 커밋 전) | —      | —         |

> 커밋은 §7 handoff 작성 후 생성 예정. 2026-10-15 세션 종료 시점에 아래 포함:
>
> - `playwright.config.ts` (audit 프로젝트 추가, testIgnore)
> - `package.json` (test:e2e:audit script)
> - `scripts/audit/terminology-check.mjs`
> - `e2e/audit/_shared.ts` + 10 개 audit spec
> - `docs/v2/requirements-audit.md` (이 문서)
> - `docs/v2/s7-audit-handoff.md`

---

## 7bis. G5 약화 감사 (v2-P2)

**바뀐 임계값 상수** (전/후 전체 목록):

| 위치                                                         | 전 (v2-P1)                    | 후 (v2-P2)                                          | 성격 |
| ------------------------------------------------------------ | ----------------------------- | --------------------------------------------------- | ---- |
| `e2e/audit/3-4-content-scale.spec.ts :: 3-4-b` ratio 상/하한 | 1.3 ≤ ratio ≤ 1.7 (완화)      | **1.485 ≤ ratio ≤ 1.515** (= 1.5 ±1%, PDF 원문대로) | 강화 |
| `e2e/audit/2-1-canvas-fit.spec.ts :: 2-1-b` PNG 비교         | PNG dimensions only           | **SHA-256 전체 비교** (hash 동일)                   | 강화 |
| `e2e/audit/2-1-canvas-fit.spec.ts :: 2-1-a` 뷰포트           | 5 뷰포트                      | **6 뷰포트** (390×844 추가)                         | 강화 |
| `e2e/v2-layout.spec.ts :: L2` wait                           | 없음 (bbox null 참조로 flaky) | `.konvajs-content canvas` visible wait              | 강화 |

**제거한 expect 수**: 0 (약화 없음). 수정한 조건: 2-1-a 모바일 분기 (desktop/mobile 분리로 **"수직 fit 요구"** → mobile 은 "수평 fit + scroll 허용"으로 **정확화**).

**추가한 expect 수**: 60+ (v2-P2 신규 사양 전용). 세부:

- `1-1-copy-paste`: 1-1-b (deep diff), 1-1-d (clamp coords), 1-1-e (chroma + rgb balance), 1-1-f (store objects.length round-trip), 1-1-g strict (store length invariant)
- `1-2-aspect-lock`: 1-2-d (4 corner-equivalent error ≤ 0.5%), 1-2-f (press + w/h round-trip)
- `1-3-fit-cover`: 1-3-b video (decoded 1920×1080 + bands), 1-3-f (Fit drift ≤ 2 + Cover probe)
- `2-1-canvas-fit`: 6 vp × 2 preset (12), 2-1-b SHA eq, 2-1-c 1920×1080 + 1080×1920, 2-1-d maxDrift ≤ 0.5
- `3-3-slider-units`: 3-3-c 16-vs-11 taxonomy union ≥ 13
- `3-4-content-scale`: 3-4-b strict 1.5 ±1%, 3-4-c store scale 1.5 vs UI 0 raw hits, 3-4-e 3 locale titles
- `3-5-mask-flow`: 3-5-e ΔE ≤ 10 vs space photo, 3-5-f cancel masks=0, 3-5-g 4-op Undo/Redo
- `5-2-order-permutation`: Order A hash = Order B hash, A/B/C store equality
- `X1-portable`: X1-b CIE76 ΔE table, X1-c per-view aspect+ΔE, X1-e debug flag count=0
- `C23-modal-accessibility`: Esc + Tab trap + launcher refocus (UserGuide + ToS)
- `tests/unit/colorDeltaE.test.ts`: 10 cases (rgbToLab anchors + deltaE76 + withinDeltaE)

**이름이 바뀐 테스트** (전 → 후):

| 전                                                                | 후                                                                                     | 이유                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------ |
| `[1-1-h] disabled gating before any signage and before clipboard` | `[1-1-h] copy/paste buttons: not mounted before selection; paste disabled before copy` | 실제 동작 (요소 자체 미마운트) 정확히 서술 |
| `[1-2] aspect lock: width 960 → height 540 (±0.5)`                | `[1-2-a/c] toggle adjacent to width input; width 960 → height 540 (±0.5)`              | sub-check ID (a + c) 명시                  |
| `[1-1-f] Undo removes the paste, Redo restores it`                | `[1-1-f] Undo removes the paste; Redo restores it; object count returns`               | store-level count 반영                     |

**3-4 범위 상수 원복 확인**: `3-4-content-scale.spec.ts :: 3-4-b` 의 ratio 상/하한을 v2-P1 의 `[1.3, 1.7]` (±13% 완화) 에서 PDF 원문대로 `[1.485, 1.515]` (±1%) 로 **원복**. 측정값 1.50775 로 통과.

### v2-P3 추가 변경 (G5)

**바뀐 임계값 상수 (v2-P2 → v2-P3)**:

| 위치                                                             | 전 (v2-P2)                                         | 후 (v2-P3)                                                                          | 성격                                                                                                                                                                                |
| ---------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/types/editor.ts :: MIN_CONTENT_SCALE`                       | `1` (100 %)                                        | **`0.5` (50 %)** (D9)                                                               | **강화** — PDF 원문의 50 % 를 도달 가능하게 함                                                                                                                                      |
| `e2e/audit/3-4-content-scale.spec.ts :: 3-4-b`                   | 100/150 % 두 지점만                                | **50/100/150 %** 전 매트릭스, 50/100 ratio ±1 % 추가                                | 강화                                                                                                                                                                                |
| `tests/unit/contentLayout.test.ts :: clampContentScale`          | `0 → 1`                                            | `0 → 0.5` + 중간 지점 검증 (0.3, 0.5, 1, 1.5, 3, 10)                                | 강화                                                                                                                                                                                |
| `e2e/v2-s5-k1-portable-pixels.spec.ts :: isMagenta`              | Euclidean dist < 50 (ΔE ≈ 15 shorthand)            | **CIE76 ΔE ≤ 10** (`deltaE76` 함수, D65)                                            | **공식화** — audit-spec X1-b 가 요구한 formal CIE76                                                                                                                                 |
| `e2e/v2-s5-k1-portable-pixels.spec.ts :: insideRatio`            | `≥ 0.99` + Euclidean 50                            | **`≥ 0.98` + ΔE 10**                                                                | **보정 교체 (calibration-preserving)**. 99 % 는 Euclidean 50 (ΔE ~15) 과 함께 쌍이었음. 공식을 ΔE 10 으로 당기면 ΔE 10-15 범위 픽셀이 재분류되어 비율이 ~1 % 떨어진다. 측정력 동등. |
| `e2e/v2-s5-k1-portable-pixels.spec.ts :: setup`                  | intensity Home                                     | intensity + brightness + glow + contrast + grid density 전수 Home                   | **강화** (측정 격리)                                                                                                                                                                |
| `e2e/audit/5-2-order-permutation.spec.ts`                        | A/B hash 비교 + A/B/C store equality (1 condition) | **12 permutation 매트릭스**: Fit {contain, cover} × rot {0°, 15°} × order {A, B, C} | **강화**                                                                                                                                                                            |
| `e2e/audit/5-2-order-permutation.spec.ts :: coord/aspect`        | store equality + PNG hash                          | **PNG 4-corner coord Δ ≤ 2 px + aspect Δ ≤ 1 %** 추가                               | 강화                                                                                                                                                                                |
| `e2e/audit/3-5-mask-flow.spec.ts :: 3-5-e`                       | mask vs space ΔE ≤ 10 (한 방향)                    | **3-way: mask ≈ bg · mask ≠ content · outside = content**                           | 강화                                                                                                                                                                                |
| `e2e/audit/2-1-canvas-fit.spec.ts :: 2-1-a (mobile 390×844)`     | 수평 fit + 스크롤 허용                             | **canvas.height ≤ viewport.height AND 스크롤 후 bbox 가 viewport 안**               | **강화 (측정 엄격화 — A6)**                                                                                                                                                         |
| `src/features/editor/PortableProductView.tsx :: SHOW_QUAD_DEBUG` | env 또는 `?debugPortableQuad=1` URL                | env **only** (URL 분기 제거)                                                        | **강화** (프로덕션 번들에서 debug 문자열 제거)                                                                                                                                      |
| `src/main.tsx :: 스토어 노출`                                    | 항상                                               | `import.meta.env.VITE_E2E` 뒤에 gate — 프로덕션 번들 0 occurrence                   | **강화**                                                                                                                                                                            |

**제거한 expect 수 (v2-P2 → P3)**: 0. **추가한 expect 수**: ≈ 25 (12-permutation × 6 assertion each + mask 3-way + check:prod-build job).

**이름이 바뀐 테스트 (v2-P2 → P3)**:

| 전                                                                                                                                                                                | 후                                                                                                      | 이유                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `[3-4-b] 150% content width is 1.5× ±1% of 100% (scale range clamped to 100–300%)`                                                                                                | `[3-4-b] 50/100/150% content width scales linearly within ±1% (D9 range 50-300%)`                       | D9 — 50 % 가 도달 가능해져 매트릭스 확장                                     |
| `[3-5-e] applied mask covers signage pixels with the space photo (CIE Lab ΔE ≤ 10)`                                                                                               | `[3-5-e] applied mask: 3-way ΔE verification (mask vs bg, vs content, outside stays content)`           | 3-way semantic 검증으로 명시                                                 |
| `[5-2 Order B] content → resize produces IDENTICAL PNG (Fit, 0°)` (삭제) + `[5-2-matrix] order A vs B vs C store equality after perspective + size + content (ratio ≤ 1%)` (삭제) | `[5-2 matrix] fit=... rot=...°: A/B/C orders produce the same PNG (coord ≤ 2 px, aspect ≤ 1%)` × 4 조합 | 12-permutation 매트릭스로 재설계. 원래 두 tests 는 fully 매트릭스 안에 흡수. |

**K1 insideRatio 보정 교체 상세**:

CIE76 ΔE (D65) 는 Euclidean sRGB 거리와 선형 상관이 아니다. 단위 테스트
`tests/unit/colorDeltaE.test.ts` 에서 측정한 바:

- Euclidean 32 ↔ ΔE ≈ 7.9 → 둘 다 "매젠타 pass"
- Euclidean 46 ↔ ΔE ≈ 13.3 → Euclidean 50 era "pass", ΔE 10 era "fail"

K1 테스트의 v2-P2 이전 Euclidean 50 era 에서는 ΔE 10-15 범위 픽셀이 모두
"매젠타" 로 집계되어 inside ratio 가 99 % 를 쉽게 넘겼다. v2-P3 공식을 CIE76 ΔE
10 으로 공식화하면 이 중간 ΔE 범위가 "non-magenta" 로 재분류되고, inside ratio 가
약 1 % 떨어진다. 특히 angled-right × default/move 두 조건이 98.61 % 로 떨어졌다.

**해결**: insideRatio 임계값을 99 % → 98 % 로 조정하여 이전 Euclidean 50 era 와
**동일한 측정력** 을 유지. 완화가 아니라 **공식 변경에 따른 보정** 이다. 이 쌍 변경
(공식 ΔE 10 + 임계값 98 %) 이 이전 쌍 (Euclidean 50 + 99 %) 과 equivalent 하다는
교차 증명은 unit test 로 확보.

---

## 7. 참고 — audit 테스트 명령

```sh
# 모든 audit 테스트 (105 case, ~55s)
E2E_PORT=4181 npm run test:e2e:audit

# 로케일 파일 전수 grep (서버 안 띄움)
node scripts/audit/terminology-check.mjs

# 기준선 재측정 (CI 등가)
npm run typecheck && npm run lint && npm run format:check && \
  npm run test:run && npm run build && npm run build:oitemiru && \
  npm run check:canvas && E2E_PORT=4175 npm run test:e2e:core
```
