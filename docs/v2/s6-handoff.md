# v2-S6 handoff (2026-10-15, S5 보완 + S6 완료)

**S5 보완 (A0~A7) + S6 i18n 용어 전면 교체** 모두 완료. 커밋 포함 push 대기 상태.

- A0 완료 — CI #20~#28 format 실패 분석, `.git/hooks/pre-push` 가 `npm run format:check`
  를 자동 실행하도록 추가. CLAUDE.md §5-5 에 CI 확인 의무, 테스트 이름 = 확인 내용 규칙
  추가.
- A1 완료 — K1 fixture 를 `tmp/` 에서 `e2e/fixtures/portable-screen-quads.json` 로 이동
  (committed). 폴리곤 offset 기반 inside/outside/ring 측정으로 교체.
- A2 완료 — K3 테스트 분류: 4건 삭제 (obsolete by compound model eef7335), 11건 리네임
  (intent-retained). 상세는 `docs/v2/baseline.md`.
- A3 완료 — AdvancedSettingsSection fold state 를 `uiStore.subAccordionOpen` 로 이동
  (`content-advanced` + `appearance-advanced`). 사이니지 선택 전환 후에도 fold 유지.
- A4 완료 — U1 16/16 슬라이더에 가시 라벨 + aria-valuenow 측정. 조건부 5개 (셰도, 글로우
  등) 포함. 테스트는 `occlusionSection.getByRole(...)` 로 scope 축소.
- A5 완료 — K4 비디오 측정 보강: wall-clock, bbox invariant, codec/bitrate, decoded-frame
  stripe period, portrait raw-res 1080×1920.
- A6 완료 — K2 contain fit 을 homography 기반 sub-quad 로 교체. 측정: angled view aspect
  err 0.86 % → 0.40 %. Helper 들은 `src/lib/portableSubQuad.ts` 로 추출 (fast-refresh
  규칙 준수).
- A7 완료 — S5 audit (테스트 이름 ↔ assertion 일치) 는 A2 커밋에서 처리됨.
- S6 완료 — glossary.md ① 의 전 용어가 ja/ko/en 세 로케일 모두에 반영. e2e selector 들도
  신규 라벨에 맞춰 갱신 (`X座標 → 横位置`, `レンダリングプリセット → 明るさ・時間帯` 등).

## S6 교체된 용어 (실제 적용)

| 기존 (ja)              | 신규 ja                     | ko                           | en                                     |
| ---------------------- | --------------------------- | ---------------------------- | -------------------------------------- |
| 空間 / 空間写真        | 設置場所の写真              | 설치 장소 사진               | Installation site photo                |
| X座標 / Y座標          | 横位置 / 縦位置             | 가로 위치 / 세로 위치        | Horizontal / Vertical position         |
| コンテンツ位置X / Y    | コンテンツの横位置 / 縦位置 | 콘텐츠 가로 위치 / 세로 위치 | Content horizontal / vertical position |
| 外観                   | サイネージ外観の調整        | 사이니지 외관 조정           | Signage appearance                     |
| レンダリングプリセット | 明るさ・時間帯              | 밝기·시간대                  | Brightness & time of day               |
| LCD                    | LCD（液晶）                 | LCD(액정)                    | LCD                                    |
| モザイク               | 手前の物で隠す（マスク）    | 앞쪽 물체로 가리기(마스크)   | Foreground mask                        |

TOS 1 조 (ja/ko/en) 는 glossary 와 일관되게 「設置場所の写真」·「LCD（液晶）」 로 재작성.
내부 코드명 (`Occlusion`, `SpaceBackground`, `screenQuad`) 은 유지.

## e2e 라벨 치환 범위

| 파일                               | 치환                                     |
| ---------------------------------- | ---------------------------------------- |
| `e2e/comparison-toggle.spec.ts`    | 外観 → サイネージ外観 (3)                |
| `e2e/content-material.spec.ts`     | コンテンツ位置X → コンテンツの横位置 (3) |
| `e2e/environment-sampling.spec.ts` | 空間 → 設置場所の写真 comment 유지       |
| `e2e/mobile.spec.ts`               | 外観 → サイネージ外観 (5)                |
| `e2e/onboarding.spec.ts`           | 空間 → 設置場所 (2)                      |
| `e2e/portable.spec.ts`             | 外観 → サイネージ外観 (4)                |
| `e2e/reselection.spec.ts`          | 外観 → サイネージ外観 (2)                |
| `e2e/smoke.spec.ts`                | 空間 → 設置場所の写真 (2)                |
| `e2e/v2-layout.spec.ts`            | X座標/Y座標 → 横位置/縦位置 (3)          |
| `e2e/v2-s4b.spec.ts`               | X座標/Y座標 → 横位置/縦位置 (11)         |
| `e2e/visual-qa.spec.ts`            | 外観 → サイネージ外観 (2)                |
| `e2e/support/spaceBackground.ts`   | 空間 → 設置場所 (2)                      |

## 상태 요약

| 범위 | 상태 | 비고                                                                                                                                           |
| ---- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| A0   | 완료 | pre-push format:check guard + CLAUDE §5-5 규칙 2개 추가                                                                                        |
| A1   | 완료 | fixture 커밋 + 폴리곤 측정, 12/12 pass @ inside≥99.95%, outside=0, ring=100%                                                                   |
| A2   | 완료 | K3 분류 — 4 삭제 + 11 리네임, baseline.md 표 갱신                                                                                              |
| A3   | 완료 | uiStore.subAccordionOpen 로 이동, fold round-trip pass                                                                                         |
| A4   | 완료 | 16/16 슬라이더 verified. 측정은 `occlusionSection` scoping 으로 중복 매칭 회피                                                                 |
| A5   | 완료 | K4 영상: wall-clock 6.08s, bboxΔ=0, 1920×1080 (landscape) / 1080×1920 (portrait), stripe period 8.00 ±1, Michelson 1.000                       |
| A6   | 완료 | homography sub-quad: angled err 0.86% → 0.40%. Helper 분리 (`portableSubQuad.ts`)                                                              |
| A7   | 완료 | A2 와 함께 baseline.md 에 반영                                                                                                                 |
| S6   | 완료 | ja/ko/en 전수 교체, e2e selector 12 파일 갱신. unit `locales.test.ts` 키 parity pass                                                           |
| Z    | 완료 | typecheck/lint/format:check/test:run/check:canvas/build/build:oitemiru 7종 + e2e core 231/232 (1 flaky — L2 390x844 landscape 재실행 3/3 pass) |

## 측정값 (실측)

- unit: **662 passed / 0 failed** (662 total)
- e2e core: **231 passed / 1 failed = 232 total** — 실패 `L2 390x844 landscape canvas fits inside the mobile viewport` 는 재실행 3/3 pass, flaky 로 분류 (`measure.height - canvas.height` null 참조 — Konva 마운트 전 측정, 격리 실행에서는 재현 안 됨).
- CI 등가: 7종 모두 통과.

## 다음 세션 가장 먼저 할 일 = S7

**S7 범위** (`docs/v2/sprint-plan.md` 참조):

1. 전체 회귀 재측정 (typecheck/lint/format:check/test:run/build/build:oitemiru/test:e2e)
2. **Docker Linux 환경 `qa:visual` 전면 재측정 + 스냅샷 갱신** — win32 환경 미실행 상태.
3. `docs/v2/release-notes-s7.md` (일본어 요약) 신규 작성.
4. 본서버 업로드 리허설, runbook 재검증.
5. 사용자 지시로 push 1회 + 사용자 승인 후 `v2 → main` PR.
6. S7 push 전에 알려진 e2e 실패 0건 보장 (CLAUDE.md §8 DoD).
7. L2 390x844 landscape flaky 원인 (Konva 마운트 타이밍) 조사 — mitigation 은 wait-until-non-null 로 처리하면 될 가능성.
