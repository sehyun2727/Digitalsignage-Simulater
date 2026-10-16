# canvas-freeze.json allowlist: 라인번호 → 셀렉터·내용 기준 전환 가능성 검토

## 현재 구조 (라인번호 기반)

`docs/v2/canvas-freeze.json :: cssSelectorGuard.allowlist` 는 다음과 같은 형태:

```json
{ "file": "src/styles/global.css", "line": 1298, "selector": ".editor-workspace" }
```

- 체커 (`scripts/check-canvas-freeze.mjs`) 는 CSS 파일을 스캔해 frozen 클래스 셀렉터
  (`.editor-workspace` 등) 가 등장한 **라인번호** 와 셀렉터 쌍이 allowlist 와 완전
  일치하는지 확인한다.
- 라인번호가 바뀌면 (= 위쪽에 CSS 를 추가/삭제하면) 체커 fail → allowlist 수동 재인덱스
  필요. 실제로 v2-P1 에서 `.toolbar-step-indicator` 추가로 라인 +19 shift → 재인덱스
  커밋 `46d1fdc`.

## 제안 1 — 셀렉터 전수 유니크 체크 (가장 단순)

allowlist 에 line 필드를 삭제하고 **"그 셀렉터가 몇 번 나오는지"** 만 센다:

```json
{ "file": "src/styles/global.css", "selector": ".editor-workspace", "count": 2 }
```

- 체커: `file` 안에서 `selector` 등장 횟수가 `count` 와 같은지 비교.
- 장점: 라인 shift 와 무관. 추가/삭제는 count 가 바뀌므로 여전히 감지.
- 단점: **같은 selector 가 freeze zone 안에서 N 번 + 밖에서 M 번** 공존 가능 — 밖
  (allowlist) 수만 보면 안쪽 변동을 못 감지. 현재 코드는 그렇지는 않지만 (frozen
  selector 는 freeze zone 밖에서만 등장), 리스크는 있다.

## 제안 2 — 선행 n줄 해시 (anchor 기반)

allowlist 에 **"그 selector 바로 윗 2–3 줄의 SHA-256"** 을 포함:

```json
{
  "file": "src/styles/global.css",
  "selector": ".editor-workspace",
  "contextSha256": "sha256-of-previous-3-lines"
}
```

- 체커: `file` 에서 selector 등장 위치마다 선행 3 줄의 SHA 를 계산 → allowlist 와 비교.
- 장점: 선행 context 가 안정적이면 라인 shift 에 로버스트.
- 단점: 바로 위 줄에 자체 블록 안의 다른 CSS 가 변할 수 있어 context 선택이 민감. 또한
  selector 가 반복될 때(`.editor-workspace`가 2 번) 어느 쪽을 가리키는지 모호.

## 제안 3 — allowlist 라인번호 자동 재계산 스크립트

`scripts/check-canvas-freeze.mjs` 에 `--update-lines` 플래그 추가:

- 실행하면 현재 CSS 를 스캔해 **frozen zone 밖의** `selector` 등장 위치를 전부 찾고,
  현 line 번호로 `cssSelectorGuard.allowlist` 를 덮어쓴다.
- Pre-push hook 또는 수동 호출: `node scripts/check-canvas-freeze.mjs --update-lines`.
- 장점: 현 구조 유지하면서 재인덱스 수고를 자동화. frozen zone SHA 는 손대지 않음.
- 단점: 커밋 두 번 (CSS 변경 + 재인덱스) 이 하나로 묶여야 함 → 훅 통합 필요.

## 결론 / 권장

**지금은 전환하지 않는다**. 이유:

1. 프로덕트 코드가 아니라 테스트 가드다. 현재 라인번호 재인덱스는 1 년에 몇 번 수준
   (v2 전체에서 2 커밋만 변경).
2. 셀렉터 전수 유니크 체크(제안 1)는 가장 단순하지만 **커버리지 저하**가 분명치 않아
   추가 안전 분석이 필요하다. 전환 자체가 "약화" 로 분류될 수 있다.
3. **frozen zone SHA 는 변경 없음** — allowlist 는 metadata 로 분리되어 있어 바꾸려면
   사용자 승인 필요하다는 사실만 명시하고, 실제 전환은 S7 이후로 미룬다.

**frozen zone SHA 변경이 필요하면 CLAUDE.md §5-3bis 의 `[canvas-approved]` 절차**를
그대로 따른다 (사용자 승인 커밋 + canvas-freeze.json 재기록).

**사용자 결정 필요 사항**: 재인덱스 자동화(제안 3) 를 다음 세션 (P3) 에 포함할지 여부.
