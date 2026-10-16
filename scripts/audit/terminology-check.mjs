/**
 * requirements-audit.md 4-1 / 4-3 보조 측정 스크립트.
 *
 * i18n 로케일 파일(src/i18n/locales/{ja,ko,en}.ts) + i18n 사용 위치(src/**)에서
 * glossary.md ① 의 옛 용어가 몇 번 등장하는지를 센다. UI 노출 여부와 1:1 매칭은
 * 아니지만("ja.ts 안의 '空間' 중 TOS 문단은 UI 라벨은 아니"지만 세이는 들어감),
 * 변경 범위의 전체 측정은 이걸로 충분하다.
 *
 * 사용: `node scripts/audit/terminology-check.mjs`
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');

const localeFiles = {
  ja: resolve(repo, 'src/i18n/locales/ja.ts'),
  ko: resolve(repo, 'src/i18n/locales/ko.ts'),
  en: resolve(repo, 'src/i18n/locales/en.ts'),
};

const terms = {
  ja: [
    { pattern: /空間/g, label: '空間', allowedContext: /空間に合わせて配置|空間における/g },
    { pattern: /レンダリングプリセット/g, label: 'レンダリングプリセット' },
    { pattern: /モザイク/g, label: 'モザイク' },
    { pattern: /X座標/g, label: 'X座標' },
    { pattern: /Y座標/g, label: 'Y座標' },
    { pattern: /キャンパス/g, label: 'キャンパス (typo)' },
    { pattern: /外部のHULL/g, label: '外部のHULL' },
  ],
  ko: [
    { pattern: /사이네지/g, label: '사이네지 (typo)' },
    { pattern: /렌더링 프리셋/g, label: '렌더링 프리셋' },
    { pattern: /모자이크/g, label: '모자이크' },
    { pattern: /X좌표/g, label: 'X좌표' },
    { pattern: /Y좌표/g, label: 'Y좌표' },
    { pattern: /외부 HULL/g, label: '외부 HULL' },
    { pattern: /외부의 HULL/g, label: '외부의 HULL' },
  ],
  en: [
    { pattern: /rendering preset/gi, label: 'rendering preset' },
    { pattern: /mosaic/gi, label: 'mosaic' },
    { pattern: /X coordinate/gi, label: 'X coordinate' },
    { pattern: /Y coordinate/gi, label: 'Y coordinate' },
    { pattern: /external HULL/gi, label: 'external HULL' },
  ],
};

/** @param {string} text  @param {RegExp} re  @param {RegExp | undefined} except */
function countExcept(text, re, except) {
  const matches = text.match(re) ?? [];
  if (!except) return matches.length;
  // Count each match but subtract the number of times it occurs INSIDE an allowed context.
  const allowedHits = text.match(except) ?? [];
  return Math.max(0, matches.length - allowedHits.length);
}

/** @type {Record<string, Record<string, number>>} */
const results = {};
for (const [locale, path] of Object.entries(localeFiles)) {
  const text = readFileSync(path, 'utf8');
  const row = {};
  for (const t of terms[/** @type {'ja'|'ko'|'en'} */ (locale)]) {
    row[t.label] = countExcept(text, t.pattern, t.allowedContext);
  }
  results[locale] = row;
}

console.log('# [4-1 / 4-3] locale old-term scan (locale files only)\n');
for (const [locale, row] of Object.entries(results)) {
  console.log(`## ${locale}`);
  const rows = Object.entries(row);
  const w = Math.max(...rows.map(([k]) => k.length));
  for (const [k, v] of rows) {
    const status = v === 0 ? 'OK' : 'HIT';
    console.log(`  ${k.padEnd(w)}  ${String(v).padStart(3)}  ${status}`);
  }
  console.log('');
}

// Exit non-zero if any ja or en term is still present (strict), or ko has old typo above 0
// — but this script is advisory, so only exits non-zero when ja/en have strict violations.
const strictJa = [
  'レンダリングプリセット',
  'モザイク',
  'X座標',
  'Y座標',
  'キャンパス (typo)',
  '外部のHULL',
  '空間',
];
const strictEn = ['rendering preset', 'mosaic', 'X coordinate', 'Y coordinate', 'external HULL'];
let fail = 0;
for (const k of strictJa) {
  if ((results.ja[k] ?? 0) > 0) {
    console.log(`FAIL(ja): ${k} = ${results.ja[k]}`);
    fail++;
  }
}
for (const k of strictEn) {
  if ((results.en[k] ?? 0) > 0) {
    console.log(`FAIL(en): ${k} = ${results.en[k]}`);
    fail++;
  }
}
if ((results.ko['사이네지 (typo)'] ?? 0) > 0) {
  console.log(
    `WARN(ko): 사이네지 (typo) = ${results.ko['사이네지 (typo)']} occurrences remain. glossary ① specifies 사이니지.`,
  );
}
process.exit(fail > 0 ? 1 : 0);
