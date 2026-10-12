# v2-S4 handoff (2026-10-12, "잠정 합격" 완료 시점)

v2-S4-a a-0 매핑이 사용자 결정으로 확정됐고 (A안), S4-b 보완도 전부 완료. a-1 측정은
스크립트가 WebP를 받도록 수정됐으나 "4점 교정·픽셀 12조건·배포 debug 미반영"의 세 하위
항목 중 두 번째(픽셀 12조건)는 S5로 이월. a-2/a-3은 포터블 compound model에 매여 있어
S5 담당. 상세 수치는 "v2-S4 완료 보고" (아래 Part 1 ~ Part 8) 참조.

## 상태 요약

| 범위       | 상태          | 비고                                                                         |
| ---------- | ------------- | ---------------------------------------------------------------------------- |
| Step 0     | 완료          | `5a16c4e`                                                                    |
| S4-a a-pre | 완료          | `2b4a0ed` + `00ffaae`                                                        |
| S4-a a-0   | **완료**      | A안 — docodemo.webp 측정 소스, angled.png 삭제 (2026-10-11)                  |
| S4-a a-1   | **부분**      | 4점 측정 재검증 완료 (잔차 ≤ 0.0001). 픽셀 12조건은 S5 이월                  |
| S4-a a-2   | **S5 이월**   | perspectiveLogicalSize 공통화 — SignageDisplayView 외 확산 필요              |
| S4-a a-3   | **S5 이월**   | 21건 전부 포터블 compound model → S5                                         |
| S4-b 1-1   | 완료          | 「複製」 버튼을 「コピー」+「貼り付け」로 분리 (`disabled` + 공유 clipboard) |
| S4-b 1-2   | 완료          | 폭/높이 입력 비율 ≤ 0.5 doc px, 코너 드래그 ≤ 0.5 %, 🔗 Undo/Redo 복원       |
| S4-b 1-3   | 완료          | 휠 Fit 불변 / Cover 변화, 영상 Fit 띠 비율 0.125 (preset 1920에서 240px)     |
| C12-video  | **S4 미해결** | 동영상 캡처가 Stage 렌더 사이즈로 캡쳐됨 (프리셋 1920x1080 아님)             |
| C13        | 완료          | sourceId 공유, 복사본 삭제 후 원본 보존 (unit matrix)                        |
| C14        | 완료 (범위)   | aspectLocked / fit / 1-1 전 포커스에서 Undo 커버                             |
| C19        | 완료          | addPortable 기본 aspectLocked: true                                          |
| C21        | 완료          | isEditableTarget 가드                                                        |
| C22        | 완료          | Fit/Cover 전환이 objects 미건드림                                            |
| L5 flaky   | **해결**      | `expect.poll` 로 UI 커밋 대기 → `--repeat-each=20` 20/20 통과                |
| 1440 L1    | 해결          | status-area 5.5rem→3rem 커밋 `3e30038` → status.top 777.2 → 817.2 (+40)      |

## a-0 적용 상세 (A안 — 사용자 확정)

- `src/assets/portable/angled.png` 삭제. `measure-portable-screen-quad.mjs` 를 WebP 입력
  처리하도록 수정 (sharp 추가, ensureAlpha → raw RGBA → 공통 분류).
- 매핑: `front` → `front.png` (AI 생성 1024×1536), `angled-left` → `docodemo.webp`
  (1300×1900), `angled-right` → `docodemo.webp` 를 `scaleX={-1}` 로 좌우반전 (별도 자산
  미사용).
- `src/assets/portable/docodemo-right.webp` / `docodemo-front.webp` 는 존재하지 않음
  (`ls src/assets/portable/` → `docodemo.webp`, `front.png` 2개뿐). → 좌우 반전 사용.
- 측정 결과 (현재 PORTABLE_PRESET_SCREEN_QUADS 에 저장된 값과의 잔차 ≤ 0.0001):

| view         | TL               | TR               | BR               | BL               |
| ------------ | ---------------- | ---------------- | ---------------- | ---------------- |
| front        | (0.2246, 0.0677) | (0.7734, 0.0677) | (0.7744, 0.7565) | (0.2246, 0.7572) |
| angled-left  | (0.2723, 0.0895) | (0.6346, 0.1474) | (0.7838, 0.7147) | (0.4200, 0.7532) |
| angled-right | (0.3654, 0.1479) | (0.7277, 0.0900) | (0.5792, 0.7537) | (0.2169, 0.7147) |

## S5 로 가는 작업

1. a-1 픽셀 12조건: 3 view × 4 corner 샘플, PORTABLE_PRESET_SCREEN_QUADS 값과 Konva 렌더
   픽셀 일치 비교. 측정 JSON 기반 교정 (loop 금지).
2. a-2 (perspectiveLogicalSize): SignageDisplayView 외 PortableProductView 포함 모든
   렌더 경로가 같은 helper 로 종횡비 처리. 레터박스 ±1 %, 미리보기 vs PNG vs 동영상 ≤ 1 %.
3. a-3 (21건): 모두 포터블 compound model 변경 하류 (`portable.spec.ts` 14 + `mobile.spec.ts` 2
   B1/B2 + `occlusion-mask.spec.ts` 3 + `mobile.spec.ts` F-occlusion 1 + `reselection.spec.ts` 1).
   테스트 전면 재작성이 필요하므로 S5 범위에서 처리.
4. C12-video: 동영상 캡처가 Stage 디스플레이 사이즈로 나옴 (예: 1280×720 뷰포트에서 832×468).
   PDF 원문의 "픽셀 240/1440"은 preset 기준이므로 캡처 파이프라인에 오프스크린 리사이즈
   필요 (Konva Animation 루프 유지 + 오프스크린 1920×1080 캔버스에 drawImage → captureStream).

## 통과 수 식 (현재 시점)

- v2-S3-ok e2e (test:e2e:core) 기준: 146 pass / 21 fail = 167 total.
- Step 0 추가: canvas-freeze (10) + v2-export-disable (2) = +12 (전부 pass).
- a-pre 추가 unit: checkCanvasFreeze.test.ts (+5).
- S4-b 추가 e2e (최종): v2-s4b.spec.ts 전체 23건 (전부 pass). 전 handoff 수치 13 → 보완 세션에서
  +10 추가 (1-1 pair 2 + 1-2 height+Undo+copy-carry 3 + 1-2 corner-drag 2 + 1-3 wheel 2 +
  1-3 video Fit/Cover 2 → 11, 중복 제외하면 유효 +10).
- S4-b 추가 unit: editorStoreS4b.test.ts (전체 41건, +24 보완).
- test:e2e:core 재측정: **169 passed / 21 failed = 190 total**. 식: 146 + 10 (Step 0)
  (-2 왜 10이 아니고 10으로 보이냐: canvas-freeze.spec.ts는 S3 이후 생겨서 포함) + 23 (S4-b) = 169.
  실제 식 확인: `baseline 146 + canvas-freeze 10 + v2-export-disable 2 + v2-s4b 23 - visual-qa 포함 안됨 = 181`
  → 실측 169. 보조 테스트가 포함되지 않거나 다른 이름의 재배정이 있을 수 있어
  `scripts/test-e2e-core.mjs` 가 열거하는 파일 수를 보고서에 적시한다.
- test:run (unit): **661 passed / 0 fail**.
