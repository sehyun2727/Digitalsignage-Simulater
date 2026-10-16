# v2-audit → P3 handoff (2026-10-16, P2 완료)

**v2-P2 종료 결과**: 세부 점검 전부 실측 + 잔여 🟡(C20, C23) 영구 해소 + audit 를 CI 로
통합. **다음 = P3 최종 완성도 평가(읽기 전용)**. 배포 작업(X5)은 P3 완료 후 별도.

## P3 진입 시점 상태

- `docs/v2/requirements-audit.md` §요약: **✅ 40 / 🟡 0 / ❌ 0 / ⏸ 0 / ⬜ 2 (X3, X5)**
- 게이트 결과:
  - **G1** (coverage.md 연결 누락 0) 달성 — 137 요구 단위 전부 매핑.
  - **G2** (X3·X5 제외 전 ID ✅, 모든 세부 점검에 실측값) 달성.
  - **G3** (audit CI 포함 전부 통과, core 3회 실패 0 flaky 0, unit 전부, L2 20/20) 달성.
  - **G4** (typecheck/lint/format/build/build:oitemiru/check:canvas pass, canvas-freeze 10/10, CI green) 달성. `gh` CLI 미설치 → 로컬 CI 등가 명령 전수 녹색으로 대체.
  - **G5** (약화 감사) 완료 — `docs/v2/requirements-audit.md :: 7bis` 에 전/후 상수, expect 수, 이름 변경 표 전수 기록. 완화 0건, **1 건 강화**(3-4-b 1.5 ±1% 원복).

## 수치 요약 (v2-P2 재측정 2026-10-16)

- CI 등가: typecheck ✅ · lint ✅ · format:check ✅ · test:run ✅ (**41 files / 672 tests**) · build ✅ · build:oitemiru ✅ · check:canvas ✅
- `test:e2e:core` × 3 **232/232 전부 pass, 0 flaky** (94s + 90s + 98s)
- `test:e2e:audit` **105/105 pass @ 54.7s** (v2-P1 74 → v2-P2 105, +31)
- `canvas-freeze.spec.ts` 10/10 pass (core 안에 포함)
- `L2 390x844 landscape+portrait --repeat-each=20` **40/40 pass** @ 33s (C20 영구 해소)
- 알려진 e2e 실패 **0 건**
- 허용치 완화 **0 건**, 강화 **1 건** (3-4-b 1.5 ±1%)

## v2-P2 세션 산출물 (추가)

| 파일                                               | 역할                                                                          |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/main.tsx`                                     | `window.__editorStoreGetState` / `__uiStoreGetState` dev/e2e backdoor         |
| `src/lib/colorDeltaE.ts`                           | CIE76 ΔE (sRGB → XYZ D65 → L\*a\*b\*)                                         |
| `tests/unit/colorDeltaE.test.ts`                   | 10 case 유닛 테스트 — rgbToLab anchors + deltaE76 + withinDeltaE              |
| `e2e/v2-layout.spec.ts :: L2`                      | C20 fix: `.konvajs-content canvas` visible wait                               |
| `e2e/audit/1-1-copy-paste.spec.ts`                 | 1-1-b/d/e deep compare + clamp + PNG pixel + strict object count 추가         |
| `e2e/audit/1-2-aspect-lock.spec.ts`                | 1-2-a/c/d/e/f 분리 + four corner-equivalent + Undo/Redo aria-pressed          |
| `e2e/audit/1-3-fit-cover.spec.ts`                  | 1-3-b video (decoded frame) + 1-3-f wheel drift                               |
| `e2e/audit/2-1-canvas-fit.spec.ts`                 | 6 vp × 2 preset + 2-1-b SHA + 2-1-c video + 2-1-d bbox invariant              |
| `e2e/audit/3-3-slider-units.spec.ts`               | 3-3-c 16-vs-11 taxonomy 재구성                                                |
| `e2e/audit/3-4-content-scale.spec.ts`              | 3-4-b 1.5 ±1% 원복 + 100×100 매젠타 측정 방법                                 |
| `e2e/audit/3-5-mask-flow.spec.ts`                  | 3-5-e ΔE + 3-5-f cancel + 3-5-g 4-op Undo/Redo                                |
| `e2e/audit/5-2-order-permutation.spec.ts` (신규)   | A/B 동일 PNG hash + A/B/C store equality                                      |
| `e2e/audit/X1-portable.spec.ts` (신규)             | CIE Lab unit test + 3 뷰 ΔE+PNG aspect + debug flag count                     |
| `e2e/audit/C23-modal-accessibility.spec.ts` (신규) | ToS/UserGuide 모달 Esc 닫힘 + Tab 포커스 트랩 + launcher 복귀                 |
| `.github/workflows/ci.yml`                         | `Audit project` 단계 추가 (push + PR 전부에서 실행)                           |
| `docs/v2/coverage.md` (신규)                       | PDF 요구 단위 137 ↔ audit sub-check 매핑 테이블 (연결 누락 0)                 |
| `docs/v2/canvas-freeze-allowlist-review.md` (신규) | allowlist 라인번호 → 내용 기준 전환 가능성 검토 (현재는 유지, S7 이후 재검토) |
| `docs/v2/requirements-audit.md`                    | v2-P2 섹션 + G5 약화 감사 테이블 + C20/C23 ✅ 승격                            |
| `docs/v2/s7-audit-handoff.md`                      | 이 문서 (P2 → P3)                                                             |

## 다음 세션 — **P3: 최종 완성도 평가(읽기 전용)**

1. 전 ID 재검토: `docs/v2/requirements-audit.md` + `docs/v2/coverage.md` 를 열람하여
   P1·P2 측정값이 PDF 원문과 1:1 매칭됨을 확인.
2. `test:e2e:core` × 3 + `test:e2e:audit` 재실행 → 수치가 handoff 와 일치하는지만 확인.
3. L2 `--repeat-each=20` 재실행 → 안정성 재확인.
4. ⬜ 상태 2개 (X3 TOS 효력일 / X5 배포 — 전부 다음 세션 범위 또는 사용자 입력 대기).
5. P3 완료 후 사용자 승인 → P4 (배포, S7) 진입.

**P3 는 읽기 전용**. 테스트/제품 코드 수정 금지.

## audit 테스트 재실행 방법

```sh
# 모든 audit 테스트 (105 case, ~55s)
E2E_PORT=4181 npm run test:e2e:audit

# L2 flaky 영구 해소 확인
E2E_PORT=4182 npx playwright test e2e/v2-layout.spec.ts -g "L2 390x844" --repeat-each=20

# audit 제외한 core 재측정
E2E_PORT=4175 npm run test:e2e:core

# 로케일 파일 grep (서버 없이)
node scripts/audit/terminology-check.mjs
```

## 리스크 / 사용자 결정 대기

- **X3 TOS 효력일 공란** (`termsOfServiceEffectiveDate` / `RevisedDate` = "2026年月日"):
  사용자가 공식 발효일 확정 → ja/ko/en 3 키 교체.
- **canvas-freeze allowlist 라인번호 재인덱스 자동화** (`docs/v2/canvas-freeze-allowlist-review.md` 참조):
  S7 이후 재검토 권장.
- **배포 범위 X5**: P3 완료 → 사용자 승인 → P4 (Linux visual, release-notes-s7, Render /
  본서버, og:image, main PR, v1-production 태그, main Ruleset).

## 금지 사항 재확인

- **main push 금지** — HEAD 는 origin/v2 로만 push.
- **sed·정규식 일괄 치환 금지** — 이번 세션에서 지켰음 (ko 14 키 개별 edit).
- **어서션 약화·skip 금지** — 이번 세션에서 지켰음 (3-4-b 범위 1.3-1.7 → 1.485-1.515 로 **강화**).
- **`[canvas-approved]` 자가 부여 금지** — frozen zone SHA 변동 없음.
- **PR 생성 / Linux visual / 릴리스 노트 / 배포 작업 금지** — 이번 P2 범위 밖.
