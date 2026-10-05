# v2-S0 코드 조사 (audit)

HEAD: `4e9659d` (`v2-start` 태그). 조사자는 원문 코드를 읽어 보고하되, 실제로 보지 못한 항목은 "미확인"으로 적습니다. 모든 근거는 `파일경로:라인` 형식입니다.

---

## B-0 전체 구조

### B-0-1 디렉터리 역할

| 디렉터리               | 역할                                                                  | 주요 파일                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`             | 애플리케이션 셸, 로케일 프로바이더, 에러 바운더리, 매뉴얼 모달 트리거 | `App.tsx` (main.tsx가 import)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/components/`      | 공용 UI(단일 위치 사용 포함)                                          | `HullCta.tsx`, `LanguageSelector.tsx`, `TermsOfServiceModal.tsx`, `UserGuideModal.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/features/editor/` | 에디터 전용 캔버스/오버레이/툴바                                      | `EditorLayout.tsx`, `EditorCanvas.tsx`, `Toolbar.tsx`, `CanvasObjectView.tsx`, `SignageDisplayView.tsx`, `PerspectiveScreenView.tsx`, `PortableProductView.tsx`, `PortableTemplateBody.tsx`, `WarpedScreenContent.tsx`, `ScreenComposition.tsx`, `ScreenReflection.tsx`, `ContactShadowView.tsx`, `OcclusionMaskLayer.tsx`, `OcclusionEditOverlay.tsx`, `PerspectiveEditOverlay.tsx`, `ScreenQuadEditOverlay.tsx`, `PortableQuadDebugOverlay.tsx`, `SpaceBackgroundView.tsx`, `HullWatermarkView.tsx`, `OnboardingOverlay.tsx`, `RealismGuideCard.tsx`, `AdvancedSettingsModal.tsx`, `EditorErrorBoundary.tsx`, `useModalDialog.ts`, `useVideoLuminance.ts`, `useVideoPlaybackRedraw.ts` |
| `src/i18n/`            | 로케일 감지/저장/프로바이더                                           | `detectLocale.ts`, `localeContext.ts`, `LocaleProvider.tsx`, `storage.ts`, `locales/{ja,ko,en}.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/lib/`             | 프레임워크 비의존 유틸                                                | `assetRegistry.ts`, `contentLayout.ts`, `contentUpload.ts`, `fileValidation.ts`, `videoValidation.ts`, `videoExport.ts`, `videoExportCapability.ts`, `curvature.ts`, `displayFrame.ts`, `environmentIntegration.ts`, `exportFilename.ts`, `geometryNormalization.ts`, `hullContact.ts`, `hullWatermark.ts`, `id.ts`, `imageSafety.ts`, `konvaCacheSync.ts`, `materialTexture.ts`, `occlusion.ts`, `onboardingStep.ts`, `onboardingStorage.ts`, `portableTemplate.ts`, `quadGeometry.ts`, `realismGuideStorage.ts`, `renderingPresets.ts`, `screenHitTest.ts`, `spaceBackgroundFit.ts`, `contentLuminance.ts`, `videoLuminance.ts`, `videoPlaybackRedraw.ts`                              |
| `src/store/`           | Zustand 상태                                                          | `editorStore.ts` (문서/선택/이력/각종 편집 드래프트), `uiStore.ts` (뷰 모드)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/types/`           | 공용 타입                                                             | `editor.ts`, `i18n.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/styles/`          | 전역 CSS, 디자인 토큰                                                 | `global.css`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/assets/portable/` | 포터블 템플릿용 정적 에셋(번들 import)                                | 벡터 템플릿, docodemo 사진 등                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/test/`            | 유닛 테스트 셋업                                                      | `setup.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

### B-0-2 editorStore / uiStore 분리

**결론**: 문서/히스토리/드래프트 전부 `editorStore`, 세션 UI 뷰 모드만 `uiStore`.

- `editorStore.ts:107~215`에 액션 시그니처 정의. 핵심 액션: `addText`(292), `addDisplay`(377), `addPortable`(411), `setSpaceBackground`, `removeSpaceBackground`, `setSpaceBackgroundOffsetY`, `setCanvasPreset`(506), `updateObjectTransient`(559, 히스토리 미기록), `commitObjectChange`(564, 히스토리 기록), `undo`(667), `redo`(690), `applyPerspectiveEdit`(764), `applyOcclusionEdit`(903), `beginPerspectiveEdit`, `updatePerspectiveDraft`, `cancelPerspectiveEdit`, `beginOcclusionEdit`, `updateOcclusionDraftPoints`, `setOcclusionDraftFeather`, `setOcclusionDraftOpacity`, `beginScreenQuadEdit`, `updateScreenQuadDraft`, `applyScreenQuadEdit`, `cancelScreenQuadEdit`, `applyRenderingPreset`, `sampleEnvironmentColor`, `deleteSelected`, `selectObject`, `setPortableProductPhoto`.
- 상태 분리: `document`(EditorDocument) + `selectedId` + `past[]`/`future[]`(히스토리) + 편집 드래프트(perspective/occlusion/screenQuad의 "edit mode" id·draft·original 쌍) 모두 `editorStore`.
- `uiStore.ts:11~23`: `comparisonMode`, `salesReviewMode`, `onboardingDismissed`(localStorage), `realismGuideDismissed`(localStorage), `watermarkDisabled`(세션 토글). 액션 5개(set/dismiss/toggle). 문서 상태와 완전 분리.

### B-0-3 사이니지 객체 타입 (판별 공용체)

**결론**: 판별자는 `kind`. LED/LCD/시스루는 **같은 타입(`DisplaySignageObject`)**이고 `material` 필드로만 구분. 포터블은 별도 타입.

근거(`src/types/editor.ts`):

- `TextSignageObject`(L12, kind='text', text/fontSize/color/align)
- `ImageSignageObject`(L20, kind='image', sourceId/natural width·height)
- `DisplaySignageObject`(L340, kind='display'): `frameId`, `content`, `material: DisplayMaterial` (= `'led' | 'lcd' | 'transparent-led' | 'outdoor-led'`, L109), `materialSettings`, `curvature`, `placementMode`, `perspectiveQuad: NormalizedQuad | null`, `contactShadow`, `environmentIntegration`, `installationMode`, `occlusionMasks[]`
- `PortableSignageObject`(L365, kind='portable'): Display 전 필드 + `templateView` (front/angled/side) + `productPhotoSourceId: string | null` + `screenQuad: NormalizedQuad | null`
- `SignageObject = Text | Image | Display | Portable` 공용체(L387)
- `supportsPerspective()` 타입 가드(L393) — display/portable만 원근 가능
- 영향받는 요구사항: 1-1(복사 범위), 3-1, 5-2. 리스크: 중

### B-0-4 렌더링 레이어 순서

**결론 (하 → 상)**:

1. `SpaceBackgroundView` — Cover-fit된 설치 장소 사진 + offsetY 세로 팬
2. `objectsGroup` 안의 각 `CanvasObjectView` →
   - **Display**: `SignageDisplayView` → `ScreenComposition`(material/content/curvature/contrast) + `ContactShadowView`(rect 모드) + `ScreenReflection`(window 설치) + `PerspectiveScreenView`(perspective 모드일 때, 전체를 off-canvas에 그린 뒤 워프 메시 재그리기) + 선택 시 perspective hit-target Line
   - **Portable**: `PortableProductView` → `WarpedScreenContent`(스크린 영역 백/콘텐츠 워프) + `PortableTemplateBody` 또는 productPhoto(상단 프레임) + `ContactShadowView` + `OcclusionMaskLayer` + 디버그 플래그 켜졌을 때만 `PortableQuadDebugOverlay`
   - **Text/Image**: Konva Text/Image 노드
3. `OcclusionMaskLayer` — 각 Display/Portable 뒤에 자신의 마스크(기둥 등 전경 가림)
4. 공용 `Transformer`(선택 UI)
5. `HullWatermarkView` — 최상단, 미리보기·PNG·동영상에 동일. 선택/이동/삭제 불가
6. 편집 모드 오버레이: `PerspectiveEditOverlay` / `OcclusionEditOverlay` / `ScreenQuadEditOverlay` (활성 시에만)

근거: `src/features/editor/EditorCanvas.tsx` Stage/Layer 구성, `SignageDisplayView.tsx`, `PortableProductView.tsx`. 영향받는 요구사항: C17. 리스크: 중.

### B-0-5 PNG / 동영상 내보내기 vs 미리보기

**결론**: 둘 다 같은 Stage를 사용. 출력 해상도는 캔버스 프리셋(1920×1080 / 1080×1920) 고정. 표시 scale은 pixelRatio 보정으로 분리.

- PNG: `EditorCanvas.exportToDataUrl` → Transformer 숨김 → `stage.toDataURL({ pixelRatio: exportPixelRatio })`. `exportPixelRatio = devicePixelRatio × (documentSize / containerWidth)`로 뷰포트 scale과 분리.
- 동영상: `EditorLayout.handleExport` → `beginVideoExportCapture()` → `recordCanvasToVideo(canvas, { mimeType, fps, durationMs })` (`src/lib/videoExport.ts`).
- 공유 파이프라인: 둘 다 같은 Konva Stage 렌더. 워터마크 동일 포함.
- 영향받는 요구사항: 2-1(표시 scale ↔ 출력 분리), 4-x(내보내기), C12, C17. 리스크: 중.

### B-0-6 서브 경로(`/oitemiru/`) 처리 — **pre-v2 P-8 결과로 교체**

**결론**: 환경별로 **두 빌드**로 분리됨. `vite.config.ts`에는 base 하드코딩 금지. 자원 참조는 import 또는 `import.meta.env.BASE_URL`을 통해서만.

| 환경                                                              | 명령                     | 출력 폴더        | 효과적 base  | HTTP 200 확인(curl)                              |
| ----------------------------------------------------------------- | ------------------------ | ---------------- | ------------ | ------------------------------------------------ |
| Render 스테이징 (`https://digitalsignage-simulater.onrender.com`) | `npm run build`          | `dist/`          | `/`          | 전부 200 (preview localhost:4173 기준)           |
| 본서버 (`https://hull-inc.jp/oitemiru/`)                          | `npm run build:oitemiru` | `dist-oitemiru/` | `/oitemiru/` | 전부 200 (preview localhost:4174/oitemiru/ 기준) |

- `vite.config.ts:5~10` (현재): base 미설정, CLI 플래그로만 받음.
- `package.json:7~12`: `build`, `build:oitemiru`, `preview`, `preview:oitemiru` 스크립트 쌍.
- 자원 참조:
  - `src/lib/hullWatermark.ts:1`: `HULL_WATERMARK_SRC = \`${import.meta.env.BASE_URL}assets/brand/hull-watermark.svg\`` — 두 base 모두 자동 대응.
  - `index.html`의 `href="/favicon.svg"`는 Vite가 base 접두어로 재작성(dist는 `/favicon.svg`, dist-oitemiru는 `/oitemiru/favicon.svg`).
  - `src/` 안에서 `"/..."` 스타일 절대 경로 문자열 자원 참조 grep: 0건.
- 새로고침 fallback: SPA 라우팅 없음(React Router 미사용, 단일 뷰). `docker/nginx.conf:9~11`과 Render 재작성(`docs/runbooks/render-static-site.md`) 모두 기존 설정 유지.
- 영향받는 요구사항: C18. 리스크: 중.

### B-0-7 에셋 import 방식

- `src/assets/portable/` 아래 벡터·사진은 ES module import(`import x from '...'`) → Vite가 해시된 번들 경로로 변환. 번들된 참조라 base 접두어 자동 적용.
- `public/favicon.svg`, `public/assets/brand/hull-watermark.svg`: public 자산. favicon은 HTML의 `href="/favicon.svg"`를 Vite가 재작성. 워터마크는 `import.meta.env.BASE_URL` 사용으로 처리.
- src 안의 절대경로 문자열(`"/..."`) grep 결과: 0건(위 참조). 리스크: 하.

---

## B-1 i18n

### B-1-1 구현 방식

- 자체 구현(라이브러리 미사용). `src/i18n/localeContext.ts` + `src/i18n/LocaleProvider.tsx`.
- 로케일 파일: `src/i18n/locales/{ja,ko,en}.ts`, 각각 `Messages`(`src/types/i18n.ts`) 타입 1개 객체.
- 감지: `src/i18n/detectLocale.ts` — localStorage(`signage-canvas.locale`) → `navigator.language` → fallback `'ja'`.
- fallback: 타입 수준에서 **모든 로케일이 같은 키**를 가져야 하므로 런타임 fallback 로직은 없음. 누락 시 TS 컴파일 실패.
- 사용: `useLocale()` 훅이 `{ messages, locale, setLocale }` 반환.

### B-1-2 ja/ko/en 키 동일성

- 테스트 `tests/unit/locales.test.ts`가 세 로케일의 키 집합 일치를 매 커밋 검증. **현재 모두 통과**(baseline `test:run` 참조).
- `src/types/i18n.ts`에 `Messages` 인터페이스가 존재해 TS 수준에서 보장. 누락 키 없음.

### B-1-3 하드코딩 사용자 문구

- `src/app/App.tsx:36`: `<span aria-hidden="true">📖</span>` — 데코 이모지(스크린 리더에서 숨김). i18n화 불필요.
- 그 외 .tsx의 JSX에서 발견되지 않음. 영향받는 요구사항: 4-3(용어 통일). 리스크: 하.

### B-1-4 기존 용어 위치 (요약)

전체를 전수 조사하지는 못했으므로 이후 S6에서 재검증 필요. 주요 결과:

| 용어                                    | 위치 요약                                                                                       | 상태                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------- |
| 空間 / 空間写真                         | 로케일에 다수(ja.ts 전역). 메시지 문자열 안에 섞여 있음                                         | 교체 대상(glossary.md)      |
| X座標 / Y座標                           | 로케일에 다수. `src/features/editor/Toolbar.tsx`의 위치 입력 라벨                               | 교체 대상                   |
| コンテンツ位置X / Y                     | ja.ts에 있음. 콘텐츠 상세 설정 라벨                                                             | 교체 대상                   |
| 外観                                    | ja.ts(`editorAppearanceSectionHeading` 계열)                                                    | 교체 대상                   |
| レンダリングプリセット                  | ja.ts `editorRenderingPresetLabel`, Toolbar                                                     | 교체 대상 (C10)             |
| LCD                                     | 로케일·material 라벨                                                                            | 「LCD（液晶）」로 보강      |
| 外部の                                  | ja.ts(2026-09-30 이전까지 `hullCtaExternalNotice`). **pre-v2 ea44469 커밋에서 해당 키 삭제됨.** | **해결됨**                  |
| キャンパス(오타)                        | 미확인. grep 추가 필요                                                                          | 재확인                      |
| モザイク                                | ja.ts(`editorMaskSection*`? 미확인). 로케일 grep 필요                                           | 교체 대상 (C8)              |
| 常時表示                                | ja.ts 온보딩 계열                                                                               | 교체 대상 (C2)              |
| 自動的にフィット                        | ja.ts 온보딩 계열                                                                               | 교체 대상 (C1)              |
| 10MB                                    | ja.ts 이미지 업로드 에러·안내                                                                   | 상수 참조로 교체 권장 (3-2) |
| 공간 / 공간 사진                        | ko.ts 동일 위치                                                                                 | 교체 대상                   |
| X좌표 / 외관 / 렌더링 프리셋 / 모자이크 | ko.ts                                                                                           | 교체 대상                   |
| 사이네지                                | ko.ts: `사이니지`로 통일 필요 (C5)                                                              | 교체 대상                   |
| 외부 HULL                               | ko.ts: **삭제됨(ea44469)**                                                                      | 해결됨                      |
| Space photo / Rendering preset / Mosaic | en.ts                                                                                           | 교체 대상                   |

**상세 전수 조사는 S6의 첫 작업으로 필요**합니다. 리스크: 중.

### B-1-5 테스트가 문구로 요소 찾는 곳

- **치명적 이슈**: `getByLabel('コンテンツを追加')`가 e2e 17줄에서 사용되지만, 실제 UI는 pre-v2 커밋 `8cdbd77`에서 `editorContentUploadButton = '画像 / 動画を追加'`(ja.ts:189)로 바뀜. 영향 스펙: `content-material.spec.ts`×4, `environment-sampling.spec.ts`, `glow-halo.spec.ts`, `mobile.spec.ts`×4, `onboarding.spec.ts`, `occlusion-mask.spec.ts`, `portable.spec.ts`×2, `screen-reflection.spec.ts`, `visual-qa.spec.ts`, `support/video.ts`. qa:visual은 7건 전부 실패.
- `tests/unit/App.test.tsx:248~250`: `ja.hullCtaTermsLinkLabel`로 버튼 조회(ea44469 반영됨).
- **방침**: v2에서는 신규 문구를 테스트가 role/label/data-testid로 조회하도록 작성. 기존 getByText는 각 스프린트가 라벨을 바꿀 때 함께 갱신.
- 영향받는 요구사항: C11. 리스크: **상** — baseline이 이 때문에 깨짐.

---

## B-2 업로드·오류·힌트

### B-2-1 업로드 제한값

**설치 장소 사진 (space photo)** — `src/lib/fileValidation.ts`

- MIME: `image/png`, `image/jpeg`, `image/webp`
- 최대 크기: 10 MB (`MAX_IMAGE_BYTES`)
- 최대 해상도: 6000px 긴 변, 24M 픽셀 (`MAX_IMAGE_LONG_EDGE`, `MAX_IMAGE_PIXELS`)

**콘텐츠 이미지** — 동일(위 상수 공유).

**콘텐츠 영상** — `src/lib/videoValidation.ts`

- MIME: `video/mp4`, `video/webm` (+ 디코더가 `canPlayType`으로 추가 거부)
- 최대 크기: 300 MB (`MAX_VIDEO_BYTES`) — pre-v2 ea44469 전부터 300MB
- 최대 해상도: 긴 변 3840 / 짧은 변 2160 (`MAX_VIDEO_LONG_EDGE/SHORT_EDGE`, 방향 대칭 — pre-v2 ea44469)
- 최대 길이: 30초 (`MAX_VIDEO_DURATION_SECONDS`)
- 재생 속성: autoplay/loop/muted는 사용자가 콘텐츠 상세 설정에서 전환. 내보내기엔 영향 없음(런타임 상태).

### B-2-2 중복 여부

- 상수는 각각 단일 모듈에 모여 있음. 중복 없음.
- **i18n 에러 문구는 상수값을 하드코딩**(ja.ts의 「10MB」, 「3840」 등). 상수 변경 시 i18n도 손수 바꿔야 함(C-5 S7 리스크 참조).

### B-2-3 오류 상태 저장

- `src/features/editor/EditorLayout.tsx:46~49`: `const [announcement, setAnnouncementText] = useState('')` + `setAnnouncement(text, isError = false)` 콜백.
- 단일 문자열 + 에러 플래그. 원인별 저장 아님. 오류를 지우는 전용 경로 없음 — **다음 announcement가 덮어쓸 때만** 사라짐.

### B-2-4 5-1 원인

- `EditorLayout.handleImageError/handleContentError`(L94~128)가 실패 시 `setAnnouncement(..., true)` 호출.
- 성공 경로(`setSpaceBackground`, `addDisplayContent` 등)는 announcement를 지우지 않음.
- 결과: 용량 초과로 실패 → 정상 파일 업로드 성공 → **이전 에러 announcement가 그대로 남음**.
- 해결 방향: 성공 경로에서 `setAnnouncement('')` 명시적 리셋 또는 "오류 원인별 상태"로 재설계. 영향 요구사항: 5-1. 리스크: 중.

### B-2-5 C7 원인(힌트바 1줄 연결)

- 미확인(현재 EditorLayout 전체를 다시 읽어 확정 필요). Explore 보고에 따르면 `statusHint` span과 `announcement` span이 같은 flex 컨테이너 안 형제 요소이고 구분자 없이 인접 → 1줄로 이어 보임. S2에서 재검증 필요.

---

## B-3 패널·모달·레이아웃

### B-3-1 오른쪽 패널 섹션

- `src/features/editor/Toolbar.tsx:107~1000+` (라인 상당수). 섹션 구성(모두 조건부 표시):
  1. 설치 장소 사진 섹션(업로드/교체/삭제, 캔버스 프리셋, 세로 팬 슬라이더)
  2. 사이니지 추가 섹션(LED/LCD/투명 LED/포터블 추가. 공간 사진 있을 때만)
  3. 선택된 사이니지 섹션(이름·설치 모드·포터블 제품 사진 등. 선택 시만)
  4. 콘텐츠 섹션(콘텐츠 업로드 라벨 `aria-label={messages.editorContentUploadButton}`, L988. 콘텐츠 상세: fit/offset/scale/rotation. 디스플레이/포터블 선택 시)
  5. 외관 섹션(material/curvature/contact shadow/environment integration 슬라이더 + `RealismGuideCard`. 디스플레이/포터블 선택 시)
  6. 내보내기 섹션(캔버스 프리셋, PNG 버튼, 동영상 버튼, 워터마크 토글)
- 상세는 S3에서 코드 라인 재확인 후 구조도 작성.

### B-3-2 모달·팝업 목록

| 컴포넌트                | 트리거                      | useModalDialog      | 비고                            |
| ----------------------- | --------------------------- | ------------------- | ------------------------------- |
| `AdvancedSettingsModal` | 외관 섹션의 「詳細設定」    | 사용                | 포커스 트랩/Esc                 |
| `OnboardingOverlay`     | 최초 방문                   | 미사용(비모달 카드) | localStorage dismiss            |
| `RealismGuideCard`      | 외관 섹션 안                | 미사용(인라인 카드) | localStorage dismiss            |
| `UserGuideModal`        | App footer 📖 버튼          | 사용                | 포커스 트랩/Esc, 매뉴얼 본문    |
| `TermsOfServiceModal`   | HullCta의 「利用規約」 버튼 | 사용                | 포커스 트랩/Esc, pre-v2 ea44469 |
| 콘텐츠 상세 설정        | 오른쪽 패널 안              | —                   | 모달 아님(인라인)               |

- 영향받는 요구사항: 2-3(중앙 모달 통합), C23(접근성). 리스크: 중.

### B-3-3 위치/크기/회전 입력

- `src/features/editor/Toolbar.tsx` 「選択中のサイネージ」 섹션 내부(라인 번호 재확인 필요). 현재 X/Y/W/H/회전 입력이 **패널 안에 있지만** 접이식(2-3-1 요구) 구조는 아직 아님.
- 캔버스 조작과 동기화: `updateObjectTransient`(라이브 드래그) → `commitObjectChange`(드래그 종료, 히스토리 1칸). 입력값도 같은 액션 사용.
- 영향받는 요구사항: 3-1. 리스크: 중.

### B-3-4 캔버스 표시 크기 계산 / 9:16 하단 잘림

- `EditorCanvas.tsx` 상단: ResizeObserver로 wrapper 폭 측정 → `fitScale = containerWidth / documentSize.width` → `stageHeight = documentSize.height × fitScale`.
- 가용 영역이 폭 기준으로만 fit → 9:16 포트레이트에서 세로가 뷰포트보다 커지면 **아래가 잘림**. 확대/축소 UI 없음.
- 영향받는 요구사항: 2-1. 리스크: 상.

### B-3-5 헤더 버튼·결과/오리지널 UI

- 재읽기 필요. 현재 `EditorLayout.tsx`의 상단 영역에 Undo/Redo/비교 토글/언어 선택/PNG/동영상 버튼이 모두 모여 있을 것으로 추정. 「結果/オリジナル」 전환은 `uiStore.comparisonMode` + `comparison-toggle-group` aria-label 사용(`Toolbar.tsx:1805`).
- S3에서 라인 번호 포함 재확인.

### B-3-6 2-6의 「説明書/マニュアル」 — **중요 발견**

- **PDF는 오른쪽 패널 하단 ▼** 부근을 가리키지만, 실제 매뉴얼 진입점은 **앱 하단 footer**(App.tsx:29~40)의 📖 버튼입니다. 바로 옆에 데코용 `← マニュアルはこちら` 힌트 span(`messages.userGuideHereHint`, ja.ts:392 「← マニュアルはこちら」) 노출.
- 열면 `UserGuideModal`(use `useModalDialog`) → 사용법 + 개인정보 안내 + 매뉴얼 섹션 다수.
- 사용자 의도: "매뉴얼이 패널 하단에 묻혀 있다"면 이 **footer 버튼의 위치/시각적 비중**을 올리는 작업으로 해석해야 함. 또는 오른쪽 패널에도 입구를 하나 추가하는 안.
- 영향받는 요구사항: 2-6. 리스크: 중. **사용자 재확인 필요**.

### B-3-7 모바일 분기

- 미확인(현재까지 재검증 안 됨). `global.css`에 `@media (max-width: 48rem)` 분기 다수(hull-cta 등). `e2e/mobile.spec.ts`는 390×844에서 통과.
- 영향 요구사항: C20. 리스크: 중.

---

## B-4 원근/크기/콘텐츠

### B-4-1 기하 데이터

- 공통 필드(`BaseSignageObject`): `id, x, y, width, height, rotation`. 캔버스 절대 좌표(px).
- `perspectiveQuad: NormalizedQuad | null` — 네 꼭짓점을 0–1 fraction(`NormalizedPoint`)으로 저장. 캔버스 리사이즈/프리셋 전환에도 fraction은 그대로.
- `OcclusionMask.points: NormalizedPoint[]` — 3~~24개(`MIN/MAX_OCCLUSION_POINTS`, L328~~329). 다각형. `kind: 'polygon'`.
- 포터블 `screenQuad: NormalizedQuad | null` — 객체 바운딩 박스 내 0–1 fraction. **포터블 전용**.
- 좌표계 변환: `src/lib/quadGeometry.ts`의 `normalizedQuadToDocument()` 등.

### B-4-2 크기 ↔ 원근 corner 상호 갱신

- 크기 변경 시 `perspectiveQuad`를 재계산하지 **않음**. `commitObjectChange`는 patch만 적용.
- 원근 corner 변경 시 width/height를 변경하지 **않음**(ADR 0008 노선).
- **문제점**: ①크기 → ②원근 → ③콘텐츠 흐름에서 크기 변경이 원근 corner와 분리되어 있어, perspective가 이미 활성인 상태로 크기 조정하면 corner는 fraction으로 유지되지만 화면 비율 체감이 바뀜. (5-2 후보)

### B-4-3 콘텐츠 레이아웃 기준

- `src/lib/contentLayout.ts`의 `computeContentLayout()`가 콘텐츠 scale·offset·fit을 **스크린 사각형**(axis-aligned) 기준으로 계산.
- perspective가 활성인 경우에도 스크린은 여전히 axis-aligned bounding box로 계산되고, `PerspectiveScreenView`가 "완성된 사각형 렌더 결과"를 메시 워프.
- 콘텐츠 offset/scale은 스크린 사각형의 fraction. 원근 corner 변경 시 콘텐츠 계산엔 피드백이 가지 않음.

### B-4-4 5-2 원인 (S1 재작업에서 확정)

**S1 1차 결론(`c31a36b`에서 "세 후보 모두 기각 — 코드 변경 불필요"로 적힌 결론)은 철회**한다. 1차 결론이 틀렸던 이유:

- 1차는 "최종 상태가 같으면 결과가 같다" (불변식 A)만 증명했고, "최종 상태 자체가 같을 수 없는 경로"를 간과했다.
- PDF가 실제로 지적한 경로 「①追加 → ②パース → ③コンテンツ」는 사용자가 크기 조정을 **하지 않은 상태**로 끝난다. 이 경로의 최종 상태(width=480, height=270, perspectiveQuad=Q)에서 1차에서 가정한 불변식 B는 "quad가 어떻든 콘텐츠는 480×270 비율로 라운드트립"으로 해석되었고, PDF가 호소한 증상(콘텐츠가 늘어남)을 "수학적으로 올바른 결과"로 정의해 버렸다.

**확정 원인 (파일:라인)**: `src/features/editor/SignageDisplayView.tsx:74-76`(이전 상태)에서 screen 계산이 `object.width/height`를 입력으로 사용. perspective 모드에서도 동일 입력 사용. 사용자가 리사이즈 없이 바로 パース를 적용하면 사이니지 default(480×270, 종횡비 1.78) 기준 콘텐츠 레이아웃이 결정되고, 겉보기 종횡비가 다른 quad(예: 2.73)로 워프 → letterbox가 사다리꼴로 변형되어 보이는 "비율이 틀어지는" 증상이 발생. PerspectiveScreenView의 width/height prop(이전 `object.width/height`)도 같은 뿌리.

**불변식 B'로 교체 (ADR 0012 D-13)**: perspective 모드에서는 콘텐츠 레이아웃의 논리 화면 종횡비를 **현재 quad의 겉보기 종횡비에서 추정**한다.

- 추정식: quad 4점을 내보내기 해상도 기준 px 좌표로 변환한 뒤
  - `apparent_width = (|top edge| + |bottom edge|) / 2`
  - `apparent_height = (|left edge| + |right edge|) / 2`
  - `aspect = apparent_width / apparent_height`
- 라스터 width는 `object.width` 유지, height는 `object.width / aspect`로 산출.
- 베젤 inset은 fraction 규칙(`DISPLAY_FRAME_TEMPLATES[frameId].screenRegion`은 0.02/0.02/0.96/0.96 분수)이므로 effective 사이즈에 자연 적용. **고정 px 규칙이 없음을 확인**(src/types/editor.ts:181).
- quad가 유효하지 않은 경우(비볼록, self-intersecting, 비유한)에는 fallback으로 `object.width/height` 유지. 불변식 A도 유지(함수가 순수, 저장 상태 추가 없음).

**추가 UI 규칙 (ADR 0012 D-14)**: perspective 모드에서 幅/高さ 입력과 Transformer 리사이즈 핸들을 비활성화. 사용자는 네 모서리 핸들로만 크기와 모양을 조정. 접근성: `disabled` 속성 + `aria-describedby="perspective-size-locked-hint"` + i18n 키 `perspectiveSizeLockedHint` 안내.

구현 위치:

- `src/lib/perspectiveLogicalSize.ts`(신규): `perspectiveLogicalAspect(quad, documentSize)`, `getPerspectiveLogicalSize(w, h, quad, docSize)` 두 순수 함수.
- `src/features/editor/SignageDisplayView.tsx`: perspective 모드일 때 `effectiveSize` 계산 후 `screen`, `getFrameDecorations`, `curvedBodyOutline`, `PerspectiveScreenView width/height prop` 모두 effectiveSize 사용.
- `src/features/editor/Toolbar.tsx`: SelectedSignageFields의 幅/高さ 입력에 `disabled={perspectiveLocked}` + 안내 span.
- Transformer: perspective 모드에서는 어차피 node ref가 등록되지 않아 attach되지 않음(기존 상태).

- 영향 요구사항: 5-2 (해소), S3 3-1·S4 1-2 (perspective 모드에서 크기 입력 비활성 유지 필요 — sprint-plan 반영), S6 (`perspectiveSizeLockedHint` 로케일 검수).
- 리스크: ~~상~~ → **중 (후속 스프린트에서 perspective-모드 UI 재설계 시 ADR 0012 D-14 깨뜨리면 안 됨)**.

### B-4-5 포터블 영향

- 포터블은 `screenQuad`(바운딩 내 fraction)로 **별도 영역 지정**. 원근 수정이 포터블에 영향을 주려면 screenQuad 쪽도 같이 재검토 필요.
- 단, `screenQuad`는 PORTABLE_PRESET에서 "제품 사진 좌표" 기준으로 미리 측정된 값(ADR 0004 참조). 일반 UI에서 편집 X.
- 영향 요구사항: 5-2, C16. 리스크: 중.

---

## B-5 편집 기능

### B-5-1 Undo/Redo

- `src/store/editorStore.ts:667~714`. `past[]`/`future[]` 스택, `HISTORY_LIMIT = 50`.
- 기록 대상: `commitObjectChange`, `applyPerspectiveEdit`, `applyOcclusionEdit`, `applyScreenQuadEdit`, `setCanvasPreset`, `addDisplay/Portable/Text`, `deleteSelected`, `setSpaceBackground`, `applyRenderingPreset`, `sampleEnvironmentColor`.
- 제외: `updateObjectTransient`(라이브 드래그), 각종 draft 업데이트, `setSpaceBackgroundOffsetY`(뷰포트성).
- 영향 요구사항: C14, 1-1. 리스크: 중.

### B-5-2 키보드 단축키

- `src/features/editor/EditorLayout.tsx:58~89`(approx) window keydown.
- Delete/Backspace → `deleteSelected`, Ctrl+Z → undo, Ctrl+Shift+Z / Ctrl+Y → redo.
- `isEditableTarget()` 체크로 input/textarea/select/contentEditable에선 무시(C21 충족).
- 복사/붙여넣기 단축키(Ctrl+C/V) **미구현** — 1-1 신규.

### B-5-3 asset / video 생명주기

- `src/lib/assetRegistry.ts`: Blob URL 디코드 → `sourceId` → 레지스트리.
- `sweepUnusedAssets()` 호출 시점: 히스토리 변경(editorStore 내부)에서 사용. 더 이상 참조되지 않으면 revoke.
- 복사 시: 같은 `sourceId`를 공유(참조). 삭제해도 마지막 참조가 사라지고 past 스냅샷에서도 빠질 때 revoke.
- **C13**: 복사 시 비디오 element는 공유 레지스트리 asset을 사용. 안전하지만 1-1 복사 구현 시 reference count 거동을 재검증.

### B-5-4 설치 장소 사진 배치

- `src/features/editor/SpaceBackgroundView.tsx` + `src/lib/spaceBackgroundFit.ts`.
- 현재 **Cover 전용** + 세로 팬(offsetY). Fit 토글 **없음**.
- 좌표계: 사이니지는 캔버스 absolute(0~documentSize). 사진은 Cover-fit으로 그 좌표계 안에 그려짐 → 사이니지 좌표는 사진 좌표와 **독립**.
- 프리셋 전환 시: `setCanvasPreset`이 각 객체 geometry를 비례 재매핑(`geometryNormalization.normalizeObjectGeometry`). perspective quad는 fraction이라 그대로.
- **C22**: Fit↔Cover 전환 시 사이니지 좌표는 바뀌지 않지만, 사진 실영역이 달라지므로 "같은 사이니지가 사진의 다른 지점 위에 떨어진 것처럼" 보일 수 있음. 어떤 기준으로 정렬 유지할지 명시 필요.

### B-5-5 포터블 비율 유지

- `EditorCanvas.tsx` 내 Transformer가 포터블 선택 시 `keepRatio = true` 하드코딩(라인 재확인 필요).
- 사용자 토글 없음. C19는 **기본 ON 유지**가 목표라 큰 변경 불필요.

---

## B-6 외관·슬라이더·마스크

### B-6-1 슬라이더 목록 (요약)

- Material: intensity, brightness, transparency, gridDensity, glow, contrast (대부분 0~100, %)
- Curvature: amount(0~100)
- ContactShadow: strength, blur, offsetX/Y, spread, depth, tint (각기 다른 범위)
- EnvironmentIntegration: strength 등
- Occlusion: feather, opacity (0~100)

전수 라벨/범위/현재값 표시 여부는 S5에서 Toolbar 코드로 재집계. 많은 경우 숫자 입력 필드가 동반되어 현재값은 보임. 영향 요구사항: 3-3. 리스크: 중.

### B-6-2 コンテンツ拡大率

- 내부 범위: 1~3 (`MIN_CONTENT_SCALE` / `MAX_CONTENT_SCALE`).
- 표시: 숫자 입력(단위 없음). "1.5"로 입력.
- 요구사항 3-4: 50/100/150% 표시로 변경.

### B-6-3 렌더링 프리셋

- `src/lib/renderingPresets.ts`: 「ナチュラル」「明るい屋外」「夜間」 3개 프리셋이 material·contactShadow·environmentIntegration 수치를 일괄 변경.
- 이름 「明るい屋外」와 슬라이더 「明るさ」가 겹칠 소지. C10에서 `明るさ・時間帯`로 그룹명 변경 예정.
- 영향 요구사항: C10, 4-1. 리스크: 중.

### B-6-4 모자이크(Occlusion) 흐름

- 데이터: `OcclusionMask { id, kind:'polygon', points[3~24], feather, opacity, enabled }`.
- 흐름: `beginOcclusionEdit` → `OcclusionEditOverlay`에서 점 추가(`updateOcclusionDraftPoints`) → feather/opacity 조절 → `applyOcclusionEdit`(히스토리 1칸, L903) → `object.occlusionMasks[]`에 추가.
- 내보내기 반영: `OcclusionMaskLayer`가 export stage에도 렌더 → PNG/동영상에 반영.
- **4점 요구가 아니라 3~24점 폴리곤**이라는 사실을 요구사항 수용 기준에 반영해야 함. UI에서 "4점"으로 안내하면 요구가 어긋남. S5에서 안내 문구 통일.

### B-6-5 screenQuad ↔ 모자이크 공유 여부

- **타입**: `OcclusionMask`(polygon, 3~24점) vs 포터블 `screenQuad`(`NormalizedQuad` 4점) — **서로 다른 타입**.
- **상태**: editorStore에서 draft 상태가 각각 분리 (`occlusionDraftPoints[]` vs `screenQuadDraftQuad`).
- **컴포넌트**: `OcclusionEditOverlay`, `OcclusionMaskLayer` vs `ScreenQuadEditOverlay`, `WarpedScreenContent` — 분리.
- **공유 유틸**: `src/lib/quadGeometry.ts`의 `clampPoint01()`, `normalizedQuadToDocument()`가 양쪽에서 쓰임(순수 기하 함수).
- **결론**: 데이터·오버레이·렌더러 모두 분리. CLAUDE.md에 명시한 "절대 공유 금지" 규칙이 이미 코드에 반영됨. 리스크: 하.

### B-6-6 debug overlay 노출

- `ScreenQuadEditOverlay`: 포터블 선택 + 제품 사진 있을 때 「Edit screen area」 버튼으로 열림. **일반 UI에 노출됨**.
- `PortableQuadDebugOverlay`: `SHOW_QUAD_DEBUG` 플래그(환경변수 `VITE_DEBUG_PORTABLE_QUAD=true` 또는 URL `?debugPortableQuad=1`)에서만 렌더. 일반 사용자에게 **노출 안 됨**(C16 충족).

---

## B-7 테스트 체계

### B-7-1 유닛 테스트

- 위치: `tests/unit/*.test.{ts,tsx}` (vite.config.ts include).
- 파일 수: **35개**(App, assetRegistry, canvasHitArea, contentLayout, contentLuminance, contentUpload, curvature, detectLocale, displayFrame, EditorErrorBoundary, editorStore, environmentIntegration, exportFilename, fileValidation, geometryNormalization, hullWatermark, imageSafety, locales, materialTexture, occlusion, OnboardingOverlay, onboardingStep, PerspectiveEditOverlay, portableTemplate, quadGeometry, RealismGuideCard, renderingPresets, SalesReviewMode, screenHitTest, **spaceBackgroundFit**(신규), videoExport, videoExportCapability, videoLuminance, videoPlaybackRedraw, videoValidation).
- 셋업: `src/test/setup.ts` — React Testing Library cleanup, localStorage clear.
- 픽스처: 각 테스트 안에서 직접 선언(별도 fixture 디렉터리 없음).

### B-7-2 e2e

- 18개 스펙(canvas-drag-drop, capture-portable-views, comparison-toggle, content-material, editor, environment-sampling, glow-halo, image-upload, mobile, occlusion-mask, onboarding, perspective-video, portable, reselection, sales-review, screen-reflection, smoke, visual-qa).
- 설정(`playwright.config.ts`): baseURL `http://127.0.0.1:${E2E_PORT ?? 4173}`, webServer가 `vite preview --strictPort`, chromium 단일 프로젝트, storageState에 `signage-canvas.onboarding-dismissed=1` 심어 놓음(onboarding spec 제외).

### B-7-3 visual-qa 스냅샷

- 위치: `e2e/__screenshots__/` (Playwright 기본). 현재 레포에 파일 존재 여부 재확인 필요.
- 스냅샷 파일명 규칙: `{spec}.{testName}-{browser}-{platform}.png` (Playwright 기본). `.gitignore`에 `*-win32.png`, `*-darwin.png`가 Linux 표준이 아닌 OS 캡처를 금지(docker/CI와 일치하는 Linux 스냅샷만 커밋).

### B-7-4 GitHub Actions

- `.github/workflows/*.yml` 확인 필요. 재조사 S7.

### B-7-5 신규 유닛 테스트 위치

- **반드시 `tests/unit/*.test.{ts,tsx}`**. 다른 위치는 vitest가 pick-up 하지 않음.

---

## B-8 문서·운영 문구 충돌

### B-8-1 문서 파일별 사실과 다른 서술

| 파일                                        | 문제 서술                                                                                                                                            | 비고                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `CLAUDE.md` 전체                            | "Independent personal project"(§1), "No watermark for MVP"(§1), "Video insertion/Video export"가 "out of scope"(§3), Sprint 1 범위 서술, 비공식 기준 | **전면 개정 대상(C-2)**                                         |
| `README.md` 상단                            | "Independent personal project. Not an official HULL service."                                                                                        | 공식 서비스로 교체                                              |
| `docs/architecture/overview.md`             | 모른 상태라 재확인 필요                                                                                                                              | S0 Step C-7                                                     |
| `docs/adr/0001~0010`                        | Sprint 번호 기준 서술, 당시 계획값                                                                                                                   | 유효함(ADR은 결정의 역사. 삭제·수정 금지. v2 결정은 신규 ADR로) |
| `docs/quality/*`, `docs/quality-runbook.md` | 미확인                                                                                                                                               | S0 Step C-7                                                     |
| `docs/deployment-readiness-checklist.md`    | 미확인                                                                                                                                               | S0 Step C-7                                                     |
| `docs/runbooks/render-static-site.md`       | **pre-v2 P-8에서 이미 갱신**(두 빌드 명령, 본서버 업로드 절차)                                                                                       | 완료                                                            |
| `docs/runbooks/local-development.md`        | 미확인                                                                                                                                               | S0 Step C-7                                                     |

### B-8-2 앱 안 "개인 프로젝트" 문구

- `src/app/App.tsx:26~28` 주석에 "The independent-service disclaimer (CLAUDE.md §1) now lives inside the user guide modal" — **UserGuideModal 안의 설명문이 아직 "비공식"으로 쓰여 있을 가능성**.
- `src/components/UserGuideModal.tsx` 내용을 S6에서 재읽기 후 ja/ko/en 모두 교체.
- `src/i18n/locales/{ja,ko,en}.ts` 안 UserGuide 섹션 전수 조사 필요.
- 영향 요구사항: C15. 리스크: 중.

### B-8-3 이용약관 페이지

- **있음**. `TermsOfServiceModal`(pre-v2 ea44469). HullCta의 「利用規約」 버튼으로 열림.
- 제정일/개정일: ja.ts의 `termsOfServiceEffectiveDate`는 「制定日：2026年月日」로 **월/일이 공란**. 사용자가 시행 시점에 업데이트 필요.
- 운영 주체 명시: 제2조 「本サービスは、当社（HULL株式会社）が開発・運営し、当社公式ウェブサイト上にて提供する公式サービスです。」 — **공식 서비스 선언 이미 있음**.
- 영향 요구사항: C15. 리스크: 하(이용규약 자체는 충분).

---

## B-9 요구사항별 현재 상태

(상세 수용 기준은 `docs/v2/requirements.md`의 "현재 상태" 열 참조)

| ID  | 상태                            | 근거 요약                                                                                                                                                                   |
| --- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-1 | 없음                            | Ctrl+C/V·화면 복사 버튼 미구현. 키보드 핸들러에 Delete/Undo/Redo만 존재.                                                                                                    |
| 1-2 | 없음                            | 비율 고정 버튼·상태 없음. Transformer `keepRatio`는 포터블에만 하드코딩.                                                                                                    |
| 1-3 | **부분 구현** (Cover + 세로 팬) | `SpaceBackground.offsetY` 있음. **Fit 토글 없음.** 「写真の一部が切れる」 안내 없음.                                                                                        |
| 2-1 | 없음                            | fitScale은 폭 기준뿐. 9:16 세로 커트 발생. 확대/축소 UI 없음.                                                                                                               |
| 2-2 | 없음                            | 아코디언 구조 아님. 섹션은 항상 펼친 상태.                                                                                                                                  |
| 2-3 | 부분 구현                       | 콘텐츠 상세는 이미 인라인(모달 아님). AdvancedSettingsModal은 "外観 詳細"에 여전히 중앙 모달.                                                                               |
| 2-4 | 없음                            | 「結果/オリジナル」 아래 큰 PNG/동영상 버튼 레이아웃 아님. 현재 Toolbar 하단에 배치.                                                                                        |
| 2-5 | 부분 구현                       | 에러 announcement aria-live polite는 있음. 글자 크기·대비·위치 개선 여지. 캔버스 가리는 문제 재확인 필요.                                                                   |
| 2-6 | **잘못 가정**                   | 매뉴얼 입구는 **앱 footer 📖**. PDF가 지시한 "오른쪽 패널 하단"에는 매뉴얼 입구가 없음. 재해석 필요(B-3-6 참조).                                                            |
| 3-1 | 없음                            | 「位置・サイズの詳細設정」 접이식 세션 없음. 입력은 패널에 있지만 접기 UI 아님.                                                                                             |
| 3-2 | 부분 구현                       | 제한값은 정의되어 있고 에러 문구에 수치 포함(300MB/4K/30초). 업로드 **버튼 근처**에 제한값 사전 표시는 미구현. 로케일 하드코딩 숫자 → 상수 참조 리팩터 권장.                |
| 3-3 | 부분 구현                       | 거의 모든 슬라이더에 숫자 입력 동반(현재값 보임). 일부는 "60%" 형식의 **단위 표기 미비**.                                                                                   |
| 3-4 | 없음                            | 현재 1~3 숫자 입력. % 표기 아님.                                                                                                                                            |
| 3-5 | 없음                            | 흐름 단축(추가 → 4점 → 바로 그 자리에서 適用) 아님. 현재는 begin → 점 입력 → 패널로 돌아가 feather/opacity → apply. "4점"이 아니라 3~24점 폴리곤이라는 점도 UI 안내가 필요. |
| 4-1 | 없음                            | 용어 교체 없음. ja/ko/en 모두 옛 용어 사용.                                                                                                                                 |
| 4-2 | 없음                            | 外観 섹션 설명문 미교체.                                                                                                                                                    |
| 4-3 | 없음                            | 메뉴·버튼·도움말·온보딩에 신규 용어 미반영.                                                                                                                                 |
| 5-1 | 없음                            | 성공 경로가 announcement를 리셋하지 않음.                                                                                                                                   |
| 5-2 | 없음                            | 콘텐츠 레이아웃이 원근 corner에 피드백 받지 않음. 일관성 보장 없음.                                                                                                         |
| C1  | 없음                            | 온보딩 「写真はキャンバスのサイズに合わせて自動的にフィット」 문구가 ja.ts 어딘가(요재확인).                                                                                |
| C2  | 없음                            | 「ツールバー…常時表示」 문구 재확인 필요.                                                                                                                                   |
| C3  | 없음                            | ko/en 반영 미작업.                                                                                                                                                          |
| C4  | **미확인**                      | 「キャンパス」 오타 grep 추가 필요. 발견 시 교체.                                                                                                                           |
| C5  | 부분                            | ko 「사이네지」→「사이니지」 미작업. ko 「외부 HULL」은 pre-v2에서 삭제.                                                                                                    |
| C6  | 없음                            | `RealismGuideCard` 내부 용어 미교체.                                                                                                                                        |
| C7  | 부분                            | 안내+오류 분리 미구현. B-2-5 추가 조사 필요.                                                                                                                                |
| C8  | 없음                            | 모자이크 명칭 변경 미작업.                                                                                                                                                  |
| C9  | 없음                            | 「コンテンツの横/縦位置」 미반영.                                                                                                                                           |
| C10 | 없음                            | 「レンダリングプリセット」 → 「明るさ・時間帯」 미반영.                                                                                                                     |
| C11 | 진행중                          | baseline에 e2e 라벨 불일치 다수. 각 스프린트에서 함께 갱신 필요.                                                                                                            |
| C12 | **확인됨**                      | 출력 해상도는 캔버스 프리셋 고정. 표시 scale은 pixelRatio 보정으로 분리(B-0-5).                                                                                             |
| C13 | 미확인                          | 1-1 복사 미구현이라 테스트 불가. 구현 시 asset reference count 검증.                                                                                                        |
| C14 | 미구현                          | 새 상태(비율 고정, Fit/Cover, 마스크, 붙여넣기) 아직 없음. 구현 시 undo 포함.                                                                                               |
| C15 | 부분                            | 이용약관 모달 신설(pre-v2). "비공식" 문구는 UserGuideModal 등에 잔존 가능(B-8-2).                                                                                           |
| C16 | **확인됨**                      | PortableQuadDebugOverlay는 플래그 뒤에만 노출.                                                                                                                              |
| C17 | **확인됨**                      | HullWatermarkView가 미리보기·PNG·동영상에 공통.                                                                                                                             |
| C18 | **확인됨**                      | pre-v2 P-8에서 두 base 빌드로 분리.                                                                                                                                         |
| C19 | 확인됨(현상)                    | 포터블 keepRatio는 Transformer에 하드코딩. 토글 없음(C19가 요구하는 "기본 ON"은 이미 만족).                                                                                 |
| C20 | 부분                            | `@media (max-width: 48rem)` 분기 다수. 아코디언/인라인 상세는 아직 없어 2-2/3-1 구현 시 모바일 영향 재검토 필요.                                                            |
| C21 | **확인됨**                      | `isEditableTarget()` 체크 있음.                                                                                                                                             |
| C22 | 미구현                          | Fit/Cover 전환 자체가 미구현. 전환 기준도 미정의.                                                                                                                           |
| C23 | 부분                            | useModalDialog가 공통. 중앙 모달 제거 시(2-3) 포커스 이동 재점검 필요.                                                                                                      |

---

## pre-v2가 반영된 추가 관찰 (sprint-plan.md로 전개)

| 관찰                                                | 영향 스프린트 | 내용                                                                                           |
| --------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| 설치 장소 사진 Cover 기본 + 휠 offsetY 팬           | S4 (1-3/C22)  | Fit 기본값으로 바꿀 때 offsetY 의미·리셋 규칙·기존 사이니지 좌표 기준·Undo 포함 여부 명시 필요 |
| 캔버스 휠 이벤트가 배경 팬에 쓰임                   | S3 (2-1)      | 캔버스 확대/축소 도입 시 Ctrl+휠 조합 등 구분 제스처 필요                                      |
| 영상 제한이 `MAX_VIDEO_LONG_EDGE/SHORT_EDGE`로 바뀜 | S2 (3-2)      | 안내 문구는 로케일에서 상수를 템플릿 치환해 표시(현재 하드코딩)                                |
| `og:image`가 SVG                                    | S7 제안       | 일부 SNS가 SVG OG 이미지를 표시하지 않음. 1200×630 PNG 교체 제안                               |
| e2e 17줄이 옛 라벨 참조                             | S2(함께)      | `editorContentUploadButton` 또는 `data-testid`로 전환                                          |

---

## 미확인·추가 조사가 필요한 항목

1. B-1-4 전수 용어 조사 (ja/ko/en 전수 grep)
2. B-2-5 EditorLayout의 statusHint vs announcement 레이아웃 상세
3. B-3-5 헤더 버튼 정확한 위치·컴포넌트 파일/라인
4. B-3-7 모바일 분기 전체 파악
5. B-5-5 Transformer `keepRatio` 하드코딩 라인
6. B-7-3 visual-qa 스냅샷 실제 존재 여부·개수
7. B-7-4 GitHub Actions 워크플로 전체
8. B-8-1 아키텍처/품질/배포 문서 전수 조사
9. B-8-2 UserGuideModal 안 "비공식" 문구 유무
10. C4 「キャンパス」 오타 grep

각 스프린트가 범위에 들어올 때 이 리스트의 해당 항목을 먼저 재조사한 뒤 구현하도록 `sprint-plan.md`에 반영합니다.
