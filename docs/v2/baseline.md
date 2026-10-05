# v2 기준선 (baseline)

이 문서는 v2 스프린트 시작 시점의 검사 결과를 기록합니다. 이후 스프린트에서는 "이 baseline 대비 새 실패가 없어야 통과"를 판정 기준으로 삼습니다.

## HEAD/태그

| 항목                        | 값                                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 브랜치                      | `main`                                                                                                                           |
| HEAD 해시 (`v2-start` 태그) | `4e9659d8e72048586df9edc2f9a624320ec9e020` (`4e9659d`)                                                                           |
| 이전 커밋 (pre-v2 전)       | `6d45c84 feat: text becomes signage content, unified labels, canvas + footer polish`                                             |
| pre-v2 정리 커밋들          | `500013d`, `f40514f`, `ea44469`, `4c0676c`, `4e9659d`                                                                            |
| `v1-production` 태그        | **미생성** — 본서버 `hull-inc.jp/oitemiru/`에 실제로 업로드된 v1 dist가 어느 커밋에서 빌드됐는지 확인할 방법이 없어 만들지 않음. |

## 환경

| 항목       | 값                                  |
| ---------- | ----------------------------------- |
| OS         | Windows 11 Home 10.0.26200          |
| Node       | v24.14.0                            |
| npm        | 11.9.0                              |
| Shell      | PowerShell 5.1 / Git Bash 병행 사용 |
| Playwright | 1.62.1 (chromium 브라우저 기설치)   |

`npm ci`는 pre-v2 정리 과정에서 별도 실행하지 않음. 이미 작업 중이던 `node_modules`를 그대로 사용하면서 개별 `npm run *`으로 검증. 다음 스프린트 시작 시 `npm ci`로 초기화 권장.

## 명령별 결과 (Step A-4)

`v2-start` (`4e9659d`) 시점에서 실행한 결과입니다. `npm test`는 vitest watch 모드이므로 사용하지 않고, `npm run test:run`을 사용했습니다.

| #   | 명령                                                            | 결과                                                                | 소요 시간              | 세부                                                                                                                                                                                                                                                                                                                            |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `npm run typecheck`                                             | ✅ pass                                                             | ~10초                  | `tsc -b` 오류 없음, 출력 없음                                                                                                                                                                                                                                                                                                   |
| 2   | `npm run lint`                                                  | ✅ pass                                                             | ~10초                  | `eslint .` 오류 없음, 출력 없음                                                                                                                                                                                                                                                                                                 |
| 3   | `npm run format:check`                                          | ✅ pass                                                             | ~5초                   | "All matched files use Prettier code style!"                                                                                                                                                                                                                                                                                    |
| 4   | `npm run test:run`                                              | ✅ pass (35 files, 531 tests, 0 skip)                               | ~11.6초                | jsdom 환경에서 `HTMLCanvasElement.getContext`·`HTMLMediaElement.pause`·`Window.scrollTo` "Not implemented" 로그 다수(무해). 실패 없음.                                                                                                                                                                                          |
| 5   | `npm run build`                                                 | ✅ pass (경고 있음)                                                 | ~0.4초                 | 161 modules → `dist/`. JS 696.76kB gz 208.02kB. 500kB 초과 경고 존재(코드 스플리팅 미도입, 기존 조건).                                                                                                                                                                                                                          |
| 6   | `npm run build:oitemiru`                                        | ✅ pass (경고 있음)                                                 | ~0.4초                 | 161 modules → `dist-oitemiru/`. JS 696.79kB gz 208.03kB. 동일 경고.                                                                                                                                                                                                                                                             |
| 7a  | `E2E_PORT=4175 npm run test:e2e` (S0 측정, 2026-09-30)          | ❌ 91 중 **37 passed / 54 failed / 0 skipped / 0 flaky** (198.6초)  | 15.1분 → 198.6초(실제) | S0 당시 백그라운드 캡처가 tail 50줄로 잘려 요약 라인 `30 passed (15.1m)`만 남았으나, S1 Step 0에서 JSON reporter로 재측정한 결과 실제 수치는 왼쪽과 같음.                                                                                                                                                                       |
| 7b  | `E2E_PORT=4175 npm run test:e2e` (**S1 Step 0 수정 후**)        | ⚠️ 91 중 **51 passed / 40 failed / 0 skipped / 0 flaky** (191.6초)  | 191.6초                | 아래 "알려진 e2e 실패" 표의 40건 외에는 통과. 각 스프린트는 이 표 안의 실패만 허용.                                                                                                                                                                                                                                             |
| 7c  | `E2E_PORT=4175 npm run test:e2e` (**v2-S2 완료 후, 현재 기준**) | ⚠️ 107 중 **74 passed / 33 failed / 0 skipped / 0 flaky** (159.9초) | 159.9초                | 전체 테스트 수 91→107 (신규 `e2e/v2-errors-upload.spec.ts` 16건 추가). 통과 51→74 (+23: S2 debt 12건 해소 + 신규 16건 중 11건 통과). 실패 40→33. S2에서 **12/14 디빗 해소**(모든 A1 4건·모든 A4-text 7건·C 1건), 미해소 2건(perspective-video 6ed3f A3 + cd710 A4-delete)은 hit-test 시맨틱 차이로 S2 범위 밖 — S4로 재귀속.    |
| 8   | `E2E_PORT=... npm run qa:visual`                                | ⚠️ **환경 미실행** (S1 Step 0, 2026-10-01)                          | —                      | Linux 전용 스냅샷(`e2e/__screenshots__/*-chromium-linux.png`)과 win32 로컬 환경의 차이. Docker Desktop 데몬이 로컬에서 기동되지 않음(`docker ps` → "cannot find file"). **S7 push 전에 Linux 환경(Docker)에서 반드시 실행 필요**. `.gitignore`가 `*-win32.png`/`*-darwin.png`를 금지하므로 win32 스냅샷을 로컬에서 만들지 않음. |

### 경고 요약

**build 청크 크기 경고**

```
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

현재 코드 스플리팅을 도입하지 않기로 결정된 상태(별도 ADR 없음). 회귀 판정 시 무시.

**vitest jsdom "Not implemented" 경고**
`HTMLCanvasElement.getContext`, `HTMLMediaElement.pause`, `Window.scrollTo`가 jsdom에 없어 발생. 테스트 통과 여부에 영향 없음. 무시.

## e2e 라벨 불일치 근본 원인

pre-v2 커밋 `8cdbd77 refactor: fold Add Image into Content Upload, drop dedicated button`에서 오른쪽 툴바의 콘텐츠 업로드 버튼 텍스트가 바뀌었습니다:

- 이전: `コンテンツを追加` (Add content)
- 현재: `画像 / 動画を追加` (Add image / video) — `messages.editorContentUploadButton` (ja.ts:189, `src/features/editor/Toolbar.tsx:988` `aria-label`)

e2e 스펙 17줄이 아직도 옛 라벨을 찾습니다:

- `content-material.spec.ts` (4), `environment-sampling.spec.ts`, `glow-halo.spec.ts`, `mobile.spec.ts` (4), `onboarding.spec.ts`, `occlusion-mask.spec.ts`, `portable.spec.ts` (2), `screen-reflection.spec.ts`, `visual-qa.spec.ts`, `support/video.ts`

`src/i18n/locales/{ja,ko,en}.ts` 어디에도 `editorAddContent` / `contentAddLabel` 계열 키가 없으므로 UI 라벨을 원복하는 것이 아니라 **e2e/헬퍼 쪽 문자열을 `editorContentUploadButton` 값이나 `data-testid`로 바꾸는 것이 옳은 방향**입니다.

## test:e2e 30 vs qa:visual 7 failed 불일치 조사

- `test:e2e` 최종 요약: `30 passed (15.1m)` — 실패 마커(`✘`, `failed`) 없음.
- `qa:visual` 최종 요약: `7 failed`. 실패 스펙:
  - `visual-qa.spec.ts:69:3` (wall-mounted LED / Natural preset)
  - `visual-qa.spec.ts:81:3` (freestanding portable / contact shadow)
  - `visual-qa.spec.ts:114:3` (four-point perspective)
  - `visual-qa.spec.ts:135:3` (bright interior LCD / Natural)
  - `visual-qa.spec.ts:154:3` (dark interior LED / Night)
  - `visual-qa.spec.ts:169:3` (outdoor daylight LED / Bright)
  - `visual-qa.spec.ts:191:3` (real-photo PNG export validity)

두 실행 모두 같은 `dist/`를 사용하고 같은 `playwright.config.ts` 구성입니다. 이론상 결과가 같아야 합니다. 두 가지 가능성:

1. `test:e2e` 백그라운드 출력이 헤더 부분에서만 잘려 저장되어 실패 라인이 파일에 남지 않았을 가능성. 최종 요약 라인 `30 passed`는 남았지만 전체 케이스를 수동 검증하지 못함. **가장 유력**.
2. 병렬 실행 타이밍 차이. Playwright는 `fullyParallel: true`이고 워커 여러 개를 씀. visual-qa만 단독 실행하면 5초 이내에 라벨을 찾지 못해 타임아웃이 나지만, 전체 e2e와 함께 실행할 때는 다른 스펙이 먼저 상호작용을 건드려 상태가 바뀌었을 여지. (검증 안 됨)

**보수적 해석**: qa:visual 7 failed를 기준선의 알려진 회귀로 등록합니다. S2 이후에서 "コンテンツを追加" 라벨(또는 그 대체명)이 어떤 UI에 실제로 존재하는지 확인하고, e2e 헬퍼를 실제 라벨로 갱신해야 합니다. 이 실패는 코드 회귀가 아니라 **테스트 코드와 UI 라벨의 불일치**로 판단합니다(pre-v2 refactor 8cdbd77에서 라벨 변경).

## 알려진 e2e 실패 (33건, v2-S2 완료 후 기준) — 새 판정 기준

**v2-S2 완료 시점의 상태입니다. 이후 스프린트의 e2e 판정은 다음을 따릅니다.**

1. 실패한 테스트가 전부 아래 표 안에 있어야 합니다(새 실패 0건).
2. 통과 수가 74 미만으로 줄면 안 됩니다.
3. 실패한 테스트는 1회 재실행합니다. 재실행에서 통과하면 flaky로 표시하고 실패로 세지 않습니다.
4. 담당 스프린트가 끝나면 자기 debt를 해소합니다.
5. **S7 push 전에는 알려진 실패가 0건이어야 합니다.** 사용자가 승인한 예외만 남길 수 있습니다.

**v2-S2에서 해소된 debt (12건, 참조용)**: editor.spec.ts 7건(C 1 + A4-text 6), image-upload.spec.ts 2건(A1), reselection.spec.ts 2건(A4-text 1 + A1 1), smoke.spec.ts 1건(A4-text). 보너스로 reselection.spec.ts "an uploaded image object is reselectable" 1건이 추가 해소(S4 debt로 분류되어 있었으나 Content Upload flow 재작성으로 자연 통과).

| 파일                      | 테스트 전체 이름                                                                                                                                                | 그룹         | 원인                                                                                                                                                                                                                                                                          | 담당                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| mobile.spec.ts            | full mobile content and export workflow at 390x844 (LED)                                                                                                        | F-download   | 상류(content-replace 등)는 통과하지만 PNG `download` 이벤트가 타임아웃. mobile viewport에서 export 흐름 재검증 필요                                                                                                                                                           | S3 (레이아웃 확정 후) 또는 S7 |
| mobile.spec.ts            | mobile smoke: LCD content and export at a portrait 1080x1920 space photo, 390x844                                                                               | F-download   | 동일                                                                                                                                                                                                                                                                          | S3/S7                         |
| mobile.spec.ts            | mobile: adds a custom portable product with a screen region and exports it at 390x844                                                                           | B2           | 포터블 다이얼로그가 compound model 전환(eef7335)으로 제거                                                                                                                                                                                                                     | S4                            |
| mobile.spec.ts            | mobile: dragging the portable screen region moves and resizes it at 390x844                                                                                     | B1           | 동일                                                                                                                                                                                                                                                                          | S4                            |
| mobile.spec.ts            | mobile: adds a transparent LED display and blends more of the space background as transparency rises, at 390x844                                                | F-download   | 상류 통과, download 이벤트 타임아웃                                                                                                                                                                                                                                           | S3/S7                         |
| mobile.spec.ts            | mobile: draws a foreground occlusion mask via tap-to-add points at 390x844                                                                                      | F-occlusion  | A4-mask 선택자는 고쳐졌지만 범위 지정 후 Apply 버튼이 나타나지 않음 (occlusion edit 흐름 하류)                                                                                                                                                                                | S5                            |
| mobile.spec.ts            | mobile smoke: a real-photo-style scene renders, exports a PNG, and introduces no horizontal overflow at 390x844                                                 | F-download   | PNG download 타임아웃                                                                                                                                                                                                                                                         | S3/S7                         |
| occlusion-mask.spec.ts    | a foreground occlusion mask restores the space photo over the masked screen area                                                                                | F-occlusion  | 범위 그리기 후 「適用」 버튼 미표시                                                                                                                                                                                                                                           | S5                            |
| occlusion-mask.spec.ts    | a too-small mask draft is rejected and the apply button stays disabled                                                                                          | F-occlusion  | 「getByRole('alert')」가 나오지 않음. 상류 occlusion 흐름 하류                                                                                                                                                                                                                | S5                            |
| occlusion-mask.spec.ts    | canceling a mask edit discards the draft without changing the object                                                                                            | F-occlusion  | 「キャンセル」 버튼 못 찾음. 상류 하류                                                                                                                                                                                                                                        | S5                            |
| perspective-video.spec.ts | hit-testing follows the perspective object's flat rect, not its warped visual body, and yields to an overlapping topmost object there                           | A3/F         | S2 재조사: perspective 적용 후 flat-rect 중심(960,540)에서 재선택 실패 — 현재 hit-test가 warped quad 기준으로 보이고, 테스트의 "flat rect가 hit area"라는 전제가 현재 코드 거동과 불일치. 거동을 flat-rect로 되돌릴지, 테스트 전제를 바꿀지는 S4(복붙·pos 보존 설계)에서 판정 | **S4로 재귀속 (S2 deferral)** |
| perspective-video.spec.ts | edit/cancel discards draft changes, reset restores the original quad, and undo/redo toggle placement mode                                                       | A4-delete    | 위와 동일 하류: Undo 후 중심 클릭으로 LED를 재선택 못 함                                                                                                                                                                                                                      | **S4로 재귀속 (S2 deferral)** |
| portable.spec.ts          | walks the photo and drag-to-draw region steps to add a portable product, then re-edits its region                                                               | B2           | 포터블 다이얼로그 제거(eef7335). 테스트는 다이얼로그 UI 기준                                                                                                                                                                                                                  | S4                            |
| portable.spec.ts          | replaces a portable product photo, resetting its screen region, and undo restores the original photo                                                            | B1           | 동일                                                                                                                                                                                                                                                                          | S4                            |
| portable.spec.ts          | rejects a screen region smaller than the minimum size and keeps the dialog open                                                                                 | B1           | 동일                                                                                                                                                                                                                                                                          | S4                            |
| portable.spec.ts          | cancelling the builder does not add a portable object                                                                                                           | B2           | 동일                                                                                                                                                                                                                                                                          | S4                            |
| portable.spec.ts          | undo removes an added portable product and redo restores it                                                                                                     | B1           | 동일                                                                                                                                                                                                                                                                          | S4                            |
| portable.spec.ts          | applies content and material to a portable product; export is clipped to its screen region and defaults to LCD                                                  | B1           | 동일                                                                                                                                                                                                                                                                          | S4                            |
| portable.spec.ts          | direct region move/resize: dragging inside the region moves it, and Save creates exactly one history entry on top of creation                                   | B1           | 동일                                                                                                                                                                                                                                                                          | S4                            |
| portable.spec.ts          | direct region move/resize: dragging the se corner handle resizes while keeping the nw corner fixed                                                              | B1           | 동일                                                                                                                                                                                                                                                                          | S4                            |
| portable.spec.ts          | direct region move/resize: dragging a corner past the opposite one clamps at the minimum size instead of inverting or erroring                                  | B1           | 동일                                                                                                                                                                                                                                                                          | S4                            |
| portable.spec.ts          | direct region move/resize: cancelling after a drag discards the draft and creates no history entry                                                              | B1           | 동일                                                                                                                                                                                                                                                                          | S4                            |
| portable.spec.ts          | direct region move/resize: saving an unchanged region creates no history entry                                                                                  | B1           | 동일                                                                                                                                                                                                                                                                          | S4                            |
| portable.spec.ts          | export composition: a transparent product photo alpha-composites over the space background, while its opaque area and the clipped content still render normally | B1           | 동일                                                                                                                                                                                                                                                                          | S4                            |
| portable.spec.ts          | export composition: the default LCD material renders a visible highlight overlay on the screen region                                                           | B1           | 동일                                                                                                                                                                                                                                                                          | S4                            |
| portable.spec.ts          | export composition: exports a portable product on a portrait canvas at its 1080x1920 resolution                                                                 | B1           | 동일                                                                                                                                                                                                                                                                          | S4                            |
| reselection.spec.ts       | a custom portable product is reselectable after being deselected                                                                                                | B1           | 포터블 다이얼로그                                                                                                                                                                                                                                                             | S4                            |
| visual-qa.spec.ts         | wall-mounted LED display with content on the Natural preset                                                                                                     | Linux 스냅샷 | OS별 스냅샷 환경 불일치(현 로컬=win32). `.gitignore`가 win32/darwin 스냅샷 금지 → Linux(Docker/CI)에서만 비교 가능                                                                                                                                                            | S7 (Docker Linux에서 재측정)  |
| visual-qa.spec.ts         | freestanding portable product with a ground contact shadow                                                                                                      | B1 + Linux   | 포터블 다이얼로그 흐름 + Linux-only 스냅샷                                                                                                                                                                                                                                    | S4(흐름) + S7(스냅샷)         |
| visual-qa.spec.ts         | four-point perspective-placed display                                                                                                                           | Linux 스냅샷 | 동일                                                                                                                                                                                                                                                                          | S7                            |
| visual-qa.spec.ts         | bright interior photo with an LCD wall display on the Natural preset                                                                                            | Linux 스냅샷 | 동일                                                                                                                                                                                                                                                                          | S7                            |
| visual-qa.spec.ts         | dark interior photo with an LED wall display on the Night preset                                                                                                | Linux 스냅샷 | 동일                                                                                                                                                                                                                                                                          | S7                            |
| visual-qa.spec.ts         | outdoor daylight photo with an LED display on the Bright preset                                                                                                 | Linux 스냅샷 | 동일                                                                                                                                                                                                                                                                          | S7                            |

### 환경 미실행 (현재 run에선 실패로 집계됨, S7에서 해소)

- visual-qa 스냅샷(golden-image 6건: wall-led-natural, perspective-display, outdoor-daylight-led, dark-interior-led, bright-interior-lcd, freestanding-portable)이 Linux 전용. Docker Desktop 데몬이 로컬에서 기동되지 않아 `qa:visual`을 win32에서 돌리면 OS 불일치로 실패. **S7 push 전 Linux 환경에서 재측정 필수**.

### 그룹 요약 (v2-S2 완료 후)

- A1 (4) → **0** (S2 해소): 「画像を追加」 버튼 제거 → 테스트가 Content Upload로 리다이렉트.
- A3 (1) + A4-delete (1) → **2** (S4로 재귀속): perspective hit-test 시맨틱 재설계 필요. S4의 pos 보존 설계에서 처리.
- A4-text (7) → **0** (S2 해소): 「テキストを追加」가 Content 섹션 안으로 이동 → 테스트 흐름 재작성.
- B1 (14) → **14** (유지): 포터블 compound model 전환(eef7335). S4가 새 흐름으로 테스트 재작성.
- B2 (3) → **3** (유지): 동일. S4.
- C (1) → **0** (S2 해소): `.editor-empty-hint` 조건 변경 → ErrorBanner 리팩터로 자연 해결.
- F-download (4) → **4** (유지): 모바일 viewport에서 PNG download 이벤트 타임아웃. S3/S7.
- F-occlusion (4) → **4** (유지): A4-mask 선택자 고쳐도 Apply/Cancel/alert 하류에서 UI 변경 영향. S5.
- Linux 스냅샷 (5) → **5** (유지, 환경 미실행): win32에서는 비교 불가, S7 Docker Linux에서 재측정 필수.

**합계**: 40(baseline) - 13(S2 해소) + 5(이전엔 "환경 미실행"으로 세지 않던 Linux 스냅샷을 현재 run에서 집계) + 1(이전 "환경 미실행"에서 freestanding-portable은 이미 B1에 포함) = 33 ≈ 현재 실측 **33 failed**.

## Playwright 브라우저 상태

- 설치 여부: 이미 설치됨(`chromium-1234`, `chromium_headless_shell-1234`, `ffmpeg-1011`, `winldd-1007` 캐시 존재).
- 신규 설치 명령 필요: **아니오**. CI 환경이나 신규 노드에서만 `npx playwright install --with-deps chromium` 필요.

## 참고

- pre-v2 정리 상세는 `docs/v2/audit.md`의 관련 섹션과 커밋 메시지 참조.
- 기준선 값들은 baseline이라 향후 스프린트 완료 보고서에서 이 문서의 값과 비교할 것.
