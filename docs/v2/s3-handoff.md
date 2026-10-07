# v2-S3 핸드오프 (세션 전환용 요약)

본 문서는 다음 세션에서 v2-S3을 이어 받기 위한 상태 요약입니다. CLAUDE.md §9의 지시 우선순위
안에서 "현재까지 확정된 결정"과 "다음 세션에서 끝낼 작업"을 정리합니다.

## 1. 완료된 단계

### B — 캔버스 맞춤 (fit)

- 데스크톱 fit: `fitScale = min(containerW/docW, containerH/docH)`. 두 축을 모두 반영
  (`src/features/editor/EditorCanvas.tsx`).
- 모바일 fit: `fitScale = min(containerW/docW, 0.7 × window.innerHeight / docH)`.
  containerWidth 바운스트랩은 `window.innerWidth − 24`로 폴백해서 첫 paint부터 0이
  아닌 scale 보장.
- `.editor-canvas-wrapper`의 `align-items: flex-start`를 `stretch`로 되돌려 flex
  min-height:0 체인이 작동. workspace가 column을 늘여 shell 바깥으로 밀지 않음.
- 모바일 `@media`의 `.editor-canvas-measure`는 `flex: 0 0 auto`로 바뀌어 measure.height
  == stage.height (빈 공간 없음).
- `.editor-canvas-container` inline-style은 `size && stageWidth > 0 && stageHeight > 0`
  로 가드. 첫 paint에서 fallback 1920×1080이 뷰포트 넘김 → 수정됨.
- `.editor-empty-hint`에 `max-width: calc(100% − 1.5rem); white-space: normal;
  overflow-wrap: break-word` → 긴 CJK 안내문 wrap.
- 상태 영역 `flex: 0 0 5.5rem`로 사전 확보. 오류 토글에도 캔버스 top/height/페이지
  scrollHeight 모두 변화 0.
- `3c0b9e9`에서 임시로 넣었던 `.toolbar { overflow-x: hidden }`은 **제거**(원인
  해소되어 불필요).

### C — 접근성 정정

- 접힌 섹션 body는 DOM에 유지, `hidden` HTML 속성으로 숨김. `aria-controls`가 항상
  유효한 요소를 가리킴. `.toolbar-section-body[hidden], .toolbar-subsection-body[hidden]
  { display: none }` CSS로 UA 기본 override.
- Toolbar의 두 export 버튼에서 `aria-label`을 완전 제거. 접근성 이름 = 가시 텍스트
  (WCAG 2.5.3). 두 위치의 버튼은 **testid로 구분**:
  - 헤더: `editor-export-png-header`, `editor-export-video-header`
  - 패널: `editor-export-png-panel`, `editor-export-video-panel`
- L11: 사이니지 선택 + 「外観」 펼친 상태에서 position:fixed/absolute 요소 중 캔버스
  bbox와 겹치는 것 = 0 (Konva stage descendant + watermark badge는 제외).

### G — 짧은 뷰포트 overflow 감사

- `html, body, #root { overflow: hidden }`는 `src/styles/global.css:29`에 있고,
  `a97a0cc feat: wire the image editor into the app shell` (2026-08-05, pre-v2)에서
  처음 들어왔음. 7079e0f에도 같은 라인에 존재 — **S3 신규 regression 아님**.
- 1366×650, 1280×600: landscape/portrait × error on/off = 8조건 **전부 OK**. 캔버스/상태/
  푸터/패널 export 섹션 모두 뷰포트 안.
- 1024×640: landscape × 2, portrait × 2 = **4건 fail**. 뷰포트 폭이 너무 좁은 상태에서
  첫 paint의 fit-scale fallback(1)이 1920 Stage를 생성하면서 shell 바깥으로 overflow.
  Portrait 변형은 header/workspace pointer-events 충돌로 preset 토글 클릭 불가.
  → **H 단계**에서 EditorCanvas inline-style 가드 강화로 처리.

### 커밋 목록 (S3 전체)

| 해시 | 메시지 |
|---|---|
| `f9be679` | chore(v2-S3): e2e core script and baseline excluding visual-qa |
| `d06ecfd` | feat(v2-S3): inline appearance guide, export buttons, guide entry (2-3, 2-4, 2-6) |
| `6046224` | feat(v2-S3): fit canvas to work area, accordion panel, position/size details (2-1, 2-2, 3-1) |
| `1fd0004` | test(v2-S3): layout spec L1~L16 and toolbar export aria-label disambiguation |
| `3c0b9e9` | fix(v2-S3): height-aware canvas fit, hidden accordion bodies, testid-based export buttons |
| `28c6040` | fix(v2-S3): mobile fit formula, L2 overflow origin, hidden-attr accordion |
| `bd46493` | test(v2-S3): short-height desktop viewport probe (G 1366×650 / 1280×600 / 1024×640) |

## 2. 남은 단계 (다음 세션)

- **H**: 1024×640 fail 수정 — (a)안 채택(결정 §3). EditorCanvas inline-style 가드를
  `size && containerWidth > 0 && containerHeight > 0 && stageWidth > 0 && stageHeight > 0`
  로 더 엄격히. 1024에서 initial render container=0 → ResizeObserver 측정 후 fit.
  v2-layout의 G 조건 4개 재측정으로 확정.
- **D**:
  1. L5 측정 (아래 결정에 따라 UI 값으로). 1920×1080과 1280×720에서 drag/resize/
     perspective/click 각각 수행 후 캔버스 X座標·Y座標·幅·高さ input의 value를
     기대값과 비교 (오차 ≤ 1 캔버스 px).
  2. 7079e0f core에서 통과했고 HEAD에서 실패하는 19건을 테스트별로 분류
     (T-sed / T-acc / T-coord / R). 실패 메시지 첫 줄 + 원인 파일:라인 명시.
  3. 각 테스트를 하나씩 수정 (sed 금지, 어서션 유지).
  4. F-download 모바일 4건을 새 레이아웃 흐름에 맞게 재작성.
- **E**:
  - L4: 1920×1080과 1280×720에서 PNG 2개 export → 바이트/SHA-256 비교.
  - L15: 원근 모드에서 幅/高さ disabled + 안내 문구. 「位置・サイズ」 열림·접힘 양쪽
    확인.
  - L17: v2-content-order / v2-errors-upload / v2-watermark / v2-layout 각 spec의
    통과/전체 수 기록.
- **F**: `docs/v2/requirements.md` (2-1~2-6, 3-1 상태 ✅ 반영), `docs/v2/baseline.md`
  (최종 실패 목록 7e row 추가), `docs/v2/sprint-plan.md` 갱신.
- **전체 검사**: `typecheck / lint / format:check / test:run / build / build:oitemiru /
  test:e2e:core` 전부 통과 확인. 통과 수 식 `88 + 해소한 debt + 새로 추가한 테스트 수`
  가 성립해야 함.

## 3. 확정된 결정

이번 세션 사용자 결정으로 확정, 다음 세션에서도 그대로 적용:

1. **모바일 fit 비율 0.7 유지.** 390×844 landscape에서 canvas h=206으로 작아 보이지만
   유지. 변경 금지.
2. **1024×640 fail 수정은 (a)안 채택.** EditorCanvas inline-style 가드 강화 — 모든
   데스크톱 뷰포트에서 fit-scale 측정 전 Stage=0으로 둬서 initial render가 뷰포트를
   밀어내지 않게 함. mobile breakpoint 상향(b)·세로 스크롤 허용(c)은 선택 안 됨.
3. **L5 측정은 UI 값으로.** `window.__editorStore` 디버그 export는 추가하지 않음.
   X座標 / Y座標 / 幅 / 高さ 입력의 value를 기대값과 비교.
4. **sed 등 일괄 치환 금지.** 테스트는 하나씩 열어 의도를 확인하고 수정한다.
   어서션 약화·skip·삭제도 금지.
5. **기준값 7079e0f core 113 / 88 / 25 확정.** 사용자 측 초기 기대 114 total은
   off-by-one(실제로는 113)으로 결론. baseline.md 7d row는 다음 세션의 F 단계에서
   S3 최종 수치로 갱신(최소한 7079e0f = 113/88/25는 유지).

## 4. 현재 실패 44건과 7079e0f 대비 결과

**7079e0f core 25 fail** (전부 "pre-S3 debt"):
- `portable.spec.ts` 14건 (B1/B2 전부)
- `reselection.spec.ts :: a custom portable product is reselectable after being deselected` (B1)
- `mobile.spec.ts` 7건 (F-download 4 + B1/B2 2 + F-occlusion 1)
- `occlusion-mask.spec.ts` 3건 (F-occlusion)

**HEAD core 44 fail** 분류 (대부분 "추정" — D-3에서 각 테스트 실패 메시지로 확정 필요):

### Pre-S3 debt (25건, 7079e0f에서도 실패)

| 테스트 전체 이름 | 7079e0f | HEAD | 원인 분류 (초안) |
|---|---|---|---|
| `portable.spec.ts :: walks the photo and drag-to-draw region steps to add a portable product, then re-edits its region` | fail | fail | B2 debt |
| `portable.spec.ts :: replaces a portable product photo, resetting its screen region, and undo restores the original photo` | fail | fail | B1 debt |
| `portable.spec.ts :: rejects a screen region smaller than the minimum size and keeps the dialog open` | fail | fail | B1 debt |
| `portable.spec.ts :: cancelling the builder does not add a portable object` | fail | fail | B2 debt |
| `portable.spec.ts :: undo removes an added portable product and redo restores it` | fail | fail | B1 debt |
| `portable.spec.ts :: applies content and material to a portable product; export is clipped to its screen region and defaults to LCD` | fail | fail | B1 debt |
| `portable.spec.ts :: dragging inside the region moves it, and Save creates exactly one history entry on top of creation` | fail | fail | B1 debt |
| `portable.spec.ts :: dragging the se corner handle resizes while keeping the nw corner fixed` | fail | fail | B1 debt |
| `portable.spec.ts :: dragging a corner past the opposite one clamps at the minimum size instead of inverting or erroring` | fail | fail | B1 debt |
| `portable.spec.ts :: cancelling after a drag discards the draft and creates no history entry` | fail | fail | B1 debt |
| `portable.spec.ts :: saving an unchanged region creates no history entry` | fail | fail | B1 debt |
| `portable.spec.ts :: a transparent product photo alpha-composites over the space background, while its opaque area and the clipped content still render normally` | fail | fail | B1 debt |
| `portable.spec.ts :: the default LCD material renders a visible highlight overlay on the screen region` | fail | fail | B1 debt |
| `portable.spec.ts :: exports a portable product on a portrait canvas at its 1080x1920 resolution` | fail | fail | B1 debt |
| `reselection.spec.ts :: a custom portable product is reselectable after being deselected` | fail | fail | B1 debt |
| `mobile.spec.ts :: full mobile content and export workflow at 390x844 (LED)` | fail | fail | F-download |
| `mobile.spec.ts :: mobile smoke: LCD content and export at a portrait 1080x1920 space photo, 390x844` | fail | fail | F-download |
| `mobile.spec.ts :: mobile smoke: a real-photo-style scene renders, exports a PNG, and introduces no horizontal overflow at 390x844` | fail | fail | F-download |
| `mobile.spec.ts :: mobile: adds a transparent LED display and blends more of the space background as transparency rises, at 390x844` | fail | fail | F-download |
| `mobile.spec.ts :: mobile: adds a custom portable product with a screen region and exports it at 390x844` | fail | fail | B2 |
| `mobile.spec.ts :: mobile: dragging the portable screen region moves and resizes it at 390x844` | fail | fail | B1 |
| `mobile.spec.ts :: mobile: draws a foreground occlusion mask via tap-to-add points at 390x844` | fail | fail | F-occlusion |
| `occlusion-mask.spec.ts :: a foreground occlusion mask restores the space photo over the masked screen area` | fail | fail | F-occlusion |
| `occlusion-mask.spec.ts :: a too-small mask draft is rejected and the apply button stays disabled` | fail | fail | F-occlusion |
| `occlusion-mask.spec.ts :: canceling a mask edit discards the draft without changing the object` | fail | fail | F-occlusion |

### S3 신규 (19건, 7079e0f에서는 통과했음)

| 테스트 전체 이름 | 7079e0f | HEAD | 원인 분류 (초안) |
|---|---|---|---|
| `canvas-drag-drop.spec.ts :: dropping onto a rotated display screen region still hits it correctly` | pass | fail | T-coord 추정 |
| `canvas-drag-drop.spec.ts :: dropping onto the topmost of two overlapping displays assigns content only to that one` | pass | fail | T-coord 추정 |
| `content-material.spec.ts :: a newly added LED display has its contact shadow enabled by default and it renders in the export` | pass | fail | T-sed/T-acc 추정 |
| `content-material.spec.ts :: adds an LED display defaulting to led material` | pass | fail | T-acc 추정 (Appearance 접힘) |
| `content-material.spec.ts :: adds an LCD display defaulting to LCD material` | pass | fail | T-acc 추정 |
| `content-material.spec.ts :: cover-fit display content is clipped to the screen region and never spills onto the bezel` | pass | fail | T-sed 추정 (export 흐름) |
| `content-material.spec.ts :: rendering presets update the material sliders and the export brightness together` | pass | fail | T-acc + T-sed 추정 |
| `content-material.spec.ts :: uploads a generated video clip into a display and shows the autoplay/loop/mute hint` | pass | fail | T-sed 추정 |
| `environment-sampling.spec.ts :: sampling the space photo tints the screen toward its ambient color as strength rises` | pass | fail | T-sed/T-acc 추정 |
| `glow-halo.spec.ts :: the material glow halo bleeds past the screen edge into the bezel` | pass | fail | T-sed 추정 (export) |
| `mobile.spec.ts :: mobile: an LED display is reselectable by tap after being deselected at 390x844` | pass* | fail | T-coord 추정. (*) 이 테스트는 S2 보완에서 추가됐으므로 7079e0f에 포함되는지 확인 필요 — 다음 세션 체크 |
| `perspective-video.spec.ts :: adding a transparent LED display lets more of the space background show through as transparency increases` | pass | fail | T-sed/T-coord 추정 |
| `perspective-video.spec.ts :: hit-testing follows the perspective object's warped quad, overlapping topmost wins, and clicking inside the original flat rect but outside the quad does nothing` | pass | fail | T-coord 추정 (fit 변경 영향) |
| `reselection.spec.ts :: an LED display is reselectable after being deselected` | pass | fail | T-coord 추정 |
| `reselection.spec.ts :: an LCD display is reselectable after being deselected` | pass | fail | T-coord 추정 |
| `reselection.spec.ts :: a display carrying uploaded image content is reselectable after being deselected` | pass | fail | T-coord 추정 |
| `reselection.spec.ts :: clicking the topmost of two overlapping objects selects it, not the one beneath` | pass | fail | T-coord 추정 |
| `reselection.spec.ts :: dragging an unselected display selects it and moves it in a single gesture` | pass | fail | T-coord 추정 |
| `screen-reflection.spec.ts :: a window-mounted display casts a faint reflection below itself` | pass | fail | T-sed 추정 (export 흐름) |

주의: 위 **원인 분류는 추정이며 다음 세션 D-3에서 실패 메시지 첫 줄과 코드:라인으로
확정**해야 한다. T-coord 그룹은 L5 측정 결과(기대·실제 좌표 오차)로 (R) 여부를
먼저 가름.

## 5. 새로 추가한 헬퍼

- **`e2e/support/accordion.ts`** (존재, S3에서 추가):
  - `openSection(page, id)` — 상위 아코디언 섹션이 접혀 있으면 토글. 사용 가능 id:
    `space`, `add-signage`, `selected`, `content`, `appearance`. `export`는
    `always`-mode라 토글이 없다.
  - `openSubsection(page, id)` — 서브-아코디언. 현재 유일한 id는
    `selected-position-size`.
- **좌표 헬퍼** — **아직 작성 전**. D 단계에서 Stage 실제 bbox를 기준으로 doc 좌표를
  계산하는 헬퍼 함수(예: `e2e/support/stageCoords.ts`에 `pagePointForDoc(page, docPoint)`
  / `docPointForPage(page, pagePoint)`)를 신설할 것. 지금은 각 e2e 안에서 ad-hoc으로
  `.editor-canvas-container`의 `getBoundingClientRect()`를 쓰고 있어 wrapper bbox가
  바뀌면 그대로 drift.

---

## 전체 상태 체크

- 모든 S3 변경은 커밋 완료, 작업 트리 clean.
- 태그 없음. push 금지 유지. 다음 세션에서 H → D → E → F → 전체 검사 → 최종 보고
  순서로 진행 후, 사용자 검수 통과 시에만 `v2-S3-ok` 태그 작업 지시 가능.
