# Signage Canvas

> 브라우저에서 간단한 디지털 사이니지 화면을 구성하고 이미지로 내보내기 위한 독립 개인 프로젝트입니다.  
> **Working title:** Signage Canvas

## 서비스 요약

- **日本語:** ブラウザ上でシンプルなデジタルサイネージ画面を作成し、画像として書き出すための個人プロジェクトです。
- **English:** An independent personal project for creating simple digital-signage compositions in the browser and exporting them as images.

> Signage Canvas는 공식 HULL 서비스가 아니며 HULL과 제휴·후원·운영 관계가 없습니다. HULL은 외부 문의 CTA로만 표시될 예정입니다.

## 상태

**현재 상태: 계획 및 Sprint 1 준비 단계**

아래 기능은 구현 완료를 의미하지 않습니다. `Planned`는 계획된 기능, `Current`는 현재 Sprint에서 다루는 범위, `Future`는 후속 검토 항목입니다.

## 목표

- 계정 없이 빠르게 사이니지 시안을 만들기
- 사용자의 파일과 작업을 가능한 한 브라우저 안에서 처리하기
- 일본어를 기본 언어로 제공하고 한국어·영어를 지원하기
- 간단하고 이해하기 쉬운 편집 경험 제공
- 결과물을 이미지로 내보낼 수 있게 하기

## 주요 기능

### Sprint 1 / Current

- [ ] React + TypeScript + Vite 기반 앱 골격
- [ ] 일본어 기본 UI
- [ ] 한국어·영어 i18n 구조
- [ ] Konva 기반의 기본 캔버스
- [ ] 텍스트, 이미지, 배경색 요소의 기본 편집
- [ ] 기본 선택·배치·텍스트 편집
- [ ] 브라우저 로컬 이미지 처리
- [ ] PNG 이미지 내보내기
- [ ] 기본 모바일 레이아웃
- [ ] GitHub Actions CI
- [ ] Docker 및 Render free plan 배포 기반

### Future / Roadmap

- [ ] 비디오 삽입 기술 스파이크
- [ ] 브라우저 측 비디오 내보내기 가능성 검토
- [ ] 더 풍부한 템플릿과 편집 기능
- [ ] 필요성이 확인된 경우에만 로컬 저장 기능 개선

비디오 기능은 브라우저 호환성, 코덱, 메모리, 성능, 내보내기 품질을 검증하는 스파이크 이후에만 구현을 검토합니다.

## 기술 스택 (Planned)

- React
- TypeScript
- Vite
- Konva / React-Konva
- Zustand
- Browser File API 및 Canvas API
- GitHub Actions
- Docker
- Render free plan

## 로컬 실행

> 아래 명령은 저장소의 실제 스크립트가 확정된 후 업데이트할 예정입니다.

```bash
git clone <REPOSITORY_URL>
cd <REPOSITORY_DIRECTORY>
npm ci
npm run dev
```

브라우저에서 Vite가 안내하는 로컬 주소를 엽니다.

## Docker 실행

> Dockerfile과 실제 서비스 명령이 확정되면 이 섹션을 갱신합니다.

```bash
docker build -t signage-canvas .
docker run --rm -p 5173:5173 signage-canvas
```

## Scripts

현재 저장소에 존재하는 스크립트만 유효합니다. 계획된 예시는 다음과 같습니다.

```bash
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드
npm run preview    # 빌드 결과 미리보기
npm run lint       # 린트
npm run typecheck  # TypeScript 검사
npm test           # 테스트
```

## 배포 개요

초기 배포 대상은 Render free plan입니다.

배포 설정이 확정되면 다음 정보를 추가합니다.

- Build command
- Publish 또는 start command
- SPA fallback 설정
- 환경 변수
- 무료 플랜의 제한 및 cold start 안내
- 기본 브랜치 배포 절차

앱은 MVP에서 백엔드 없이 동작하는 것을 목표로 합니다. 배포를 위해 불필요한 서버나 데이터베이스를 추가하지 않습니다.

## 개인정보 및 파일 처리 정책

- MVP는 계정과 로그인을 요구하지 않습니다.
- 사용자가 선택한 이미지와 편집 데이터는 가능한 한 브라우저 안에서 처리합니다.
- 사용자의 파일을 서버로 업로드하거나 저장하는 기능은 현재 계획에 포함되어 있지 않습니다.
- 파일 내용, 로컬 경로, object URL 등의 민감한 정보를 로그로 남기지 않습니다.
- 향후 로컬 저장 또는 서버 기능이 추가되면 저장 범위와 삭제 방법을 별도로 문서화합니다.
- 실제 배포 전에는 브라우저별 파일 처리 동작과 개인정보 안내를 점검합니다.

## HULL CTA 안내

HULL은 Signage Canvas의 운영 주체가 아닙니다. 프로젝트 안에서 HULL을 언급할 경우, 외부 문의 링크로만 명확하게 표시합니다.

- 문의 링크: https://hull-inc.jp/contact

HULL의 상표, 로고, 서비스 설명을 공식 제휴처럼 사용하지 않습니다.

## 프로젝트 구조 (Planned)

```text
.
├── src/
│   ├── app/          # 앱 시작점과 전역 설정
│   ├── components/   # 공통 UI 컴포넌트
│   ├── features/
│   │   └── editor/   # 캔버스 및 편집 기능
│   ├── i18n/         # 일본어·한국어·영어 리소스
│   ├── lib/          # 공통 유틸리티
│   ├── store/        # Zustand 상태
│   ├── styles/       # 전역 스타일
│   └── types/        # 공유 타입
├── public/           # 정적 파일
├── tests/            # 테스트
├── Dockerfile        # 컨테이너 설정
└── .github/workflows # CI
```

구조는 구현 과정에서 단순성과 유지보수성을 기준으로 조정될 수 있습니다.

## 기여 workflow

1. 현재 Sprint 범위와 이슈를 확인합니다.
2. 범위 밖 기능은 구현 전에 승인을 받습니다.
3. 짧고 명확한 브랜치를 생성합니다.

```text
feat/editor-text
fix/export-error
docs/sprint-1
```

4. 한 커밋에는 하나의 논리적 변경만 담습니다.
5. Conventional Commit 스타일을 권장합니다.

```text
feat: add local image element
fix: handle export error
docs: clarify privacy policy
```

6. PR에는 변경 내용, 테스트 결과, UI 스크린샷 또는 녹화, 알려진 제한을 포함합니다.
7. 병합 전 lint, typecheck, test, build를 실행합니다.

## 범위 관리

이 프로젝트는 승인된 Sprint 범위를 벗어나 코딩하지 않는 것을 원칙으로 합니다.

Sprint 1에는 계정, 서버 업로드, 워터마크, 비디오 삽입·내보내기, 협업, 결제, 분석 기능이 포함되지 않습니다. 필요해 보이는 기능이라도 먼저 이슈로 제안하고 승인을 받아야 합니다.

## Disclaimer

이 저장소는 독립적인 개인 프로젝트입니다. 제공되는 기능과 배포 상태는 변경될 수 있으며, 특정 목적에 대한 적합성이나 무중단 동작을 보장하지 않습니다.

HULL은 본 프로젝트의 공식 서비스가 아니며, 본 저장소는 HULL의 승인·후원·제휴를 의미하지 않습니다.

## License

라이선스는 아직 결정되지 않았습니다.

```text
License: TBD
```

라이선스가 확정되기 전에는 저장소의 코드와 자산을 재배포하거나 상업적으로 사용하는 조건을 임의로 해석하지 마세요.
