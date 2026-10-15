# v2-audit → S7 handoff (2026-10-15)

**세션 결과**: PDF 수정사항 전수 audit 완료. 요구사항별 상태 장부는 `docs/v2/requirements-audit.md`. 다음 단계는 사용자 검수 후 **미달 항목 수정 스프린트** (묶음 ①~③).

## 세션 산출물

| 파일                                             | 역할                                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `docs/v2/requirements-audit.md`                  | **마스터 장부** — PDF 1-1~~5-2, X1~~X5, C1~C23 각각의 원문/구현 위치/기존 테스트/점검 테스트/실측값/상태/미달 사유 |
| `docs/v2/s7-audit-handoff.md`                    | 이 문서                                                                                                            |
| `e2e/audit/_shared.ts`                           | 공용 헬퍼 (openAppJa, addSpaceBg, contrast ratio 등)                                                               |
| `e2e/audit/1-1-copy-paste.spec.ts`               | [1-1] コピー/貼り付け 측정                                                                                         |
| `e2e/audit/1-2-aspect-lock.spec.ts`              | [1-2] 비율 고정 측정                                                                                               |
| `e2e/audit/1-3-fit-cover.spec.ts`                | [1-3] Fit/Cover 측정                                                                                               |
| `e2e/audit/2-1-canvas-fit.spec.ts`               | [2-1] 캔버스 자동 맞춤 (3 뷰포트)                                                                                  |
| `e2e/audit/2-3-advanced-settings-inline.spec.ts` | [2-3] role=dialog 소실 확인                                                                                        |
| `e2e/audit/2-4-export-button.spec.ts`            | [2-4] export 버튼 크기 측정                                                                                        |
| `e2e/audit/2-5-error-banner.spec.ts`             | [2-5] 에러 배너 폰트/대비 측정                                                                                     |
| `e2e/audit/3-2-upload-hint.spec.ts`              | [3-2] 사전 안내 상수 확인                                                                                          |
| `e2e/audit/3-3-slider-units.spec.ts`             | [3-3] 슬라이더 단위 측정                                                                                           |
| `e2e/audit/3-4-content-scale.spec.ts`            | [3-4] % 입력 측정                                                                                                  |
| `e2e/audit/3-5-mask-flow.spec.ts`                | [3-5] 마스크 명칭·단축 측정                                                                                        |
| `e2e/audit/4-1-terminology.spec.ts`              | [4-1] 3 로케일 옛 용어 grep                                                                                        |
| `e2e/audit/4-2-appearance-text.spec.ts`          | [4-2] 외관 설명문 정확 일치 측정                                                                                   |
| `e2e/audit/5-1-auto-error-dismiss.spec.ts`       | [5-1] 오류 자동 소거                                                                                               |
| `scripts/audit/terminology-check.mjs`            | 로케일 파일 전수 grep (서버 없이 재현)                                                                             |
| `playwright.config.ts`                           | `audit` 프로젝트 추가, 기본 run 에서 `testIgnore: /audit[\\/]/`                                                    |
| `package.json`                                   | `test:e2e:audit` 스크립트 추가                                                                                     |

## 수치 요약 (실측 2026-10-15)

- CI 등가: typecheck ✅ · lint ✅ · format:check ✅ · test:run ✅ (662/662) · build ✅ · build:oitemiru ✅ · check:canvas ✅
- `test:e2e:core` × 3 **232/232 전부 pass, 0 flaky**
- `test:e2e:audit` **18/18 pass @ ~10s**
- 알려진 e2e 실패 **0 건**
- 허용치 완화 **0 건**
- gh CLI 미설치 → CI 결과는 로컬 등가 명령 전수 실행으로 대체

## 상태 요약 (장부 §요약)

- ✅ 완료 **24**: 1-1 · 1-2 · 1-3 · 2-1 · 2-2 · 2-3 · 2-4 · 2-5 · 3-1 · 3-2 · 5-1 · 5-2 · X1 · C7 · C8 · C9 · C10 · C11 · C12 · C13 · C14 · C16 · C17 · C18 · C19 · C21 · C22
- 🟡 부분 **8**: 3-3 (「暖色・寒色トーン」 단위) / 3-5 (단계 안내) / 4-1 (ko 사이네지 28건) / 4-3 (ko 전면 불일치) / X3 (TOS 효력일 공란) / C5 · C15 · C20 · C23
- ❌ 미달 **5**: 4-2 · C1 · C2 · C3 · C6
- ⏸ 결정 대기 **2**: 2-3 (ADR 승인 있음 — 재확인 권장) · X2 (버튼↔모달 라벨 불일치)
- ⬜ 미착수 **1**: X5 (전부 S7 범위)

## 수정 묶음 제안 (장부 §5)

**묶음 ① — 로케일 치환** (S / 10분)

- 4-2 외관 설명문 ja/ko/en 1-liner 교체
- 4-1/4-3 ko `사이네지` 28건 → `사이니지` 전수 치환
- 테스트: `test:run`(로케일 키 parity) + 추가 audit 재실행 (`test:e2e:audit` 중 [4-1 ko] 테스트가 자동으로 drift 측정)

**묶음 ② — UI 소폭 기능 추가** (M / 30분)

- 3-5 단계 안내 `ステップ{current}/{total}：隠したい範囲の角をクリック（{count}/4）` 구현
- 3-3 「暖色・寒色トーン」 단위/범위 안내 추가
- 신규 i18n 키 3 로케일 추가

**묶음 ③ — Onboarding/RealismGuide 재서술** (S / 15분)

- C1: `editorCanvasEmptyHint` / `onboardingDescription` 를 1-3 Fit/Cover 반영
- C2: `onboardingDescription` 아코디언 구조 반영
- C6: `realismGuideTitle` (ja = "外観の設定について") 를 새 외관 명칭에 맞춰 재서술

**묶음 ④ — 사용자 승인 필요**

- X3 TOS 효력일 공란 → 사용자 결정 요
- X2 「使い方ガイド」 vs 「使い方・このツールについて」 라벨 통일 → 사용자 결정

## 다음 세션 가장 먼저 할 일

1. **사용자 검수** — `docs/v2/requirements-audit.md` 를 열고 "⏸ 결정 대기" 섹션 (장부 §4) 의 A~F 각 항목 결정.
2. 결정이 끝나면 **묶음 ①~③ 수정** → 커밋 각각 분리 (묶음 1건 = 커밋 1건).
3. S7 범위 재진입 (`docs/v2/s6-handoff.md` 의 §다음 세션 가장 먼저 할 일) — qa:visual Docker Linux, release-notes-s7, Render / 본서버, main PR.

## audit 테스트 재실행 방법

```sh
# 로컬 서버 자동 기동 + audit 전수 (18 case, ~10s)
E2E_PORT=4181 npm run test:e2e:audit

# 로케일 파일 grep (서버 없이)
node scripts/audit/terminology-check.mjs

# audit 제외한 core 재측정
E2E_PORT=4175 npm run test:e2e:core
```

## 미해결 / 모니터

- **L2 390x844 landscape** — S6 handoff 에서 flaky 로 분류. 이번 세션 3회 run 전부 재현 안 됨. 재발 시 wait-until-non-null fix 적용.
- **S6 ko 번역 drift**: realismGuideDescription(ko) 는 "앞 **물체**로 가리기", glossary 는 "앞**쪽** 물체로 가리기". 미묘한 drift. **묶음 ①** 안에서 함께 정리.

## 금지 사항 재확인

- **제품 코드(src/) 수정 금지** — 이번 세션에서 지켰음.
- **sed/정규식 일괄 치환 금지** — 이번 세션에서 지켰음.
- **기존 테스트 수정·skip·허용치 완화 금지** — 이번 세션에서 지켰음.
- **main push 금지** — HEAD 는 origin/v2 로만 push.
