# Sky シャード予報カレンダー 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sky: Children of the Light のシャード噴出を予報する日本語Webアプリを作る（月間カレンダー＋ボトムシート詳細表示）

**Architecture:** 静的ファイル4本（index.html / style.css / shard.js / app.js）。luxon をCDN経由で読み込み、シャード予測の計算はすべてブラウザ内で完結。GitHub Pagesに直接デプロイ。

**Tech Stack:** HTML5, CSS3, Vanilla JavaScript (ES2020), luxon 3.x (CDN)

---

### Task 1: プロジェクト初期化

**Files:**
- Create: `.gitignore`
- Create: `index.html`（空）
- Create: `style.css`（空）
- Create: `shard.js`（空）
- Create: `app.js`（空）
- Create: `tests/shard.test.html`（空）

- [ ] **Step 1: git 初期化**

```bash
cd "C:/Users/moriz/プロダクト/sky-shards"
git init
```

- [ ] **Step 2: .gitignore を作成**

```
.superpowers/
```

- [ ] **Step 3: 空ファイルを作成**

```bash
New-Item index.html, style.css, shard.js, app.js -ItemType File
New-Item tests -ItemType Directory
New-Item tests/shard.test.html -ItemType File
```

- [ ] **Step 4: 初回コミット**

```bash
git add .
git commit -m "chore: project scaffold"
```

---

### Task 2: shard.js — 定数と getShardInfo()

**Files:**
- Create: `shard.js`
- Create: `tests/shard.test.html`

#### ロジックの概要（参照元: PlutoyDev/sky-shards）

Sky 日付（America/Los_Angeles）の日付から以下を決定する：

| 変数 | 計算 |
|---|---|
| `isRed` | `dayOfMth % 2 === 1`（奇数日 = 赤） |
| `realmIdx` | `(dayOfMth - 1) % 5` → 5領域を順番に割り当て |
| `infoIndex` | 赤: `(⌊(dayOfMth-1)/2⌋ % 3) + 2`、黒: `⌊dayOfMth/2⌋ % 2` |

`SHARD_CONFIGS[infoIndex]` から noShardWkDay / interval / offset / maps を取得し、曜日チェックで `hasShard` を判定。

- [ ] **Step 1: tests/shard.test.html にテストを書く**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>shard.js テスト</title>
  <script src="https://cdn.jsdelivr.net/npm/luxon@3.4.4/build/global/luxon.min.js"></script>
  <script src="../shard.js"></script>
  <style>
    body { font-family: monospace; padding: 20px; background: #fff; }
    .pass { color: green; }
    .fail { color: red; font-weight: bold; }
  </style>
</head>
<body>
<h2>shard.js テスト</h2>
<div id="results"></div>
<script>
  const results = [];
  function assert(condition, label) { results.push({ ok: condition, label }); }

  // Test 1: 2026-06-05（金） → 赤・vault・Jellyfish Cove・hasShard=true
  const d1 = luxon.DateTime.fromObject({ year: 2026, month: 6, day: 5, hour: 12 }, { zone: 'America/Los_Angeles' });
  const i1 = getShardInfo(d1);
  assert(i1.isRed === true,                    'June 5: isRed = true');
  assert(i1.realm === 'vault',                 'June 5: realm = vault');
  assert(i1.location === 'Jellyfish Cove',     'June 5: location = Jellyfish Cove');
  assert(i1.hasShard === true,                 'June 5: hasShard = true');
  assert(i1.occurrences[0].start.hour === 3 && i1.occurrences[0].start.minute === 30,
                                               'June 5: first start = 3:30 Sky');
  assert(i1.occurrences[1].start.hour === 9 && i1.occurrences[1].start.minute === 30,
                                               'June 5: second start = 9:30 Sky');

  // Test 2: 2026-06-04（木） → 黒・wasteland・Broken Temple・hasShard=true
  const d2 = luxon.DateTime.fromObject({ year: 2026, month: 6, day: 4, hour: 12 }, { zone: 'America/Los_Angeles' });
  const i2 = getShardInfo(d2);
  assert(i2.isRed === false,                   'June 4: isRed = false');
  assert(i2.realm === 'wasteland',             'June 4: realm = wasteland');
  assert(i2.location === 'Broken Temple',      'June 4: location = Broken Temple');
  assert(i2.hasShard === true,                 'June 4: hasShard = true');
  assert(i2.occurrences[0].start.hour === 1 && i2.occurrences[0].start.minute === 50,
                                               'June 4: first start = 1:50 Sky');

  // Test 3: 2026-07-04（土） → 黒・noShardWkDay=[6,7]・hasShard=false
  const d3 = luxon.DateTime.fromObject({ year: 2026, month: 7, day: 4, hour: 12 }, { zone: 'America/Los_Angeles' });
  const i3 = getShardInfo(d3);
  assert(i3.hasShard === false,                'July 4 (Sat): hasShard = false');

  const div = document.getElementById('results');
  div.innerHTML = results.map(r =>
    `<div class="${r.ok ? 'pass' : 'fail'}">${r.ok ? '✓' : '✗'} ${r.label}</div>`
  ).join('') + `<p><strong>${results.filter(r=>r.ok).length}/${results.length} passed</strong></p>`;
</script>
</body>
</html>
```

- [ ] **Step 2: ローカルサーバーを起動してテストが失敗することを確認**

`/serve` スキルでサーバーを起動し、`tests/shard.test.html` を開く。  
期待結果: `ReferenceError: getShardInfo is not defined`（赤）

- [ ] **Step 3: shard.js を実装**

```js
/* global luxon */
const { Duration, DateTime } = luxon;

const LAND_OFFSET = Duration.fromObject({ minutes: 8, seconds: 40 });
const END_OFFSET  = Duration.fromObject({ hours: 4 });

const SHARD_CONFIGS = [
  {
    noShardWkDay: [6, 7],
    interval: Duration.fromObject({ hours: 8 }),
    offset:   Duration.fromObject({ hours: 1, minutes: 50 }),
    maps: ['prairie.butterfly', 'forest.brook', 'valley.rink', 'wasteland.temple', 'vault.starlight'],
  },
  {
    noShardWkDay: [7, 1],
    interval: Duration.fromObject({ hours: 8 }),
    offset:   Duration.fromObject({ hours: 2, minutes: 10 }),
    maps: ['prairie.village', 'forest.boneyard', 'valley.rink', 'wasteland.battlefield', 'vault.starlight'],
  },
  {
    noShardWkDay: [1, 2],
    interval: Duration.fromObject({ hours: 6 }),
    offset:   Duration.fromObject({ hours: 7, minutes: 40 }),
    maps: ['prairie.cave', 'forest.end', 'valley.dreams', 'wasteland.graveyard', 'vault.jelly'],
  },
  {
    noShardWkDay: [2, 3],
    interval: Duration.fromObject({ hours: 6 }),
    offset:   Duration.fromObject({ hours: 2, minutes: 20 }),
    maps: ['prairie.bird', 'forest.tree', 'valley.dreams', 'wasteland.crab', 'vault.jelly'],
  },
  {
    noShardWkDay: [3, 4],
    interval: Duration.fromObject({ hours: 6 }),
    offset:   Duration.fromObject({ hours: 3, minutes: 30 }),
    maps: ['prairie.island', 'forest.sunny', 'valley.hermit', 'wasteland.ark', 'vault.jelly'],
  },
];

const MAP_NAMES = {
  'prairie.butterfly': 'Butterfly Field',
  'prairie.village':   'Village Islands',
  'prairie.cave':      'Cave',
  'prairie.bird':      'Bird Nest',
  'prairie.island':    'Sanctuary Island',
  'forest.brook':      'Forest Brook',
  'forest.boneyard':   'Boneyard',
  'forest.end':        'Forest Garden',
  'forest.tree':       'Treehouse',
  'forest.sunny':      'Elevated Clearing',
  'valley.rink':       'Ice Rink',
  'valley.dreams':     'Village of Dreams',
  'valley.hermit':     'Hermit Valley',
  'wasteland.temple':  'Broken Temple',
  'wasteland.battlefield': 'Battlefield',
  'wasteland.graveyard':   'Graveyard',
  'wasteland.crab':    'Crabfield',
  'wasteland.ark':     'Forgotten Ark',
  'vault.starlight':   'Starlight Desert',
  'vault.jelly':       'Jellyfish Cove',
};

const REALMS   = ['prairie', 'forest', 'valley', 'wasteland', 'vault'];
const REALM_JA = { prairie: '草原', forest: '森', valley: '谷', wasteland: '荒れ地', vault: '金庫' };

// date: luxon DateTime（任意のゾーン可）
function getShardInfo(date) {
  const today   = date.setZone('America/Los_Angeles').startOf('day');
  const dayOfMth = today.day;
  const dayOfWk  = today.weekday; // 1=Mon … 7=Sun

  const isRed    = dayOfMth % 2 === 1;
  const realmIdx = (dayOfMth - 1) % 5;
  const infoIndex = isRed
    ? (Math.floor((dayOfMth - 1) / 2) % 3) + 2
    : Math.floor(dayOfMth / 2) % 2;

  const config   = SHARD_CONFIGS[infoIndex];
  const hasShard = !config.noShardWkDay.includes(dayOfWk);
  const mapKey   = config.maps[realmIdx];

  // DST補正: 日曜かつ、日付跨ぎで夏時間が変わる場合にオフセットを1h調整
  let firstStart = today.plus(config.offset);
  if (dayOfWk === 7 && today.isInDST !== firstStart.isInDST) {
    firstStart = firstStart.plus({ hours: firstStart.isInDST ? -1 : 1 });
  }

  const occurrences = Array.from({ length: 3 }, (_, i) => {
    const start = firstStart.plus(config.interval.mapUnits(x => x * i));
    const land  = start.plus(LAND_OFFSET);
    const end   = start.plus(END_OFFSET);
    return { start, land, end, startLocal: start.toLocal(), landLocal: land.toLocal(), endLocal: end.toLocal() };
  });

  return {
    date:     today,
    isRed,
    hasShard,
    realm:    REALMS[realmIdx],
    realmJa:  REALM_JA[REALMS[realmIdx]],
    mapKey,
    location: MAP_NAMES[mapKey],
    occurrences,
    lastEnd:  occurrences[2].end,
  };
}
```

- [ ] **Step 4: テストがすべて通ることを確認**

`tests/shard.test.html` をリロード。  
期待結果: `8/8 passed`（緑）

- [ ] **Step 5: コミット**

```bash
git add shard.js tests/shard.test.html
git commit -m "feat: shard prediction logic (getShardInfo)"
```

---

### Task 3: shard.js — findNextShard()

**Files:**
- Modify: `shard.js`（末尾に追記）
- Modify: `tests/shard.test.html`（テスト追加）

- [ ] **Step 1: tests/shard.test.html に findNextShard テストを追加**

既存テストの `results` の下に追加（`div.innerHTML` の行より前）:

```js
  // Test 4: 2026-07-04（土, シャードなし） → findNextShard が翌日 7/5 を返す
  const from4 = luxon.DateTime.fromObject({ year: 2026, month: 7, day: 4, hour: 12 }, { zone: 'America/Los_Angeles' });
  const next4 = findNextShard(from4);
  assert(next4.date.day === 5 && next4.date.month === 7, 'findNextShard from July 4 → July 5');
  assert(next4.hasShard === true,                         'July 5: hasShard = true');
  assert(next4.realm === 'vault',                         'July 5: realm = vault');
  assert(next4.location === 'Jellyfish Cove',             'July 5: location = Jellyfish Cove');
```

- [ ] **Step 2: テストが失敗することを確認**

期待結果: `ReferenceError: findNextShard is not defined`

- [ ] **Step 3: shard.js 末尾に findNextShard を追加**

```js
// from: luxon DateTime（Sky ゾーン推奨）
// 再帰でシャードのある日を探す（深さは最大 2 日程度）
function findNextShard(from) {
  const info = getShardInfo(from);
  if (info.hasShard && from < info.lastEnd) {
    return info;
  }
  return findNextShard(info.date.plus({ days: 1 }));
}
```

- [ ] **Step 4: テストがすべて通ることを確認**

期待結果: `16/16 passed`

- [ ] **Step 5: コミット**

```bash
git add shard.js tests/shard.test.html
git commit -m "feat: findNextShard"
```

---

### Task 4: index.html — HTMLスケルトン

**Files:**
- Modify: `index.html`

- [ ] **Step 1: index.html を実装**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sky シャード予報</title>
  <link rel="stylesheet" href="style.css">
  <script src="https://cdn.jsdelivr.net/npm/luxon@3.4.4/build/global/luxon.min.js"></script>
</head>
<body>
  <header class="header">
    <h1>シャード予報</h1>
    <p class="header-subtitle" id="current-date"></p>
  </header>

  <main class="main">
    <section class="next-shard-section">
      <div class="next-shard-card" id="next-shard-card"></div>
    </section>

    <section class="calendar-section">
      <div class="calendar-nav">
        <button class="nav-btn" id="prev-month">&#x2039;</button>
        <h2 class="calendar-title" id="calendar-title"></h2>
        <button class="nav-btn" id="next-month">&#x203a;</button>
      </div>
      <div class="calendar-grid" id="calendar-grid"></div>
    </section>
  </main>

  <div class="sheet-backdrop" id="sheet-backdrop"></div>
  <div class="bottom-sheet" id="bottom-sheet">
    <div class="sheet-grip"></div>
    <div class="sheet-content" id="sheet-content"></div>
  </div>

  <script src="shard.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: ブラウザで開いて白紙が表示されることを確認（エラーなし）**

- [ ] **Step 3: コミット**

```bash
git add index.html
git commit -m "feat: HTML skeleton"
```

---

### Task 5: style.css — Apple 風デザイン

**Files:**
- Modify: `style.css`

- [ ] **Step 1: style.css を実装**

```css
:root {
  --bg:           #ffffff;
  --bg-secondary: #f5f5f7;
  --text-primary: #1d1d1f;
  --text-secondary: #86868b;
  --text-tertiary: #aeaeb2;
  --separator:    #e5e5ea;
  --red:          #ff3b30;
  --gray:         #636366;
  --blue:         #0071e3;
  --font: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
}

* { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text-primary);
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
}

/* ── Header ── */
.header {
  padding: 20px 20px 12px;
  position: sticky; top: 0;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--separator);
  z-index: 10;
}
.header h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
.header-subtitle { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }

/* ── Main ── */
.main { padding: 16px 16px 100px; }

/* ── Next Shard Card ── */
.next-shard-section { margin-bottom: 24px; }

.next-shard-card {
  background: var(--bg-secondary);
  border-radius: 16px;
  padding: 16px;
}
.next-shard-label {
  font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.5px;
  color: var(--text-secondary); margin-bottom: 8px;
}
.next-shard-time {
  font-size: 36px; font-weight: 700;
  letter-spacing: -1.5px; line-height: 1;
  margin-bottom: 8px;
}
.next-shard-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
.next-shard-location { font-size: 13px; color: var(--text-secondary); }
.next-shard-count { font-size: 12px; color: var(--text-tertiary); }

/* ── Badges ── */
.shard-badge {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 12px; font-weight: 600;
  padding: 3px 8px; border-radius: 20px;
}
.shard-badge.red   { background: #fff2f1; color: var(--red); }
.shard-badge.black { background: #f2f2f7; color: var(--gray); }

/* ── Calendar Nav ── */
.calendar-nav {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px; padding: 0 4px;
}
.calendar-title { font-size: 17px; font-weight: 600; letter-spacing: -0.3px; }
.nav-btn {
  width: 32px; height: 32px; border: none;
  background: var(--bg-secondary); border-radius: 50%;
  font-size: 20px; color: var(--blue); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.nav-btn:hover   { background: #e5e5ea; }
.nav-btn:active  { background: #d1d1d6; }

/* ── Calendar Grid ── */
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.weekday-header {
  text-align: center; font-size: 11px; font-weight: 600;
  color: var(--text-secondary); padding: 4px 0 8px;
}
.weekday-header.sun { color: #ff3b30; }
.weekday-header.sat { color: var(--blue); }

.day-cell {
  aspect-ratio: 1;
  border-radius: 10px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 3px; cursor: pointer;
  transition: background 0.1s;
  user-select: none;
}
.day-cell:hover:not(.empty) { background: var(--bg-secondary); }
.day-cell:active:not(.empty) { background: #e5e5ea; }
.day-cell.empty { cursor: default; pointer-events: none; }

.day-number {
  font-size: 13px; font-weight: 500; line-height: 1;
  color: var(--text-primary);
}
.day-cell.today .day-number {
  width: 26px; height: 26px;
  background: #1d1d1f; color: #ffffff;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 12px;
}
.day-cell.no-shard .day-number { color: var(--text-tertiary); }

.shard-indicator { width: 5px; height: 5px; border-radius: 50%; }
.shard-indicator.red   { background: var(--red); }
.shard-indicator.black { background: var(--gray); }

/* ── Bottom Sheet ── */
.sheet-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0);
  z-index: 40; pointer-events: none;
  transition: background 0.3s;
}
.sheet-backdrop.visible {
  background: rgba(0,0,0,0.35);
  pointer-events: auto;
}

.bottom-sheet {
  position: fixed; bottom: 0;
  left: 50%; transform: translateX(-50%) translateY(100%);
  width: 100%; max-width: 480px;
  background: var(--bg);
  border-radius: 20px 20px 0 0;
  z-index: 50;
  padding: 8px 16px 48px;
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  max-height: 80vh; overflow-y: auto;
}
.bottom-sheet.open { transform: translateX(-50%) translateY(0); }

.sheet-grip {
  width: 36px; height: 4px;
  background: var(--separator); border-radius: 2px;
  margin: 0 auto 16px;
}

.sheet-date-header {
  display: flex; justify-content: space-between;
  align-items: center; margin-bottom: 14px;
}
.sheet-date-title { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }

.occurrence-card {
  background: var(--bg-secondary);
  border-radius: 12px; padding: 12px; margin-bottom: 8px;
}
.occ-time  { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
.occ-land  { font-size: 12px; color: var(--text-secondary); margin: 2px 0 8px; }
.occ-meta  { display: flex; gap: 6px; align-items: center; font-size: 13px; color: var(--text-secondary); }

.no-shard-message {
  text-align: center; color: var(--text-tertiary);
  padding: 32px 0; font-size: 15px;
}
```

- [ ] **Step 2: ブラウザで index.html を開き、ヘッダーと白いカード領域が見えることを確認**

- [ ] **Step 3: コミット**

```bash
git add style.css
git commit -m "feat: Apple-style CSS design"
```

---

### Task 6: app.js — カレンダー描画とナビゲーション

**Files:**
- Modify: `app.js`

- [ ] **Step 1: app.js を実装（カレンダー部分）**

```js
/* global luxon, getShardInfo, findNextShard */

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

let currentYear  = luxon.DateTime.now().setZone('America/Los_Angeles').year;
let currentMonth = luxon.DateTime.now().setZone('America/Los_Angeles').month;

function updateHeaderDate() {
  const nowSky = luxon.DateTime.now().setZone('America/Los_Angeles');
  const fmt = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  document.getElementById('current-date').textContent = fmt.format(nowSky.toJSDate());
}

function renderCalendar(year, month) {
  const title = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' })
    .format(new Date(year, month - 1));
  document.getElementById('calendar-title').textContent = title;

  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  // 曜日ヘッダー
  WEEKDAYS_JA.forEach((d, i) => {
    const hdr = document.createElement('div');
    hdr.className = 'weekday-header' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '');
    hdr.textContent = d;
    grid.appendChild(hdr);
  });

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=日
  const daysInMonth    = new Date(year, month, 0).getDate();
  const todaySky       = luxon.DateTime.now().setZone('America/Los_Angeles').startOf('day');

  // 月初め前の空セル
  for (let i = 0; i < firstDayOfWeek; i++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell empty';
    grid.appendChild(cell);
  }

  // 日付セル
  for (let d = 1; d <= daysInMonth; d++) {
    // Sky ゾーンで正午を指定してその暦日のシャードを取得（タイムゾーン境界を回避）
    const skyDate = luxon.DateTime.fromObject(
      { year, month, day: d, hour: 12 },
      { zone: 'America/Los_Angeles' }
    );
    const info = getShardInfo(skyDate);
    const isToday = skyDate.toISODate() === todaySky.toISODate();

    const cell = document.createElement('div');
    const classes = ['day-cell'];
    if (!info.hasShard) classes.push('no-shard');
    if (isToday)        classes.push('today');
    cell.className = classes.join(' ');

    const num = document.createElement('div');
    num.className = 'day-number';
    num.textContent = d;
    cell.appendChild(num);

    if (info.hasShard) {
      const dot = document.createElement('div');
      dot.className = 'shard-indicator ' + (info.isRed ? 'red' : 'black');
      cell.appendChild(dot);
    }

    cell.addEventListener('click', () => showDetail(skyDate, info));
    grid.appendChild(cell);
  }
}

document.getElementById('prev-month').addEventListener('click', () => {
  if (--currentMonth === 0) { currentMonth = 12; currentYear--; }
  renderCalendar(currentYear, currentMonth);
});
document.getElementById('next-month').addEventListener('click', () => {
  if (++currentMonth === 13) { currentMonth = 1; currentYear++; }
  renderCalendar(currentYear, currentMonth);
});
```

- [ ] **Step 2: app.js 末尾に DOMContentLoaded を追加（後のタスクで更新する）**

```js
document.addEventListener('DOMContentLoaded', () => {
  updateHeaderDate();
  renderCalendar(currentYear, currentMonth);
});
```

- [ ] **Step 3: ブラウザで確認**

- カレンダーグリッドが表示される
- 今日の日付が黒丸でハイライトされている
- 赤・黒のドットが各日に表示される
- ← → で月が切り替わる

- [ ] **Step 4: コミット**

```bash
git add app.js
git commit -m "feat: calendar grid with month navigation"
```

---

### Task 7: app.js — ボトムシート

**Files:**
- Modify: `app.js`

- [ ] **Step 1: app.js に showDetail / hideSheet を追加（DOMContentLoaded の前に挿入）**

```js
function showDetail(skyDate, info) {
  const dateStr = skyDate.setLocale('ja').toFormat('M月d日（EEE）');
  let html = `
    <div class="sheet-date-header">
      <div class="sheet-date-title">${dateStr}</div>
      ${info.hasShard
        ? `<span class="shard-badge ${info.isRed ? 'red' : 'black'}">${info.isRed ? '🔴 赤' : '⚫ 黒'}</span>`
        : ''}
    </div>
  `;

  if (!info.hasShard) {
    html += `<div class="no-shard-message">この日はシャードなし</div>`;
  } else {
    info.occurrences.forEach(occ => {
      html += `
        <div class="occurrence-card">
          <div class="occ-time">${occ.startLocal.toFormat('HH:mm')}</div>
          <div class="occ-land">着地 ${occ.landLocal.toFormat('HH:mm')} &nbsp;·&nbsp; 消滅 ${occ.endLocal.toFormat('HH:mm')}</div>
          <div class="occ-meta">
            <span class="shard-badge ${info.isRed ? 'red' : 'black'}" style="font-size:11px;padding:2px 7px">${info.realmJa}</span>
            <span>${info.location}</span>
          </div>
        </div>
      `;
    });
  }

  document.getElementById('sheet-content').innerHTML = html;
  document.getElementById('bottom-sheet').classList.add('open');
  document.getElementById('sheet-backdrop').classList.add('visible');
}

function hideSheet() {
  document.getElementById('bottom-sheet').classList.remove('open');
  document.getElementById('sheet-backdrop').classList.remove('visible');
}
```

- [ ] **Step 2: DOMContentLoaded に backdrop イベントを追加**

```js
document.addEventListener('DOMContentLoaded', () => {
  updateHeaderDate();
  renderCalendar(currentYear, currentMonth);
  document.getElementById('sheet-backdrop').addEventListener('click', hideSheet);
});
```

- [ ] **Step 3: ブラウザで確認**

- 日付セルをタップ → ボトムシートが下からスライドアップ
- シャードのある日：3回分の時刻・着地・消滅・領域・場所が表示される
- シャードなしの日：「この日はシャードなし」が表示される
- 背景タップ → シートが閉じる

- [ ] **Step 4: コミット**

```bash
git add app.js
git commit -m "feat: bottom sheet detail view"
```

---

### Task 8: app.js — 次のシャードカード

**Files:**
- Modify: `app.js`

- [ ] **Step 1: renderNextShard を追加（showDetail の前に挿入）**

```js
function renderNextShard() {
  const nowSky  = luxon.DateTime.now().setZone('America/Los_Angeles');
  const info    = findNextShard(nowSky);
  const nextOcc = info.occurrences.find(occ => nowSky < occ.end) || info.occurrences[0];

  const todaySky    = nowSky.startOf('day');
  const tomorrowSky = todaySky.plus({ days: 1 });
  const isToday     = info.date.toISODate() === todaySky.toISODate();
  const isTomorrow  = info.date.toISODate() === tomorrowSky.toISODate();
  const dateLabel   = isToday ? '今日' : isTomorrow ? '明日' : info.date.setLocale('ja').toFormat('M月d日');

  const remaining = info.occurrences.filter(occ => nowSky < occ.end).length;

  document.getElementById('next-shard-card').innerHTML = `
    <div class="next-shard-label">次のシャード</div>
    <div class="next-shard-time">${nextOcc.startLocal.toFormat('HH:mm')}</div>
    <div class="next-shard-meta">
      <span class="shard-badge ${info.isRed ? 'red' : 'black'}">${info.isRed ? '🔴 赤' : '⚫ 黒'}</span>
      <span class="next-shard-location">${info.realmJa} &nbsp;·&nbsp; ${info.location}</span>
    </div>
    <div class="next-shard-count">${dateLabel} &nbsp;·&nbsp; あと${remaining}回</div>
  `;
}
```

- [ ] **Step 2: DOMContentLoaded を最終形に更新**

```js
document.addEventListener('DOMContentLoaded', () => {
  updateHeaderDate();
  renderCalendar(currentYear, currentMonth);
  renderNextShard();
  setInterval(renderNextShard, 60_000); // 1分ごとに更新
  document.getElementById('sheet-backdrop').addEventListener('click', hideSheet);
});
```

- [ ] **Step 3: ブラウザで確認**

- 上部カードに「次のシャード」時刻・種別・領域・場所が表示される
- 「今日」「明日」ラベルが正しい
- 「あとN回」が正しい（本日最後の回が終わっていれば翌日の情報に切り替わる）

- [ ] **Step 4: コミット**

```bash
git add app.js
git commit -m "feat: next shard card with auto-refresh"
```

---

### Task 9: GitHub Pages デプロイ

**Files:** なし（リポジトリ設定のみ）

- [ ] **Step 1: GitHub でリポジトリを作成**

```bash
gh repo create sky-shards --public --source=. --remote=origin
```

- [ ] **Step 2: push**

```bash
git push -u origin main
```

- [ ] **Step 3: GitHub Pages を有効化**

```bash
gh api repos/:owner/sky-shards/pages \
  --method POST \
  --field source='{"branch":"main","path":"/"}'
```

または: GitHub の Settings → Pages → Source: `main` / `/ (root)` → Save

- [ ] **Step 4: デプロイ完了を確認**

数分後に `https://<username>.github.io/sky-shards/` を開き、カレンダーが表示されることを確認。
