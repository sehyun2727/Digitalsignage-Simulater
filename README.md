# Signage Canvas (Digital Signage Simulator)

> 브라우저에서 간단한 디지털 사이니지 화면을 구성하고 이미지로 내보내기 위한 독립 개인 프로젝트입니다.
> **Working title:** Signage Canvas / Digital Signage Simulator

## 서비스 요약

- **日本語:** ブラウザ上でシンプルなデジタルサイネージ画面を作成し、画像として書き出すための個人プロジェクトです。
- **English:** An independent personal project for creating simple digital-signage compositions in the browser and exporting them as images.

> Signage Canvas는 공식 HULL 서비스가 아니며 HULL과 제휴·후원·운영 관계가 없습니다. HULL은 외부 CTA로만 표시됩니다.
> CTA 링크: https://hull-inc.jp/ (Sprint 4.2부터 — 이전에는 https://hull-inc.jp/contact 였습니다)

## 상태

**현재 상태: Sprint 4.3 완료 — Sprint 0~4.3이 통합되어 배포 가능한 상태입니다 (Sprint 3.2: 캔버스 객체 재선택 결함 수정, Sprint 4.1: 통합 툴바 에디터 UI, Sprint 4.2: 사진 우선(photo-first) 문서 모델·LED/LCD/透過LED/포터블 4종 신호기·곡률(curvature) 제어, Sprint 4.3: 4점 원근 배치·환경 통합(그림자/톤 블렌딩)·동영상 콘텐츠 및 내보내기 포함)**

Sprint 0에서 구현된 것:

- Vite + React + TypeScript 앱 골격
- 일본어 기본, 한국어·영어 i18n 구조 및 언어 전환
- 독립 서비스 고지 및 HULL 외부 CTA 링크
- Vitest + React Testing Library 단위/컴포넌트 테스트
- Playwright 스모크 테스트
- ESLint, Prettier, TypeScript strict 모드
- GitHub Actions CI (format/lint/typecheck/test/build/docker build)
- 프로덕션용 멀티스테이지 Dockerfile (Nginx, SPA fallback)
- Render Static Site 배포 문서

Sprint 1에서 구현된 것:

- Konva/react-konva 기반 캔버스 에디터 (`wall-led` 1920×1080, `stand-display` 1080×1920 템플릿)
- 텍스트 요소 추가/편집(내용, 폰트 크기, 색상, 정렬), 이미지 요소 추가, 배경색 편집
- 선택, 드래그 이동, Transformer를 통한 크기 조절·회전, 속성 패널을 통한 수치 입력
- 실행 취소/다시 실행 (값이 실제로 바뀐 커밋만 히스토리에 쌓임 — no-op 커밋은 무시)
- 키보드 단축키: `Delete`/`Backspace`(선택 삭제), `Ctrl/Cmd+Z`(실행 취소), `Ctrl/Cmd+Shift+Z` 또는 `Ctrl/Cmd+Y`(다시 실행). 입력 필드(input/textarea/select/contenteditable)에 포커스가 있을 때는 이 단축키들이 전역으로 발동하지 않습니다.
- PNG 내보내기 — 화면 확대/축소와 무관하게 항상 템플릿 원본 해상도(1920×1080 / 1080×1920)로 내보내며, 선택 UI(Transformer 테두리·핸들)는 내보낸 이미지에 절대 포함되지 않습니다.
- 이미지 업로드 검증: 허용 MIME 타입(`image/png`, `image/jpeg`, `image/webp`) 및 10MB 크기 제한, 디코딩 실패(손상된 파일·MIME 스푸핑) 시 접근성 있는 오류 안내와 Object URL 정리
- EXIF Orientation은 브라우저(`Image()`)의 기본 디코딩 동작을 그대로 사용 — 별도 라이브러리를 추가하지 않았습니다.
- 모바일 대응: 캔버스 영역에 `touch-action: none`을 적용해 드래그/리사이즈/회전 제스처가 페이지 스크롤/줌으로 가로채이지 않도록 함

Sprint 1에서 구현되지 않은 것 (범위 밖):

- 비디오 삽입/내보내기 (별도 기술 스파이크 필요)
- 계정, 서버 업로드, 결제, 분석, 워터마크
- 캔버스 밖으로 벗어난 요소 위치를 자동으로 제한(clamp)하는 기능

Sprint 2에서 구현된 것:

- **공간 배경 사진**: 캔버스 전체를 덮는 배경 사진을 추가/삭제할 수 있습니다(`editorAddSpaceBackgroundButton`/
  `editorRemoveSpaceBackgroundButton`). 템플릿을 전환하면 공간 배경은 초기화됩니다.
- **디스플레이 객체 배치**: 벽걸이형 LED(`wall-led`, 기본 소재: 屋外LED)와 스탠드형 디스플레이(`stand-display`,
  기본 소재: LCD)를 캔버스에 배치할 수 있습니다. 각 디스플레이는 베젤/스탠드 등 단순화된 프레임 장식과, 프레임별로
  정의된 화면 영역(screen region)을 가집니다.
- **화면 콘텐츠**: 디스플레이의 화면 영역에 이미지를 업로드해 표시할 수 있습니다. 표시 방식(전체 표시 Contain /
  화면 채우기 Cover), 위치 오프셋(X/Y), 확대율을 조절할 수 있으며, 언제든 기본값으로 리셋하거나 콘텐츠를
  교체·삭제할 수 있습니다. 콘텐츠는 화면 영역 밖(베젤 위)으로 절대 넘치지 않도록 캔버스 클리핑으로 강제됩니다.
- **디스플레이 소재(재질) 프리셋**: 屋外LED/LCD 중 소재를 선택할 수 있고, 질감 강도(intensity)와 밝기
  (brightness) 슬라이더로 시각적 프리뷰를 조절할 수 있습니다. 이는 순수하게 시각적인 참고 표현이며 실제 제품
  성능을 보장하지 않는다는 안내 문구가 항상 함께 표시됩니다(자세한 배경은
  [`docs/adr/0003-content-and-material-model.md`](docs/adr/0003-content-and-material-model.md) 참고).
- **PNG 내보내기 확장**: 공간 배경, 디스플레이 프레임, 클리핑된 화면 콘텐츠, 소재 프리뷰가 모두 정확한 템플릿
  해상도로 내보내기에 반영되며, Sprint 1과 동일하게 선택 UI는 내보낸 이미지에 포함되지 않습니다.
- **에셋 수명 주기**: 업로드된 이미지(공간 배경/화면 콘텐츠)는 런타임 에셋 레지스트리에 등록되고, 문서 상태와
  실행 취소/다시 실행 히스토리 전체에서 더 이상 참조되지 않을 때 자동으로 정리(Object URL 해제)됩니다.

Sprint 2에서 구현되지 않은 것 (범위 밖):

- 실제 제품과 유사한 프레임/소재 아트 — 현재는 단순화된 사각형 베젤과 시각적 프리뷰 오버레이입니다.
- 디스플레이당 다중 콘텐츠 슬롯, 플레이리스트, 동영상 콘텐츠.
- 모바일 뷰포트 전용 e2e 테스트(수동 반응형 확인만 수행).

Sprint 3에서 구현된 것:

- **사용자 지정 포터블 제품**: 키오스크, 태블릿 스탠드, 차량 등 사용자가 보유한 제품 사진을 업로드해 캔버스에
  배치할 수 있습니다(`ポータブル製品を追加` 버튼 → `PortableBuilderModal`). 사진 업로드 → 화면 영역 지정 →
  추가의 3단계 마법사이며, 첫 단계는 앱 최초의 모달/다이얼로그로 포커스 트랩·Esc 닫기·닫은 후 포커스
  복원·배경 스크롤 잠금을 자체 구현했습니다.
- **화면 영역 지정**: 제품 사진 위에서 드래그로 직사각형을 그리거나, 기존 영역 안쪽을 드래그해 이동하거나,
  네 모서리 핸들을 드래그해 반대쪽 모서리를 고정한 채 크기를 조절하거나, x/y/폭/높이를 숫자로 직접 입력해
  화면 영역(0-1로 정규화된 사각형)을 지정합니다. 모든 드래그 상호작용은 Pointer Events 기반이라 마우스와
  터치 모두에서 동일하게 동작하며, `background-size: contain`으로 인해 레터박스가 생기는 4:3 비율이 아닌
  사진에서도 좌표가 정확히 매핑됩니다. 모서리 드래그가 반대쪽 모서리를 넘어가면 뒤집히거나 오류가 나는 대신
  드래그 도중 실시간으로 사진 가로/세로 각각의 5%(최소 크기)에서 멈춥니다. 반면 숫자 입력으로 5% 미만을
  지정하면 접근성 있는 오류로 거부됩니다(자동 보정하지 않음). 사진을 처음 업로드하면 가운데 60%×60%의
  기본 영역이 미리 채워집니다. 드래그 도중에는 실행 취소/다시 실행 히스토리에 아무것도 기록되지 않으며,
  저장을 눌러 실제로 값이 바뀐 경우에만 정확히 한 개의 히스토리 항목이 생성됩니다.
- **화면 영역 재편집**: 배치된 포터블 객체는 속성 패널의 `画面領域を編集` 버튼으로 화면 영역만 다시 편집할 수
  있습니다(사진 교체는 범위 밖 — 자세한 배경은
  [`docs/adr/0004-custom-portable-template.md`](docs/adr/0004-custom-portable-template.md) 참고).
- **가로세로 비율 고정**: 포터블 객체는 제품 사진의 원본 가로세로 비율로 항상 고정된 채로 이동·크기 조절(모서리
  핸들만)·회전할 수 있습니다. 이 덕분에 화면 영역(사진 비율의 일부)을 객체의 현재 크기에 별도의 좌표 변환 없이
  직접 매핑할 수 있습니다.
- **콘텐츠/소재 재사용**: Sprint 2의 화면 콘텐츠(Contain/Cover, 오프셋, 확대율)와 소재(屋外LED/LCD, 질감 강도,
  밝기) 시스템을 포터블 제품의 화면 영역에 그대로 적용합니다. 새 포터블 객체는 기본적으로 LCD 소재이며
  콘텐츠는 비어 있습니다.
- **투명 배경 안내**: 업로드한 사진에서 투명도(alpha)를 감지해 배경이 있는 사진보다 투명 PNG/WebP가 더
  자연스럽게 합성된다는 안내 문구를 표시합니다 — 실제 배경 제거/마스킹은 수행하지 않는 순수 안내용입니다.
- **PNG 내보내기 확장**: 포터블 제품의 사진과 화면 영역에 클리핑된 콘텐츠/소재가 정확한 템플릿 해상도로
  내보내기에 반영됩니다.

Sprint 3에서 구현되지 않은 것 (범위 밖):

- 원근/4점/다각형 화면 영역 — 화면 영역은 항상 축에 정렬된 직사각형입니다.
- 여러 각도의 제품 사진 생성, 배경 제거(자동/수동), 다중 화면 영역.
- 포터블 객체 생성 후 사진 교체(제품 사진 크롭/재편집 에디터) — 다른 사진을 쓰려면 객체를 삭제하고 새로
  추가해야 합니다.

Sprint 3.1에서 구현된 것 (Sprint 3의 화면 영역 상호작용/내보내기 검증 보강):

- **화면 영역 직접 이동/크기 조절**: 위 "화면 영역 지정" 항목에 설명된 대로, 기존 영역 박스를 드래그해 이동하고
  모서리 핸들을 드래그해 크기를 조절하는 기능을 새로 연결했습니다(관련 지오메트리 함수는 Sprint 3에서 이미
  단위 테스트로 검증되어 있었으나 UI에는 연결되어 있지 않았습니다 — 자세한 배경은
  [`docs/adr/0004-custom-portable-template.md`](docs/adr/0004-custom-portable-template.md) 참고).
- **내보내기 합성 픽셀 단위 검증**: 투명/불투명 제품 사진, 벽걸이(1920×1080)/스탠드형(1080×1920) 두 템플릿,
  화면 영역 편집 전/후(실행 취소/다시 실행 포함) 조합을 실제 Chromium(Playwright)에서 내보낸 PNG의 실제
  픽셀을 샘플링해 검증합니다(`e2e/portable.spec.ts`).
- **에셋 수명 주기 및 히스토리 검증 보강**: 빌더를 취소했을 때 아직 문서에 커밋되지 않은 업로드 사진의
  Object URL이 즉시 해제되는지(`tests/unit/App.test.tsx`), 포터블 객체를 삭제·실행 취소·다시 실행해도
  히스토리에서 참조되는 동안 에셋이 유지되는지(`tests/unit/editorStore.test.ts`)를 검증합니다.
- **모바일 터치 뷰포트 검증**: 390×844 뷰포트에서 화면 영역 이동/크기 조절 드래그가 정상 동작하는지 확인하는
  e2e 테스트를 추가했습니다(`e2e/mobile.spec.ts`). Chromium의 터치 뷰포트 에뮬레이션을 사용하며 실제 기기
  검증은 아닙니다.

Sprint 3.2에서 구현된 것 (캔버스 객체 재선택 결함 수정 — P0 핫픽스):

- **재선택 불가 버그 수정**: 벽걸이 디스플레이, 스탠드형 디스플레이, 포터블 제품 객체를 선택 해제(빈 캔버스
  클릭, 실행 취소/다시 실행)한 뒤 다시 클릭해도 선택되지 않던 문제를 수정했습니다. 원인은 각 객체를 감싸는
  Konva `<Group>` 내부의 모든 하위 도형이 `listening={false}`로 설정되어 있어 클릭 이벤트가 Group까지
  버블링되지 않았기 때문입니다. 각 Group의 첫 번째 자식으로 보이지 않는 히트 영역 `Rect`
  (`fill="transparent"`, `listening`, 객체 전체 크기)를 추가해 해결했습니다. 투명 배경 제품 사진도 실제
  알파 채널이 아닌 객체의 전체 직사각형 영역을 히트 대상으로 사용합니다(알파 인식 히트 테스트는 범위 밖).
  자세한 배경은 [`docs/adr/0005-canvas-object-reselection-hotfix.md`](docs/adr/0005-canvas-object-reselection-hotfix.md)
  참고.
- **드래그 중 위치 튐 현상 수정**: 선택되지 않은 객체를 드래그로 이동할 때 선택 처리를 드래그 시작이 아닌
  드래그 종료 시점으로 옮겨, 드래그 도중 스토어 상태 갱신으로 인해 이동 위치가 시작점으로 되돌아가던 문제를
  함께 수정했습니다.
- **회귀 테스트 보강**: `tests/unit/canvasHitArea.test.tsx`(히트 영역 단위 테스트), `e2e/reselection.spec.ts`
  (재선택·겹친 객체·드래그 선택·실행 취소/다시 실행 시나리오, 실제 Chromium), `e2e/mobile.spec.ts`(모바일
  탭 재선택 시나리오)를 추가했습니다.

Sprint 4.1에서 구현된 것 (통합 툴바 에디터 UI):

- **단일 통합 툴바**: 기존에 시도했던 5단계 가이드 플로우(공간 → 신호기 → 콘텐츠 → 효과 → 내보내기, 단계별
  마운트/언마운트 패널)는 병합 전에 반려되어 완전히 제거되었습니다. 대신 화면 우측에 항상 표시되는 하나의
  툴바가 고정된 순서의 6개 섹션 — 공간, 신호기 추가, 선택된 신호기, 콘텐츠, 외관, 내보내기 — 을 동시에
  보여줍니다. 모든 컨트롤이 항상 접근 가능하며, "지금 어떤 단계에 있는지"라는 개념 자체가 없습니다. 자세한
  배경(반려된 대안 포함)은
  [`docs/adr/0006-guided-editor-sprint-4-1.md`](docs/adr/0006-guided-editor-sprint-4-1.md) 참고.
- **헤더 / 워크스페이스 / 상태 바 레이아웃**: 상단 헤더(제품명, 실행 취소, 다시 실행, 간이 비교 토글, 언어
  선택, 내보내기), 캔버스와 툴바가 나란히 놓인 워크스페이스, 하단의 간결한 상태 바로 구성됩니다. 접근성
  이름 중복을 피하기 위해 실행 취소/다시 실행/내보내기는 헤더에만, 삭제는 툴바의 "선택된 신호기" 섹션에만,
  결과/오리지널 비교 토글(고정 라벨)은 툴바의 "내보내기" 섹션에만 존재하도록 엄격히 분리했습니다. 헤더의
  간이 비교 버튼은 같은 상태를 제어하지만 라벨이 서로 다른 별도의 컨트롤입니다.
- **원본/결과 비교 토글**: 편집 결과 대신 업로드한 공간 사진만 보여주는 토글을 추가했습니다. 별도의
  내보내기나 두 번째 캔버스 없이, 기존 캔버스에서 신호기 객체·Transformer·드래그 앤 드롭 렌더링만
  일시적으로 억제하는 방식으로 구현했습니다. 내보내기는 화면에 오리지널 뷰가 표시된 상태여도 항상 합성된
  결과물을 내보냅니다.
- **비차단(non-blocking) 첫 방문 온보딩 카드**: 통합 툴바를 처음 한 번만 소개하는 작은 카드를 추가했습니다.
  모달이 아닌 `role="note"` 카드로, 배경 잠금·포커스 트랩·Escape 닫기가 없어 카드가 떠 있는 동안에도 모든
  툴바·캔버스 컨트롤을 그대로 사용할 수 있습니다. 닫힘 여부는 `localStorage`에 저장되어 이후 방문에서는
  다시 표시되지 않습니다.
- **HULL CTA 위치 변경**: 문서 하단 각주에 있던 HULL 문의 링크를 화면 우측 하단에 고정된 녹색 버튼으로
  옮겼습니다. 링크의 URL·`target`·`rel`·접근성 이름은 변경하지 않았습니다.
- **모바일 뷰포트 대응 개선**: `100dvh`(동적 뷰포트 높이) 지원 브라우저에서 모바일 주소창 표시/숨김에 따른
  레이아웃 잘림을 방지하도록 `100vh` 대체값과 함께 적용했습니다. 이번 스프린트에서 추가로, 헤더 액션 영역과
  신호기 추가 버튼 그리드가 좁은 화면(390px)에서 가로 스크롤을 유발하던 두 가지 결함과, 세로로 긴 템플릿
  선택 시 캔버스가 헤더 영역까지 겹쳐 보이던 결함을 수정했습니다.

Sprint 4.2에서 구현된 것 (사진 우선 문서 모델 및 소재/곡률 확장):

- **사진 우선(photo-first) 문서 모델**: 더 이상 문서 템플릿을 먼저 선택하지 않습니다. 처음 업로드한 공간
  사진이 그 자체로 문서가 되어, 사진의 방향 보정된 가로세로 비율 그대로(늘이거나 자르지 않고) 캔버스 크기와
  PNG 내보내기 해상도를 결정합니다. 공간 사진이 없으면 문서 자체가 없는 상태이며, 신호기 추가 버튼은 모두
  비활성화되어 사진을 먼저 추가하도록 안내합니다. 자세한 배경은
  [`docs/adr/0007-photo-first-document-and-materials-sprint-4-2.md`](docs/adr/0007-photo-first-document-and-materials-sprint-4-2.md)
  참고.
- **디코딩 픽셀 안전 한도**: 매우 큰 사진을 업로드해도 디코딩 픽셀 수가 4,000만 픽셀(`MAX_DECODED_PIXELS`)을
  넘지 않도록, 가로세로 비율을 유지한 채 동일한 배율로 결정론적으로 축소합니다.
- **공간 사진 교체/삭제**: 공간 사진을 다른 사진으로 교체하거나 삭제할 수 있으며, 각각 실행 취소/다시 실행
  히스토리에 정확히 한 개의 항목만 남깁니다. 교체 시 기존에 배치된 신호기 객체들의 위치·크기는 새 문서
  크기에 비례하도록 자동으로 재배치됩니다(절대 좌표가 아닌 문서 대비 비율 기준).
- **4종 신호기 패밀리**: LED, LCD, 透過(투과)LED 디스플레이와 기존의 사용자 지정 포터블 제품을 각각 독립된
  버튼으로 추가합니다. 문서 크기(=공간 사진 해상도)와 완전히 분리되어 있어, 어떤 신호기를 선택해도 배치
  가능한 위치와 크기는 동일한 로직을 따릅니다.
- **소재 옵션 확장**: 질감 강도(intensity)·밝기(brightness) 2개뿐이던 소재 조절 슬라이더가 투과율
  (transparency, 透過LED 전용)·그리드 밀도(gridDensity)·발광(glow)·대비(contrast)까지 6개로 늘었습니다.
  소재별로 실제 적용되는 슬라이더만 외관 섹션에 표시됩니다(예: LCD는 그리드/발광 슬라이더가 없음).
- **곡률(curvature) 제어**: LED와 透過LED 소재에 한해 평면(flat)/오목(concave)/볼록(convex) + 정도(0-100)
  슬라이더를 제공합니다. 화면 영역을 여러 개의 세로 스트립으로 나누고 각 스트립을 포물선 형태로 상하
  변위시키는 2차원 근사 표현이며, 실제 3D·원근 렌더링이 아닙니다(자세한 배경은 위 ADR 0007 참고).
- **HULL CTA 링크 변경**: 문의 링크가 `https://hull-inc.jp/contact`에서 `https://hull-inc.jp/`로 변경되었고,
  버튼 문구도 3개 언어 모두 갱신되었습니다. 화면 우측 하단 고정 녹색 버튼이라는 위치/방식은 Sprint 4.1과
  동일합니다.
- **PNG 파일명 단순화**: 더 이상 템플릿 ID가 없으므로 파일명에서 해당 구간이 사라졌습니다 —
  `signage-canvas_{yyyyMMdd-HHmmss}.png`.

Sprint 4.2에서 구현되지 않은 것 (범위 밖):

- 진짜 3D·원근 기반 곡률 렌더링 — 현재는 2차원 스트립 변위 근사입니다.
- 문서(공간 사진·신호기 배치)의 서버 또는 `localStorage` 영속화 — 새로고침하면 편집 내용이 초기화됩니다
  (Sprint 1부터 유지된 정책, 변경 없음).
- 신호기 프레임(베젤/스탠드) 형상 자체의 확장 — 기존 단순화된 사각형 베젤 표현을 그대로 사용합니다.

Sprint 4.3에서 구현된 것 (4점 원근 배치, 환경 통합, 동영상):

- **4점 원근(perspective) 배치**: 디스플레이·포터블 제품을 "空間に合わせて配置（パース）" 버튼으로 임의의
  사각형(원근) 영역에 맞춰 배치할 수 있습니다. 네 모서리를 드래그하거나 숫자(X/Y좌표) 입력으로 정밀하게
  조정하며, 자기교차·오목·화면 밖·최소 크기 미만 등의 잘못된 사각형은 적용(適用) 버튼이 비활성화되고
  접근성 있는 오류 메시지로 안내됩니다. 원근 모드에서도 선택·드래그·크기 조절은 항상 객체의 원래 사각형
  기준으로 동작하며(시각적으로 왜곡된 사각형 자체를 클릭 대상으로 삼지 않음), "通常配置に戻す" 버튼으로
  언제든 일반 사각형 배치로 되돌릴 수 있습니다. 자세한 배경은
  [`docs/adr/0008-perspective-environment-and-video-sprint-4-3.md`](docs/adr/0008-perspective-environment-and-video-sprint-4-3.md)
  참고.
- **환경 통합(그림자·톤 블렌딩)**: 신호기가 실제로 촬영된 장소에 설치된 것처럼 보이도록, 실루엣 형태의
  접지 그림자(강도·흐림·오프셋 조절)와 배경 사진의 톤에 맞춰 채도/대비/하이라이트를 낮추는 블렌딩 강도를
  각각 선택적으로 켤 수 있습니다. 두 기능 모두 순수 시각 효과이며 원본 공간 사진 자체는 절대 변경하지
  않습니다.
- **동영상 콘텐츠 및 내보내기**: 디스플레이·포터블 제품의 화면 콘텐츠로 정지 이미지 대신 동영상 파일을
  업로드할 수 있습니다(자동 재생·반복 재생·음소거 고정, 별도 재생 컨트롤 없음). 브라우저가 지원하는 경우
  "動画で書き出す" 버튼으로 캔버스를 그대로 녹화해 WebM 동영상으로 내보낼 수 있으며(서버 업로드 없이 전부
  브라우저 내부에서 처리), 지원하지 않는 브라우저(예: 현재 Safari)에서는 버튼 자체가 나타나지 않고 대신
  안내 문구가 표시됩니다. PNG 내보내기는 동영상 콘텐츠가 있어도 캔버스의 현재 프레임을 그대로 내보내는
  기존 동작을 유지합니다.

Sprint 4.3에서 구현되지 않은 것 (범위 밖):

- 원근 모드의 클릭 판정은 항상 객체의 원래 사각형 기준입니다 — 시각적으로 왜곡된 사각형 형태 자체를
  클릭 히트 영역으로 사용하지 않습니다(자세한 배경은 위 ADR 0008 참고).
- 동영상 재생 컨트롤(재생/정지/탐색) — 항상 자동 재생·반복·음소거로만 표시됩니다.
- 디스플레이·포터블 제품당 다중 콘텐츠 슬롯이나 재생목록 — 화면 콘텐츠는 이미지 또는 동영상 1개뿐입니다.
- 동영상 트랜스코딩·화질/비트레이트 조절 — 브라우저의 `MediaRecorder` 기본 인코딩을 그대로 사용합니다.

## 기술 스택

- React 19 + TypeScript + Vite
- Konva / react-konva (캔버스 렌더링, 선택/변형, PNG 내보내기)
- Zustand (에디터 문서 상태, 실행 취소/다시 실행 히스토리)
- Vitest + React Testing Library, Playwright(Chromium)
- ESLint + Prettier
- GitHub Actions, Docker(Nginx), Render Static Site

## Requirements

- Node.js 22.x
- npm

## 설치 및 로컬 실행

```bash
git clone https://github.com/sehyun2727/Digitalsignage-Simulater.git
cd Digitalsignage-Simulater
npm ci
npm run dev
```

브라우저에서 Vite가 안내하는 로컬 주소(기본값 `http://localhost:5173`)를 엽니다.

## Scripts

```bash
npm run dev            # 개발 서버
npm run build           # 프로덕션 빌드 (dist/)
npm run preview         # 빌드 결과 미리보기
npm run lint             # ESLint
npm run format           # Prettier로 포맷팅
npm run format:check     # Prettier 검사만 수행
npm run typecheck        # TypeScript 검사
npm run test              # Vitest (watch)
npm run test:run          # Vitest (단일 실행, CI에서 사용)
npm run test:e2e          # Playwright e2e 테스트 (실제 Chromium — smoke, 에디터, 이미지 업로드, 공간 배경/디스플레이 콘텐츠·소재, 포터블 제품, 4점 원근 배치/透過LED/동영상, 모바일 뷰포트, 온보딩/비교 토글, 재선택)
                           # E2E_PORT 환경변수로 미리보기 서버 포트를 바꿀 수 있습니다(기본값 4173). 예: E2E_PORT=4174 npm run test:e2e
```

## Docker 실행

```bash
docker build -t digital-signage-simulator:local .
docker run --rm -p 8080:8080 digital-signage-simulator:local
```

`http://localhost:8080`에서 확인합니다. Nginx가 정적 빌드 결과를 서빙하며 SPA fallback이 설정되어 있습니다.

## Git workflow

1. 현재 Sprint 범위와 이슈를 확인합니다.
2. 범위 밖 기능은 구현 전에 승인을 받습니다.
3. 짧고 명확한 브랜치를 생성합니다: `feat/editor-text`, `fix/export-error`, `docs/sprint-1`, `chore/ci`
4. 한 커밋에는 하나의 논리적 변경만 담습니다. Conventional Commit 스타일을 권장합니다.
5. PR에는 변경 내용, 테스트 결과, UI 스크린샷 또는 녹화, 알려진 제한을 포함합니다.
6. 병합 전 `format:check`, `lint`, `typecheck`, `test:run`, `build`를 실행합니다.
7. `main`에 직접 커밋하지 않습니다.

## Localization

- 저장 우선순위: 저장된 언어 선택(`localStorage`) → 지원되는 브라우저 언어 → 일본어(기본값).
- 지원 언어 코드: `ja`(기본), `ko`, `en`.
- 모든 화면 텍스트는 `src/i18n/locales/*.ts`의 번역 키를 통해 제공됩니다.
- 무거운 i18n 라이브러리 대신 작은 타입 기반 구현을 사용합니다 (`docs/adr/0001-frontend-foundation.md` 참고).

## 개인정보 및 파일 처리 정책

- MVP는 계정과 로그인을 요구하지 않습니다.
- `localStorage`에는 언어 선택값만 저장하며, 그 외 사용자 데이터를 저장하지 않습니다.
- 사용자가 선택한 이미지와 편집 데이터는 브라우저 안에서만 처리됩니다 — 서버로 업로드되지 않습니다.
- 사용자의 파일을 서버로 업로드하거나 저장하는 기능은 현재 계획에 포함되어 있지 않습니다.
- 파일 내용, 로컬 경로, object URL 등의 민감한 정보를 로그로 남기지 않습니다.

## 이미지 업로드 정책

- 허용 형식: `image/png`, `image/jpeg`, `image/webp`. 그 외 형식은 즉시 거부됩니다.
- 최대 크기: 10MB.
- MIME 타입이 허용 목록에 있어도 실제 바이트가 유효한 이미지가 아닐 수 있습니다(손상된 파일, 타입 스푸핑). 이 경우 `Image()` 디코딩이 실패하면 접근성 있는 오류 메시지를 보여주고, 생성했던 Object URL을 즉시 해제합니다.
- EXIF Orientation은 브라우저의 기본 이미지 디코딩 동작을 그대로 따릅니다(최신 Chrome/Firefox/Safari/Edge는 `Image()`/`<img>` 디코딩 시 EXIF Orientation을 자동 적용하며 회전된 이미지의 `naturalWidth`/`naturalHeight`도 교체됩니다). 별도의 EXIF 라이브러리를 추가하지 않았습니다.
- **알려진 제한 — Object URL 수명 주기:** 디코딩에 성공해 캔버스에 추가된 이미지의 Object URL은 세션 동안 해제하지 않습니다. 삭제/실행 취소 시점에 즉시 해제하면 실행 취소·다시 실행 히스토리가 여전히 참조 중인 이미지 미리보기가 깨질 수 있기 때문입니다(히스토리 스냅샷 전체에 대한 참조 카운팅은 Sprint 1 범위를 벗어나는 것으로 판단해 의도적으로 구현하지 않았습니다). 디코딩 실패로 캔버스에 추가되지 않은 파일의 Object URL만 안전하게 즉시 해제됩니다.

## PNG 내보내기 정책

- 내보내기는 화면 확대/축소(줌) 상태와 무관하게 항상 업로드된 공간 사진의 방향 보정된 원본 해상도로
  생성됩니다(디코딩 픽셀 안전 한도로 축소된 경우 그 축소된 해상도 기준). 문서 크기를 별도로 선택하는 템플릿
  개념은 더 이상 없습니다 — 자세한 배경은
  [`docs/adr/0007-photo-first-document-and-materials-sprint-4-2.md`](docs/adr/0007-photo-first-document-and-materials-sprint-4-2.md)
  참고.
- Transformer의 선택 테두리·핸들은 내보내기 직전 동기적으로 숨겼다가 즉시 복원하는 방식으로 처리되어, 내보낸 PNG에는 절대 포함되지 않습니다.
- 파일명 형식: `signage-canvas_{yyyyMMdd-HHmmss}.png` (예: `signage-canvas_20260813-143052.png`). 콜론(`:`) 등 파일 시스템에서 문제가 되는 문자는 포함되지 않습니다.
- 내보내기에 실패하면(예: 캔버스가 준비되지 않음) 파일 다운로드를 생략하고 접근성 있는 오류 메시지를 보여줍니다.

## 동영상 업로드 및 내보내기 정책

- 화면 콘텐츠로 이미지 대신 동영상 파일을 업로드할 수 있습니다. 허용 형식: `video/mp4`, `video/webm`. 최대
  크기: 80MB.
- 컨테이너(MIME 타입)가 허용 목록에 있어도 브라우저가 실제 코덱을 재생할 수 없는 경우가 있어,
  `HTMLVideoElement.canPlayType()`로 사전 검사 후 재생 불가능한 파일은 접근성 있는 오류로 거부합니다.
- 업로드된 동영상은 항상 자동 재생·반복 재생·음소거로만 표시되며, 별도의 재생/정지/탐색 컨트롤은
  제공하지 않습니다.
- "動画で書き出す" 버튼은 브라우저가 `HTMLCanvasElement.captureStream`과 `MediaRecorder`(WebM, VP9 또는
  VP8)를 모두 지원할 때만 나타납니다. 지원하지 않는 브라우저(예: 현재 Safari)에서는 버튼이 아예 표시되지
  않고 안내 문구만 보여주며, PNG 내보내기는 영향받지 않고 계속 사용할 수 있습니다.
- 동영상 내보내기는 캔버스에 표시된 동영상 콘텐츠 중 가장 긴 재생 시간(최대 15초로 제한)만큼, 동영상
  콘텐츠가 전혀 없으면 6초 동안 캔버스 화면을 그대로 녹화해 WebM 파일로 저장합니다 — 서버 업로드 없이
  전부 브라우저 내부에서 처리됩니다.
- 파일명 형식: `signage-canvas_{yyyyMMdd-HHmmss}.webm`.

## HULL CTA 안내

HULL은 Signage Canvas의 운영 주체가 아닙니다. 프로젝트 안에서 HULL을 언급할 경우, 외부 CTA 링크로만 명확하게 표시합니다.

- CTA 링크: https://hull-inc.jp/ (새 탭에서 열림, `rel="noopener noreferrer"`)

HULL의 상표, 로고, 서비스 설명을 공식 제휴처럼 사용하지 않습니다.

## 배포 개요

초기 배포 대상은 Render **Static Site**입니다. 상세 설정은
[`docs/runbooks/render-static-site.md`](docs/runbooks/render-static-site.md)를 참고하세요.
Sprint 4.2 기준으로 `main`은 Sprint 0~4.2를 모두 포함하며 위 설정으로 배포 가능하지만, 실제 Render 배포는
아직 수행되지 않았습니다 — Render 계정/서비스 생성 권한이 이 작업 환경에 없어 설정만 확인·문서화되어
있습니다.

앱은 백엔드 없이 동작하는 것을 목표로 합니다. 배포를 위해 불필요한 서버나 데이터베이스를 추가하지 않습니다.

## 프로젝트 구조

```text
.
├── src/
│   ├── app/            # 앱 루트 (App.tsx)
│   ├── components/     # 공통 UI 컴포넌트
│   ├── features/editor/ # 에디터 UI: EditorLayout(헤더+워크스페이스+상태 바), Toolbar(6섹션 통합 툴바),
│   │                     # EditorCanvas, SignageDisplayView, SpaceBackgroundView, PortableBuilderModal
│   │                     # (포터블 제품 마법사), PortableProductView, PerspectiveEditOverlay(원근 배치
│   │                     # 편집 오버레이), PerspectiveScreenView(원근 왜곡 렌더링), OnboardingOverlay 등
│   ├── i18n/           # 일본어·한국어·영어 리소스, 감지/저장 로직
│   ├── lib/            # 공통 유틸리티/상수 (파일 검증, 파일명 생성, 에셋 레지스트리, 콘텐츠 배치/프레임/소재 지오메트리,
│   │                     # curvature.ts — 곡률 스트립 근사, imageSafety.ts — 디코딩 픽셀 안전 한도,
│   │                     # geometryNormalization.ts — 공간 사진 교체 시 객체 재배치,
│   │                     # portableRegion.ts — 화면 영역 정규화 사각형 지오메트리,
│   │                     # quadGeometry.ts — 4점 원근 사각형 지오메트리/검증,
│   │                     # videoValidation.ts / videoExportCapability.ts / videoExport.ts — 동영상
│   │                     # 업로드 검증·내보내기 지원 감지·캔버스 녹화 파이프라인 등)
│   ├── store/          # Zustand 에디터 스토어 (문서 상태, 히스토리, 원근 배치 드래프트 수명주기, 에셋 스윕 구독)
│   ├── styles/          # 전역 스타일
│   ├── test/            # Vitest 환경 설정
│   └── types/            # 공유 타입 (에디터 문서/객체 — PortableSignageObject, NormalizedQuad,
│   │                     # ContactShadowSettings, EnvironmentIntegrationSettings 포함, i18n 메시지)
├── tests/unit/           # Vitest + React Testing Library (portableRegion.test.ts 포함)
├── e2e/                   # Playwright e2e 테스트 (실제 Chromium — portable.spec.ts, perspective-video.spec.ts,
│   │                     # mobile.spec.ts 포함)
│   └── support/            # PNG/EXIF/픽셀 샘플링, 동영상 픽스처 생성 등 테스트 전용 헬퍼
├── docker/nginx.conf       # SPA fallback 설정
├── Dockerfile
├── docs/
│   ├── architecture/overview.md
│   ├── adr/0001-frontend-foundation.md
│   ├── adr/0003-content-and-material-model.md
│   ├── adr/0004-custom-portable-template.md
│   ├── adr/0005-canvas-object-reselection-hotfix.md
│   ├── adr/0006-guided-editor-sprint-4-1.md
│   ├── adr/0007-photo-first-document-and-materials-sprint-4-2.md
│   ├── adr/0008-perspective-environment-and-video-sprint-4-3.md
│   └── runbooks/
└── .github/workflows/ci.yml
```

## Known limitations

- 캔버스 밖으로 요소를 이동해도 위치가 자동으로 제한(clamp)되지 않습니다 — 의도적으로 변경하지 않은 기존 동작입니다.
- 성공적으로 추가된 이미지의 Object URL은 세션 동안 해제되지 않습니다 (위 "이미지 업로드 정책"의 알려진 제한 참고).
- 모바일 Safari에서 `<a download>`를 통한 PNG 다운로드는 브라우저/버전에 따라 동작이 다를 수 있으며, 이 환경에서 직접 검증하지 못했습니다.
- 모바일 레이아웃은 기본 반응형 수준이며 폭넓은 기기 매트릭스에서 검증되지 않았습니다.
- HULL CTA는 화면 우측 하단에 고정 위치로 표시됩니다 — 매우 좁은 모바일 화면에서 툴바 컨트롤과 겹칠 수
  있는 실기기 충돌 검증은 아직 수행하지 않았습니다(자세한 내용은
  `docs/adr/0006-guided-editor-sprint-4-1.md`의 Consequences 참고).
- Render 실배포는 아직 수행되지 않았고 설정만 문서화되어 있습니다.
- 디스플레이 프레임(베젤/스탠드)과 소재(LED/LCD/透過LED) 프리뷰는 단순화된 시각적 표현이며, 실제 제품 형상이나
  성능을 재현하지 않습니다(자세한 내용은 `docs/adr/0003-content-and-material-model.md` 참고).
- 곡률(curvature) 제어는 화면 영역을 여러 세로 스트립으로 나눠 포물선 형태로 변위시키는 2차원 근사이며,
  실제 3D·원근 렌더링이 아닙니다(자세한 배경은
  `docs/adr/0007-photo-first-document-and-materials-sprint-4-2.md` 참고).
- 디스플레이·포터블 제품당 화면 콘텐츠는 이미지 또는 동영상 중 1개만 지원합니다 — 다중 콘텐츠 슬롯이나
  재생목록은 범위 밖입니다.
- 동영상은 항상 자동 재생·반복 재생·음소거로만 표시되며, 재생/정지/탐색 등의 컨트롤은 제공하지 않습니다.
- 동영상 내보내기는 브라우저의 `MediaRecorder`가 지원하는 코덱(VP9/VP8, WebM 컨테이너)을 그대로 사용하며
  별도의 화질/비트레이트 조절이나 트랜스코딩은 제공하지 않습니다. Safari 등 `captureStream`/
  `MediaRecorder`를 지원하지 않는 브라우저에서는 동영상 내보내기 버튼 자체가 나타나지 않습니다(PNG
  내보내기는 계속 사용할 수 있습니다).
- 포터블 제품의 화면 영역은 사진 자체의 좌표계에 고정된 축 정렬 직사각형 하나뿐입니다 — 화면 영역 자체를
  원근/4점/다각형으로 지정하거나 제품당 여러 화면 영역을 두는 기능은 지원하지 않습니다(단, 배치된 객체
  전체를 4점 원근 사각형에 맞추는 기능은 위 Sprint 4.3 항목에서 지원합니다).
- 4점 원근 배치 모드에서 클릭 판정(선택/드래그)은 항상 객체의 원래 사각형 기준이며, 시각적으로 왜곡된
  사각형 형태 자체를 클릭 대상으로 사용하지 않습니다(자세한 배경은
  `docs/adr/0008-perspective-environment-and-video-sprint-4-3.md` 참고).
- 접지 그림자·환경 톤 블렌딩은 순수 시각 효과이며 실제 조명/그림자를 물리적으로 시뮬레이션하지 않습니다.
- 포터블 객체는 생성 후 사진을 교체할 수 없습니다 — 다른 사진을 쓰려면 객체를 삭제하고 새로 추가해야 합니다
  (자세한 배경은 `docs/adr/0004-custom-portable-template.md` 참고).
- 편집 중인 문서(공간 사진·신호기 배치)는 세션 동안만 유지되며 새로고침하면 초기화됩니다 — 서버/localStorage
  영속화는 범위 밖입니다.
- 라이선스 미정.

## 범위 관리

이 프로젝트는 승인된 Sprint 범위를 벗어나 코딩하지 않는 것을 원칙으로 합니다. 필요해 보이는 기능이라도 먼저 이슈로 제안하고 승인을 받아야 합니다. 자세한 정책은 `CLAUDE.md`를 참고하세요.

## Disclaimer

이 저장소는 독립적인 개인 프로젝트입니다. 제공되는 기능과 배포 상태는 변경될 수 있으며, 특정 목적에 대한 적합성이나 무중단 동작을 보장하지 않습니다. HULL은 본 프로젝트의 공식 서비스가 아니며, 본 저장소는 HULL의 승인·후원·제휴를 의미하지 않습니다.

## License

라이선스는 아직 결정되지 않았습니다 (`License: TBD`). 라이선스가 확정되기 전에는 저장소의 코드와 자산을 재배포하거나 상업적으로 사용하는 조건을 임의로 해석하지 마세요.
