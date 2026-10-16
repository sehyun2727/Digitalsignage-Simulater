# v2-audit — 개발 완료 (2026-10-16)

**v2-P3 종료 결과**: Part A (A1~~A8) + Part B (B1~~B3) + Part C (독립 평가) 전부
이행. 요구 단위 137/137 (X3 2건 사용자 입력 제외) ✅. **Decision: GO** (conditional
on X3 effective-date user input).

**개발 완료. 다음 = 사용자: 약관 날짜 → PR → merge → Render 확인 → 본서버 업로드 → 태그**.

## 수치 요약 (v2-P3 최종 2026-10-16)

- CI 등가: typecheck ✅ · lint ✅ · format:check ✅ · test:run ✅ (**41 files / 672 tests**) · build ✅ · build:oitemiru ✅ · check:canvas ✅ · check:prod-build ✅ (4 symbol × 2 dir = 0 occurrences)
- `test:e2e:core` × 3 **232/232 전부 pass, 0 flaky** (84s + 94s + 100s)
- `test:e2e:audit` **115/115 pass @ 48s** (v2-P2 105 → +10 user-journey)
- L2 `--repeat-each=20` **40/40 pass** @ 15.5s (C20 영구 해소 유지)
- `canvas-freeze.spec.ts` 10/10 pass (core 안에 포함)
- 알려진 e2e 실패 **0 건**
- 약화 감사: 완화 **0 건** / 강화 **≥ 12 건** / 보정 교체 **1 건** (K1 calibration-preserving; 자세히 `requirements-audit.md §7bis`)

## v2-P3 산출물

| 파일                                          | 역할                                                            |
| --------------------------------------------- | --------------------------------------------------------------- |
| `src/main.tsx`                                | e2e store accessor 를 `import.meta.env.VITE_E2E` 뒤에 gate (A1) |
| `src/features/editor/PortableProductView.tsx` | debug overlay URL probe 제거 (A1)                               |
| `src/types/editor.ts`                         | MIN_CONTENT_SCALE 1 → **0.5** (D9)                              |
| `src/lib/termsOfServiceDate.ts` (신규)        | ToS 발효일 단일 config (A7)                                     |
| `src/components/TermsOfServiceModal.tsx`      | `{date}` 치환 + 빈 값 숨김 (A7)                                 |
| `src/i18n/locales/{ja,ko,en}.ts`              | ToS date `{date}` 템플릿                                        |
| `scripts/build-e2e.mjs` (신규)                | `npm run build:e2e` (VITE_E2E=1)                                |
| `scripts/check-prod-build.mjs` (신규)         | 4 금지 심볼 grep. CI 통합                                       |
| `scripts/run-audit.mjs` (신규)                | audit 가 e2e 빌드 사용                                          |
| `playwright.config.ts`                        | PW_E2E_BUILD gate, timeout 120 s                                |
| `package.json`                                | `build:e2e`, `check:prod-build` script                          |
| `.github/workflows/ci.yml`                    | prod-build hygiene 단계 추가                                    |
| `e2e/v2-s5-k1-portable-pixels.spec.ts`        | A2 CIE76 ΔE 10 공식화 + 보정 교체 (99 → 98 %)                   |
| `e2e/audit/2-1-canvas-fit.spec.ts`            | A6 mobile strict (canvas.height ≤ viewport.height)              |
| `e2e/audit/3-4-content-scale.spec.ts`         | 50/100/150 % 매트릭스 (D9)                                      |
| `e2e/audit/3-5-mask-flow.spec.ts :: 3-5-e`    | A3 3-way ΔE 재검증                                              |
| `e2e/audit/5-2-order-permutation.spec.ts`     | A5 12-permutation 매트릭스                                      |
| `e2e/audit/user-journey.spec.ts` (신규)       | Part C 9-case 흐름 테스트                                       |
| `tests/unit/contentLayout.test.ts`            | clampContentScale D9 반영                                       |
| `docs/v2/final-evaluation.md` (신규)          | 독립 평가 — Decision: GO                                        |
| `docs/v2/release-notes.md` (신규)             | 배포 담당자용 매뉴얼                                            |
| `docs/v2/requirements-audit.md`               | v2-P3 재판정 + A8 count fix (40→44)                             |
| `docs/v2/s7-audit-handoff.md`                 | 이 문서                                                         |

## 사용자 작업 (다음 단계)

### 1. 利用規約 발효일 설정 (X3)

`src/lib/termsOfServiceDate.ts` 를 열고:

```ts
export const TOS_EFFECTIVE_DATE = '2026年10月16日'; // 실제 발효일
export const TOS_REVISED_DATE = ''; // 개정일 (없으면 공란 → 행 숨김)
```

빈 값으로 두면 **해당 행만 숨김** — 깨진 표기 안 보임 (`release-notes.md §4`).

### 2. v2 → main PR 생성

```sh
# GitHub web UI 또는:
gh pr create --base main --head v2 --title "v2 release" \
  --body "See docs/v2/release-notes.md for user-facing changes."
```

- PR CI 가 full e2e + Docker Linux visual-qa 를 수행.
- CI green 확인 후 merge.

### 3. Render 스테이징 확인

main merge 즉시 Render 가 자동 재배포. `https://digitalsignage-simulater.onrender.com` 열어
직원 매뉴얼 (`release-notes.md §2-5` 체크리스트) 전수 통과 확인.

### 4. 본서버 업로드

`release-notes.md §2-2 ~ §2-5` 순서. 요약:

```sh
npm ci && npm run build:oitemiru
# 본서버에서:
mv /path/to/public/oitemiru /path/to/backup/oitemiru-$(date +%Y%m%d)
rsync -av --delete dist-oitemiru/ user@server:/path/to/public/oitemiru/
```

브라우저로 `https://hull-inc.jp/oitemiru/` 열어 체크리스트 전수 통과.

### 5. 릴리스 태그 (사용자 결정)

```sh
# v1-production 태그 (현재 본서버 버전 보존)
git tag -a v1-production <v1-upload-sha> -m "v1 production snapshot"
git push origin v1-production

# v2.0.0 태그 (v2 릴리스)
git switch main && git pull
git tag -a v2.0.0 -m "v2 release"
git push origin v2.0.0
```

## 리스크 / 사용자 결정

- **X3 발효일 미설정 상태로 배포하면** 利用規約 모달에 발효일 행이 **숨김** (A7 — 깨진
  표기는 아님). 하지만 법적 효력 발생일 명시 의무가 있으므로 **배포 전에 반드시 설정** 권장.
- **Linux visual-qa**: 로컬 Docker 미설치 → PR CI 에서 실행. 로컬 재측정 하려면 Docker
  설치 후 `docker build . && docker run --rm digital-signage-simulator:ci npm run qa:visual`.
- **K1 angled-right 98.6 %** — A2 공식 변경에 따른 보정 교체. 외관 결함 아님 (`requirements-audit.md §7bis`).

## 금지 사항 재확인

- **main push 금지** — v2 push 만 수행. main merge 는 사용자가 PR 로.
- **sed 일괄 치환 금지** — 지킴 (D9 는 1 상수 변경).
- **어서션 약화·skip 금지** — 지킴 (G5 완화 0 건).
- **`[canvas-approved]` 자가 부여 금지** — 지킴 (frozen zone SHA 변동 없음).
- **PR/배포/태그는 사용자** — 이 세션에서 하지 않음.

## audit 재실행

```sh
E2E_PORT=4181 npm run test:e2e:audit                    # 115 case, ~48s
E2E_PORT=4181 npm run test:e2e:audit -- e2e/audit/user-journey.spec.ts  # 9 case
E2E_PORT=4175 npm run test:e2e:core                     # core 232 case
npm run check:prod-build                                # 프로덕션 번들 hygiene
```
