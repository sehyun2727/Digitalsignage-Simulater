# v2 스프린트 계획

본 계획은 사용자 승인 전까지 **제안** 상태입니다. 각 스프린트는 사용자가 수동 테스트 + 검수자 AI 리뷰를 거친 뒤 다음으로 넘어갑니다.

## 전체 순서 (제안)

| S | 범위 | 수정 예정 영역 | 리스크 | 메모 |
|---|---|---|---|---|
| **S0** | pre-v2 정리, 기준선, 문서 정비 | `docs/**`, `CLAUDE.md`, `README.md`, 설정 파일(P-8 범위) | 중 | **완료 제안** — 커밋 7개, Render push 완료, docs/v2 전부 작성 |
| **S1** | 5-2 (원근·크기·콘텐츠 비율 일관성) | `src/lib/contentLayout.ts`, `src/features/editor/PerspectiveScreenView.tsx`, `src/features/editor/ScreenComposition.tsx`, 신규 테스트 | 상 | 가장 어려운 수학/기하. 임시 안내 선행 가능 |
| **S2** | 5-1, 2-5, 3-2, C7, **e2e debt 해소: A1/A4-text/A3/C** (`docs/v2/baseline.md` 참조) | `src/features/editor/EditorLayout.tsx`, `src/features/editor/Toolbar.tsx`, `src/i18n/locales/*`, `e2e/{editor,image-upload,reselection,smoke}.spec.ts` 등 13건 | 중 | 「テキストを追加」·「画像を追加」·`.editor-empty-hint`를 현재 UI 흐름으로 재작성 |
| **S3** | 2-1, 2-2, 2-3, 3-1, 2-4, 2-6, C12, C16, C20, C23 | `src/features/editor/EditorLayout.tsx`, `src/features/editor/Toolbar.tsx`, `src/features/editor/AdvancedSettingsModal.tsx`, `src/styles/global.css` | 상 | 2-6은 사용자 재확인 후 진입 |
| **S4** | 1-1, 1-2, 1-3, C13, C14, C19, C21, C22, **e2e debt 해소: B1/B2** (포터블 compound 흐름 기준 재작성 17건) | `src/store/editorStore.ts`, `src/features/editor/EditorLayout.tsx`(keydown), `src/features/editor/EditorCanvas.tsx`(Transformer), `src/features/editor/SpaceBackgroundView.tsx`, `src/lib/spaceBackgroundFit.ts`, `e2e/{portable,reselection,mobile,visual-qa}.spec.ts` | 상 | 1-3 Fit/Cover 전환 시 좌표 기준 결정 필요(audit B-5-4). 포터블 다이얼로그 제거(eef7335) 후 e2e 미갱신. |
| **S5** | 3-3, 3-4, 3-5, C8, **e2e debt 해소: F-occlusion** (occlusion 흐름 재작성 4건) | `src/features/editor/Toolbar.tsx`, `src/features/editor/OcclusionEditOverlay.tsx`, `src/features/editor/RealismGuideCard.tsx`, `src/i18n/locales/*`, `e2e/{occlusion-mask,mobile}.spec.ts` | 중 | 모자이크 흐름이 가장 변화 큼 |
| **S6** | 4-1, 4-2, 4-3, C1~C6, C9, C10(용어), C15(앱 문구) | `src/i18n/locales/*`, `src/components/UserGuideModal.tsx`, `src/features/editor/OnboardingOverlay.tsx`, `src/features/editor/RealismGuideCard.tsx` | 중 | 전수 용어 조사 선행(audit "미확인·추가 조사" 참조) |
| **S7** | 전체 회귀, C11, C17, C18, 릴리스 노트(ja), 배포·롤백 절차, **F-download 재검증**, **Docker Linux에서 `qa:visual` 전체 실행 및 스냅샷 갱신** | `docs/v2/release-notes-s7.md`(신규), `docs/runbooks/*`, `tests/` 전체 재측정 | 중 | push 1회, 본서버 수동 업로드 가이드 재검증. **S1 Step 0 시점 Docker Desktop 데몬 미기동으로 qa:visual을 win32에서 미실행함. Linux 환경에서 반드시 재측정 필요.** |

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
- **수정 예정 파일**: `src/features/editor/EditorLayout.tsx`(fit 계산, 비교 버튼 위치), `src/features/editor/Toolbar.tsx`(아코디언, 상세 설정 섹션 통합), `src/features/editor/AdvancedSettingsModal.tsx`(섹션으로 전환 또는 삭제), `src/styles/global.css`.
- **새 테스트 파일**:
  - `tests/unit/Toolbar.accordion.test.tsx` — 섹션 접기/펼치기, 선택 전환 시 상태 유지.
  - `tests/unit/EditorLayout.canvasFit.test.tsx` — 9:16에서 하단 안 잘림.
  - `e2e/panel-layout.spec.ts` — 아코디언·인라인 상세의 전체 흐름.
- **예상 리스크**: visual-qa 다수가 영향받음(C11). 스냅샷 재측정 필요.
- **다른 스프린트와의 충돌**: 2-6은 사용자 재확인 전까지 유보. 이 스프린트의 **마지막** 작업으로 두는 것을 제안.

### S4 — 편집 기능 (1-1, 1-2, 1-3, C13, C14, C19, C21, C22)
- **수정 예정 파일**: `src/store/editorStore.ts`(복사/붙여넣기 액션, 비율 고정 상태, Fit/Cover 상태), `src/features/editor/EditorLayout.tsx`(Ctrl+C/V 핸들러), `src/features/editor/Toolbar.tsx`(비율 고정 토글, Fit/Cover 토글), `src/features/editor/EditorCanvas.tsx`(Transformer keepRatio 토글, 휠 핸들러 — 2-1 캔버스 줌과의 조합), `src/features/editor/SpaceBackgroundView.tsx`, `src/lib/spaceBackgroundFit.ts`(computeContainFit 신규).
- **새 테스트 파일**:
  - `tests/unit/editorStore.copy.test.ts` — 복사·붙여넣기 액션 동작, asset reference 공유 안전성(C13).
  - `tests/unit/spaceBackgroundFit.contain.test.ts` — Fit 계산.
  - `e2e/copy-paste.spec.ts` — Ctrl+C/V 흐름, input 포커스 중 가로채지 않음.
  - `e2e/fit-cover-toggle.spec.ts` — 토글 + 사이니지 좌표 보존 + PNG 출력 반영.
- **예상 리스크**: 1-3 Fit↔Cover 전환 시 사이니지 좌표 기준 **결정 필요**(audit 권장: 캔버스 absolute 유지). 사용자 테스트 후 재조정 가능.
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
- **예상 리스크**: 중. e2e 라벨 다수 다시 영향(S2에서 1차 정비하긴 했지만 S6의 재명명이 더 큼).

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
