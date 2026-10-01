# 배포 (deployment)

## 두 환경

| 환경 | URL | 역할 | 배포 방식 |
|---|---|---|---|
| **Render 스테이징** | `https://digitalsignage-simulater.onrender.com` | 직원 확인용. v2 스프린트 진행 중에도 중간 상태는 공유되지 않도록 push를 억제 | main에 push하면 `npm ci && npm run build` → `dist/` 자동 서빙 (Render Static Site) |
| **본서버 (운영)** | `https://hull-inc.jp/oitemiru/` | 공개 운영. 서브 경로 `/oitemiru/` | 사용자가 로컬에서 `npm run build:oitemiru` 한 뒤 `dist-oitemiru/` **내용물**을 서버에 수동 업로드 |

두 환경은 **URL 경로가 다릅니다**. Render는 루트 `/`, 본서버는 하위 경로 `/oitemiru/`. 이 때문에 하나의 빌드로 양쪽을 커버할 수 없고, 환경별 빌드 스크립트가 분리되어 있습니다. (pre-v2 P-8 결정, ADR 0011)

## 경로 처리 원칙

- `vite.config.ts`에 `base`를 하드코딩하지 않습니다. CLI 플래그 `--base`로만 처리.
- 자원 참조는 **import**(ES module) 또는 **`import.meta.env.BASE_URL`** 사용. `/`로 시작하는 절대 경로 문자열은 금지.
  - 예시: `src/lib/hullWatermark.ts:1` 참고.
- `index.html` 안의 `href="/favicon.svg"` 같은 참조는 Vite가 빌드 시 base로 자동 재작성합니다.
- `index.html`의 canonical/OG 메타는 운영 URL(`https://hull-inc.jp/oitemiru/`) 절대 URL로 고정 — 이는 Render에서도 그대로 노출되지만 "운영 URL이 우선"이라는 의도된 동작입니다.

## 환경별 빌드 조사 결과 (P-10)

| 빌드 | 출력 폴더 | `index.html`의 JS/CSS 접두어 | `import.meta.env.BASE_URL` | HTTP 200 확인 |
|---|---|---|---|---|
| `npm run build` | `dist/` | `/assets/…` | `/` | localhost:4173/ 에서 index.html / favicon.svg / assets/*.js / assets/*.css / assets/brand/hull-watermark.svg 모두 200 |
| `npm run build:oitemiru` | `dist-oitemiru/` | `/oitemiru/assets/…` | `/oitemiru/` | localhost:4174/oitemiru/ 에서 동일 자원 모두 200. 루트 `/`는 302(base로 리다이렉트) |

grep: `dist/` 안 `/oitemiru/` 등장은 index.html canonical/OG 메타 4곳뿐(자원 참조 아님). JS 번들 안에는 0건.

## 릴리스 순서 (v2)

1. S1~S6: **로컬 커밋만**. `git push` 금지. 이유: Render 스테이징을 직원이 보는데, 중간 상태가 노출되면 혼선.
2. S7 완료 후: 사용자 지시가 있을 때 **1회만** `git push origin main`.
3. Render가 자동 재배포(`npm ci && npm run build`) → 스테이징 반영.
4. 직원 확인 후 사용자 승인.
5. 사용자가 로컬에서 `npm run build:oitemiru` 실행.
6. 아래 "본서버 수동 업로드 절차"로 교체.

## 본서버 수동 업로드 절차

**AI는 이 절차의 "업로드 자체"를 수행하지 않습니다. 빌드 명령과 업로드 대상 안내만 합니다.**

1. 깨끗한 체크아웃(릴리스 커밋)에서 로컬 실행: `npm ci && npm run build:oitemiru`. 결과: `dist-oitemiru/` (index.html, assets/*, favicon.svg).
2. 서버 쪽에서 기존 `/oitemiru/` 폴더를 **이름 바꿔 백업** (예: `oitemiru-YYYYMMDD/`). 한 번에 되돌릴 수 있도록.
3. `dist-oitemiru/` **안의 파일들**(폴더 자체가 아님)을 서버의 `/oitemiru/` 디렉터리에 교체 업로드.
4. 브라우저로 `https://hull-inc.jp/oitemiru/` 접속, 새로고침, 설치 장소 사진 업로드, PNG/동영상 내보내기 확인. 네트워크 탭에서 모든 자원이 `/oitemiru/…` 경로에서 200 응답인지 확인.
5. 문제가 있으면 백업 폴더를 `/oitemiru/`로 되돌려 롤백.

**금지**:
- `dist/`(루트 빌드)를 `/oitemiru/`에 업로드하면 **자원 404**가 납니다.
- `dist-oitemiru/`를 Render에 업로드/push하면 **자원 404**가 납니다.
- 서버의 기존 백업 폴더(`oitemiru-YYYYMMDD/`)를 급히 삭제하지 말 것(최소 1 릴리스 분량 보존).

## Render 스테이징 운영

- 설정 파일: `docs/runbooks/render-static-site.md` 참조.
- 재배포 트리거: `main` 브랜치 push.
- SPA 재작성 규칙: `/*` → `/index.html` (현재 설정 유지).
- Node 버전: 22.x.

## 롤백

| 환경 | 절차 |
|---|---|
| Render | 사용자가 Render 대시보드에서 이전 Deploy 선택 → Redeploy. 또는 `git revert` 후 push. |
| 본서버 | 백업 폴더(`oitemiru-YYYYMMDD/`)의 이름을 `/oitemiru/`로 되돌리기. |

## 관련 문서

- `docs/runbooks/render-static-site.md` — Render 설정, 두 빌드 명령, 본서버 업로드 절차의 서버 측 설명.
- `docs/adr/0011-v2-decisions.md` — 두 빌드 스크립트 분리 결정 기록.
- `docs/v2/sprint-plan.md` — 스프린트 릴리스 순서.
