# v2 스프린트 계획

본 계획은 사용자 승인 전까지 **제안** 상태입니다. 각 스프린트는 사용자가 수동 테스트 + 검수자 AI 리뷰를 거친 뒤 다음으로 넘어갑니다.

## 전체 순서 (제안)

| S      | 범위                                                                                                                 | 수정 예정 영역                                                                                                                                                                                                                                                          | 리스크 | 메모                                                                                                                                                                                                      |
| ------ | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S0** | pre-v2 정리, 기준선, 문서 정비                                                                                       | `docs/**`, `CLAUDE.md`, `README.md`, 설정 파일(P-8 범위)                                                                                                                                                                                                                | 중     | **완료 제안** — 커밋 7개, Render push 완료, docs/v2 전부 작성                                                                                                                                             |
| **S1** | 5-2 (원근·크기·콘텐츠 비율 일관성)                                                                                   | `src/lib/contentLayout.ts`, `src/features/editor/PerspectiveScreenView.tsx`, `src/features/editor/ScreenComposition.tsx`, 신규 테스트                                                                                                                                   | 상     | 가장 어려운 수학/기하. 임시 안내 선행 가능                                                                                                                                                                |
| **S2** | 5-1, 2-5, 3-2, C7, **e2e debt 해소: A1/A4-text/A3/C** (`docs/v2/baseline.md` 참조)                                   | `src/features/editor/EditorLayout.tsx`, `src/features/editor/Toolbar.tsx`, `src/i18n/locales/*`, `e2e/{editor,image-upload,reselection,smoke}.spec.ts` 등 13건                                                                                                          | 중     | 「テキストを追加」·「画像を追加」·`.editor-empty-hint`를 현재 UI 흐름으로 재작성                                                                                                                          |
| **S3** | 2-1, 2-2, 2-3, 3-1, 2-4, 2-6, C12, C16, C20, C23, **e2e debt 해소: F-download 4건**                                  | `src/features/editor/EditorLayout.tsx`, `src/features/editor/Toolbar.tsx`, `src/features/editor/AdvancedSettingsModal.tsx`, `src/features/editor/EditorCanvas.tsx`, `src/styles/global.css`, `e2e/support/{accordion,mobileExport}.ts`                                  | 상     | **완료 제안 (2026-10-08)** — 수용 기준 전부 충족, 통과 수 128/149, 새 실패 0건. 2-3은 모달이 Appearance 아코디언 하위 액션으로 재배치됨(완전 인라인 전환은 S5 이월).                                      |
| **S4** | 1-1, 1-2, 1-3, C13, C14, C19, C21, C22, **e2e debt 해소: B1/B2** (포터블 compound 흐름 기준 재작성 17건)             | `src/store/editorStore.ts`, `src/features/editor/EditorLayout.tsx`(keydown), `src/features/editor/EditorCanvas.tsx`(Transformer), `src/features/editor/SpaceBackgroundView.tsx`, `src/lib/spaceBackgroundFit.ts`, `e2e/{portable,reselection,mobile,visual-qa}.spec.ts` | 상     | **1-1·1-2·1-3·C13·C14·C19·C21·C22 완료 (v2-S4-b, 2026-10-10)**. a-3 B1/B2 17건은 a-0 매핑 결정 대기 → **S5로 이월**(S5 범위에 추가). 신규 테스트 13 e2e + 17 unit, 통과 수 159 / 21 fail (baseline 유지). |
| **S5** | 3-3, 3-4, 3-5, C8, **e2e debt 해소: F-occlusion** (occlusion 흐름 재작성 4건)                                        | `src/features/editor/Toolbar.tsx`, `src/features/editor/OcclusionEditOverlay.tsx`, `src/features/editor/RealismGuideCard.tsx`, `src/i18n/locales/*`, `e2e/{occlusion-mask,mobile}.spec.ts`                                                                              | 중     | 모자이크 흐름이 가장 변화 큼                                                                                                                                                                              |
| **S6** | 4-1, 4-2, 4-3, C1~C6, C9, C10(용어), C15(앱 문구)                                                                    | `src/i18n/locales/*`, `src/components/UserGuideModal.tsx`, `src/features/editor/OnboardingOverlay.tsx`, `src/features/editor/RealismGuideCard.tsx`                                                                                                                      | 중     | 전수 용어 조사 선행(audit "미확인·추가 조사" 참조)                                                                                                                                                        |
| **S7** | 전체 회귀, C11, C17, C18, 릴리스 노트(ja), 배포·롤백 절차, **Docker Linux에서 `qa:visual` 전체 실행 및 스냅샷 갱신** | `docs/v2/release-notes-s7.md`(신규), `docs/runbooks/*`, `tests/` 전체 재측정                                                                                                                                                                                            | 중     | push 1회, 본서버 수동 업로드 가이드 재검증. F-download는 S3에서 해소되었으므로 S7에서 별도 재검증 불필요. qa:visual은 여전히 Linux 전용 스냅샷 생성 필요.                                                 |

## 스프린트별 상세 (제안)

### S1 — 5-2 (원근·크기·콘텐츠 비율 일관성)

- **수정 예정 파일**: `src/lib/contentLayout.ts`(필요 시 perspective-aware fit 계산 추가), `src/features/editor/ScreenComposition.tsx`, `src/features/editor/PerspectiveScreenView.tsx`, `src/features/editor/Toolbar.tsx`(임시 안내 추가 시).
- **새 테스트 파일**:
  - `tests/unit/contentLayout.perspective.test.ts` — 원근 corner 변경 시 콘텐츠 비율이 유지되는지(아직 실패하는 테스트 작성 후 구현).
  - `e2e/perspective-content-order.spec.ts` — 순서를 바꿔도 최종 렌더가 같은지(픽셀 비교).
- **예상 리스크**: 수학적 난도 상. ADR 0008 전제가 바뀔 수 있어 그 ADR의 "결정 번복" 가능성 염두.
- **다른 스프린트와의 충돌**: 5-2 수정이 포터블 `screenQuad` 처리에 영향을 줄 수 있음(audit B-4-5). S4의 복사·붙여넣기 전에 안정화 필요.

### S2 — 5-1, 2-5, 3-2, C7, e2e 라벨 정비

- **수정 예정 파일**: `src/features/editor/EditorLayout.tsx`(성공 경로 announcement 리셋, 힌트바 분리), `src/features/editor/Toolbar.tsx`(업로드 버튼 근처 제한값 표시), `src/i18n/locales/{ja,ko,en}.ts`(에러·안내 문구 상수화 템플릿), **`e2e/**/*.spec.ts`·`e2e/support/*.ts`**(17줄 라벨 교체: `editorContentUploadButton` 또는 `data-testid`).
- **새 테스트 파일**:
  - `tests/unit/EditorLayout.announcement.test.tsx` — 실패 → 성공 흐름에서 announcement 자동 리셋.
  - 기존 e2e 스펙은 **라벨만 교체**하여 전면 그대로 유지(스냅샷은 S7에서 재측정 또는 scoped update).
- **예상 리스크**: visual-qa 스냅샷이 라벨만 변경에도 영향받으면 S2에서 함께 재기록할지 결정 필요(스냅샷 재측정은 작업량 큼).
- **다른 스프린트와의 충돌**: S3 레이아웃 변경 전에 e2e 신뢰도 회복 필요.

### S3 — 캔버스/패널 레이아웃 (2-1, 2-2, 2-3, 3-1, 2-4, 2-6)

**v2-S2 추가 범위 (ADR 반영 전)**: 2-1 「캔버스 자동 맞춤」을 구현할 때, S2에서 캔버스 아래에 추가된 `.editor-status-area`(힌트 + 에러 배너) 높이를 fit 계산에 포함해야 합니다. 현재 fit은 캔버스 컨테이너 자체 폭에만 반응하지만, 상태 영역이 커지면 세로 공간이 줄어 9:16에서 하단이 다시 잘릴 수 있습니다. `EditorLayout`의 fit 계산이 상태 영역 bounding box를 측정하거나 CSS grid로 상태 영역을 캔버스 가용 영역 바깥에 두는 식으로 처리할 것.

- **수정 예정 파일**: `src/features/editor/EditorLayout.tsx`(fit 계산, 비교 버튼 위치), `src/features/editor/Toolbar.tsx`(아코디언, 상세 설정 섹션 통합), `src/features/editor/AdvancedSettingsModal.tsx`(섹션으로 전환 또는 삭제), `src/styles/global.css`.
- **새 테스트 파일**:
  - `tests/unit/Toolbar.accordion.test.tsx` — 섹션 접기/펼치기, 선택 전환 시 상태 유지.
  - `tests/unit/EditorLayout.canvasFit.test.tsx` — 9:16에서 하단 안 잘림.
  - `e2e/panel-layout.spec.ts` — 아코디언·인라인 상세의 전체 흐름.
- **예상 리스크**: visual-qa 다수가 영향받음(C11). 스냅샷 재측정 필요.
- **사용자 결정 반영 (ADR 0012)**: 2-6 → **D-9** (헤더에 「使い方ガイド」 버튼 추가, footer 📖 유지, `userGuideHereHint` 제거). 2-2 → **D-10** (「설치 장소 사진」·「사이니지 추가」 기본 펼침, 「선택 중/콘텐츠」는 세션 첫 선택 시 자동 펼침·이후 사용자 선택 유지, 「외관」·모든 상세는 기본 접힘, 「書き出し」는 접을 수 없는 하단 고정 — 2-4와 결합).
- **5-2 재작업 영향 (ADR 0012 D-14)**: 3-1의 「位置・サイズの詳細設定」 접이식 섹션 안에서 幅/高さ 입력은 perspective 모드일 때 `disabled` + `aria-describedby="perspective-size-locked-hint"` 상태를 **유지**. 아코디언 재구성 과정에서 이 lock-out과 그에 딸린 안내 span을 제거하지 말 것.
- **다른 스프린트와의 충돌**: 2-6은 D-9로 명확해졌으므로 S3 안에서 자유롭게 진행 가능.

### S4 — 편집 기능 (1-1, 1-2, 1-3, C13, C14, C19, C21, C22)

**v2-S2 추가 범위 (ADR 반영 전)**: 포터블에 「파스펙티브 적용」 흐름을 열어 두는 경우, 1-2의 비율 고정 토글이 포터블의 compound 비율(`screenQuad` 겉보기 종횡비)과 어떻게 상호작용하는지 명시해야 합니다. S1 D-14에서 perspective 모드의 幅/高さ 입력은 disabled이지만, 포터블은 사진 교체 → `screenQuad` 재지정 흐름이 있어 "비율 고정 ON + 포터블 사진 변경" 시 어느 쪽을 우선시할지 결정 필요. 현재는 포터블이 compound-model-only라 비율 고정 토글 자체가 포터블에선 숨겨져 있지만, 포터블+파스펙티브 호환성이 열리면 재검토할 것.

- **수정 예정 파일**: `src/store/editorStore.ts`(복사/붙여넣기 액션, 비율 고정 상태, Fit/Cover 상태), `src/features/editor/EditorLayout.tsx`(Ctrl+C/V 핸들러), `src/features/editor/Toolbar.tsx`(비율 고정 토글, Fit/Cover 토글), `src/features/editor/EditorCanvas.tsx`(Transformer keepRatio 토글, 휠 핸들러 — 2-1 캔버스 줌과의 조합), `src/features/editor/SpaceBackgroundView.tsx`, `src/lib/spaceBackgroundFit.ts`(computeContainFit 신규).
- **새 테스트 파일**:
  - `tests/unit/editorStore.copy.test.ts` — 복사·붙여넣기 액션 동작, asset reference 공유 안전성(C13).
  - `tests/unit/spaceBackgroundFit.contain.test.ts` — Fit 계산.
  - `e2e/copy-paste.spec.ts` — Ctrl+C/V 흐름, input 포커스 중 가로채지 않음.
  - `e2e/fit-cover-toggle.spec.ts` — 토글 + 사이니지 좌표 보존 + PNG 출력 반영.
- **사용자 결정 반영 (ADR 0012 D-11)**: 1-3 Fit↔Cover — 신규 사진 Fit 기본, 캔버스 absolute 좌표 유지(사진 pixel 재매핑 안 함), Fit에서 휠 팬 불가·`offsetY=0`, Fit↔Cover 전환은 Undo 대상이고 PNG/동영상 동일 반영, Fit→Cover 복귀 시 이전 offset 복원 안 함.
- **5-2 재작업 영향 (ADR 0012 D-14)**: 1-2「縦横比を固定」비율 고정 토글은 **rect 모드 전용 기능**. perspective 모드에서는 幅/高さ 입력 자체가 비활성화되어 있어 토글이 의미 없음. UI 상에서도 perspective 모드에서는 비율 고정 아이콘을 숨기거나 비활성화할 것.
- **다른 스프린트와의 충돌**: S3의 캔버스 fit 로직과 겹침. S3 완료 후 S4.

### S5 — 외관·슬라이더·마스크 (3-3, 3-4, 3-5, C8)

- **수정 예정 파일**: `src/features/editor/Toolbar.tsx`(슬라이더 현재값·단위 표기, 콘텐츠 scale % 표기), `src/features/editor/OcclusionEditOverlay.tsx`(흐름 단축: 범위 지정 직후 적용/취소), `src/features/editor/RealismGuideCard.tsx`(용어 교체), `src/i18n/locales/*`(C8/C10 용어).
- **새 테스트 파일**:
  - `tests/unit/Toolbar.slider.test.tsx` — 모든 슬라이더에 % 표기, scale %.
  - `e2e/occlusion-flow.spec.ts` — 신규 단축 흐름.
- **예상 리스크**: 중. visual-qa에 외관 관련 스냅샷이 많음.

### S6 — 전면 용어 통일 + 앱 문구 정리 (4-x, C1~C6, C9, C10, C15)

- **수정 예정 파일**: `src/i18n/locales/{ja,ko,en}.ts`(대부분 수정), `src/components/UserGuideModal.tsx`(비공식 문구 → 공식 서비스), `src/features/editor/OnboardingOverlay.tsx`(C1/C2), `src/features/editor/RealismGuideCard.tsx`(C6), `src/features/editor/Toolbar.tsx`(라벨 참조).
- **새 테스트 파일**:
  - `tests/unit/locales.terms.test.ts` — glossary.md ①의 신규 용어가 세 로케일에 모두 존재하고 옛 용어가 사라졌는지.
- **사용자 결정 반영 (ADR 0012 D-12)**: 4-1 ko/en 번역은 `glossary.md` ①의 열에 적힌 대로 확정. S6에서 추가 다듬기는 가능하나 재번역 선결 조건 아님.
- **5-2 재작업 영향 (ADR 0012 D-14)**: 새 i18n 키 `perspectiveSizeLockedHint` (ja/ko/en 3개 문구) 를 S6 로케일 검수 대상에 포함할 것. 현재 문구는 임시 기준값으로, S6에서 전체 UI 톤 통일 과정에서 다듬어도 됨.
- **예상 리스크**: 중. e2e 라벨 다수 다시 영향(S1 Step 0에서 testid 전환했으므로 S6의 라벨 재명명은 safely applicable).

### S7 — 전체 회귀 + 릴리스 (C11, C17, C18, 노트)

- **수정 예정 파일**: `docs/v2/release-notes-s7.md`(신규, 일본어 요약), `docs/runbooks/*` 재검증.
- **새 테스트 파일**: 없음. 전체 재측정만.
- **작업**:
  - `npm run typecheck` / `lint` / `format:check` / `test:run` / `build` / `build:oitemiru` / `test:e2e` / `qa:visual` 모두 재측정, baseline 대비 회귀 비교.
  - visual-qa 스냅샷 전면 재측정(Docker Linux 환경 사용).
  - 본서버 업로드 리허설(README/runbook 보완).
  - 사용자 지시로 push 1회.

## 제안: audit 결과로 인한 순서 조정

**없음** — pre-v2 처리로 S1(5-2)과 S2(5-1)의 전제가 흔들리지 않았고, 계획된 S1~S7 순서가 유효합니다. 다만:

- **S2를 S3·S4보다 먼저 하는 이유 강조**: e2e 라벨 불일치가 전체 e2e를 신뢰 불가 상태로 만들고 있어, S3 이후 UI 개편의 회귀 판정이 어려워집니다. S2에서 라벨만이라도 먼저 정비해야 S3 이후 작업이 안전합니다.
- **S0 추가 작업 완료**: `docs/v2/deployment.md`, `docs/adr/0011-v2-decisions.md`, CLAUDE.md 전면 개정, `docs/archive/CLAUDE-v1-sprint1.md` 보관 — 모두 S0에서 처리됨.
