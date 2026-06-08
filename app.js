/* global luxon, getShardInfo, findNextShard */

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

function getNow() {
  const param = new URLSearchParams(window.location.search).get('mockTime');
  return param
    ? luxon.DateTime.fromISO(param).setZone('America/Los_Angeles')
    : luxon.DateTime.now().setZone('America/Los_Angeles');
}

const _initSky   = getNow();
let currentYear  = _initSky.year;
let currentMonth = _initSky.month;

function rewardHTML(info) {
  if (info.isRed) return `<span class="reward-text">星キャン${info.rewardAC}本分</span>`;
  return `<span class="reward-text">大キャン4つ分</span>`;
}

function badgeAndRewardHTML(info) {
  const label = info.isRed ? `星キャン${info.rewardAC}本分` : '大キャン4つ分';
  return `<div class="badge-reward">
    <span class="shard-badge ${info.isRed ? 'red' : 'black'}">${info.isRed ? '🔴' : '⚫'} ${label}</span>
  </div>`;
}

function timeRangeHTML(landLocal, endLocal) {
  const crossMidnight = landLocal.toISODate() !== endLocal.toISODate();
  const fmtDate = dt => dt.setLocale('ja').toFormat('MM/dd(EEE)');
  const fmtTime = dt => dt.toFormat('HH:mm');
  const rightDateVis = crossMidnight ? 'visible' : 'hidden';

  return `<div class="time-range">
    <div class="time-col">
      <div class="time-date">${fmtDate(landLocal)}</div>
      <div class="time-value">${fmtTime(landLocal)}</div>
    </div>
    <div class="time-sep">-</div>
    <div class="time-col">
      <div class="time-date" style="visibility:${rightDateVis}">${fmtDate(endLocal)}</div>
      <div class="time-value">${fmtTime(endLocal)}</div>
    </div>
  </div>`;
}

function renderCalendarGrid(year, month, gridEl) {
  gridEl.innerHTML = '';

  WEEKDAYS_JA.forEach((d, i) => {
    const hdr = document.createElement('div');
    hdr.className = 'weekday-header' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '');
    hdr.textContent = d;
    gridEl.appendChild(hdr);
  });

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const daysInMonth    = new Date(year, month, 0).getDate();
  const todaySky       = getNow().startOf('day');

  for (let i = 0; i < firstDayOfWeek; i++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell empty';
    gridEl.appendChild(cell);
  }

  for (let d = 1; d <= daysInMonth; d++) {
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
    if (info.hasShard)  classes.push(info.isRed ? 'shard-red' : 'shard-black');
    cell.className = classes.join(' ');

    const num = document.createElement('div');
    num.className = 'day-number';
    num.textContent = d;
    cell.appendChild(num);

    cell.addEventListener('click', () => {
      const prev = document.querySelector('.day-cell.pressing');
      if (prev && prev !== cell) prev.classList.remove('pressing');
      showDetail(skyDate, info);
    });
    gridEl.appendChild(cell);
  }

  const totalCells  = firstDayOfWeek + daysInMonth;
  const paddingCells = (6 - Math.ceil(totalCells / 7)) * 7;
  for (let i = 0; i < paddingCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell empty';
    gridEl.appendChild(cell);
  }
}

function renderCalendar(year, month) {
  const title = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' })
    .format(new Date(year, month - 1));
  document.getElementById('calendar-title').textContent = title;
  renderCalendarGrid(year, month, document.getElementById('calendar-grid'));
}

function buildDayLabel(skyDate) {
  const resetJST = skyDate.startOf('day').setZone('Asia/Tokyo');
  return `${resetJST.month}/${resetJST.day}（${WEEKDAYS_JA[resetJST.weekday % 7]}） ${resetJST.toFormat('HH:mm')}-`;
}

function computeLineLeft(nowSky, occurrences) {
  const first = occurrences[0];
  const last  = occurrences[occurrences.length - 1];
  if (nowSky < first.land) return '5px';
  if (nowSky > last.end)   return 'calc(100% - 5px)';

  for (let i = 0; i < occurrences.length; i++) {
    const occ = occurrences[i];
    if (nowSky >= occ.land && nowSky <= occ.end) {
      const dur = occ.end.diff(occ.land).as('milliseconds');
      const elp = nowSky.diff(occ.land).as('milliseconds');
      const p   = Math.max(0, Math.min(1, elp / dur));
      return `calc(${10 + i * 12}px + ${(i + p).toFixed(4)} * (100% - 44px) / 3)`;
    }
    if (i < occurrences.length - 1 && nowSky > occ.end && nowSky < occurrences[i + 1].land) {
      return `calc(${16 + i * 12}px + ${i + 1} * (100% - 44px) / 3)`;
    }
  }
  return '5px';
}

function renderTodayCard() {
  const nowSky       = getNow();
  const todayInfo    = getShardInfo(nowSky);
  const tomorrowInfo = getShardInfo(nowSky.plus({ days: 1 }));

  const todayLabel    = buildDayLabel(nowSky);
  const tomorrowLabel = buildDayLabel(nowSky.plus({ days: 1 }));

  let todayHTML = '';
  if (!todayInfo.hasShard) {
    todayHTML = '<div class="today-no-shard">シャードなし</div>';
  } else {
    const lineLeft = computeLineLeft(nowSky, todayInfo.occurrences);
    const emoji    = todayInfo.isRed ? '🔴' : '⚫';
    const reward   = todayInfo.isRed ? `星キャン${todayInfo.rewardAC}本分` : '大キャン4つ分';
    const cols     = todayInfo.occurrences.map(occ => {
      const cls   = nowSky > occ.end ? 'slot-past' : 'slot-future';
      const start = occ.landLocal.toFormat('HH:mm');
      const end   = occ.endLocal.toFormat('HH:mm');
      return `<div class="slot-col ${cls}">
        <div class="slot-time-main">${start}</div>
        <div class="slot-time-end">- ${end}</div>
      </div>`;
    }).join('');
    todayHTML = `
      <div class="day-card-badge">${emoji} <span class="day-card-reward">${reward}</span></div>
      <div class="day-card-loc">${todayInfo.realmJa} · ${todayInfo.location}</div>
      <div class="slot-grid-wrap">
        <div class="slot-now-line" style="left:${lineLeft}"></div>
        <div class="slot-grid">${cols}</div>
      </div>`;
  }

  let tomorrowHTML = 'シャードなし';
  if (tomorrowInfo.hasShard) {
    const emoji  = tomorrowInfo.isRed ? '🔴' : '⚫';
    const reward = tomorrowInfo.isRed ? `星キャン${tomorrowInfo.rewardAC}本分` : '大キャン4つ分';
    const times  = tomorrowInfo.occurrences.map(occ => occ.landLocal.toFormat('HH:mm') + '-').join(' / ');
    tomorrowHTML = `${emoji} ${reward}<br>${tomorrowInfo.realmJa} · ${tomorrowInfo.location} &nbsp;&nbsp; ${times}`;
  }

  document.getElementById('next-shard-card').innerHTML = `
    <div class="day-card-label">${todayLabel}</div>
    ${todayHTML}
    <hr class="day-card-divider">
    <div class="day-card-tomorrow"><b>${tomorrowLabel}</b><br>${tomorrowHTML}</div>
  `;
}

function showDetail(skyDate, info) {
  const dateStr = skyDate.setLocale('ja').toFormat('M月d日（EEE）');
  let html = `
    <div class="sheet-date-header">
      <div class="sheet-date-title">${dateStr}</div>
      ${info.hasShard ? badgeAndRewardHTML(info) : ''}
    </div>
    ${info.hasShard ? `<div class="sheet-location">${info.realmJa} · ${info.location}</div>` : ''}
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
  const pressing = document.querySelector('.day-cell.pressing');
  if (pressing) pressing.classList.remove('pressing');
}

function changeMonth(delta) {
  currentMonth += delta;
  if (currentMonth > 12) { currentMonth = 1; currentYear++; }
  if (currentMonth < 1)  { currentMonth = 12; currentYear--; }
  renderCalendar(currentYear, currentMonth);
}

const SWIPE_GAP = 24;

function createPeekGrid(delta) {
  const wrapper = document.querySelector('.calendar-grid-wrapper');
  const peek = document.createElement('div');
  peek.className = 'calendar-grid';
  const peekBase = delta > 0 ? `calc(100% + ${SWIPE_GAP}px)` : `calc(-100% - ${SWIPE_GAP}px)`;
  peek.style.cssText = `position:absolute;top:0;left:0;width:100%;transform:translateX(${peekBase});`;

  let adjYear = currentYear;
  let adjMonth = currentMonth + delta;
  if (adjMonth > 12) { adjMonth = 1; adjYear++; }
  if (adjMonth < 1)  { adjMonth = 12; adjYear--; }
  renderCalendarGrid(adjYear, adjMonth, peek);

  wrapper.appendChild(peek);
  return peek;
}

function slideMonth(delta) {
  const mainGrid = document.getElementById('calendar-grid');
  const wrapper  = document.querySelector('.calendar-grid-wrapper');
  const peek = createPeekGrid(delta);

  const peekHeight = peek.scrollHeight;
  if (peekHeight > wrapper.offsetHeight) {
    wrapper.style.minHeight = peekHeight + 'px';
  }

  peek.getBoundingClientRect();

  mainGrid.style.transition = 'transform 0.3s ease-out';
  mainGrid.style.transform  = `translateX(${delta > 0 ? '-100%' : '100%'})`;
  peek.style.transition     = 'transform 0.3s ease-out';
  peek.style.transform      = 'translateX(0)';

  peek.addEventListener('transitionend', function handler(e) {
    if (e.propertyName !== 'transform') return;
    peek.removeEventListener('transitionend', handler);
    changeMonth(delta);
    mainGrid.style.transition = 'none';
    mainGrid.style.transform  = 'translateX(0)';
    wrapper.style.minHeight   = '';
    peek.remove();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderCalendar(currentYear, currentMonth);
  renderTodayCard();
  setInterval(renderTodayCard, 60_000);

  document.getElementById('prev-month').addEventListener('click', () => slideMonth(-1));
  document.getElementById('next-month').addEventListener('click', () => slideMonth(1));
  document.getElementById('sheet-backdrop').addEventListener('click', hideSheet);

  const calSection = document.querySelector('.calendar-section');
  let swipeStartX  = 0;
  let swipeStartY  = 0;
  let swipeAxis    = null;
  let peekGrid     = null;
  let peekDelta    = 0;
  let isAnimating  = false;
  let pressingCell = null;
  const AXIS_THRESHOLD  = 8;
  const SWIPE_THRESHOLD = 50;

  calSection.addEventListener('touchstart', (e) => {
    if (isAnimating) return;
    const mainGrid = document.getElementById('calendar-grid');
    mainGrid.style.transition = 'none';
    mainGrid.style.transform  = 'translateX(0)';
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
    peekDelta   = 0;
    swipeAxis   = null;
    const cell = e.target.closest('.day-cell:not(.empty)');
    if (cell) { pressingCell = cell; cell.classList.add('pressing'); }
  }, { passive: true });

  calSection.addEventListener('touchmove', (e) => {
    if (isAnimating) return;
    const dx = e.touches[0].clientX - swipeStartX;
    const dy = e.touches[0].clientY - swipeStartY;

    if (!swipeAxis && Math.hypot(dx, dy) > AXIS_THRESHOLD) {
      if (pressingCell) { pressingCell.classList.remove('pressing'); pressingCell = null; }
      swipeAxis = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
      if (swipeAxis === 'h') {
        peekDelta = dx < 0 ? 1 : -1;
        peekGrid  = createPeekGrid(peekDelta);
      }
    }

    if (swipeAxis === 'h') {
      e.preventDefault();
      document.getElementById('calendar-grid').style.transform = `translateX(${dx}px)`;
      if (peekGrid) {
        const base = peekDelta > 0 ? `100% + ${SWIPE_GAP}px` : `-100% - ${SWIPE_GAP}px`;
        peekGrid.style.transform = `translateX(calc(${base} + ${dx}px))`;
      }
    }
  }, { passive: false });

  calSection.addEventListener('touchcancel', () => {
    if (pressingCell) { pressingCell.classList.remove('pressing'); pressingCell = null; }
  });

  calSection.addEventListener('touchend', (e) => {
    if (swipeAxis === 'h') {
      const dx       = e.changedTouches[0].clientX - swipeStartX;
      const mainGrid = document.getElementById('calendar-grid');

      if (Math.abs(dx) >= SWIPE_THRESHOLD && peekGrid) {
        isAnimating = true;

        const wrapper    = document.querySelector('.calendar-grid-wrapper');
        const peekHeight = peekGrid.scrollHeight;
        if (peekHeight > wrapper.offsetHeight) {
          wrapper.style.minHeight = peekHeight + 'px';
        }
        wrapper.getBoundingClientRect();

        mainGrid.style.transition = 'transform 0.2s ease-out';
        mainGrid.style.transform  = `translateX(${peekDelta > 0 ? '-100%' : '100%'})`;
        peekGrid.style.transition = 'transform 0.2s ease-out';
        peekGrid.style.transform  = 'translateX(0)';

        const p = peekGrid;
        p.addEventListener('transitionend', function handler(e) {
          if (e.propertyName !== 'transform') return;
          p.removeEventListener('transitionend', handler);
          if (!p.isConnected) return;
          changeMonth(peekDelta);
          mainGrid.style.transition = 'none';
          mainGrid.style.transform  = 'translateX(0)';
          wrapper.style.minHeight   = '';
          p.remove();
          peekGrid = null;
          isAnimating = false;
        });
      } else {
        isAnimating = true;
        mainGrid.style.transition = 'transform 0.2s ease-out';
        mainGrid.style.transform  = 'translateX(0)';
        if (peekGrid) {
          const p = peekGrid;
          p.style.transition = 'transform 0.2s ease-out';
          p.style.transform  = `translateX(${peekDelta > 0 ? `calc(100% + ${SWIPE_GAP}px)` : `calc(-100% - ${SWIPE_GAP}px)`})`;
          p.addEventListener('transitionend', function handler(e) {
            if (e.propertyName !== 'transform') return;
            p.removeEventListener('transitionend', handler);
            p.remove();
            peekGrid = null;
            isAnimating = false;
          });
        } else {
          isAnimating = false;
        }
      }
    }
    swipeAxis = null;
  }, { passive: true });
});
