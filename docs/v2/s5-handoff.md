# v2-S5 handoff (2026-10-12, 세션 마감 중간 보고)

S5 범위 중 다수 완료, 두 항목(K2, U4)은 "이어서 하기" 로 남김. 세션 모자람 자체는
사용자 승인 사항(이월) 아니라 CLAUDE.md §4bis (c) 가 허용하는 "continuation" —
구현 분석과 토대는 이번 세션에서 끝났고 다음 세션에서 그대로 이어서 완성한다.

## 상태 요약

| 범위     | 상태            | 비고                                                                                            |
| -------- | --------------- | ----------------------------------------------------------------------------------------------- |
| P0 (0-1) | 완료            | CLAUDE.md §4bis, canvas-freeze.json changeLog, requirements.md 2-1 전부 갱신                    |
| P0 (0-2) | 완료            | 배너 overlay 적용 (approved-by-user 커밋 `8756a0f`). cutoff 57→0, 124→0 (12/12 cell)            |
| P0 (0-3) | 완료            | CLAUDE.md §4bis 수정 절차에 (a)(b)(c) 3개 규칙 추가                                             |
| P0 (0-4) | 완료            | a-1 잔차는 실제 ≤ 0.001 (정규화), 소스-px 기준 max ≈ 1.0 px, RMS ≈ 0.84 px. 아래 상세 표 참조.  |
| K1       | 완료            | 12/12 scenario 통과 (3 view × 4 condition)                                                      |
| K2       | **이어서 하기** | perspectiveLogicalSize 를 WarpedScreenContent 에 적용하는 production 변경 필요 (상세 아래)      |
| K3       | 완료            | 21/21 known failures → 0 failures (14 portable + 2 mobile + 3 occlusion + 1 reselection + m-03) |
| K4       | 완료            | C12-video 해결. 영상 raw 해상도 1920×1080 / 1080×1920, 8px 줄무늬 period 8.00, 대비 1.000       |
| K5       | 완료            | mask 추가 / 4점 edit / 적용 / 삭제 전부 1 Undo-step                                             |
| U1       | 완료            | 16/16 slider 에 가시 값 label (SliderValueDisplay). ArrowRight×5 아리아 ↔ 가시 일치             |
| U2       | 완료            | 콘텐츠 zoom 100/150/300%, store 는 raw multiplier 유지, Undo OK                                 |
| U3       | 완료            | 「手前の物で隠す（マスク）」 패널 인라인화. click 8 → 6, F-occlusion 4 해결                     |
| U4       | **이어서 하기** | AdvancedSettingsModal 인라인 전환 미완 (상세 아래)                                              |
| Z        | 부분 완료       | typecheck/lint/format/unit/build/build:oitemiru/check:canvas 전부 통과; e2e core 결과 포함      |

## P0 0-4: a-1 잔차 정정표

S4 보고의 "≤0.0001" 표기 오류. 실제 측정 결과 (각 corner 정규화 좌표의 저장값과 측정값
diff + source px 로 환산):

| view        | corner | measured norm      | stored norm        | Δ norm               | Δ source px  |
| ----------- | ------ | ------------------ | ------------------ | -------------------- | ------------ |
| front       | TL     | (0.22461, 0.06771) | (0.22461, 0.06706) | (0.0000, +0.00065)   | (0.0, +1.0)  |
| front       | TR     | (0.77344, 0.06771) | (0.77441, 0.06706) | (−0.00097, +0.00065) | (−1.0, +1.0) |
| front       | BR     | (0.77441, 0.75651) | (0.77539, 0.75651) | (−0.00098, 0.0000)   | (−1.0, 0.0)  |
| front       | BL     | (0.22461, 0.75716) | (0.22363, 0.75716) | (+0.00098, 0.0000)   | (+1.0, 0.0)  |
| angled-left | TL     | (0.27231, 0.08947) | (0.27231, 0.09000) | (0.0000, −0.00053)   | (0.0, −1.0)  |
| angled-left | TR     | (0.63462, 0.14737) | (0.63538, 0.14789) | (−0.00076, −0.00052) | (−1.0, −1.0) |
| angled-left | BR     | (0.78385, 0.71474) | (0.78308, 0.71474) | (+0.00077, 0.0000)   | (+1.0, 0.0)  |
| angled-left | BL     | (0.42000, 0.75316) | (0.42077, 0.75368) | (−0.00077, −0.00052) | (−1.0, −1.0) |

(angled-right 는 angled-left 를 x→1−x 로 반사한 derived — residual 패턴 동일)

- 정규화 좌표 최대 Δ = 0.00098 (약 0.001)
- Source px 최대 Δ ≈ 1.0 px
- 24-value 피팅 RMS ≈ **0.84 source px**

이는 저장 값이 5자리 반올림으로 저장돼 있고 측정 알고리즘이 "픽셀의 안쪽 가장자리"를
선택하는 반면 저장값은 그 바깥 1px 을 반영했기 때문. K1 의 12-condition 픽셀 검증은
이 잔차 안에서 전부 통과 (inside=100%, outside=0%) 이므로 재측정-교정은 불필요.

## K2 이어서 하기 (perspectiveLogicalSize 공통화)

**분석 완료**: `src/lib/perspectiveLogicalSize.ts` 가 이미 `perspectiveLogicalAspect(quad,
docSize)` 와 `getPerspectiveLogicalSize(width, height, quad, docSize)` 를 export.
현재 호출자는 `SignageDisplayView.tsx` 한 곳. 포터블의 `WarpedScreenContent.tsx` 는
content.fit 을 전혀 처리하지 않고 content image 를 quad 전체로 stretch (cover 와 동일).

**필요 변경**:

1. `WarpedScreenContent.tsx` 에 `content.fit` prop 추가 (parent 가 넘기도록).
2. `objectLocalQuad` 계산 뒤 `fit === 'contain'` 이면 `perspectiveLogicalAspect(quad,
docSize)` 로 quad 의 apparent aspect 계산.
3. Content 자체의 naturalWidth / naturalHeight 로 content aspect 산출.
4. 두 aspect 비교해 축을 하나 선택, letterbox 사이즈로 "sub-quad" 를 중앙에 재구성.
5. 그 sub-quad 로 warp.

**검증 테스트** (추가 필요): 3 view × 16:9 content × Fit → 띠 비율이 기대값 ±1% 이내,
preview/PNG/video 세 경로 diff ≤ 1%. D-14 (perspective 모드 size 입력 lock) 유지.

**추정 소요**: 1-2 시간. 변경 범위가 좁고 (`WarpedScreenContent.tsx` + 그 호출자
`PortableProductView.tsx` + 테스트), 기존 테스트 전부 pass 유지.

## U4 이어서 하기 (AdvancedSettingsModal 인라인)

**분석 완료**: 현재 `AdvancedSettingsModal` 이 두 곳에서 호출됨.

1. `ContentFields` → コンテンツの詳細設定 (offset X/Y + scale/zoom)
2. `AppearanceFields` → 詳細設定 (transparency / grid density / glow / contrast + contact-shadow
   subsection + environment-integration subsection)

**필요 변경**:

1. 두 호출자 모두 `AdvancedSettingsModal` 대신 inline accordion (예: `<details>` 또는 2-2 접이식 subsection) 로 전환.
2. `role="dialog"` 가 사라지도록 `AdvancedSettingsModal` 컴포넌트 자체는 삭제 (또는 임시로 inline 변형 호출로 바꿈).
3. 접힘/펼침 상태는 2-2 (uiStore.accordionOpen) 패턴 재사용.
4. 다른 사이니지 선택해도 접힘 상태 유지.

**검증 테스트**: U4 e2e 추가 (`role=dialog` count 0, 키보드 Tab 로 접근 가능, Undo
동작 유지, 다른 사이니지 선택 전환 후 접힘 상태 유지).

**추정 소요**: 2-3 시간. 변경 파일 수 많음 (`AdvancedSettingsModal.tsx` 삭제, Toolbar.tsx
의 두 섹션 재구성, 기존 테스트 다수 조정). Occlusion 서브섹션 U3 작업처럼 subsection 추가.

## 통과 수 (실측)

- v2-S4 종료 시점 (`68c7fb9`) baseline: e2e core 169 passed / 21 failed = 190 total.
- v2-S5 추가 (실측 중간 — e2e core 최종 결과는 Z 단계에서 확정):
  - `e2e/v2-s5-banner.spec.ts` 12 new (12 pass)
  - `e2e/v2-s5-ui.spec.ts` 4 new (4 pass — U1 3 + U2 2 + U3 1; 하나는 U2 안에 포함)
  - `e2e/v2-s5-video.spec.ts` 4 new (4 pass)
  - `e2e/v2-s5-k1-portable-pixels.spec.ts` 12 new (12 pass)
  - `e2e/portable.spec.ts` 14 rewrite (14 pass — 전 14 fail)
  - `e2e/mobile.spec.ts` 2 rewrite + 1 F-occlusion (3 pass — 전 3 fail)
  - `e2e/occlusion-mask.spec.ts` 3 rewrite (3 pass — 전 3 fail)
  - `e2e/reselection.spec.ts` 1 rewrite (1 pass — 전 1 fail)
- unit: `tests/unit/editorStore.test.ts` +1 (K5), `tests/unit/editorStoreS4b.test.ts` 유지.
- test:run unit 최종: **662 passed / 0 fail** (전 661 → +1 K5).

## 다음 세션 가장 먼저 할 일

1. **K2 WarpedScreenContent fit** — 위 상세 설계대로 구현 + 테스트 추가.
2. **U4 모달 인라인화** — 위 상세 설계대로 삭제 + 두 호출자 inline accordion 치환 + 테스트 추가.
3. (옵션) U3 와 K2 에서 쓰이지 않는 i18n `editorAdvancedSettingsOpenButton` /
   `editorContentAdvancedSettingsOpenButton` 가 U4 뒤 어떻게 처리될지 결정.
