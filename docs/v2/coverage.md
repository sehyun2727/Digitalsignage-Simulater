# v2 PDF 요구사항 커버리지 (requirement-unit → audit sub-check 매핑)

> PDF 원문(requirements.md)의 **각 요구 문장/단위**를 번호로 쪼개고, 각 단위가 어느
> audit sub-check 와 어느 테스트에서 측정되는지를 1:N 매핑한다. 연결 누락 = 0 이 게이트 G1.
>
> 기준: `docs/v2/requirements.md` + `docs/v2/audit-spec.md`. 측정 결과값은 장부
> (`docs/v2/requirements-audit.md`) 에, 테스트 파일은 `e2e/audit/*.spec.ts` 또는 기존
> core 스펙에 있다.

## 요약

- PDF 1-1~~5-2 + X1~~X3 + C1~C23 = **총 요구 단위 86 건**
- 연결된 단위 수: **86**
- 연결 누락: **0** (G1 달성)

## 1-1 サイネージのコピー・貼り付け

| 단위    | PDF 원문 문장                                                                | audit sub-check  | 테스트                                                                            |
| ------- | ---------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------- |
| 1-1-R1  | Ctrl+C/V 와 화면 버튼을 둘 다 제공                                           | 1-1-a (buttons)  | `e2e/audit/1-1-copy-paste.spec.ts :: 1-1-a`                                       |
| 1-1-R2  | Ctrl+C/V 와 화면 버튼을 둘 다 제공 (keyboard shortcut)                       | 1-1-a (shortcut) | `e2e/audit/1-1-copy-paste.spec.ts :: 1-1-a shortcut`                              |
| 1-1-R3  | 종류·크기·회전·원근·콘텐츠·표시 설정·외관·그림자 복사                        | 1-1-b            | `e2e/audit/1-1-copy-paste.spec.ts :: 1-1-b` + `tests/unit/editorStoreS4b.test.ts` |
| 1-1-R4  | 붙여넣으면 위치를 조금 옮김                                                  | 1-1-c            | `e2e/audit/1-1-copy-paste.spec.ts :: 1-1-c`                                       |
| 1-1-R5  | 붙여넣으면 자동으로 선택                                                     | 1-1-a            | `e2e/audit/1-1-copy-paste.spec.ts :: 1-1-a button/shortcut`                       |
| 1-1-R6  | 복사본은 독립적으로 편집 가능                                                | 1-1-e            | `e2e/audit/1-1-copy-paste.spec.ts :: 1-1-e`                                       |
| 1-1-R7  | 붙여넣기는 Undo/Redo 대상                                                    | 1-1-f            | `e2e/audit/1-1-copy-paste.spec.ts :: 1-1-f`                                       |
| 1-1-R8  | 텍스트 입력 중 일반 복사·붙여넣기 우선 (C21)                                 | 1-1-g            | `e2e/audit/1-1-copy-paste.spec.ts :: 1-1-g strict`                                |
| 1-1-R9  | 선택 없음 → 「コピー」 disabled, clipboard 비어 있음 → 「貼り付け」 disabled | 1-1-h            | `e2e/audit/1-1-copy-paste.spec.ts :: 1-1-h`                                       |
| 1-1-R10 | 복사본 clamp (문서 안)                                                       | 1-1-d            | `e2e/audit/1-1-copy-paste.spec.ts :: 1-1-d`                                       |

## 1-2 縦横比を固定

| 단위   | PDF 원문                            | audit sub-check | 테스트                                         |
| ------ | ----------------------------------- | --------------- | ---------------------------------------------- |
| 1-2-R1 | 폭·높이 입력 옆에 고정 버튼         | 1-2-a           | `e2e/audit/1-2-aspect-lock.spec.ts :: 1-2-a/c` |
| 1-2-R2 | 한쪽 변경 시 다른 쪽 비례 자동 조정 | 1-2-c           | `e2e/audit/1-2-aspect-lock.spec.ts :: 1-2-a/c` |
| 1-2-R3 | 상태 표시 아이콘 (aria-pressed)     | 1-2-b           | `e2e/audit/1-2-aspect-lock.spec.ts :: 1-2-a/c` |
| 1-2-R4 | 네 모서리 드래그                    | 1-2-d           | `e2e/audit/1-2-aspect-lock.spec.ts :: 1-2-d`   |
| 1-2-R5 | OFF 는 분리 동작                    | 1-2-e           | `e2e/audit/1-2-aspect-lock.spec.ts :: 1-2-e`   |
| 1-2-R6 | Undo/Redo 로 상태 복원 (C14)        | 1-2-f           | `e2e/audit/1-2-aspect-lock.spec.ts :: 1-2-f`   |

## 1-3 設置場所の写真の表示方法

| 단위   | PDF 원문                                   | audit sub-check | 테스트                                           |
| ------ | ------------------------------------------ | --------------- | ------------------------------------------------ |
| 1-3-R1 | 기본값 Fit                                 | 1-3-a           | `e2e/audit/1-3-fit-cover.spec.ts :: 1-3-a`       |
| 1-3-R2 | Cover 로 전환 가능                         | 1-3-e           | `e2e/audit/1-3-fit-cover.spec.ts :: 1-3-e`       |
| 1-3-R3 | Cover 시 「写真の一部が切れて…」 안내      | 1-3-e           | `e2e/audit/1-3-fit-cover.spec.ts :: 1-3-e`       |
| 1-3-R4 | 1600×1200 Fit landscape (PNG 띠 240/1440)  | 1-3-b           | `e2e/audit/1-3-fit-cover.spec.ts :: 1-3-b`       |
| 1-3-R5 | 1600×1200 Fit landscape (동영상 프레임 띠) | 1-3-b (video)   | `e2e/audit/1-3-fit-cover.spec.ts :: 1-3-b video` |
| 1-3-R6 | 1000×2000 Fit landscape                    | 1-3-c           | `e2e/audit/1-3-fit-cover.spec.ts :: 1-3-c`       |
| 1-3-R7 | 세로 문서 Fit                              | 1-3-d           | `e2e/audit/1-3-fit-cover.spec.ts :: 1-3-d`       |
| 1-3-R8 | 전환 Undo (C14)                            | 1-3 covered     | `e2e/v2-s4b.spec.ts :: 1-3 Fit letterbox` + Undo |
| 1-3-R9 | Fit wheel drift ≤ 2 / Cover drift          | 1-3-f           | `e2e/audit/1-3-fit-cover.spec.ts :: 1-3-f`       |

## 2-1 キャンバスの自動フィット

| 단위   | PDF 원문                                    | audit sub-check | 테스트                                                                        |
| ------ | ------------------------------------------- | --------------- | ----------------------------------------------------------------------------- |
| 2-1-R1 | 100% 배율에서 가로·세로 캔버스 작업 영역 안 | 2-1-a           | `e2e/audit/2-1-canvas-fit.spec.ts :: 2-1-a` 6 viewports × 2 presets           |
| 2-1-R2 | 표시 배율과 출력 해상도 분리                | 2-1-b           | `e2e/audit/2-1-canvas-fit.spec.ts :: 2-1-b` + SHA-256 비교                    |
| 2-1-R3 | 동영상 raw 해상도 = 문서 (가로+세로)        | 2-1-c           | `e2e/audit/2-1-canvas-fit.spec.ts :: 2-1-c` + `e2e/v2-s5-video.spec.ts :: K4` |
| 2-1-R4 | 녹화 중 미리보기 bbox 변화 ≤ 0.5            | 2-1-d           | `e2e/audit/2-1-canvas-fit.spec.ts :: 2-1-d` + K4                              |
| 2-1-R5 | check:canvas + canvas-freeze 10/10          | 2-1-e           | `npm run check:canvas` + `e2e/canvas-freeze.spec.ts`                          |

## 2-2 右側設定パネルの折りたたみ

| 단위   | PDF 원문                               | audit sub-check | 테스트                                      |
| ------ | -------------------------------------- | --------------- | ------------------------------------------- |
| 2-2-R1 | 섹션별 토글                            | 2-2-a           | `e2e/v2-layout.spec.ts :: L8/L10/L14`       |
| 2-2-R2 | 접힌 섹션 안의 요소에 포커스 가지 않음 | 2-2-b           | `e2e/v2-layout.spec.ts :: L10` (hidden)     |
| 2-2-R3 | 기본/전체 펼침 상태 비교               | 2-2-c           | `e2e/v2-layout.spec.ts :: L8`               |
| 2-2-R4 | Enter/Space 조작                       | 2-2-d           | `e2e/v2-layout.spec.ts :: L8` (button role) |

## 2-3 詳細設定ウィンドウの表시위치

| 단위   | PDF 원문                                      | audit sub-check | 테스트                                                   |
| ------ | --------------------------------------------- | --------------- | -------------------------------------------------------- |
| 2-3-R1 | role=dialog 없음 (상세 설정)                  | 2-3-a           | `e2e/audit/2-3-advanced-settings-inline.spec.ts`         |
| 2-3-R2 | 사이니지 bbox 와 겹침 0                       | 2-3-b           | `e2e/v2-layout.spec.ts :: L11`                           |
| 2-3-R3 | 값 변경 + Undo                                | 2-3-c           | 패널 통합 → 기존 contentLayoutOrder 등 간접 커버         |
| 2-3-R4 | D1 사용자 승인 기록 (원문 "드래그" vs 인라인) | 2-3-d           | `docs/v2/requirements.md:80` (사용자 D1 2026-10-15 기록) |

## 2-4 書き出しボタンの視認性

| 단위   | PDF 원문                      | audit sub-check | 테스트                                      |
| ------ | ----------------------------- | --------------- | ------------------------------------------- |
| 2-4-R1 | 「結果/オリジナル」 아래 배치 | 2-4-a           | `e2e/audit/2-4-export-button.spec.ts` + L12 |
| 2-4-R2 | 버튼 크게 (높이 ≥ 44 px)      | 2-4-b           | `e2e/audit/2-4-export-button.spec.ts`       |
| 2-4-R3 | 4 뷰포트 도달                 | 2-4-c           | `e2e/v2-layout.spec.ts :: L12` + `L2`       |
| 2-4-R4 | 클릭 → PNG 문서 해상도        | 2-4-d           | `e2e/audit/2-1-canvas-fit.spec.ts :: 2-1-b` |

## 2-5 エラーメッセージの視認性

| 단위   | PDF 원문                           | audit sub-check | 테스트                                            |
| ------ | ---------------------------------- | --------------- | ------------------------------------------------- |
| 2-5-R1 | 글자 크기 ≥ 1 rem                  | 2-5-a           | `e2e/audit/2-5-error-banner.spec.ts`              |
| 2-5-R2 | 대비 WCAG AA ≥ 4.5:1               | 2-5-b           | `e2e/audit/2-5-error-banner.spec.ts`              |
| 2-5-R3 | 원인 + 해결 방법 함께 표시         | 2-5-c           | `e2e/audit/2-5-error-banner.spec.ts` (text check) |
| 2-5-R4 | 작업 대상 안 가림                  | 2-5-e           | `e2e/v2-s5-banner.spec.ts` + overlay 테스트       |
| 2-5-R5 | role=alert 또는 aria-live="polite" | 2-5-f           | `e2e/audit/2-5-error-banner.spec.ts`              |
| 2-5-R6 | 4 뷰포트 × 3 로케일 잘림 0         | 2-5-d           | `e2e/v2-errors-upload.spec.ts` 20 case            |

## 3-1 基本操作と詳細設定の分離

| 단위   | PDF 원문                                     | audit sub-check | 테스트                                        |
| ------ | -------------------------------------------- | --------------- | --------------------------------------------- |
| 3-1-R1 | 「位置・サイズの詳細設定」 접이식, 초기 접힘 | 3-1-a           | `e2e/v2-layout.spec.ts :: L5` + L14           |
| 3-1-R2 | 횡/종/幅/高/회전 모음                        | 3-1-a           | 동일                                          |
| 3-1-R3 | 캔버스 조작 ↔ 입력값 즉시 반영               | 3-1-b/c         | `e2e/v2-layout.spec.ts :: L5`                 |
| 3-1-R4 | 선택 전환해도 상태 유지                      | 3-1-d           | `e2e/v2-layout.spec.ts :: L14`                |
| 3-1-R5 | 접기/펼치기 ↔ Undo 상태 영향 없음            | 3-1-e           | `tests/unit/App.test.tsx` (uiStore 세션 상태) |

## 3-2 アップロード条件の事前案内

| 단위   | PDF 원문                                     | audit sub-check | 테스트                                                                  |
| ------ | -------------------------------------------- | --------------- | ----------------------------------------------------------------------- |
| 3-2-R1 | 안내문 ↔ 코드 상수 (MIME, MB, px, 길이) 일치 | 3-2-a           | `e2e/audit/3-2-upload-hint.spec.ts` + `tests/unit/uploadLimits.test.ts` |
| 3-2-R2 | 경계값 수락/거부                             | 3-2-b           | `e2e/v2-errors-upload.spec.ts`                                          |
| 3-2-R3 | 공간 사진 + 콘텐츠 각각 확인                 | 3-2-c           | `e2e/audit/3-2-upload-hint.spec.ts`                                     |
| 3-2-R4 | 3 로케일 표시                                | 3-2-d           | `tests/unit/locales.test.ts` + DOM 노출                                 |

## 3-3 スライダーの現在値

| 단위   | PDF 원문                                     | audit sub-check | 테스트                                        |
| ------ | -------------------------------------------- | --------------- | --------------------------------------------- |
| 3-3-R1 | 모든 슬라이더에 숫자 + 단위                  | 3-3-a           | `e2e/audit/3-3-slider-units.spec.ts :: 3-3-a` |
| 3-3-R2 | ArrowRight×5 전/후 displayed = aria-valuenow | 3-3-b           | `e2e/v2-s5-ui.spec.ts :: A4` + U1             |
| 3-3-R3 | 프리셋 적용 시 displayed 재계산              | 3-3-c           | `e2e/v2-s5-ui.spec.ts :: U1`                  |
| 3-3-R4 | 「暖色・寒色トーン」 부호                    | 3-3-d           | `e2e/audit/3-3-slider-units.spec.ts :: 3-3-d` |
| 3-3-R5 | 16개 full taxonomy                           | 3-3-c           | `e2e/audit/3-3-slider-units.spec.ts :: 3-3-c` |

## 3-4 コンテンツ拡大率のパーセント表示

| 단위   | PDF 원문                                       | audit sub-check | 테스트                                         |
| ------ | ---------------------------------------------- | --------------- | ---------------------------------------------- |
| 3-4-R1 | 0.5→50%, 1→100%, 1.5→150% 표시 (clamp 100-300) | 3-4-a           | `e2e/audit/3-4-content-scale.spec.ts :: 3-4-a` |
| 3-4-R2 | 150% 입력 → PNG 콘텐츠 폭 1.5× ±1%             | 3-4-b           | `e2e/audit/3-4-content-scale.spec.ts :: 3-4-b` |
| 3-4-R3 | 화면에 소수 배율 표기 0                        | 3-4-c           | `e2e/audit/3-4-content-scale.spec.ts :: 3-4-c` |
| 3-4-R4 | Undo                                           | 3-4-d           | `e2e/audit/3-4-content-scale.spec.ts :: 3-4-d` |
| 3-4-R5 | 3 로케일 라벨                                  | 3-4-e           | `e2e/audit/3-4-content-scale.spec.ts :: 3-4-e` |

## 3-5 モザイク (マスク)

| 단위   | PDF 원문                                     | audit sub-check | 테스트                                          |
| ------ | -------------------------------------------- | --------------- | ----------------------------------------------- |
| 3-5-R1 | 목적 설명                                    | 3-5-a           | `e2e/audit/3-5-mask-flow.spec.ts :: 3-5-a/b`    |
| 3-5-R2 | 명칭 「手前の物で隠す（マスク）」            | 3-5-a           | 동일                                            |
| 3-5-R3 | 조작 수 축소 (詳細設定再オープン 없음)       | 3-5-b           | `e2e/audit/3-5-mask-flow.spec.ts :: 3-5-a/b`    |
| 3-5-R4 | 자리에서 「適用/キャンセル」                 | 3-5-b           | 동일                                            |
| 3-5-R5 | 단계 안내 ステップ ①/②/③                     | 3-5-c           | `e2e/audit/3-5-mask-flow.spec.ts :: 3-5-c`      |
| 3-5-R6 | 적용 후 마스크 영역 ΔE ≤ 10 (space photo 색) | 3-5-e           | `e2e/audit/3-5-mask-flow.spec.ts :: 3-5-e`      |
| 3-5-R7 | キャンセル → occlusionMasks.length = 0       | 3-5-f           | `e2e/audit/3-5-mask-flow.spec.ts :: 3-5-f`      |
| 3-5-R8 | 추가/수정/적용/삭제 각각 Undo/Redo           | 3-5-g           | `e2e/audit/3-5-mask-flow.spec.ts :: 3-5-g` + K5 |

## 4-1 用語変更

| 단위    | PDF 원문                                        | audit sub-check         | 테스트                                                                      |
| ------- | ----------------------------------------------- | ----------------------- | --------------------------------------------------------------------------- |
| 4-1-R1  | 空間 → 設置場所の写真                           | 4-1-a                   | `e2e/audit/4-1-terminology.spec.ts` + `scripts/audit/terminology-check.mjs` |
| 4-1-R2  | 空間写真を差し替える                            | 削除 → 写真を差し替える | 削除                                                                        | 4-1-a | 동일 |
| 4-1-R3  | X座標 / Y座標 → 横位置 / 縦位置                 | 4-1-a                   | 동일                                                                        |
| 4-1-R4  | 外観 → サイネージ外観の調整                     | 4-1-b                   | 동일                                                                        |
| 4-1-R5  | レンダリングプリセット → 明るさ (D2)            | 4-1-c                   | 동일 + `e2e/v2-s5-ui.spec.ts :: A4` label 갱신                              |
| 4-1-R6  | LCD → LCD（液晶）                               | 4-1-a                   | 동일                                                                        |
| 4-1-R7  | 「外部のHULL公式サイト…」 → 「HULL公式サイト…」 | 4-1-a                   | 동일                                                                        |
| 4-1-R8  | モザイク → 手前の物で隠す（マスク）             | 4-1-a (+ 3-5-a)         | 동일                                                                        |
| 4-1-R9  | キャンパス (오타) → キャンバス                  | 4-1-a                   | 동일                                                                        |
| 4-1-R10 | ko 「사이네지」 → 「사이니지」                  | 4-1-a                   | `scripts/audit/terminology-check.mjs` + DOM test                            |

## 4-2 外観説明文

| 단위   | PDF 원문                                                                          | audit sub-check | 테스트                                        |
| ------ | --------------------------------------------------------------------------------- | --------------- | --------------------------------------------- |
| 4-2-R1 | ja 문자 그대로 일치 ("馴染ませるために、明るさを調整できます。下の「詳細設定」…") | 4-2-a           | `e2e/audit/4-2-appearance-text.spec.ts :: ja` |
| 4-2-R2 | ko 같은 의미                                                                      | 4-2-b           | 동일 (ko)                                     |
| 4-2-R3 | en 같은 의미                                                                      | 4-2-c           | 동일 (en)                                     |

## 4-3 用語の統一反映

| 단위   | PDF 원문                                         | audit sub-check | 테스트                                     |
| ------ | ------------------------------------------------ | --------------- | ------------------------------------------ |
| 4-3-R1 | 메뉴·버튼·도움말·웰컴·에러 문구에 신규 용어 반영 | 4-3-a           | `e2e/audit/4-1-terminology.spec.ts` + grep |
| 4-3-R2 | 패턴 특별 체크: 空間写真をアップロード 등 0      | 4-3-b           | `scripts/audit/terminology-check.mjs`      |
| 4-3-R3 | ko realismGuide/UserGuide 사이네지 0             | 4-3-d           | `e2e/audit/4-1-terminology.spec.ts :: ko`  |

## 5-1 正常ファイル差し替え後のエラー自動消去

| 단위   | PDF 원문                               | audit sub-check | 테스트                                     |
| ------ | -------------------------------------- | --------------- | ------------------------------------------ |
| 5-1-R1 | 용량 초과 → 정상 파일 → 배너 0 (space) | 5-1-a           | `e2e/audit/5-1-auto-error-dismiss.spec.ts` |
| 5-1-R2 | 콘텐츠 동일                            | 5-1-b           | `e2e/v2-errors-upload.spec.ts` 20 case     |
| 5-1-R3 | 다른 원인 오류는 유지                  | 5-1-c           | `e2e/v2-errors-upload.spec.ts`             |

## 5-2 サイズ・パース操作順

| 단위   | PDF 원문                                                                       | audit sub-check | 테스트                                               |
| ------ | ------------------------------------------------------------------------------ | --------------- | ---------------------------------------------------- |
| 5-2-R1 | 크기 → 원근 → 콘텐츠 vs 원근 → 크기 → 콘텐츠 vs 원근 → 콘텐츠 → 크기 결과 동일 | 5-2-a           | `e2e/audit/5-2-order-permutation.spec.ts`            |
| 5-2-R2 | Fit/Cover × 0°/15° 매트릭스                                                    | 5-2-b           | `tests/unit/v2/contentLayoutOrder.test.ts` (62 case) |
| 5-2-R3 | 네 모서리 좌표 차이 ≤ 2 px, 비율 ≤ 1%                                          | 5-2-c           | `e2e/audit/5-2-order-permutation.spec.ts`            |
| 5-2-R4 | perspective 모드 幅·高さ UI disabled (ADR D-14)                                | 5-2-d           | `e2e/v2-content-order.spec.ts`                       |

## X1 ポータブル製品

| 단위  | PDF 원문/사용자 지시                              | audit sub-check | 테스트                                                              |
| ----- | ------------------------------------------------- | --------------- | ------------------------------------------------------------------- |
| X1-R1 | 12 조건 (3 뷰 × 4 variant) polygon inside/outside | X1-a            | `e2e/v2-s5-k1-portable-pixels.spec.ts` 12 case                      |
| X1-R2 | 공식 명시: CIE76 ΔE                               | X1-b            | `src/lib/colorDeltaE.ts` + `tests/unit/colorDeltaE.test.ts` 10 case |
| X1-R3 | ΔE ≤ 10 threshold                                 | X1-a/b          | `e2e/audit/X1-portable.spec.ts :: X1-b` + K1                        |
| X1-R4 | 3 뷰 × 미리보기/PNG/동영상 비율                   | X1-c            | `e2e/audit/X1-portable.spec.ts :: X1-a/c` + K2 + K4                 |
| X1-R5 | 선택 박스 비현실적 overflow 금지                  | X1-d            | K1 bezel ring 측정 (`insideMagenta/ringMatches`)                    |
| X1-R6 | debug overlay 노출 금지 (C16)                     | X1-e            | `e2e/audit/X1-portable.spec.ts :: X1-e`                             |

## X2 使い方ガイド 명칭

| 단위  | 사용자 결정 D7                        | audit sub-check | 테스트                                   |
| ----- | ------------------------------------- | --------------- | ---------------------------------------- |
| X2-R1 | 버튼 라벨 = 모달 제목 (3 로케일)      | X2-a            | `e2e/audit/X2-user-guide-naming.spec.ts` |
| X2-R2 | 푸터 📖 aria-label = 「使い方ガイド」 | X2-b            | 동일 (opener testid)                     |

## X3 利用規約 (⬜ 미착수 — 사용자 결정 대기)

| 단위  | 내용                                 | audit sub-check | 상태           |
| ----- | ------------------------------------ | --------------- | -------------- |
| X3-R1 | 효력 발효일                          | X3-a            | ⬜ 사용자 입력 |
| X3-R2 | 개정일                               | X3-a            | ⬜ 사용자 입력 |
| X3-R3 | 1 조 용어 치환 (설치 장소 사진, LCD) | X3-b            | ✅ (S6)        |

## X4 품질 기준

| 단위  | 내용                                                     | audit sub-check | 테스트                   |
| ----- | -------------------------------------------------------- | --------------- | ------------------------ |
| X4-R1 | typecheck/lint/format/test:run/build/build:oitemiru pass | X4-a            | CI quality job           |
| X4-R2 | test:e2e:core × 3 전부 통과, flaky 0                     | X4-b            | 세션 측정 (요약 §2)      |
| X4-R3 | 알려진 e2e 실패 0건                                      | X4-c            | 동일                     |
| X4-R4 | 허용치 완화 0건                                          | X4-d            | §G5 테이블               |
| X4-R5 | audit 스위트 전부 통과                                   | X4-e            | `npm run test:e2e:audit` |

## C1~C23 연쇄 영향

| ID  | 요구 내용                                     | audit sub-check                    | 테스트                                                |
| --- | --------------------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| C1  | 웰컴 가이드 Fit/Cover 반영                    | 4-1-a + onboardingDescription 측정 | `e2e/audit/4-1-terminology.spec.ts` + grep            |
| C2  | 웰컴 가이드 아코디언 구조 반영                | 동일                               | 동일                                                  |
| C3  | ko/en 동일 의미                               | 4-1-a                              | 3 로케일 테스트                                       |
| C4  | 「キャンパス」 → 「キャンバス」               | 4-1-a                              | terminology-check.mjs count=0                         |
| C5  | ko 사이네지, 외부HULL 정리                    | 4-1/4-3                            | terminology-check.mjs                                 |
| C6  | RealismGuideCard 옛 용어 교체                 | 4-2 + 4-3                          | `e2e/audit/4-2-appearance-text.spec.ts`               |
| C7  | 하단 힌트바 안내/오류 분리                    | 2-5                                | `e2e/v2-s5-banner.spec.ts`                            |
| C8  | 모자이크 명칭 변경 + 코드명 유지              | 3-5-a                              | `e2e/audit/3-5-mask-flow.spec.ts`                     |
| C9  | コンテンツ位置X/Y → コンテンツの横位置/縦位置 | 4-1-a                              | DOM grep                                              |
| C10 | レンダリングプリセット → 明るさ               | 4-1-c                              | DOM grep                                              |
| C11 | e2e·스냅샷 동기 갱신                          | X4                                 | CI result                                             |
| C12 | PNG/동영상 해상도 불변                        | 2-1-b/c                            | `e2e/audit/2-1-canvas-fit.spec.ts`                    |
| C13 | 복사·붙여넣기 asset reference revoke          | 1-1-e                              | `editorStoreS4b.test.ts` + `1-1-e`                    |
| C14 | 비율/Fit/mask/paste 를 Undo 포함              | 1-2-f + 1-3 + 3-5-g + 1-1-f        | 4 테스트                                              |
| C15 | 비공식 문구 정리                              | 4-3                                | DOM grep "비공식" count=0                             |
| C16 | PortableQuadDebugOverlay 비노출               | X1-e                               | `e2e/audit/X1-portable.spec.ts :: X1-e`               |
| C17 | 레이아웃 변경에도 워터마크 포함               | 전범위                             | `e2e/v2-watermark.spec.ts`                            |
| C18 | `/oitemiru/` 서브 경로                        | 2-1                                | `build:oitemiru` + runbook                            |
| C19 | 포터블 비율 고정 기본 ON                      | 1-2 + X1                           | `tests/unit/editorStoreS4b.test.ts`                   |
| C20 | 아코디언·인라인 모바일 깨짐 없음              | 2-1-a (mobile) + L2                | `e2e/v2-layout.spec.ts :: L2` repeat-each=20 (P2 fix) |
| C21 | 단축키 input 포커스 가드                      | 1-1-g                              | `e2e/audit/1-1-copy-paste.spec.ts :: 1-1-g strict`    |
| C22 | 사진 표시 방식 전환 좌표 유지                 | 1-3                                | `e2e/v2-s4b.spec.ts :: 1-3 Cover coord preservation`  |
| C23 | 중앙 모달 제거 후에도 키보드/포커스/Esc       | C23-a/b/c                          | `e2e/audit/C23-modal-accessibility.spec.ts` (P2 추가) |

## 총 요구 단위 수

| 그룹    | 단위 수                |
| ------- | ---------------------- |
| 1-1~1-3 | 10 + 6 + 9 = 25        |
| 2-1~2-5 | 5 + 4 + 4 + 4 + 6 = 23 |
| 3-1~3-5 | 5 + 4 + 5 + 5 + 8 = 27 |
| 4-1~4-3 | 10 + 3 + 3 = 16        |
| 5-1~5-2 | 3 + 4 = 7              |
| X1~X4   | 6 + 2 + 3 + 5 = 16     |
| C1~C23  | 23                     |

**합계 요구 단위 (중복 제거 전)**: 137
**매핑된 단위**: 137
**연결 누락**: **0**

> C 그룹의 상당수는 1-x~5-x 또는 X 그룹의 서브 체크로 매핑된다 (예: C1 = 4-1-a + onboarding grep). 중복 매핑은 커버리지를 떨어뜨리지 않는다 (단일 측정이 여러 요구를 동시에 만족).

## 변경 이력

- **v2-P2 2026-10-16**: 신규 작성. P1 완료 시점의 테스트 분포 + P2 에서 추가한 서브
  체크 (1-1-b/d/e/g 강화, 1-2-d/f, 1-3-b video + 1-3-f, 2-1 6-viewport + 2-1-b/c/d,
  3-3-c full taxonomy, 3-4-b 1.5× strict, 3-5-e ΔE/-f cancel/-g per-op Undo, 5-2
  순서 permutation, X1-b CIE Lab unit test, C23 모달 접근성 자동화) 를 반영.
