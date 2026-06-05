/* global luxon, getShardInfo, findNextShard */

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

const _initSky   = luxon.DateTime.now().setZone('America/Los_Angeles');
let currentYear  = _initSky.year;
let currentMonth = _initSky.month;

function timeRangeHTML(landLocal, endLocal) {
  const crossMidnight = landLocal.toISODate() !== endLocal.toISODate();
  const fmtDate = dt => dt.setLocale('ja').toFormat('MM/dd(EEE)');
  const fmtTime = dt => dt.toFormat('HH:mm');

  if (crossMidnight) {
    return `<div class="time-range cross-midnight">
      <div class="time-col">
        <div class="time-date">${fmtDate(landLocal)}</div>
        <div class="time-value">${fmtTime(landLocal)}</div>
      </div>
      <div class="time-sep">-</div>
      <div class="time-col">
        <div class="time-date">${fmtDate(endLocal)}</div>
        <div class="time-value">${fmtTime(endLocal)}</div>
      </div>
    </div>`;
  } else {
    return `<div class="time-range">
      <div class="time-date">${fmtDate(landLocal)}</div>
      <div class="time-value">${fmtTime(landLocal)} - ${fmtTime(endLocal)}</div>
    </div>`;
  }
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

function renderNextShard() {
  const nowSky  = luxon.DateTime.now().setZone('America/Los_Angeles');
  const info    = findNextShard(nowSky);
  const nextOcc = info.occurrences.find(occ => nowSky < occ.end) || info.occurrences[0];
  const isActive = nowSky >= nextOcc.start;
  const label   = isActive ? '現在シャード中' : '次のシャード';

  document.getElementById('next-shard-card').innerHTML = `
    <div class="next-shard-label">${label}</div>
    ${timeRangeHTML(nextOcc.landLocal, nextOcc.endLocal)}
    <div class="next-shard-meta">
      <span class="shard-badge ${info.isRed ? 'red' : 'black'}">${info.isRed ? '🔴 赤' : '⚫ 黒'}</span>
      <span class="next-shard-location">${info.realmJa} &nbsp;·&nbsp; ${info.location}</span>
    </div>
  `;
}

function showDetail(skyDate, info) {
  const dateStr = skyDate.setLocale('ja').toFormat('M月d日（EEE）');
  let html = `
    <div class="sheet-date-header">
      <div class="sheet-date-title">${dateStr}</div>
      ${info.hasShard ? `
        <div class="sheet-header-right">
          <span class="shard-badge ${info.isRed ? 'red' : 'black'}">${info.isRed ? '🔴 赤' : '⚫ 黒'}</span>
          <span class="sheet-location">${info.realmJa} · ${info.location}</span>
        </div>` : ''}
    </div>
  `;

  if (!info.hasShard) {
    html += `<div class="no-shard-message">この日はシャードなし</div>`;
  } else {
    info.occurrences.forEach(occ => {
      html += `
        <div class="occurrence-card">
          ${timeRangeHTML(occ.landLocal, occ.endLocal)}
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

document.addEventListener('DOMContentLoaded', () => {
  renderCalendar(currentYear, currentMonth);
  renderNextShard();
  setInterval(renderNextShard, 60_000); // 1分ごとに更新
  document.getElementById('prev-month').addEventListener('click', () => {
    if (--currentMonth === 0) { currentMonth = 12; currentYear--; }
    renderCalendar(currentYear, currentMonth);
  });
  document.getElementById('next-month').addEventListener('click', () => {
    if (++currentMonth === 13) { currentMonth = 1; currentYear++; }
    renderCalendar(currentYear, currentMonth);
  });
  document.getElementById('sheet-backdrop').addEventListener('click', hideSheet);
});
