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

document.addEventListener('DOMContentLoaded', () => {
  updateHeaderDate();
  renderCalendar(currentYear, currentMonth);
});
