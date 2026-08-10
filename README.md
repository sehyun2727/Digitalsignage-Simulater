# Signage Canvas (Digital Signage Simulator)

> 브라우저에서 간단한 디지털 사이니지 화면을 구성하고 이미지로 내보내기 위한 독립 개인 프로젝트입니다.
> **Working title:** Signage Canvas / Digital Signage Simulator

## 서비스 요약

- **日本語:** ブラウザ上でシンプルなデジタルサイネージ画面を作成し、画像として書き出すための個人プロジェクトです。
- **English:** An independent personal project for creating simple digital-signage compositions in the browser and exporting them as images.

> Signage Canvas는 공식 HULL 서비스가 아니며 HULL과 제휴·후원·운영 관계가 없습니다. HULL은 외부 문의 CTA로만 표시됩니다.
> 문의 링크: https://hull-inc.jp/contact

## 상태

**현재 상태: Sprint 2 완료 (공간 배경 + 디스플레이 화면 콘텐츠/소재 기반) — PR 전 최종 QA 및 결함 수정 반영됨**

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
npm run test:e2e          # Playwright e2e 테스트 (실제 Chromium — smoke, 에디터, 이미지 업로드, 공간 배경/디스플레이 콘텐츠·소재)
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

- 내보내기는 화면 확대/축소(줌) 상태와 무관하게 항상 선택된 템플릿의 원본 픽셀 해상도로 생성됩니다 (`wall-led`: 1920×1080, `stand-display`: 1080×1920).
- Transformer의 선택 테두리·핸들은 내보내기 직전 동기적으로 숨겼다가 즉시 복원하는 방식으로 처리되어, 내보낸 PNG에는 절대 포함되지 않습니다.
- 파일명 형식: `signage-canvas_{templateId}_{yyyyMMdd-HHmmss}.png` (예: `signage-canvas_wall-led_20260106-153000.png`). 콜론(`:`) 등 파일 시스템에서 문제가 되는 문자는 포함되지 않습니다.
- 내보내기에 실패하면(예: 캔버스가 준비되지 않음) 파일 다운로드를 생략하고 접근성 있는 오류 메시지를 보여줍니다.

## HULL CTA 안내

HULL은 Signage Canvas의 운영 주체가 아닙니다. 프로젝트 안에서 HULL을 언급할 경우, 외부 문의 링크로만 명확하게 표시합니다.

- 문의 링크: https://hull-inc.jp/contact (새 탭에서 열림, `rel="noopener noreferrer"`)

HULL의 상표, 로고, 서비스 설명을 공식 제휴처럼 사용하지 않습니다.

## 배포 개요

초기 배포 대상은 Render **Static Site**입니다. 상세 설정은
[`docs/runbooks/render-static-site.md`](docs/runbooks/render-static-site.md)를 참고하세요.
Sprint 0 기준으로 실제 배포는 아직 수행되지 않았습니다 — 설정만 문서화되어 있습니다.

앱은 백엔드 없이 동작하는 것을 목표로 합니다. 배포를 위해 불필요한 서버나 데이터베이스를 추가하지 않습니다.

## 프로젝트 구조

```text
.
├── src/
│   ├── app/            # 앱 루트 (App.tsx)
│   ├── components/     # 공통 UI 컴포넌트
│   ├── features/editor/ # 에디터 UI: Toolbar, EditorCanvas, PropertiesPanel, SignageDisplayView, SpaceBackgroundView 등
│   ├── i18n/           # 일본어·한국어·영어 리소스, 감지/저장 로직
│   ├── lib/            # 공통 유틸리티/상수 (파일 검증, 파일명 생성, 에셋 레지스트리, 콘텐츠 배치/프레임/소재 지오메트리 등)
│   ├── store/          # Zustand 에디터 스토어 (문서 상태, 히스토리, 에셋 스윕 구독)
│   ├── styles/          # 전역 스타일
│   ├── test/            # Vitest 환경 설정
│   └── types/            # 공유 타입 (에디터 문서/객체, i18n 메시지)
├── tests/unit/           # Vitest + React Testing Library
├── e2e/                   # Playwright e2e 테스트 (실제 Chromium)
│   └── support/            # PNG/EXIF/픽셀 샘플링 등 테스트 전용 헬퍼
├── docker/nginx.conf       # SPA fallback 설정
├── Dockerfile
├── docs/
│   ├── architecture/overview.md
│   ├── adr/0001-frontend-foundation.md
│   ├── adr/0003-content-and-material-model.md
│   └── runbooks/
└── .github/workflows/ci.yml
```

## Known limitations (Sprint 1)

- 캔버스 밖으로 요소를 이동해도 위치가 자동으로 제한(clamp)되지 않습니다 — 의도적으로 변경하지 않은 기존 동작입니다.
- 성공적으로 추가된 이미지의 Object URL은 세션 동안 해제되지 않습니다 (위 "이미지 업로드 정책"의 알려진 제한 참고).
- 모바일 Safari에서 `<a download>`를 통한 PNG 다운로드는 브라우저/버전에 따라 동작이 다를 수 있으며, 이 환경에서 직접 검증하지 못했습니다.
- 모바일 레이아웃은 기본 반응형 수준이며 폭넓은 기기 매트릭스에서 검증되지 않았습니다.
- Render 실배포는 아직 수행되지 않았고 설정만 문서화되어 있습니다.
- 디스플레이 프레임(베젤/스탠드)과 소재(屋外LED/LCD) 프리뷰는 단순화된 시각적 표현이며, 실제 제품 형상이나
  성능을 재현하지 않습니다(자세한 내용은 `docs/adr/0003-content-and-material-model.md` 참고).
- 디스플레이당 화면 콘텐츠는 정지 이미지 1개만 지원합니다 — 다중 콘텐츠 슬롯이나 동영상은 범위 밖입니다.
- 라이선스 미정.

## 범위 관리

이 프로젝트는 승인된 Sprint 범위를 벗어나 코딩하지 않는 것을 원칙으로 합니다. 필요해 보이는 기능이라도 먼저 이슈로 제안하고 승인을 받아야 합니다. 자세한 정책은 `CLAUDE.md`를 참고하세요.

## Disclaimer

이 저장소는 독립적인 개인 프로젝트입니다. 제공되는 기능과 배포 상태는 변경될 수 있으며, 특정 목적에 대한 적합성이나 무중단 동작을 보장하지 않습니다. HULL은 본 프로젝트의 공식 서비스가 아니며, 본 저장소는 HULL의 승인·후원·제휴를 의미하지 않습니다.

## License

라이선스는 아직 결정되지 않았습니다 (`License: TBD`). 라이선스가 확정되기 전에는 저장소의 코드와 자산을 재배포하거나 상업적으로 사용하는 조건을 임의로 해석하지 마세요.
