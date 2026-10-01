# v2 기준선 (baseline)

이 문서는 v2 스프린트 시작 시점의 검사 결과를 기록합니다. 이후 스프린트에서는 "이 baseline 대비 새 실패가 없어야 통과"를 판정 기준으로 삼습니다.

## HEAD/태그

| 항목 | 값 |
|---|---|
| 브랜치 | `main` |
| HEAD 해시 (`v2-start` 태그) | `4e9659d8e72048586df9edc2f9a624320ec9e020` (`4e9659d`) |
| 이전 커밋 (pre-v2 전) | `6d45c84 feat: text becomes signage content, unified labels, canvas + footer polish` |
| pre-v2 정리 커밋들 | `500013d`, `f40514f`, `ea44469`, `4c0676c`, `4e9659d` |
| `v1-production` 태그 | **미생성** — 본서버 `hull-inc.jp/oitemiru/`에 실제로 업로드된 v1 dist가 어느 커밋에서 빌드됐는지 확인할 방법이 없어 만들지 않음. |

## 환경

| 항목 | 값 |
|---|---|
| OS | Windows 11 Home 10.0.26200 |
| Node | v24.14.0 |
| npm | 11.9.0 |
| Shell | PowerShell 5.1 / Git Bash 병행 사용 |
| Playwright | 1.62.1 (chromium 브라우저 기설치) |

`npm ci`는 pre-v2 정리 과정에서 별도 실행하지 않음. 이미 작업 중이던 `node_modules`를 그대로 사용하면서 개별 `npm run *`으로 검증. 다음 스프린트 시작 시 `npm ci`로 초기화 권장.

## 명령별 결과 (Step A-4)

`v2-start` (`4e9659d`) 시점에서 실행한 결과입니다. `npm test`는 vitest watch 모드이므로 사용하지 않고, `npm run test:run`을 사용했습니다.

| # | 명령 | 결과 | 소요 시간 | 세부 |
|---|---|---|---|---|
| 1 | `npm run typecheck` | ✅ pass | ~10초 | `tsc -b` 오류 없음, 출력 없음 |
| 2 | `npm run lint` | ✅ pass | ~10초 | `eslint .` 오류 없음, 출력 없음 |
| 3 | `npm run format:check` | ✅ pass | ~5초 | "All matched files use Prettier code style!" |
| 4 | `npm run test:run` | ✅ pass (35 files, 531 tests, 0 skip) | ~11.6초 | jsdom 환경에서 `HTMLCanvasElement.getContext`·`HTMLMediaElement.pause`·`Window.scrollTo` "Not implemented" 로그 다수(무해). 실패 없음. |
| 5 | `npm run build` | ✅ pass (경고 있음) | ~0.4초 | 161 modules → `dist/`. JS 696.76kB gz 208.02kB. 500kB 초과 경고 존재(코드 스플리팅 미도입, 기존 조건). |
| 6 | `npm run build:oitemiru` | ✅ pass (경고 있음) | ~0.4초 | 161 modules → `dist-oitemiru/`. JS 696.79kB gz 208.03kB. 동일 경고. |
| 7 | `E2E_PORT=4175 npm run test:e2e` | ⚠️ **부분 통과. 30 passed 라인만 캡처됨, 실패 라인 미캡처** | 15.1분 | Playwright chromium 프로젝트. 백그라운드 stdout이 tail 50줄만 남겨져 개별 테스트 결과 로그를 모두 검증하지 못함. 아래 "라벨 불일치" 절 참고. `test:e2e` 스펙 파일에도 `getByLabel('コンテンツを追加')`가 존재하므로 최소 qa:visual 7건 이상이 실제로 실패했을 가능성이 높음. 이 baseline에서는 **부분 통과로 처리**하고 S2에서 재측정. |
| 8 | `E2E_PORT=4176 npm run qa:visual` | ⚠️ **7 failed** | ~3.5분 | 모두 동일 원인: `locator.setInputFiles: Test timeout of 30000ms exceeded` — `getByLabel('コンテンツを追加')`를 대기하다 타임아웃. `e2e/visual-qa.spec.ts:47` `addContent()` 헬퍼가 사라진/이름이 바뀐 라벨을 찾음. pre-v2 커밋 `8cdbd77 refactor: fold Add Image into Content Upload, drop dedicated button`에서 라벨이 바뀐 것으로 추정. |

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

## 알려진 baseline 실패 목록

| 항목 | 원인(추정) | 처리 계획 |
|---|---|---|
| `visual-qa.spec.ts` 7 failed | 8cdbd77에서 「コンテンツを追加」 라벨 변경. e2e 헬퍼 `addContent()`가 옛 라벨을 찾음 | 조기 스프린트(S2 또는 S3)에서 헬퍼를 실제 라벨로 교체. 시각 회귀 스냅샷 재기록은 그 뒤. |
| `test:e2e` 다수 실패(추정) | 동일 원인. e2e 17줄이 옛 라벨 참조 | S2에서 e2e 재측정 후 실제 통과/실패 수 확정. 이 baseline의 30 passed 수치는 참고용. |

이후 스프린트에서는 이 표 외의 새 실패가 나면 "회귀"로 간주합니다.

## Playwright 브라우저 상태
- 설치 여부: 이미 설치됨(`chromium-1234`, `chromium_headless_shell-1234`, `ffmpeg-1011`, `winldd-1007` 캐시 존재).
- 신규 설치 명령 필요: **아니오**. CI 환경이나 신규 노드에서만 `npx playwright install --with-deps chromium` 필요.

## 참고
- pre-v2 정리 상세는 `docs/v2/audit.md`의 관련 섹션과 커밋 메시지 참조.
- 기준선 값들은 baseline이라 향후 스프린트 완료 보고서에서 이 문서의 값과 비교할 것.
