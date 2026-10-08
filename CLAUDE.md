# CLAUDE.md — 置いてみる君 (디지털사이네지 설치 시뮬레이터) v2 작업 지침

> 이전 Sprint 1 지침은 `docs/archive/CLAUDE-v1-sprint1.md`에 보관되어 있습니다. 현재 규칙은 **이 문서**입니다.

## 1. 프로젝트 정체성

- **프로젝트명**: 置いてみる君 (デジタルサイネージ設置シミュレーター)
- **운영 주체**: HULL株式会社 — 당사가 운영하는 **공식 서비스**입니다. "개인 프로젝트", "비공식" 같은 서술을 코드·문서·앱 문구에 쓰지 마세요.
- **공개 운영 URL**: `https://hull-inc.jp/oitemiru/` (수동 빌드 업로드)
- **직원 확인용 스테이징**: `https://digitalsignage-simulater.onrender.com` (`main` push 자동 재배포, Render Static Site)
- **처리 원칙**: 브라우저 로컬 처리. 업로드한 이미지·영상은 서버로 전송되지 않습니다. (TermsOfServiceModal 제5조 참조)
- **워터마크 필수**: PNG·동영상 내보내기에 HULL 워터마크가 자동으로 포함됩니다. 선택·이동·삭제 불가. 사용자 토글(`uiStore.watermarkDisabled`)로만 세션 단위로 끌 수 있으며, 기본값은 ON.
- **포터블 compound model 확정**: 포터블 제품은 "제품 사진/템플릿 + 고정 screenQuad + 콘텐츠 워프"가 하나의 Group. `screenQuad`는 **포터블 전용**이며 모자이크(Occlusion)와 **타입·상태·컴포넌트를 공유하지 않습니다** (B-6-5 참조). 일반 UI에서 `PortableQuadDebugOverlay`를 노출하지 마세요.

## 2. 기술 스택과 디렉터리 경계

- **스택**: React 19 + TypeScript 5 + Vite 8 + Vitest + Konva(react-konva) + Zustand + Playwright + ESLint + Prettier
- **배포**: Render Static Site(스테이징) + 본서버 수동 업로드(운영). Docker는 로컬·CI 재현용(`Dockerfile`, `docker/nginx.conf`).
- **디렉터리 역할** (상세는 `docs/v2/audit.md` B-0-1):
  - `src/app/`: 애플리케이션 셸, 로케일 프로바이더, 에러 바운더리
  - `src/components/`: 공용 UI (`HullCta`, `LanguageSelector`, `TermsOfServiceModal`, `UserGuideModal`)
  - `src/features/editor/`: 에디터 UI (`EditorLayout`, `EditorCanvas`, `Toolbar`, 각종 뷰·오버레이)
  - `src/i18n/`: 로케일 감지·프로바이더·`locales/{ja,ko,en}.ts`
  - `src/lib/`: 프레임워크 비의존 유틸
  - `src/store/`: `editorStore`(문서·히스토리·드래프트), `uiStore`(세션 UI 모드)
  - `src/types/`: 공용 타입
  - `src/styles/`: 전역 CSS
  - `src/assets/portable/`: 포터블 번들 자산 (ES module import)
  - `public/`: Vite가 base로 재작성해 주는 정적 자산 (favicon, 워터마크 SVG)
  - `tests/unit/`: Vitest (include=`tests/**/*.test.{ts,tsx}` — 다른 위치는 picked-up 안 됨)
  - `e2e/`: Playwright 스펙 (`playwright.config.ts`)
  - `docs/`, `docs/v2/`, `docs/adr/`, `docs/runbooks/`: 문서

## 3. 아키텍처 핵심 규칙

### 3-1. 상태 분리

- **문서 상태**: `editorStore` — `document`(공간 배경 + 캔버스 프리셋 + 객체 배열), `selectedId`, `past`/`future` 히스토리(50 한도), 각종 편집 드래프트(perspective/occlusion/screenQuad).
- **세션 UI 상태**: `uiStore` — `comparisonMode`, `salesReviewMode`, `onboardingDismissed`(localStorage), `realismGuideDismissed`(localStorage), `watermarkDisabled`.
- 두 스토어의 상태는 섞지 마세요. 특히 비교 모드·세일즈 리뷰 모드를 문서 히스토리에 넣지 마세요.

### 3-2. 렌더링 레이어 순서 (하 → 상)

1. `SpaceBackgroundView` (Cover-fit + offsetY 세로 팬)
2. objects(각 `CanvasObjectView` → `SignageDisplayView`/`PortableProductView`/Konva Text/Image) + 각 객체의 `ContactShadowView`·`OcclusionMaskLayer`·`ScreenReflection` 등
3. 공용 `Transformer` (선택 UI)
4. `HullWatermarkView` (최상단, 미리보기·PNG·동영상 공통)
5. 편집 모드 오버레이(`PerspectiveEditOverlay`·`OcclusionEditOverlay`·`ScreenQuadEditOverlay`)

### 3-3. 편집 표시 배율과 출력 해상도 분리

- `fitScale = containerWidth / documentSize.width`가 표시 배율. **출력은 캔버스 프리셋(1920×1080 또는 1080×1920) 고정**. `exportPixelRatio = devicePixelRatio × (documentSize / containerWidth)`로 보정.
- 레이아웃 변경(S3)·확대/축소(S4) 도입 후에도 **PNG/동영상 출력 해상도는 불변**이어야 합니다 (C12).

### 3-4. 포터블 compound model

- `PortableSignageObject`는 `BaseSignageObject` + `templateView`(front/angled/side) + `productPhotoSourceId: string | null` + `screenQuad: NormalizedQuad | null`.
- 사용자가 제품 사진을 업로드하면 `productPhotoSourceId`가 생기고, 그 안에서 `ScreenQuadEditOverlay`로 `screenQuad`를 지정. 사진 없을 때는 템플릿 뷰별 preset 값을 fallback으로 사용.
- `WarpedScreenContent`가 콘텐츠를 `screenQuad`로 워프, `PortableTemplateBody`(또는 productPhoto)가 상단 프레임을 덮음.

### 3-5. **포터블 `screenQuad`와 모자이크(Occlusion) 4점은 공유 금지**

- 서로 다른 타입: `screenQuad: NormalizedQuad`(4점) vs `OcclusionMask { kind:'polygon', points: NormalizedPoint[] }`(3~24점).
- 서로 다른 drafts (`screenQuadDraftQuad` vs `occlusionDraftPoints`), 서로 다른 오버레이·레이어·좌표계. 유틸 함수(`clampPoint01`, `normalizedQuadToDocument`)만 공유.
- 이 둘을 합치려 하지 마세요.

### 3-6. HULL 워터마크

- `src/features/editor/HullWatermarkView.tsx` + `src/lib/hullWatermark.ts`.
- `HULL_WATERMARK_SRC = \`${import.meta.env.BASE_URL}assets/brand/hull-watermark.svg\`` — 두 base에서 자동 대응.
- 미리보기·PNG·동영상에 **같은 layout 함수**로 항상 최상단. 선택·이동·삭제 불가. 토글은 `uiStore.watermarkDisabled`만.

### 3-7. 서브 경로(`/oitemiru/`) 처리

- `vite.config.ts`에 **`base`를 하드코딩하지 말 것**. 환경별 차이는 `package.json` scripts의 `--base`로만 처리:
  - `npm run build` → base `/`, 출력 `dist/` (Render용)
  - `npm run build:oitemiru` → base `/oitemiru/`, 출력 `dist-oitemiru/` (본서버용)
- 자원 참조는 ES module import 또는 `import.meta.env.BASE_URL` 사용. `/`로 시작하는 **절대 경로 문자열 금지**.
- `index.html`의 `href="/favicon.svg"`는 Vite가 base로 재작성.
- 상세: `docs/v2/deployment.md`, `docs/runbooks/render-static-site.md`.

### 3-8. object URL / HTMLVideoElement 생명주기

- 모든 업로드 자산은 `src/lib/assetRegistry.ts`를 통해 디코드 후 `sourceId`로 참조. Object URL은 레지스트리가 관리.
- 객체 삭제·히스토리 폐기 후 `sweepUnusedAssets()`가 참조 수를 세어 revoke.
- 복사·붙여넣기(S4) 구현 시 `sourceId` 공유 참조의 revoke 거동을 반드시 테스트(C13).

## 4. i18n 규칙

- 모든 **사용자 노출 문자열**은 `src/types/i18n.ts`의 `Messages` 키로. 하드코딩 금지(JSX의 데코 이모지 등 aria-hidden 제외).
- 세 로케일(ja/ko/en) **동시에** 추가·수정. `tests/unit/locales.test.ts`가 키 집합 일치를 검증.
- 신규 문구는 `docs/v2/glossary.md`의 용어를 그대로 사용. 신규 용어가 거기 없으면 ①에 먼저 추가.
- **문장 조각 금지**: 완전한 문장을 2개 이상의 키로 쪼개 이어붙이지 말 것. 어순이 다른 언어에서 깨짐.
- **상수 하드코딩 금지**: 「10MB」「3840」 같은 수치는 로케일 문자열에 넣지 말고 UI 레이어에서 상수를 포맷해 넣기.
- 신규 문구는 **role/label/data-testid**로 테스트가 조회하도록 설계. getByText는 라벨 변경에 취약.

## 4bis. 캔버스 동결 (v2-S4 Step 0-3)

v2-S3-ok(태그 `v2-S3-ok`, 커밋 `18d9fe4`) 시점의 캔버스 표시 방식을 **기준 상태**로 못 박습니다. 기준 상태의 정의:

- 문서 크기 1920×1080 / 1080×1920.
- 폭·높이 안에 비율을 유지한 채 맞춤(미려 확대/축소·오버패닝 없음).

### 동결 대상 (수정 금지)

| id                      | 파일                                   | 내용                                                                                                                                  |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `preset-sizes`          | `src/types/editor.ts`                  | `CanvasPresetId` + `CANVAS_PRESET_SIZES` + `DEFAULT_CANVAS_PRESET`                                                                    |
| `fit-scale`             | `src/features/editor/EditorCanvas.tsx` | fitScale IIFE + stageWidth/stageHeight 계산, 측정 전 fallback(desktop 0 / mobile viewport bootstrap)                                  |
| `coord-convert`         | `src/features/editor/EditorCanvas.tsx` | `clientPointToDocumentPoint` (화면 → 문서 좌표)                                                                                       |
| `measure-container-jsx` | `src/features/editor/EditorCanvas.tsx` | `.editor-canvas-measure` + `.editor-canvas-container` 래퍼 JSX 구조와 inline-style gate                                               |
| `root-overflow`         | `src/styles/global.css`                | 데스크톱 `html, body, #root { overflow: hidden; height: 100dvh }`                                                                     |
| `workspace-grid`        | `src/styles/global.css`                | `.editor-workspace` / `.editor-canvas-column` / `.editor-canvas-wrapper` / `.editor-canvas-measure` / `.editor-canvas-container` 규칙 |
| `status-area`           | `src/styles/global.css`                | `.editor-status-area { flex: 0 0 5.5rem }` + min/max-height 등                                                                        |
| `media-breakpoint-72`   | `src/styles/global.css`                | `@media (max-width: 72rem) and (min-width: 48.0001rem)` 블록(헤더 wrap)                                                               |
| `media-breakpoint-48`   | `src/styles/global.css`                | `@media (max-width: 48rem)` 열림 라인(모바일 stacked 전환)                                                                            |

### 허용 대상 (수정 자유)

- Stage 안에서 그리는 오브젝트·레이어·효과(새 레이어, 셰이더, 콘텐츠 매핑 등).
- 패널(Toolbar) 내용·구조.
- 내보내기 로직 전반. **단 출력 해상도는 문서 크기 그대로**(C12).

### 수정 절차 ([canvas-approved])

동결 대상을 바꿔야 하면 CC는 **직접 수정하지 말고 멈춰서** 보고합니다. 보고에는 ① 이유, ② 변경 전후 수치, ③ 대안을 반드시 넣습니다. 사용자가 승인한 뒤에만 수정하며, 그 커밋 메시지에 `[canvas-approved]`를 붙입니다.

승인된 수정 커밋은 **같은 커밋**에서 `docs/v2/canvas-freeze.json`의 해당 id도 새 SHA로 갱신합니다. 두 파일을 분리하면 CI(`npm run check:canvas`)가 바로 깨집니다.

### 강제 장치

1. **코드 마커**: 동결 블록을 `CANVAS-FREEZE:BEGIN <id>` / `CANVAS-FREEZE:END <id>` 주석으로 감싸 둡니다(ts/tsx는 `//`, css는 `/* */`). 마커 자체는 블록의 **내용**이 아니므로 수정해도 SHA에 영향 없음.
2. **해시 검증**: `scripts/check-canvas-freeze.mjs`가 마커 사이 바이트의 SHA-256을 `docs/v2/canvas-freeze.json`과 비교. 미스매치 시 exit 1. `npm run check:canvas`로 호출.
3. **런타임 측정**: `e2e/canvas-freeze.spec.ts`가 v2-S3-ok 측정값(Stage left/top/width/height)과 ±0.5 px 범위에서 일치하는지 확인(1920×1080 / 1440×900 / 1280×720 / 1024×640 / 390×844 × 16:9/9:16).

## 5. 작업 방식 (v2)

### 5-1. 브랜치·커밋

- **작업 브랜치는 `v2`만 씁니다.** 로컬 `main`은 `origin/main`과 동일하게 유지하며, 커밋을 올리지 않습니다. `main`은 S7의 `v2 → main` PR merge로만 전진하고, Render 스테이징·운영은 `main`에서만 배포됩니다.
- 스프린트당 커밋 1개 이상. 메시지 형식: `feat(v2-S{n}): ...`, `fix(v2-S{n}): ...`, `docs(v2-S{n}): ...`, `test(v2-S{n}): ...`, `refactor(v2-S{n}): ...`, `chore(v2-S{n}): ...`.
- 한 파일이 여러 주제에 걸치면 분리하지 말고 묶기. `git add -p` 금지.

### 5-2. push 규칙

- CC는 `origin v2`에만 push할 수 있습니다. 허용 형태는 다음뿐:
  - `git push origin v2`
  - `git push -u origin v2`
  - `git push origin <태그명>` (단건, 아래 5-3 참조)
- push 시점: 스프린트 Step 완료 + 전체 검사 통과 + handoff 작성 완료 중 하나가 참일 때. 문서 전용 커밋은 handoff 조건을 생략합니다.
- **main push 금지**, `--force` / `-f` / `--force-with-lease` / `--tags` / `--all` / `--mirror` / 원격 ref 삭제 금지. 로컬 `.git/hooks/pre-push`가 이 세 가지(main 대상, non-fast-forward, 삭제)를 거부합니다. 훅 재설치는 `docs/runbooks/render-static-site.md` 참조.
- push가 거부되거나 non-fast-forward가 뜨면 **다시 시도하지 말고 멈춘 뒤** 출력 전문을 보고합니다.

### 5-3. 태그 규칙

- 태그 생성·push는 **사용자 검수 합격 후 사용자가 명시적으로 지시**했을 때만 수행합니다. 지시받은 태그만 개별로 push하고 `--tags`는 쓰지 않습니다.
- 자동으로 `v2-S{n}-ok` 류의 태그를 미리 만들지 마세요.
- **아카이브 태그로 복구**: 2026-10-09 정리에서 v1 시절 9개 feature/chore 브랜치는 삭제되고 각 tip은 `archive/v1/<원래브랜치명>` annotated 태그로 보존됐습니다. 되살리려면 `git switch -c <원래브랜치명> archive/v1/<원래브랜치명>` — 예: `git switch -c feature/sprint-4-5-scene-integration-qa archive/v1/feature/sprint-4-5-scene-integration-qa`. 아카이브 태그는 push 금지 목록이 아니지만, S7 외에는 새 태그를 만들지 않습니다.

### 5-4. S3 교훈 (반드시 지킬 것)

1. **sed·정규식으로 여러 파일을 일괄 치환하지 않습니다.** 테스트는 하나씩 열어 의도를 확인하고 수정합니다. 일괄 치환은 의미 축소(헤더/패널 중 하나만 검사하게 됨)를 유발합니다.
2. **세션이 부족하면 끝낸 단계까지 커밋 → `docs/v2/sN-M-handoff.md` 작성 → `origin v2` push → 보고** 순서로 넘깁니다. 중간에 버리거나 반쯤 끝난 상태로 두지 않습니다.
3. **측정을 먼저 하고 분류는 그다음에 합니다.** T(T-sed/T-acc/T-coord)·R(앱 회귀) 판정은 실측값(실패 메시지 첫 줄 + 원인 파일:라인)을 근거로만 결정합니다. "추정"으로 분류하지 마세요.
4. **사용자 결정이 필요한 지점은 선택지와 권장안을 함께 제시**합니다. 혼자 디자인 결정을 내리지 않습니다.

### 5-5. 검증 규칙

- 보고서에서 "포맷 일치", "확인함", "통과함"만 적힌 항목은 NG로 간주합니다. 수치(측정값, 비교 결과, 차이)를 함께 적습니다.
- 수치 없는 어서션(예: `expect(x).toBeTruthy()`)은 가능하면 수치 어서션으로 교체합니다. 교체가 어려우면 로그에 측정값을 기록합니다.

### 5-6. 본서버 배포는 AI가 하지 않습니다

- AI는 `npm run build:oitemiru`를 실행해 `dist-oitemiru/`를 만드는 데까지만. 서버 업로드는 사용자가 수동.
- 상세 절차: `docs/v2/deployment.md`.

### 5-7. 범위 밖 변경 금지

- 스프린트 범위에 없는 리팩터, 디자인 변경, 의존성 추가, 포매팅 자동 수정(`prettier --write`, `eslint --fix`)을 범위 작업과 섞지 마세요.
- 범위 밖이 꼭 필요하면 멈추고 보고.

### 5-8. 불확실하면 추측 구현 금지

- 사용자 요구가 불분명하면 가장 작은 가역 구현을 제안하거나, 집중 질문을 1개 하고 중단.
- 코드에서 확인 안 된 사실을 보고에 쓰지 말 것("미확인"이라고 적기).

### 5-9. 버그 수정은 실패 테스트 선행

- 버그 수정은 **실패하는 테스트를 먼저 작성**하고 그 테스트가 통과하도록 수정.
- 의도된 UI 변경으로 테스트가 깨지면 그 스프린트의 범위 안에서 테스트도 함께 갱신.

### 5-10. visual-qa 스냅샷 갱신 규칙

- 스냅샷 갱신은 **의도된 변경에 한해** `npm run qa:visual:update`.
- 갱신한 스냅샷 파일 목록과 이유를 보고서에 기록.
- 의도하지 않은 차이가 생기면 버그로 처리.
- OS별 스냅샷은 `.gitignore`에 따라 Linux(Docker/CI) 외 금지 (`*-win32.png`, `*-darwin.png` ignored).

### 5-11. e2e 집계는 `test:e2e:core` 기준 (S3 이후)

- `visual-qa.spec.ts`(golden-image 6건)는 Linux 전용 스냅샷 기반이라 win32에서는 집계 신뢰도가 없음. 그래서 S3~S6의 e2e 판정은 **`npm run test:e2e:core`**(`--grep-invert "golden-image"`) 결과를 기준으로 삼는다.
- `visual-qa`는 S7 Docker Linux에서 별도 `qa:visual`로 돌리고 거기서만 판정한다. baseline 알려진 실패 표의 "Linux 스냅샷" 행도 S7에서만 평가한다.

### 5-12. 수동 테스트·스크린샷 금지, 자가검증은 측정값으로

- **사용자에게 수동 테스트를 돌리라고 요청하지 않습니다.** 스크린샷 첨부도 요청하지 않습니다. v2 전체에서 "브라우저로 확인해 주세요" 흐름은 쓰지 않습니다.
- 스프린트가 "눈으로 확인되어야 하는" 항목(폰트 크기, 대비, 레이아웃)을 요구할 때는 자가검증 항목(V1, V2, ...)을 **Playwright assertion**으로 작성합니다. 폰트 크기는 `getComputedStyle(...).fontSize` 측정, 대비는 relative-luminance 계산, 위치는 `boundingBox` 비중첩으로 검증합니다.
- 자가검증 테스트는 e2e 스펙 안에 섞어 두되 `v2-xxx-upload.spec.ts` 같이 스프린트별 파일로 묶어서 관리합니다. 보고서에 각 V 항목의 **측정값**(예: `fontSize=16px, contrastRatio=12.63:1`)을 적습니다. 통과·실패만 적지 말 것.
- 중간 분석·계획을 적는 임시 `.md` 파일은 커밋에서 제외합니다(`docs/v2/*.md`에 들어가는 공식 문서만 커밋).

## 6. 테스트 규칙

### 6-1. 사용 명령 (모두 하이픈·오타 없이 그대로)

| 명령                                   | 용도                             | 비고                                         |
| -------------------------------------- | -------------------------------- | -------------------------------------------- |
| `npm run typecheck`                    | `tsc -b` 전체 체크               |                                              |
| `npm run lint`                         | `eslint .`                       |                                              |
| `npm run format:check`                 | `prettier --check .`             | pass가 기본                                  |
| `npm run test:run`                     | Vitest 단일 실행                 | **`npm test`는 watch 모드이므로 쓰지 말 것** |
| `npm run build`                        | 루트 base 빌드(Render용)         |                                              |
| `npm run build:oitemiru`               | `/oitemiru/` base 빌드(본서버용) |                                              |
| `npm run test:e2e`                     | Playwright 전체                  | `E2E_PORT=4175` 등으로 포트 지정 가능        |
| `npm run qa:visual`                    | visual-qa 스펙만                 |                                              |
| `npm run qa:visual:update`             | 스냅샷 갱신                      | 범위 안 의도된 변경만                        |
| `npm run preview` / `preview:oitemiru` | 로컬 preview                     | base 각각 다름                               |

### 6-2. 테스트 작성

- 단위 테스트 위치: **`tests/unit/*.test.{ts,tsx}`**. 다른 위치는 pick-up 안 됨.
- e2e 위치: `e2e/*.spec.ts`.
- 선택자: **role / label / data-testid 우선**. getByText는 문구가 자주 바뀌는 UI 요소에 쓰지 말 것.
- jsdom 환경 경고(`HTMLCanvasElement.getContext`, `HTMLMediaElement.pause`, `Window.scrollTo` "Not implemented")는 무시.

### 6-3. 실행하지 않은 검사를 통과했다고 쓰지 않기

- 보고서에 명령별 실제 실행 결과만 기록. 추정으로 ✅ 쓰지 마세요.

## 7. 스프린트 완료 보고서 형식

각 스프린트가 끝나면 아래 형식으로 보고하세요(검수자 AI가 코드를 직접 보지 않고도 판단할 수 있도록 구체적으로).

```
# v2-S{n} 완료 보고

## 1. 요약 (3~5줄)

## 2. 범위
- 담당 요구사항 ID와 각 수용 기준의 충족 여부
- 범위 밖 변경 없음(또는 있다면 사유)

## 3. 변경 내역
- 수정 파일 목록(파일경로:라인)
- 신규 파일
- 삭제 파일
- 신규 i18n 키 (ja/ko/en 전부)
- 신규/변경 테스트 파일

## 4. 검사 결과 표
명령 | 결과 | 테스트 수(파일/테스트/skip) | 실패 목록 | 소요 시간
(baseline과 비교해 새 실패가 있으면 각각 사유·조치 명시)

## 5. visual-qa 스냅샷 갱신 내역
- 파일 | 이유

## 6. 알려진 한계·후속 작업

## 7. 커밋 목록
- 해시 | 메시지 | 포함 파일 요약

## 8. 다음 스프린트 영향
```

## 8. 완료 정의 (DoD)

스프린트가 완료되려면 **모두** 참이어야 합니다.

- [ ] 담당 요구사항 ID별 수용 기준 전부 충족 (`docs/v2/requirements.md`의 체크리스트).
- [ ] `typecheck`, `lint`, `format:check`, `test:run`, `build`, `build:oitemiru` **모두 통과**.
- [ ] **e2e 판정**(`docs/v2/baseline.md`의 "알려진 e2e 실패" 표):
  - 실패한 테스트가 전부 그 표 안에 있어야 함(새 실패 0건).
  - 통과 수가 baseline(v2-S2 보완 후 **87**)보다 줄면 안 됨.
  - 실패한 테스트는 1회 재실행. 재실행에서 통과하면 flaky로 표시하고 실패로 세지 않음.
  - 담당 스프린트는 자기 debt를 해소: S4(B1/B2), S5(F-occlusion), S3 또는 S7(F-download), S7(Linux 스냅샷 환경 재측정).
  - **S7 push 전에는 알려진 실패가 0건이어야 함.** 사용자가 승인한 예외만 남길 수 있음.
- [ ] `qa:visual`: Docker 가능하면 Linux 환경에서 통과. 불가능하면 "환경 미실행" 기록 후 S7에서 반드시 실행.
- [ ] 사용자 문구는 모두 i18n 키로. ja/ko/en 전부 갱신.
- [ ] 일본어 기본 동작 유지. 한국어·영어 전환 깨짐 없음.
- [ ] 포터블 compound model, HULL 워터마크, `/oitemiru/` 서브 경로, 이용약관 모달 접근성 **회귀 없음**.
- [ ] object URL / 리스너 / 비디오 element 정리 유지.
- [ ] 사용자 노출 behavior 변경이나 설정 변경이 있으면 문서(`docs/v2/*.md`, `docs/runbooks/*`, README) 갱신.
- [ ] PR/커밋에 알려진 제한·검증 방법·회귀 가능 영역 기록.
- [ ] `main`에 push·커밋 없음. `v2` push만 수행.

## 9. 지시 우선순위

충돌 시 다음 순서로 적용:

1. 시스템/개발자 지시 및 리포지토리 보안 정책
2. 사용자의 명시적 현재 요청
3. 승인된 스프린트 범위·수용 기준(`docs/v2/requirements.md`)
4. 이 문서 (CLAUDE.md)
5. 기존 구현 관례

의심이 들면 범위를 넓히기 전에 멈추고 확인 요청하세요.
