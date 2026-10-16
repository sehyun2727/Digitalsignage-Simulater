# v2 Audit Spec (sub-check 상세 정의)

> `docs/v2/requirements-audit.md` 가 **상태 장부**, 이 문서가 **세부 점검 정의**다. 각
> 마스터 ID 에 대해 어떤 하위 점검(a, b, c…)을 통과해야 ✅ 로 올릴 수 있는지 기준값과
> 함께 명시한다. 측정 명령은 각 항목 끝에 테스트 파일 경로로 표기.

**기준 해상도**: 1920×1080 (desktop), 1366×650 (laptop), 1024×640 (small), 390×844 (mobile)
**기준 문서 크기**: 가로 1920×1080, 세로 1080×1920
**기준 로케일**: ja 원문 — ko/en 은 glossary.md 번역.

---

## 1-1 サイネージのコピー・貼り付け

- **1-1-a** 4종 사이니지(LED/LCD/シースルー/ポータブル) × 2 경로(화면 「コピー」/「貼り付け」 버튼, Ctrl+C/V 단축키): 복사 → 붙여넣기 후 `objects.length` +1 및 선택이 복사본으로 자동 전환.
- **1-1-b** 깊은 비교: 원본과 복사본의 전체 필드 비교에서 `id`·`x`·`y` 를 제외한 차이가 0. 비교한 필드 목록을 콘솔 출력하여 어떤 필드가 복제되는지 명시.
- **1-1-c** 오프셋 n=1,2,3: 같은 clipboard 를 n 번 붙여넣었을 때 (x,y) 가 (+20n, +20n). 각각 실측 수치 기록.
- **1-1-d** clamp: 원본을 x≈1850 로 둔 뒤 붙여넣었을 때 복사본의 (x+w)가 문서 가로(1920) 이하가 되도록 clamp. 좌표 실측.
- **1-1-e** 독립 편집: 복사본의 밝기/콘텐츠를 변경해도 원본은 그대로. 복사본 콘텐츠를 삭제한 뒤 PNG 를 내보내도 **원본 콘텐츠 영역이 픽셀 수준으로 유지됨** (PNG 샘플 색 측정).
- **1-1-f** Undo/Redo: 붙여넣기 후 Undo 1 회 → `objects.length` 원복, Redo 1 회 → 복사본 복원.
- **1-1-g** 입력 포커스 중 Ctrl+C/V: 텍스트/숫자 입력란에 포커스가 있을 때 Ctrl+C/V → 사이니지 수 변화 0, 입력란에 문자열이 들어감.
- **1-1-h** disabled 상태: 선택 없음 → 「コピー」 disabled, clipboard 비어 있음 → 「貼り付け」 disabled.

→ `e2e/audit/1-1-copy-paste.spec.ts`, `e2e/v2-s4b.spec.ts` (전체 커버 유지)

## 1-2 縦横比を固定

- **1-2-a** 토글 bbox 가 幅·높이 입력 옆에 인접(CSS px 간격).
- **1-2-b** ON/OFF 아이콘 + aria-pressed 동시 변경.
- **1-2-c** ON 상태에서 幅=960 → 높이 540 ±0.5. 높이=540 → 幅 960 양방향 확인.
- **1-2-d** 네 모서리 코너 드래그 각각 w/h 실측: TL/TR/BL/BR 각 변환 후 종횡비 유지 (±0.5%).
- **1-2-e** OFF 에서는 한쪽만 바뀜 (반대쪽 그대로).
- **1-2-f** Undo/Redo 시 값+aria-pressed 함께 복원.

→ `e2e/audit/1-2-aspect-lock.spec.ts`, `e2e/v2-s4b.spec.ts`

## 1-3 設置場所の写真の表示方法

- **1-3-a** 신규 사진 업로드 시 Fit 이 기본.
- **1-3-b** 1600×1200 사진을 1920×1080 캔버스에 Fit → 좌/우 띠 240 ±2 px, 사진 폭 1440 ±2 px. PNG 와 디코딩한 **동영상 프레임** (video raw resolution) 둘 다 측정.
- **1-3-c** 1000×2000 사진을 1920×1080 (landscape) 캔버스에 Fit → 좌/우 띠·사진 폭 측정.
- **1-3-d** 세로 문서(1080×1920): 1600×1200 사진 Fit 띠 상/하 측정.
- **1-3-e** Cover 전환: 띠 0 px, 안내문 「写真の一部が切れて表示される場合があります。」 노출.
- **1-3-f** Fit 상태 wheel drift ≤ 2 CSS px / Cover drift 실측.

→ `e2e/audit/1-3-fit-cover.spec.ts`, `e2e/v2-s4b.spec.ts`

## 2-1 キャンバスの自動フィット

- **2-1-a** 6 해상도 (1920×1080, 1366×650, 1280×720, 1024×640, 1440×900, 390×844) × landscape + portrait: `.editor-canvas-container` bbox 가 뷰포트 안이고 세로 scrollY 0, docScrollOverflow 0.
- **2-1-b** PNG 출력: 1920 창과 1024 창에서 각각 내보내기 → 둘 다 PNG 크기가 문서 크기(1920×1080) + 바이트/SHA-256 비교 결과 기록.
- **2-1-c** 동영상 출력: 디코딩한 videoWidth/videoHeight = 문서 크기 (가로 1920×1080 / 세로 1080×1920).
- **2-1-d** 녹화 중 미리보기 bbox: 100ms 간격으로 .editor-canvas-container bbox 변화 최대값 (기존 K4 테스트가 maxBbChange=0.00 로 확인).
- **2-1-e** `npm run check:canvas` OK + canvas-freeze.spec.ts 10/10 pass.

→ `e2e/audit/2-1-canvas-fit.spec.ts`, `e2e/canvas-freeze.spec.ts`, `e2e/v2-s5-video.spec.ts (A5)`

## 2-2 右側設定パネルの折りたたみ

- **2-2-a** 섹션 토글 (space / add-signage / selected / content / appearance / export) 전수 동작.
- **2-2-b** 접힌 섹션 안의 요소가 Tab 순서에서 제외 (hidden 속성).
- **2-2-c** 기본 상태와 전체 펼침 상태 패널 scrollHeight 비교.
- **2-2-d** Enter/Space 로 조작 가능 (버튼 role → 네이티브).

→ `e2e/v2-layout.spec.ts :: L8/L10/L14`

## 2-3 詳細設定ウィンドウの表示位置

- **2-3-a** `role=dialog` count = 0 (ToS/UserGuide 모달 제외).
- **2-3-b** 외관 섹션 「詳細設정」 펼친 상태에서 선택된 사이니지 bbox 와 겹치는 패널·오버레이 요소 0 (elementFromPoint).
- **2-3-c** 값 변경과 Undo 동작.
- **2-3-d** D1 (사용자 결정 2026-10-15) 로 "드래그 모달" 미구현을 승인, 패널 인라인 유지 — requirements.md 기록.

→ `e2e/audit/2-3-advanced-settings-inline.spec.ts`, `e2e/v2-layout.spec.ts :: L11`

## 2-4 書き出しボタンの視認性

- **2-4-a** DOM 순서와 bbox 가 모두 「結果/オリジナル」 아래.
- **2-4-b** PNG/동영상 버튼 높이 ≥ 44 CSS px.
- **2-4-c** 4 뷰포트 (desktop/laptop/small/mobile) 각각에서 스크롤로 도달.
- **2-4-d** 클릭 → PNG 가 **문서 해상도** 로 다운로드.

→ `e2e/audit/2-4-export-button.spec.ts`

## 2-5 エラーメッセージの視認性

- **2-5-a** font-size ≥ 1 rem (16 px) 실측.
- **2-5-b** fg/bg 대비 ≥ 4.5:1 (WCAG AA).
- **2-5-c** 오류 메시지 전체 목록에 원인(cause) + 해결(remedy) 2 줄.
- **2-5-d** 4 뷰포트 × 3 로케일에서 잘림 0.
- **2-5-e** 배너 등장/소거 시 캔버스 bbox 변화 0 (오버레이 모드).
- **2-5-f** role=alert 이거나 aria-live=polite — 접근성 announcement 확보.

→ `e2e/audit/2-5-error-banner.spec.ts`, `e2e/v2-errors-upload.spec.ts`

## 3-1 基本操作と詳細設定の分離

- **3-1-a** 「位置・サイズの詳細設정」 서브 아코디언 기본 aria-expanded=false, 입력 5개(횡/종/幅/高/회전) 안에 있음.
- **3-1-b** 캔버스 드래그 → 입력값 갱신 (ms 수준).
- **3-1-c** 입력 → 캔버스 bbox 변화.
- **3-1-d** A 선택 → B 선택 시 subAccordion 상태 유지 (uiStore.subAccordionOpen).
- **3-1-e** 접기/펼치기 3 회 전후로 Undo 가능 횟수 차이 0.

→ `e2e/v2-layout.spec.ts :: L5/L14/L15`, `e2e/audit/1-2-aspect-lock.spec.ts`

## 3-2 アップロード条件の事前案内

- **3-2-a** 안내 문구 안의 수치(10 MB, 300 MB, 6000 px, 3840×2160, 30 s)가 코드 상수 (`src/lib/uploadLimits.ts`) 와 일치.
- **3-2-b** 경계값 파일: 제한 이내 → 수락, 제한 초과 → 거부.
- **3-2-c** 공간 사진·콘텐츠 각각 확인.
- **3-2-d** 3 로케일 표시.

→ `e2e/audit/3-2-upload-hint.spec.ts`, `tests/unit/uploadLimits.test.ts`

## 3-3 スライダーの現在値

- **3-3-a** 외관 섹션 + 詳細設定 모두 펼친 상태의 range 입력 수 N. 기본 7 개(質感·画面の明るさ·강도·블러·너비·깊이·톤) + 조건부: 透과度(1), 그리드/글로우/코ンtras(3), 曲率(1), 느낌새기 강도(1), 마스크 중 흐림/불투명(2). 조건 전부 켤 때 **최대 16**, 조건별 노출 수를 테스트에서 측정 (현재 LED 기본 설정: 11, 透과LED 시: 12…).
- **3-3-b** 각 슬라이더에서 ArrowRight×5 전/후 displayed value = aria-valuenow + 단위.
- **3-3-c** 프리셋 적용 시 displayed value 가 재계산.
- **3-3-d** 「暖色・寒色トーン」 (contact shadow tint, 범위 −100~+100): 양수 값 → `+N`, 0 → `0`, 음수 → `-N`.

→ `e2e/audit/3-3-slider-units.spec.ts`, `e2e/v2-s5-ui.spec.ts :: A4`

## 3-4 コンテンツ拡大率のパーセント表示

- **3-4-a** 입력란 초기값 100, 접미사 「%」 노출.
- **3-4-b** 150 입력 후 blur → 입력값 150 유지. PNG 샘플: 콘텐츠 폭이 default 대비 **×1.5 ±1%** (가로 축 매젠타 run 측정).
- **3-4-c** 화면에 소수 배율(0.5, 1.5 등) 표기 0건.
- **3-4-d** Undo 동작.
- **3-4-e** 3 로케일 (「コンテンツ拡大率」/「콘텐츠 확대 비율」/「Content zoom」).

→ `e2e/audit/3-4-content-scale.spec.ts`, `e2e/v2-s5-ui.spec.ts :: U2`

## 3-5 モザイク（マスク）의 목적 명확화·단축

- **3-5-a** 명칭 「手前の物で隠す（マスク）」 (ja) 노출.
- **3-5-b** 4번째 점을 찍은 직후 「適用」 버튼 enabled + 「キャンセル」 함께 노출. 「詳細設定再オープン」 조작 수 0.
- **3-5-c** 단계 안내 (D3): draft 점 수 < 4 → 「ステップ①：隠したい範囲の4点を指定」, ≥ 4 → 「ステップ②：各点をドラッグして位置を調整」, 그리고 상시 「ステップ③：「適用」で確定、「キャンセル」でやり直し」. 측정 수단: `editor-occlusion-step-indicator` 로 조회.
- **3-5-d** 조작 수 전/후 비교.
- **3-5-e** 적용 후 PNG 에서 마스크 영역의 사이니지 픽셀이 공간 사진 색으로 덮이는지 (ΔE 측정).
- **3-5-f** キャンセル → occlusionMasks.length 0.
- **3-5-g** 추가/수정/적용/삭제 각각 Undo/Redo 1 단계.

→ `e2e/audit/3-5-mask-flow.spec.ts`, `e2e/occlusion-mask.spec.ts`

## 4-1 用語変更

- **4-1-a** 옛 표기(「空間」·「レンダリングプリセット」·「X座標/Y座標」·「モザイク」·「キャンパス」·「外部のHULL」·ko「사이네지」·en「external HULL」) 출현 수: locale 파일 grep + 실제 화면 DOM innerText (모든 섹션 펼친 상태, 3 로케일).
- **4-1-b** 새 표기 반영 위치: ja 「設置場所の写真」·「明るさ」·「画面の明るさ」·「サイネージ外観の調整」·「手前の物で隠す（マスク）」, ko 「설치 장소 사진」·「밝기」·「화면 밝기」·「사이니지 외관 조정」·「앞쪽 물체로 가리기(마스크)」, en 「Installation site photo」·「Brightness」·「Screen brightness」·「Signage appearance」·「Foreground mask」.
- **4-1-c** v2-P1 D2 로 「明るさ・時間帯」 → 「明るさ」 복원 + 素材 brightness → 「画面の明るさ」 명칭 분리 완료.

→ `e2e/audit/4-1-terminology.spec.ts`, `scripts/audit/terminology-check.mjs`

## 4-2 外観説明文

- **4-2-a** realismGuideDescription (ja) = 「サイネージ本体を「設置場所の写真」に馴染ませるために、明るさを調整できます。下の「詳細設定」から、さらに細かな調整ができます。」 **문자 그대로 일치**.
- **4-2-b** ko: 「사이니지 본체를 「설치 장소 사진」에 어울리게 하기 위해 밝기를 조정할 수 있습니다. 아래의 「세부 설정」에서 더 세밀하게 조정할 수 있습니다.」
- **4-2-c** en: 「Adjust the brightness so the signage blends into the installation site photo. Open "Advanced settings" below for finer control.」

→ `e2e/audit/4-2-appearance-text.spec.ts`

## 4-3 用語の統一反映

- **4-3-a** 온보딩 각 단계 텍스트 + 사용 가이드 (매뉴얼) 에서 옛 표기 0.
- **4-3-b** 「レンダリングプリセットで」「空間写真からサンプリング」「モザイクで」「空間写真を追加」「空間写真をアップロード」 패턴 0건.
- **4-3-c** 바뀐 i18n 키별 사용 위치 표: `editorRenderingPresetLabel`, `editorMaterialBrightnessLabel`, `editorSpaceBackgroundLabel`, `editorOcclusionLabel`, `toolbarAppearanceSectionHeading`.
- **4-3-d** ko realismGuide/UserGuide 에서 「사이네지」 0건.

→ `e2e/audit/4-1-terminology.spec.ts`, `scripts/audit/terminology-check.mjs`

## 5-1 正常ファイル差し替え後のエラー自動消去

- **5-1-a** 공간 사진: 10 MB 초과 → 에러 노출 → 정상 1920×1080 PNG → `role=alert` count=0.
- **5-1-b** 콘텐츠 이미지도 같은 방식: 10 MB 초과 → 에러 → 정상 → 소거.
- **5-1-c** 다른 소스의 오류는 **독립 유지**.

→ `e2e/audit/5-1-auto-error-dismiss.spec.ts`, `e2e/v2-errors-upload.spec.ts`

## 5-2 サイズ・パース操作順による歪み

- **5-2-a** 비교 순서 3 종:
  - A: 크기 → 원근 → 콘텐츠
  - B: 원근 → 크기 → 콘텐츠
  - C: 원근 → 콘텐츠 → 크기
- **5-2-b** 조건: Fit/Cover × 회전 0°/15°.
- **5-2-c** 기준: PNG 콘텐츠 영역 4 코너 좌표 차이 ≤ 2 px, 콘텐츠 종횡비 차이 ≤ 1%.
- **5-2-d** UI 레벨 안전장치: perspective 모드에서는 幅·高さ 입력 disabled → "크기 vs 원근 corner" 충돌 자체가 발생하지 않음.

→ `tests/unit/v2/contentLayoutOrder.test.ts` (62 case), `e2e/v2-content-order.spec.ts`

---

## X1 ポータブル製品

- **X1-a** 12 조건 (3 템플릿 시점 × 기본/이동/크기/회전 15°):
  - 마젠타 판정 = **CIE Lab ΔE** (CIE76 — sRGB → Lab via standard illuminant D65), 임계값 ≤ 10.
  - 폴리곤 2 px 안쪽 비율 ≥ 99%.
  - 폴리곤 2 px 바깥 마젠타 count = 0.
  - 베젤 ring (2–5 px) 색이 ΔE ≤ 10 로 baseline 과 일치.
- **X1-b** K1 테스트의 현재 임계값 산출 근거 (코드: `isMagenta` 는 Euclidean RGB dist < 50, 이는 CIE76 ΔE ≈ 10 의 안전 상한).
- **X1-c** 16:9 Fit 비율 오차: 3 시점 × 미리보기/PNG/동영상 각각 측정 (K2).
- **X1-d** 선택 박스가 기기 bbox 를 과하게 넘치지 않음.
- **X1-e** debug overlay dist 0 (SHOW_QUAD_DEBUG=false by default).

→ `e2e/v2-s5-k1-portable-pixels.spec.ts`, `e2e/v2-s5-k2-portable-fit.spec.ts`

## X2 使い方ガイド 명칭·export 라벨

- **X2-a** 헤더 버튼 가시 라벨 = 모달 제목 = 「使い方ガイド」 (3 로케일).
- **X2-b** 푸터 📖 aria-label 「使い方ガイド」 (아이콘 only).
- **X2-c** 매뉴얼 안의 "合成前의 설치 장소 사진" 표현이 신규 용어 반영 (userGuideTipsItems).

→ `e2e/audit/X2-user-guide-naming.spec.ts` (신규 추가 예정, 또는 터미노ジー 테스트에 흡수)

## X3 利用規約

- **X3-a** 효력 발효일/개정일: 「2026年月日」 → 사용자 결정 대기 (⏸).
- **X3-b** 1 조 안의 용어는 S6 에서 「設置場所の写真」·「LCD（液晶）」 로 재작성 — 의미 변경 없음.

→ TOS 전수 비교: `src/i18n/locales/{ja,ko,en}.ts :: termsOfServiceSections`

## X4 품질 기준

- **X4-a** typecheck / lint / format:check / build / build:oitemiru / check:canvas / test:run 전부 pass.
- **X4-b** test:e2e:core × 3 전부 통과, flaky 0.
- **X4-c** 알려진 e2e 실패 0 건.
- **X4-d** 허용치 완화 0 건.
- **X4-e** audit 스위트 전부 통과.

→ CI 등가 로컬 명령.

## X5 배포 (S7 범위, P1 범위 외)

- 상태 기록만 수행. Linux visual / 릴리스 노트 / Render 확인 / 본서버 리허설 / og:image / 직원 매뉴얼 / v1-production 태그 / main Ruleset.

---

## C1~C23 매핑 참조

`docs/v2/requirements-audit.md §3` 의 표. 각 C 는 1-x~~5-x 또는 X1~~X3 로 매핑되며 그
위치의 서브 체크에서 측정된다.
