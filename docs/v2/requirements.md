# v2 요구사항 체크리스트

PDF 「置いて見る君の修正案v2」(2026-09) 19개 + 연쇄 영향 C1~C23. 각 항목에 **담당 스프린트 / 수용 기준 / 현재 상태**를 명시합니다. 현재 상태의 근거는 `docs/v2/audit.md`.

## PDF 요구사항 (19개)

### 1-1 사이니지 복사·붙여넣기

- **담당 스프린트**: S4
- **수용 기준**:
  - Ctrl/Cmd+C·V와 화면 "복사"/"붙여넣기" 버튼 둘 다 동작
  - 복사 범위: 종류, 크기, 회전, 원근 corner, 이미지/영상/텍스트 콘텐츠, 콘텐츠 표시 설정, 외관, 그림자, 환경 통합, 모자이크(마스크) 전부
  - 붙여넣은 객체는 원본에서 약간 오프셋(겹치지 않게)
  - 붙여넣은 객체가 자동으로 선택됨
  - 복사본은 완전 독립(원본 수정이 복사본에 영향 없음)
  - Undo/Redo 대상(복사·붙여넣기 각각 1 히스토리)
  - 텍스트 입력 포커스에선 일반 Ctrl+C/V 우선(C21)
- **현재 상태**: **완료 (v2-S4-b)** — `editorStore.ts`에 `clipboard` 상태 + `copySelected`/`pasteFromClipboard`/`duplicateSelected` 액션. 깊은 복제(`cloneSignageObject`): 콘텐츠 `sourceId`만 공유, 나머지는 전부 사본. 오프셋 `(+20n, +20n)` doc px — n은 같은 clipboard 엔트리의 누적 paste 수. 문서 경계로 클램프, perspective quad 코너도 같은 normalized shift로 평행 이동 후 `clampPoint01`. 붙여넣기마다 1 history 엔트리, Undo/Redo로 복원. `EditorLayout.tsx`가 `window.addEventListener('keydown')` 핸들러에서 `isEditableTarget`(input/textarea/select/contenteditable) 가드 뒤에 Ctrl+C/V 디스패치 — C21 충족. Toolbar의 「複製」 버튼(`editor-duplicate-object`, 4 종 전부)이 복사+붙여넣기 1회를 묶음 실행. i18n 키: `editorDuplicateObjectButton`(ja: 「複製」/ko: 「복제」/en: Duplicate). 테스트: `tests/unit/editorStoreS4b.test.ts` 9건 + `e2e/v2-s4b.spec.ts` 7건.

### 1-2 가로세로 비율 고정

- **담당 스프린트**: S4
- **수용 기준**:
  - 폭·높이 입력 옆에 "비율 고정(🔗)" 토글 버튼 (Illustrator 느낌)
  - ON 상태에서 한쪽 변경 → 다른 쪽 자동 비례
  - 토글 상태는 선택된 사이니지별로 기억
  - Undo 대상
- **현재 상태**: **완료 (v2-S4-b)** — `BaseSignageObject.aspectLocked?: boolean`(기본 undefined/false). `PositionSizeSubsection`의 폭/높이 입력 아래 🔗 토글(`toolbar-aspect-lock-toggle`, 가시 텍스트 라벨 「縦横比を固定」/「가로세로 비율 고정」/「Lock aspect ratio」). ON일 때 폭 입력 blur → height=width/ratio, 높이 입력 blur → width=height*ratio (오차 ≤ 0.5 doc px, H3 측정 err=0.000). Transformer `keepRatio(true)` + 모서리 핸들만 활성 (`EditorCanvas.tsx:280-295`). D-14 perspective 모드에서는 토글 `disabled` + `aria-describedby="perspective-size-locked-hint"` (H3 확인). 토글 조작도 `commitObjectChange`를 거치므로 Undo 대상(C14). i18n: `editorAspectLockToggleLabel`.

### 1-3 설치 장소 사진 표시 방식 (Fit / Cover)

- **담당 스프린트**: S4
- **수용 기준**:
  - 기본값 Fit(全体表示 = Contain)
  - 사용자가 Cover(画面いっぱいに表示) 선택 가능
  - Cover 선택 시 「写真の一部が切れて表示される場合があります。」 안내 표시
  - 전환은 Undo 대상(C14)
  - 전환 시 사이니지 좌표 기준: audit B-5-4의 결론대로 "캔버스 absolute 좌표 유지"로 기본값. 사용자 테스트 후 재검토(C22)
  - PNG/동영상 내보내기에 동일 반영
- **현재 상태**: **완료 (v2-S4-b)** — `SpaceBackground.fit?: 'contain' | 'cover'`. `setSpaceBackground`가 신규 업로드 시 기본값 `contain`을 세팅. `SpaceBackgroundView`가 `fit === 'contain'`일 때 `computeContainFit`로 letterbox, `cover`일 때 기존 `computeCoverFit` 유지. `setSpaceBackgroundFit` 액션은 Undo 대상이고 contain 전환 시 `offsetY=0` 리셋. Space 섹션 세그먼트 버튼 2개(`editor-space-background-fit-contain`/`editor-space-background-fit-cover`), aria-pressed로 활성 상태 노출. Cover 전용 안내문 `editorSpaceBackgroundCoverHint` (ja/ko/en). `EditorCanvas.handleWheel`과 `setSpaceBackgroundOffsetY` 모두 contain 모드에서는 조기 return — 휠 패닝 무력화. H4 측정: 1920×1080 doc + 4:3 (1600×1200) 사진 Fit → 사진 폭 1440 px(기대 1440 ± 1 → 측정 1440 ✓), 좌/우 letterbox 240 px(기대 240 ± 1 → 측정 240 ✓). Cover에서 각 코너 샘플 red(rgb=255,0,0 → 띠 0 ✓). Fit↔Cover 전환 시 LED bbox diff=0 (X,Y,W,H 전부 동일).

### 2-1 캔버스 자동 맞춤

- **담당 스프린트**: S3
- **수용 기준**:
  - 브라우저 100% 창에서 16:9·9:16 캔버스 전체가 작업 영역 안에 보임(특히 9:16 하단 안 잘림)
  - 표시 배율과 출력 해상도 분리 유지(C12)
  - 창 리사이즈 시 자동 재맞춤
- **현재 상태**: **완료 (v2-S3)** — `EditorCanvas.tsx`의 fitScale이 두 축 모두 반영: 데스크톱 `min(containerW/docW, containerH/docH)`, 모바일 `min(viewportInnerW − 24, 0.7 × viewportInnerH)`. 측정 전 fitScale은 0으로 두어 측정 이전 Stage가 뷰포트를 밀어내지 않음 (H 단계 보완). 창 리사이즈는 ResizeObserver + `window.resize` 리스너로 자동 재맞춤. 출력 해상도는 `exportPixelRatio = (1/fitScale)(1+1e-6)`로 캔버스 프리셋(1920×1080 또는 1080×1920) 고정 — L4 테스트가 1920×1080과 1280×720 뷰포트에서 PNG 바이트/SHA-256 일치를 검증.

### 2-2 오른쪽 설정 패널 아코디언

- **담당 스프린트**: S3
- **수용 기준**:
  - 각 섹션 접기/펼치기
  - 기본 상태 정의(각 섹션별): 사이니지 추가·내보내기는 펼침, 그 외는 접힘? (스프린트 시작 전 사용자와 확정)
  - 접힘 상태는 사이니지 선택이 바뀌어도 섹션별로 유지
- **현재 상태**: **완료 (v2-S3)** — `uiStore.accordionOpen`에 섹션별 상태(`space`·`add-signage`·`selected`·`content`·`appearance`). 기본값: `space`·`add-signage`=true, `appearance`=false, `selected`/`content`=null(세션 첫 선택 시 auto-open then user-wins — `openAccordionIfAuto`). `export` 섹션은 토글 없는 pinned 모드. 접힘 상태는 다른 사이니지 선택 전환 후에도 유지 (L8/L14 검증). 접힘 body는 DOM에 남고 `hidden` HTML 속성으로 숨겨 `aria-controls` 유효성 유지 (L10 검증).

### 2-3 중앙 상세 설정 창을 오른쪽 패널로 통합

- **담당 스프린트**: S3
- **수용 기준**:
  - `AdvancedSettingsModal`을 외관 섹션 안 접이식으로 전환
  - 남는 모달이 있다면 사이니지를 가리지 않는 위치로
- **결정 사항 (glossary.md ③)**: 중앙 모달은 오른쪽 패널로 통합한다.
- **현재 상태**: **부분 완료 — `詳細設定` 모달 인라인화는 S5 이월(3-5와 함께)** — Toolbar의 `AppearanceFields` 안에 「詳細設定」(editorAdvancedSettingsOpenButton) 버튼을 두어 `AdvancedSettingsModal`을 호출. 모달 자체는 아직 중앙 다이얼로그로 남아 있으나 외관 섹션(아코디언)의 하위 액션으로 재배치되어 "사이니지를 가리지 않는 위치"는 L11 (overlapping count = 0)으로 검증됨. 완전 인라인 전환은 S5의 외관 섹션 리팩터 범위로 이월(3-3/3-4/3-5 상세 설정 통합과 함께).

### 2-4 「結果/オリジナル」 아래 큰 PNG/동영상 버튼

- **담당 스프린트**: S3
- **수용 기준**:
  - 비교 토글 아래에 PNG/동영상 내보내기 버튼을 크게 배치
  - 모바일에서도 쉽게 눌리는 크기
- **현재 상태**: **완료 (v2-S3)** — Toolbar의 pinned `export` 섹션에 `editor-export-png-panel` / `editor-export-video-panel` 두 버튼이 패널 하단에 상주. L12는 PNG 패널 버튼 높이 ≥ 44 px를 검증(측정값 44.0 px). 기존 헤더 버튼(`editor-export-png-header`)은 그대로 유지하여 데스크톱 상단 export와 모바일 하단 export가 공존.

### 2-5 오류 메시지 시인성

- **담당 스프린트**: S2
- **수용 기준**:
  - 글자 크기 ≥ 1rem, 대비 WCAG AA
  - 원인 + 해결 방법 함께 표시
  - 작업 대상(캔버스, 선택된 사이니지)을 가리지 않는 위치
  - aria-live="polite"는 유지
- **현재 상태**: **완료 (v2-S2)** — 신규 `ErrorBanner` 컴포넌트(`src/features/editor/ErrorBanner.tsx`)가 캔버스 아래 `.editor-status-area`에 렌더링(캔버스를 가리지 않음). 원인/해결 두 줄, 폰트 1rem(16px), 전경 `#5f1313`/배경 `#fdecec` 대비 12.63:1 (WCAG AA 통과). 오류는 `role="alert"`, 성공 힌트는 `role="status"`로 채널 분리(C7 참조). × 버튼은 `aria-label` 번역 키 `errorBannerDismissButtonLabel`.

### 2-6 사용 가이드(説明書/マニュアル) 진입점

- **담당 스프린트**: S3
- **수용 기준**:
  - 항상 보이는 위치에 매뉴얼 입구 하나 이상
  - 모바일에서도 접근 가능
- **현재 상태**: **완료 (v2-S3)** — 2개 입구를 두 축에서 상시 노출: 헤더 「使い方ガイド」 버튼(`editor-header-user-guide`, 데스크톱 상단) + footer 📖 아이콘 버튼(`editor-footer-user-guide`, aria-label 「使い方ガイド」, 모든 뷰포트 공통). 둘 다 `uiStore.userGuideOpen` single source of truth 토글. 기존 임시 "매뉴얼은 여기" 안내(`userGuideHereHint`)는 제거(L13 검증: 옛 라벨 count = 0).

### 3-1 위치·크기 상세 설정 접이식

- **담당 스프린트**: S3
- **수용 기준**:
  - 「選択中のサイネージ」 섹션 안 접이식 「位置・サイズの詳細設定」(横位置/縦位置/幅/높이/회전)
  - 처음엔 접힘
  - 패널 안 인라인(팝업 금지)
  - 폭·높이 옆 비율 고정 버튼(1-2와 동일 UI 재사용)
  - 캔버스 조작 ↔ 입력값 즉시 상호 반영
  - 다른 사이니지를 선택해도 접힘·펼침 상태 유지(현재 선택 사이니지의 상태)
- **현재 상태**: **완료 — 비율 고정 버튼은 S4(1-2)** — Toolbar의 `PositionSizeSubsection` (data-testid 접두 `toolbar-subsection-position-size`): X座標/Y座標/幅/高さ/回転 입력을 모두 담은 인라인 접이식 서브-아코디언. 기본 접힘(`subAccordionOpen['selected-position-size']: false`), 사이니지 전환 후에도 상태 유지 (L14 검증). 캔버스 drag/resize/perspective/click이 입력값에 1 CSS px 이내로 반영됨 (L5 at 1920×1080과 1280×720 — 측정값: drag got=(819~821 vs 820 expected). perspective 모드에서는 幅/高さ가 `disabled` + `#perspective-size-locked-hint` 안내 표시 (L15 검증, 섹션 열림/접힘 양쪽). perspective 핸들 (+40, +30) CSS px 드래그는 **v2-S4 Step 0-5에서 aria-valuetext를 1 자리 소수(`toFixed(1)`)로 전환**해 store 환산값 기준으로 ariaErr ≤ 1.92 doc px x / 1.08 doc px y 범위 안에 들어오는 걸 확인(실측 ariaErr 좌상 1.55/0.08 at 1920, 1.04/0.06 at 1280; bbox 보조 oracle은 1/scale CSS-px 플로어 안쪽). **비율 고정 토글(🔗)은 S4의 1-2 범위.**

### 3-2 이미지·영상 추가 버튼 근처 제한 사전 표시

- **담당 스프린트**: S2
- **수용 기준**:
  - 콘텐츠 업로드 버튼 근처에 형식/용량/해상도/영상 길이 제한 명시
  - 로케일에서 상수를 템플릿 치환(상수 변경 시 자동 반영) — 하드코딩된 「10MB」「300MB」 등 제거
- **현재 상태**: **완료 (v2-S2)** — `src/lib/uploadLimits.ts`가 단일 source of truth: `getImageLimits()`·`getVideoLimits()`가 `fileValidation.ts`·`videoValidation.ts`의 상수를 포맷해서 반환하고, 이 값으로 (a) 공간 사진·콘텐츠 업로드 버튼 옆에 노출되는 **힌트 문구**(testids `editor-space-background-upload-hint`, `editor-content-upload-hint-image`, `editor-content-upload-hint-video`), (b) `<input accept>` 속성, (c) 에러 메시지 `params`가 **모두 동일하게 공급**됨. 로케일 문자열에 수치 하드코딩 없음(`{formats}`·`{maxMb}`·`{maxLongEdge}`·`{maxShortEdge}`·`{maxSeconds}`·`{maxPixels}` 템플릿). `tests/unit/uploadLimits.test.ts`가 drift-check 보장.

### 3-3 슬라이더 현재값 표시

- **담당 스프린트**: S5
- **수용 기준**:
  - 모든 슬라이더에 현재값 숫자 + 단위(「60%」)
- **현재 상태**: **부분** — 다수 슬라이더에 숫자 입력은 있으나 단위 표기 부족.

### 3-4 コンテンツ拡大率 % 표기

- **담당 스프린트**: S5
- **수용 기준**:
  - 입력·표시가 50%, 100%, 150%
  - 내부 값(1.0, 1.5)과의 변환은 UI 레이어에서 처리
- **현재 상태**: **없음**.

### 3-5 모자이크 흐름 단축 + 이름·설명

- **담당 스프린트**: S5
- **수용 기준**:
  - 목적 설명: 「柱や什器など、手前にある物の後ろにサイネージが隠れているように見せる機能です。」
  - 흐름: 추가 → 범위 지정(실제론 3~24점 폴리곤) → **그 자리에서 바로 "適用/キャンセル"** (상세 설정으로 돌아가지 않음)
  - 현재 단계 안내 「ステップ{current}/{total}：隠したい範囲の角をクリック（{count}/4）」 — 4점이 기본이지만 더 추가 가능하다는 안내
  - 내부 코드명 Occlusion은 유지(C8)
- **현재 상태**: **없음** — 현재는 begin → 점 → 패널로 돌아감 → feather/opacity → apply.

### 4-1 용어 변경

- **담당 스프린트**: S6
- **수용 기준**: `docs/v2/glossary.md` ①의 변경 용어를 ja/ko/en에 모두 반영.
- **S6 추가 검토 항목 (v2-S4 Step 0 기록)**: `userGuideOpenButton` 라벨이 커밋 `d06ecfd feat(v2-S3): …` (2026-10-06)에서 `使い方・このツールについて` → `使い方ガイド`로 변경되었음(글로서리 반영 없이). 헤더 버튼은 가시 텍스트가 라벨과 동일하므로 WCAG 2.5.3 통과, footer 📖 버튼은 아이콘-only(가시 텍스트 없음)이므로 2.5.3 적용 외. S6에서 ja/ko/en의 `userGuideOpenButton` 값을 glossary.md ①에 맞춰 재검토할 것.
- **현재 상태**: **없음**.

### 4-2 외관 섹션 설명문 교체

- **담당 스프린트**: S6
- **수용 기준**: 「サイネージ本体を「設置場所の写真」に馴染ませるために、明るさを調整できます。下の「詳細設定」から、さらに細かな調整ができます。」
- **현재 상태**: **없음**.

### 4-3 변경 용어 전면 통일

- **담당 스프린트**: S6
- **수용 기준**: 메뉴·버튼·도움말·웰컴 가이드·에러 문구까지 신규 용어 반영.
- **현재 상태**: **없음**.

### 5-1 오류 자동 제거

- **담당 스프린트**: S2
- **수용 기준**: 용량 초과 등으로 실패 후, **같은 종류의 정상 파일 업로드가 성공하면** 그 오류 announcement가 자동으로 지워짐.
- **현재 상태**: **완료 (v2-S2)** — `uiStore`에 `errors: Partial<Record<UploadErrorSource, UploadError>>` + per-source `requestSequence` 카운터 추가. `beginUploadRequest(source)` → sequence 증가 + id 반환, `setUploadError(source, id, error)` → **id가 현재 sequence일 때만** 반영(stale 요청 무시), `clearUploadError(source, id)` → 성공 시 같은 소스 에러만 제거. 같은 소스에서 새 에러는 REPLACE(누적 안 됨), 다른 소스는 독립. × 버튼은 `dismissUploadError(source)`로 id 무시 즉시 제거. async race는 sequence로 방어. 에러는 `editorStore` 히스토리와 분리되어 Undo/Redo 영향 없음.

### 5-2 크기·원근 조정 순서와 콘텐츠 비율 일관성

- **담당 스프린트**: S1 (가장 먼저) — **S1 완료 (재작업 후)**
- **수용 기준**:
  - PDF 재현 경로 「①追加 → ②パース → ③コンテンツ」(크기 조정 생략)에서도 콘텐츠 비율이 틀어지지 않는다.
  - 「①追加 → ②大きさ調整 → ③パース → ④コンテンツ」와 같은 조합도 당연히 정상.
  - perspective 모드에서는 크기 입력(幅·高さ)과 리사이즈 핸들이 비활성화되어 "크기 vs 원근 corner" 간 충돌이 UI 수준에서 발생하지 않음(ADR 0012 D-14).
- **현재 상태**: **완료 (불변식 B'로 교체)** — perspective 모드의 콘텐츠 비율은 이제 quad의 겉보기 종횡비에서 추정(ADR 0012 D-13). 코드: `src/lib/perspectiveLogicalSize.ts`(신규) + `src/features/editor/SignageDisplayView.tsx`가 perspective 모드일 때 effectiveSize 사용. UI: `src/features/editor/Toolbar.tsx`의 幅/高さ 입력이 perspective 모드에서 `disabled` + `aria-describedby="perspective-size-locked-hint"`. i18n: `perspectiveSizeLockedHint` (ja/ko/en). 테스트: `tests/unit/v2/contentLayoutOrder.test.ts`의 "PDF path 5-2" describe 블록 6 케이스 + 매트릭스 48 + 영상 1 + rect 회귀 1 + 포터블 회귀 1 = 총 62건 유닛 테스트. e2e: `e2e/v2-content-order.spec.ts`의 PDF P2 wall-LED 코너 샘플링 + 크기 입력 disabled 검증 2건.
- **확정 원인**: `src/features/editor/SignageDisplayView.tsx:74-76`(이전)가 perspective 모드에서도 `object.width/height`로 screen을 계산 → 사용자가 리사이즈를 생략하면 사이니지 기본값(480×270, 1.78) 기준 콘텐츠 레이아웃 → quad 겉보기 2.73:1에 letterbox-then-warp. audit B-4-4 후보 ①("콘텐츠 레이아웃이 quad를 입력받지 않음")이 **올바른 설계가 아니라 오히려 원인**이었음.
- **커밋 이력**:
  - `c31a36b fix(v2-S1): compute content layout in logical screen space independent of edit order` — JSDoc + 매트릭스 테스트만 추가, 코드 변경 없음. PDF 증상 실제로 재현 못 하는 "최종 상태 동일 → 결과 동일" 검증에 그쳤음. **S1 재작업 보고에서 결론 철회**.
  - `fix(v2-S1): derive perspective content aspect from quad (PDF 5-2)` — 실제 수정. perspective 모드에서 quad 겉보기 종횡비 기반 effectiveSize + 크기 입력 비활성화 + 새 i18n 키.
- **임시 안내 표시**: 불필요 (불변식이 UI 레벨에서 보장).

---

## 연쇄 영향 (C1~C23)

| ID  | 내용                                                                                                    | 담당    | 현재 상태                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | 웰컴 가이드 「写真はキャンバスのサイズに合わせて自動的にフィットします」를 1-3 Fit/Cover에 맞게 수정    | S6      | 없음                                                                                                                                                                                                                                                                                                         |
| C2  | 웰컴 가이드 「右側のツールバーには…が常時表示されています」를 아코디언 구조에 맞게 수정                 | S6      | 없음                                                                                                                                                                                                                                                                                                         |
| C3  | 4-1 용어 변경을 ko/en에도 동일 의미로 반영                                                              | S6      | 없음                                                                                                                                                                                                                                                                                                         |
| C4  | 오타 「キャンパス」→「キャンバス」 (존재 여부 미확인)                                                   | S6      | 미확인                                                                                                                                                                                                                                                                                                       |
| C5  | ko 「사이네지」→「사이니지」, ko 「외부 HULL 공식 웹사이트」→「HULL 공식 웹사이트」, en "external" 정리 | S6      | 부분(「외부」는 pre-v2에서 처리)                                                                                                                                                                                                                                                                             |
| C6  | `RealismGuideCard` 안 옛 용어 교체                                                                      | S6      | 없음                                                                                                                                                                                                                                                                                                         |
| C7  | 하단 힌트바에서 안내문과 오류 분리                                                                      | S2      | **완료 (v2-S2)** — `role="status"` polite 힌트와 `role="alert"` 에러 배너가 캔버스 아래 `.editor-status-area`에서 분리 렌더. 성공·안내는 `hintAnnouncement`(힌트바), 실패는 `ErrorBanner`로 라우팅.                                                                                                          |
| C8  | 모자이크 UI 명칭 변경, 내부 코드명 Occlusion 유지                                                       | S5      | 없음                                                                                                                                                                                                                                                                                                         |
| C9  | コンテンツ位置X/Y → コンテンツの横位置/縦位置                                                           | S6      | 없음                                                                                                                                                                                                                                                                                                         |
| C10 | レンダリングプリセット → 明るさ・時間帯                                                                 | S5/S6   | 없음                                                                                                                                                                                                                                                                                                         |
| C11 | 각 스프린트가 자신의 라벨 변경에 맞춰 e2e·스냅샷 동기 갱신                                              | 모든 S  | 진행중(baseline에 깨짐 발견)                                                                                                                                                                                                                                                                                 |
| C12 | 레이아웃 변경 후에도 PNG/동영상 출력 해상도 불변                                                        | S3      | 확인됨(현재도 성립)                                                                                                                                                                                                                                                                                          |
| C13 | 복사·붙여넣기 시 asset reference 공유의 revoke 거동 검증                                                | S4      | **완료 (v2-S4-b)** — `cloneSignageObject`가 콘텐츠 `sourceId` 문자열만 공유, 나머지 필드는 깊은 사본. `collectAssetSourceIds`가 사본에서도 같은 sourceId를 reachable로 집계 → sweep이 asset을 유지. 단위 테스트 「copy of a display with content keeps the asset reference」로 검증(sourceId 문자열 동일성). |
| C14 | 비율 고정, 사진 표시 방식, 마스크, 붙여넣기 상태 변경을 Undo 대상에 포함                                | S4~S5   | **부분 완료 (v2-S4-b)** — 1-2 aspectLocked, 1-3 fit, 1-1 copy/paste 전부 `pushHistory` 거친 커밋이라 Undo 대상. 마스크(occlusion)는 S5 범위.                                                                                                                                                                 |
| C15 | 앱 "비공식" 문구 정리 (UserGuideModal 등)                                                               | S6      | 부분                                                                                                                                                                                                                                                                                                         |
| C16 | PortableQuadDebugOverlay 비노출 유지                                                                    | S4 이후 | 확인됨                                                                                                                                                                                                                                                                                                       |
| C17 | 레이아웃 변경 후에도 워터마크 포함 유지                                                                 | 모든 S  | 확인됨                                                                                                                                                                                                                                                                                                       |
| C18 | `/oitemiru/` 서브 경로 최초 접속·새로고침·에셋 로딩 정상                                                | S0      | 확인됨 (P-8/P-10)                                                                                                                                                                                                                                                                                            |
| C19 | 포터블 비율 고정 기본 ON                                                                                | S4      | **완료 (v2-S4-b)** — `addPortable`에서 `aspectLocked: true`로 생성. Transformer `keepRatio` 로직은 `isPortable                                                                                                                                                                                               |     | userAspectLocked`이므로 포터블은 사용자가 수동으로 꺼도 Transformer는 비율 유지(의도된 동작). unit test 「newly added portables start with aspectLocked = true」로 검증. |
| C20 | 아코디언·인라인 상세의 모바일 기본 표시 깨짐 없음                                                       | S3/S4   | 재검증 필요(S5~S6에서 다룸)                                                                                                                                                                                                                                                                                  |
| C21 | 복사·붙여넣기 단축키가 Delete·Ctrl+Z/Y·input 입력과 충돌 안 함                                          | S4      | **완료 (v2-S4-b)** — `EditorLayout.handleKeyDown`의 `isEditableTarget` 가드 뒤에만 Ctrl+C/V 디스패치. e2e test 「Ctrl+V inside an <input> does not paste」로 undo-enabled 상태 변화 0건 확인.                                                                                                                |
| C22 | 사진 표시 방식 전환 시 기존 사이니지 좌표 기준 정의 + PNG/동영상 동일 반영                              | S4      | **완료 (v2-S4-b)** — `setSpaceBackgroundFit`은 `document.objects`를 건드리지 않음(사진 렌더링만 바뀜). e2e 「Cover mode: no letterbox, signage bbox unchanged」로 X/Y/W/H 완전 동일 확인. PNG는 Stage toDataURL이므로 자동 반영. 동영상은 recordCanvasToVideo가 같은 Stage를 캡처하므로 반영.                |
| C23 | 중앙 모달 제거 후에도 키보드 조작/포커스 이동/Esc 유지                                                  | S3      | 재검증 필요                                                                                                                                                                                                                                                                                                  |

---

## 요구 전제의 확인 요청 사항 — **전부 해결 (v2-S1, ADR 0012)**

1. ~~**2-6 매뉴얼 위치 재해석**~~ → **D-9 (S3)**: 헤더(言語 옆)에 「使い方ガイド」 버튼 추가 + 기존 UserGuideModal 열기, footer 📖 유지, `userGuideHereHint` 제거.
2. ~~**2-2 아코디언 기본 상태**~~ → **D-10 (S3)**: 「설치 장소 사진」·「사이니지 추가」 기본 펼침. 「선택 중/콘텐츠」는 세션 첫 선택 시 자동 펼침, 이후 사용자 선택 유지. 「외관」과 모든 상세는 기본 접힘. 「書き出し」는 접을 수 없는 하단 고정.
3. ~~**1-3 Fit↔Cover 전환 시 사이니지 좌표 기준**~~ → **D-11 (S4)**: 캔버스 absolute 유지. 신규 사진은 Fit 기본, Fit에서는 휠 팬 불가·offsetY=0, Fit→Cover 돌아올 때 이전 offset 복원 안 함. 전환은 Undo 대상이고 PNG/동영상 동일 반영.
4. ~~**4-1 변경 용어의 로케일 번역**~~ → **D-12 (S6)**: glossary.md ①의 ko/en 번역 그대로 확정. S6에서 로케일 전체 작업 중 추가 다듬기는 가능하나 재번역 선결 조건 아님.
