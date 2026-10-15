# v2-audit → P2 handoff (2026-10-15, P1 완료)

**v2-P1 종료 결과**: 사용자 결정 D1~D8 전수 이행 + 세부 점검 확장 완료.
**다음 = P2 잔여 마무리 (남은 ❌/🟡/보류 전부 해소). 배포 작업은 P3 완료 후 별도.**

## P2 진입 시점 상태

- `docs/v2/requirements-audit.md` §요약: **✅ 28 / 🟡 2 (C20, C23) / ❌ 0 / ⏸ 0 / ⬜ 2 (X3, X5)**
- 게이트 G1 (X3·X5 제외 전 ID ✅) 달성.
- G2 (core 3회·audit·unit 전부 통과) 달성: core 232/232 × 3, audit 74/74, unit 662/662.
- G3 (static checks + canvas-freeze 10/10) 달성.
- G4 (CI run ID 녹색) — `gh` CLI 미설치. 로컬 CI 등가 명령 전부 통과로 대체 기록 (§X4).
- G5 (약화 감사 0건) 달성: 바뀐 임계값 0, 제거/추가한 expect 는 §v2-P1 요약표에 기록, 테스트 이름 변경 0.

## P2 남은 작업

| ID  | 유형 | 설명                                                                                                                                  | 규모    |
| --- | ---- | ------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| C20 | 🟡   | L2 390x844 landscape — S6 flaky 로 1회 재현. v2-P1 재측정에서 3/3 안정이지만 wait-until-non-null fix 적용으로 완전 해소 권장          | S       |
| C23 | 🟡   | ToS/UserGuide 모달 포커스/Esc 수동 재검증 자동화. 현재 `useModalDialog` 는 Esc 로 닫히지만 e2e 수준 검증 없음 — audit 테스트 1건 추가 | S       |
| X3  | ⬜   | TOS 효력일 공란 "2026年月日" — **사용자 입력 필요**                                                                                   | 사용자  |
| X5  | ⬜   | S7 배포 범위 (Linux visual, 릴리스 노트, Render, 본서버, og:image, 매뉴얼, 태그, main Ruleset)                                        | P3 범위 |

## P1 세션 산출물 (추가)

| 파일                                             | 역할                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| `src/i18n/locales/{ja,ko,en}.ts`                 | D2/D4/D6/D7/D8 로케일 치환 + 신규 키 editorOcclusionStep1/2/3            |
| `src/types/i18n.ts`                              | editorOcclusionStep1/2/3 신규 키                                         |
| `src/features/editor/Toolbar.tsx`                | SliderValueDisplay `showSign` prop + tint 적용 + mask step indicator JSX |
| `src/styles/global.css`                          | `.toolbar-step-indicator` 스타일 17줄 (frozen zone 밖)                   |
| `docs/v2/canvas-freeze.json`                     | CSS allowlist 라인번호 재인덱스                                          |
| `docs/v2/glossary.md`                            | ① 用語 표에 「画面の明るさ」·「使い方ガイド」 추가, ③ ADR 수정           |
| `docs/v2/requirements.md`                        | 2-3 D1 근거 기록                                                         |
| `docs/v2/requirements-audit.md`                  | v2-P1 요약 섹션 + 전 ID 재판정                                           |
| `docs/v2/audit-spec.md`                          | 세부 점검 정의 (sub-check IDs)                                           |
| `docs/v2/s7-audit-handoff.md`                    | 이 문서                                                                  |
| `docs/v2/audit/img/{ID,D3,D7}.png`               | 25 대표 스크린샷 (ja + D2/D3/D4/D7 ko/en)                                |
| `e2e/audit/1-1-copy-paste.spec.ts`               | 1-1-h disabled gating + 4종 × 버튼/단축키 + 1-1-c offset + 1-1-f/g       |
| `e2e/audit/1-3-fit-cover.spec.ts`                | 1-3-a~e PNG band 측정 (portrait 포함)                                    |
| `e2e/audit/2-1-canvas-fit.spec.ts`               | 2-1-a 6 뷰포트 × landscape+portrait + 2-1-b PNG 해상도                   |
| `e2e/audit/3-3-slider-units.spec.ts`             | 3-3-a 전체 슬라이더 매트릭스 + 3-3-d 부호 표시                           |
| `e2e/audit/3-4-content-scale.spec.ts`            | 3-4-a % 접미사 + 3-4-b PNG 1.5× 확인                                     |
| `e2e/audit/3-5-mask-flow.spec.ts`                | 3-5-a 명칭 + 3-5-b apply + 3-5-c 단계 안내 전환                          |
| `e2e/audit/4-2-appearance-text.spec.ts`          | D4 ja/ko/en 외관 설명문 정확 일치                                        |
| `e2e/audit/X2-user-guide-naming.spec.ts`         | D7 ja/ko/en 버튼↔모달 라벨 통일                                          |
| `e2e/audit/screenshots.spec.ts`                  | 25 대표 스크린샷 생성                                                    |
| `e2e/{v2-s5-ui,content-material,mobile}.spec.ts` | D2 label 변경 선택자 갱신 + D5 showSign 보정                             |

(초기 audit 세션 산출물 — `08cd0c1` 커밋 — 은 그대로 유지. 위 표는 **P1 추가분**)

## 수치 요약 (v2-P1 재측정 2026-10-15)

- CI 등가: typecheck ✅ · lint ✅ · format:check ✅ · test:run ✅ (662/662) · build ✅ · build:oitemiru ✅ · check:canvas ✅
- `test:e2e:core` × 3 **232/232 전부 pass, 0 flaky** (168s + 174s + 178s)
- `test:e2e:audit` **74/74 pass @ 28s** (49 측정 + 25 스크린샷)
- `canvas-freeze.spec.ts` 10/10 pass (core 안에 포함)
- 알려진 e2e 실패 **0 건**
- 허용치 완화 **0 건**
- gh CLI 미설치 → CI 결과는 로컬 등가 명령 전수 실행으로 대체

## 다음 세션 가장 먼저 할 일 — **P2: 잔여 마무리**

1. C20 (L2 flaky) 영구 해소: `e2e/v2-layout.spec.ts` L2 wait-until-non-null fix. 측정 반복.
2. C23 (ToS/UserGuide Esc·focus) 자동화: audit 테스트 1건 추가.
3. X3 (TOS 효력일): 사용자 입력 받아 ja/ko/en 3 키 교체.
4. P2 완료 후 **P3 (배포 — Linux visual, release-notes-s7, Render, 본서버, og:image, main PR 등 X5 전수)**. 이번 P1 에서는 배포 관련 작업을 하지 않음.

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
