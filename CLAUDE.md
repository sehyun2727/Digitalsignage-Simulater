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

## 5. 작업 방식 (v2)

### 5-1. 브랜치·커밋
- `main` 직접 커밋 허용(1인 작업). 스프린트당 커밋 1개 이상.
- 메시지 형식: `feat(v2-S{n}): ...`, `fix(v2-S{n}): ...`, `docs(v2-S{n}): ...`, `test(v2-S{n}): ...`, `refactor(v2-S{n}): ...`.
- 한 파일이 여러 주제에 걸치면 분리하지 말고 묶기. `git add -p` 금지.

### 5-2. push 규칙
- **S1~S6 중에는 `git push` 금지**. Render 스테이징을 직원이 보기 때문입니다(운영 영향 아님).
- S7 완료 후 사용자 지시가 있을 때만 1회 push.
- `--force` 계열 금지. non-fast-forward가 나면 멈추고 보고.

### 5-3. 본서버 배포는 AI가 하지 않습니다
- AI는 `npm run build:oitemiru`를 실행해 `dist-oitemiru/`를 만드는 데까지만. 서버 업로드는 사용자가 수동.
- 상세 절차: `docs/v2/deployment.md`.

### 5-4. 범위 밖 변경 금지
- 스프린트 범위에 없는 리팩터, 디자인 변경, 의존성 추가, 포매팅 자동 수정(`prettier --write`, `eslint --fix`)을 범위 작업과 섞지 마세요.
- 범위 밖이 꼭 필요하면 멈추고 보고.

### 5-5. 불확실하면 추측 구현 금지
- 사용자 요구가 불분명하면 가장 작은 가역 구현을 제안하거나, 집중 질문을 1개 하고 중단.
- 코드에서 확인 안 된 사실을 보고에 쓰지 말 것("미확인"이라고 적기).

### 5-6. 버그 수정은 실패 테스트 선행
- 버그 수정은 **실패하는 테스트를 먼저 작성**하고 그 테스트가 통과하도록 수정.
- 의도된 UI 변경으로 테스트가 깨지면 그 스프린트의 범위 안에서 테스트도 함께 갱신.

### 5-7. visual-qa 스냅샷 갱신 규칙
- 스냅샷 갱신은 **의도된 변경에 한해** `npm run qa:visual:update`.
- 갱신한 스냅샷 파일 목록과 이유를 보고서에 기록.
- 의도하지 않은 차이가 생기면 버그로 처리.
- OS별 스냅샷은 `.gitignore`에 따라 Linux(Docker/CI) 외 금지 (`*-win32.png`, `*-darwin.png` ignored).

## 6. 테스트 규칙

### 6-1. 사용 명령 (모두 하이픈·오타 없이 그대로)
| 명령 | 용도 | 비고 |
|---|---|---|
| `npm run typecheck` | `tsc -b` 전체 체크 | |
| `npm run lint` | `eslint .` | |
| `npm run format:check` | `prettier --check .` | pass가 기본 |
| `npm run test:run` | Vitest 단일 실행 | **`npm test`는 watch 모드이므로 쓰지 말 것** |
| `npm run build` | 루트 base 빌드(Render용) | |
| `npm run build:oitemiru` | `/oitemiru/` base 빌드(본서버용) | |
| `npm run test:e2e` | Playwright 전체 | `E2E_PORT=4175` 등으로 포트 지정 가능 |
| `npm run qa:visual` | visual-qa 스펙만 | |
| `npm run qa:visual:update` | 스냅샷 갱신 | 범위 안 의도된 변경만 |
| `npm run preview` / `preview:oitemiru` | 로컬 preview | base 각각 다름 |

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
  - 통과 수가 baseline(현재 51)보다 줄면 안 됨.
  - 실패한 테스트는 1회 재실행. 재실행에서 통과하면 flaky로 표시하고 실패로 세지 않음.
  - 담당 스프린트는 자기 debt를 해소: S2(C7/A1/A4-text/C/A3), S4(B1/B2), S5(F-occlusion), S3 또는 S7(F-download), S7(visual-qa 환경 미실행 포함).
  - **S7 push 전에는 알려진 실패가 0건이어야 함.** 사용자가 승인한 예외만 남길 수 있음.
- [ ] `qa:visual`: Docker 가능하면 Linux 환경에서 통과. 불가능하면 "환경 미실행" 기록 후 S7에서 반드시 실행.
- [ ] 사용자 문구는 모두 i18n 키로. ja/ko/en 전부 갱신.
- [ ] 일본어 기본 동작 유지. 한국어·영어 전환 깨짐 없음.
- [ ] 포터블 compound model, HULL 워터마크, `/oitemiru/` 서브 경로, 이용약관 모달 접근성 **회귀 없음**.
- [ ] object URL / 리스너 / 비디오 element 정리 유지.
- [ ] 사용자 노출 behavior 변경이나 설정 변경이 있으면 문서(`docs/v2/*.md`, `docs/runbooks/*`, README) 갱신.
- [ ] PR/커밋에 알려진 제한·검증 방법·회귀 가능 영역 기록.
- [ ] S7 외에는 `git push` 안 했음.

## 9. 지시 우선순위

충돌 시 다음 순서로 적용:

1. 시스템/개발자 지시 및 리포지토리 보안 정책
2. 사용자의 명시적 현재 요청
3. 승인된 스프린트 범위·수용 기준(`docs/v2/requirements.md`)
4. 이 문서 (CLAUDE.md)
5. 기존 구현 관례

의심이 들면 범위를 넓히기 전에 멈추고 확인 요청하세요.
