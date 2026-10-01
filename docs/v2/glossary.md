# v2 용어·결정 사전 (glossary)

## ① 변경 용어 (기존 → 신규)

| 기존 (ja) | 신규 ja | ko | en |
|---|---|---|---|
| 空間 | 設置場所の写真 | 설치 장소 사진 | Installation site photo |
| 空間写真を差し替える | 写真を差し替える | 사진 교체 | Replace photo |
| 空間写真を削除 | 写真を削除 | 사진 삭제 | Delete photo |
| X座標 / Y座標 | 横位置 / 縦位置 | 가로 위치 / 세로 위치 | Horizontal position / Vertical position |
| コンテンツ位置X / Y | コンテンツの横位置 / 縦位置 | 콘텐츠 가로 위치 / 세로 위치 | Content horizontal / vertical position |
| 外観 | サイネージ外観の調整 | 사이니지 외관 조정 | Signage appearance |
| レンダリングプリセット | 明るさ・時間帯 | 밝기·시간대 | Brightness & time of day |
| LCD | LCD（液晶） | LCD(액정) | LCD |
| 外部のHULL公式サイトが新しいタブで開きます。 | HULL公式サイトが新しいタブで開きます。 | HULL 공식 웹사이트가 새 탭에서 열립니다. | Opens the HULL website in a new tab. |
| モザイク | 手前の物で隠す（マスク） | 앞쪽 물체로 가리기(마스크) | Foreground mask |
| キャンパス (오타) | キャンバス | 캔버스 | Canvas |
| 사이네지 (ko 오타) | — | 사이니지 | — |

**예외**: 「空間に合わせて配置（パース）」는 사진 이름이 아니라 조작 명이므로 **유지**.

**내부 코드명 유지**: `Occlusion`, `SpaceBackground`, `screenQuad` 등의 식별자는 바꾸지 않음. UI 노출 문자열만 교체.

## ② v2에서 새로 생기는 UI 문구

S2~S5에서 아래 표를 사용합니다. 기존 로케일에 같은 뜻의 키가 이미 있으면 기존 문구를 우선하고 이 표를 갱신하세요.

| ja | ko | en |
|---|---|---|
| 位置・サイズの詳細設定 | 위치·크기 상세 설정 | Position & size details |
| 縦横比を固定 | 가로세로 비율 고정 | Lock aspect ratio |
| 全体表示（フィット） | 전체 표시(맞춤) | Fit (show whole photo) |
| 画面いっぱいに表示（カバー） | 화면 가득 표시(채우기) | Fill (cover canvas) |
| 写真の一部が切れて表示される場合があります。 | 사진 일부가 잘려 보일 수 있습니다. | Parts of the photo may be cropped. |
| 書き出し | 내보내기 | Export |
| 使い方ガイド | 사용 가이드 | How to use |
| コピー / 貼り付け | 복사 / 붙여넣기 | Copy / Paste |
| 適用 / キャンセル | 적용 / 취소 | Apply / Cancel |
| 柱や什器など、手前にある物の後ろにサイネージが隠れているように見せる機能です。 | 기둥이나 집기 등 앞쪽 물체 뒤에 사이니지가 가려진 것처럼 보이게 하는 기능입니다. | Makes the signage look partly hidden behind foreground objects such as pillars or fixtures. |
| ステップ{current}/{total}：隠したい範囲の角をクリック（{count}/4） | 단계 {current}/{total}: 가릴 범위의 꼭짓점을 클릭 ({count}/4) | Step {current}/{total}: Click corners of the area to hide ({count}/4) |

## ③ 결정 사항 (ADR)

이 결정들은 `docs/adr/0011-v2-decisions.md`에도 ADR 형식으로 기록되어 있습니다. 요약:

1. **2-3**: 중앙 모달은 오른쪽 패널로 통합(접이식 섹션으로). `AdvancedSettingsModal`은 외관 섹션 내 접이식으로 재구성.
2. **レンダリングプリセット** → **明るさ・時間帯** (「明るさ」 슬라이더와 이름 충돌 방지).
3. **モザイク** → **手前の物で隠す（マスク）**. 내부 코드명 `Occlusion`은 유지.
4. **설치 장소 사진 기본 표시 방식**: **Fit (Contain)**. Cover는 사용자 선택.
5. **운영 기준**: HULL株式会社가 운영하는 **공식 서비스**. 비공식/개인 프로젝트 문구는 모두 교체.
6. **배포 분리**: Render 스테이징(루트 `/`) + 본서버(`/oitemiru/`) **빌드 스크립트 분리**. `vite.config.ts`에 base 하드코딩 금지. (`npm run build` vs `npm run build:oitemiru`)
7. **포터블 비율 고정**: 기본 ON (제품 사진 왜곡 방지).

## ④ 명명 원칙

- **문장 조각 금지**: 문구를 2개 이상의 i18n 키로 쪼개 이어붙이지 말 것(언어마다 어순이 달라 깨짐). 완전한 문장 1개 = 키 1개.
- **상수 하드코딩 금지**: 「10MB」「3840」같은 수치는 로케일에 쓰지 말고 `MAX_IMAGE_BYTES`, `MAX_VIDEO_LONG_EDGE` 등을 UI 레이어에서 포맷해서 넣기.
- **키 네이밍**: 섹션별로 접두어(`editor…`, `toolbar…`, `onboarding…`, `realismGuide…`, `userGuide…`, `termsOfService…`). 새 문구는 이 규칙 유지.
