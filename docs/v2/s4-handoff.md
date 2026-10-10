# v2-S4 Step 0 + S4-a a-pre + S4-b handoff (2026-10-10, final)

v2-S4-a 와 v2-S4-b (범위 내 전체)가 완료되었다. v2-S4-a a-0 매핑 결정이 보류라 그에 의존하는
a-1~a-3 는 S5 로 이월된다.

## 상태 요약

| 범위       | 상태        | 비고                                                                                                 |
| ---------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| Step 0     | 완료        | 커밋 `5a16c4e` (이전 세션)                                                                           |
| S4-a a-pre | 완료        | 커밋 `2b4a0ed` + `00ffaae` (canvas-freeze spec/json/selector-guard 하드닝)                           |
| S4-a a-0   | **보류**    | 포터블 angled 에셋 매핑 `angled.png` vs `docodemo.webp` 모호 — 사용자 결정 대기 (A/B/C 옵션 handoff) |
| S4-a a-1   | **S5 이월** | a-0 결정 선행 필요                                                                                   |
| S4-a a-2   | **S5 이월** | a-0 결정 선행 필요                                                                                   |
| S4-a a-3   | **S5 이월** | 17 건 전부 포터블 compound model 관련 → a-0 결정 뒤                                                  |
| S4-b 1-1   | 완료        | copy/paste/duplicate (editorStore, EditorLayout, Toolbar, locales)                                   |
| S4-b 1-2   | 완료        | 🔗 aspectLocked (BaseSignageObject, PositionSizeSubsection, Transformer, Portable 기본 ON)           |
| S4-b 1-3   | 완료        | Fit/Cover 세그먼트 (SpaceBackground.fit, SpaceBackgroundView, 휠 가드)                               |
| S4-b C13   | 완료        | sourceId 공유 + collectAssetSourceIds 집계                                                           |
| S4-b C14   | 부분 완료   | 1-2/1-3/1-1 Undo 범위. occlusion 마스크는 S5                                                         |
| S4-b C19   | 완료        | addPortable aspectLocked: true                                                                       |
| S4-b C21   | 완료        | isEditableTarget 가드로 input 포커스에서 shortcut 무력화                                             |
| S4-b C22   | 완료        | Fit/Cover 전환이 objects 미건드림 + Stage toDataURL/캡처 공통 반영                                   |

## 멈춤 지점 — a-0 매핑 모호 (여전히 사용자 결정 대기)

프롬프트의 멈춤 조건 (4). `src/assets/portable/`에 `angled.png` + `docodemo.webp` 공존.
production (`PortableTemplateBody.tsx:51`) 은 `docodemo.webp` 사용, 측정 스크립트
(`measure-portable-screen-quad.mjs:40`) 은 `angled.png` 사용. 측정값이 완전히 다름.

### 옵션 (사용자 결정 대기)

| 옵션         | 설명                                                | 작업 범위                          | 영향                      |
| ------------ | --------------------------------------------------- | ---------------------------------- | ------------------------- |
| **A (권장)** | measure 소스 docodemo.webp로 교체 + angled.png 제거 | 스크립트 수정 + 자산 1개 삭제      | production·측정·주석 통일 |
| **B**        | production 소스 angled.png로 교체 + docodemo 제거   | PortableTemplateBody + quad 재측정 | 네이티브 alpha 상실       |
| **C**        | 공존 유지                                           | 변경 없음                          | 영구 drift                |

## 통과 수 식 (v2-S4-b 완료 시점)

- v2-S3-ok 기준: 155 total / 134 pass / 21 fail.
- Step 0 추가 e2e: canvas-freeze.spec.ts (10) + v2-export-disable.spec.ts (2) = 12.
- a-pre 추가 unit: checkCanvasFreeze.test.ts (5).
- S4-b 추가 e2e: v2-s4b.spec.ts (13) — 1-1 (4종 × Ctrl+C/V = 4) + 3-paste + input guard + 複製
  - 1-2 ratio-lock + D-14 + 1-3 Fit letterbox + Cover coord + wheel-pan guard + Undo = 13.
- S4-b 추가 unit: editorStoreS4b.test.ts (17).
- e2e 전체: 180 total (167 → +13).
- e2e 재측정: **158 passed / 22 failed → L5 1280x720 단독 재실행 통과 → effective 159 pass / 21 fail / 1 flaky**.
  식: baseline 146 + 신규 13 = 159 ✓. 알려진 실패 목록 밖 실패 0건.

## S5 를 위한 선결 조건 (이 handoff 를 넘기는 다음 세션에서 먼저 할 것)

1. 사용자에게 a-0 옵션 A/B/C 결정 확인.
2. a-1 (측정 소스 확정 후 재측정, 4 점 교정, 픽셀 검증 12 조건).
3. a-2 (perspectiveLogicalSize 공통화).
4. a-3 (17 B1/B2 + 매핑 결정 뒤 재작성).
5. S5 범위(occlusion 흐름, F-occlusion 4건, 3-3/3-4/3-5 UI).
