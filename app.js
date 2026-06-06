/* global luxon, getShardInfo, findNextShard */

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

const _initSky   = luxon.DateTime.now().setZone('America/Los_Angeles');
let currentYear  = _initSky.year;
let currentMonth = _initSky.month;

function rewardHTML(info) {
  if (info.isRed) return `<span class="reward-text">${info.rewardAC}本</span>`;
  return `<span class="reward-text">大キャン4つ分</span>`;
}

function badgeAndRewardHTML(info) {
  return `<div class="badge-reward">
    <span class="shard-badge ${info.isRed ? 'red' : 'black'}">${info.isRed ? '🔴 赤' : '⚫ 黒'}</span>
    ${rewardHTML(info)}
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
  const todaySky       = luxon.DateTime.now().setZone('America/Los_Angeles').startOf('day');

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

function computeSlots(info, nowSky) {
  const fmt = dt => dt.toFormat('HH:mm');
  return info.occurrences.map(occ => {
    const time = `${fmt(occ.landLocal)} - ${fmt(occ.endLocal)}`;
    if (nowSky >= occ.end)  return { time, state: 'past',   progress: 100 };
    if (nowSky >= occ.land) return { time, state: 'active', progress: Math.round((nowSky - occ.land) / (occ.end - occ.land) * 100) };
                            return { time, state: 'future', progress: 0 };
  });
}

function computePos(info, nowSky) {
  const occs = info.occurrences;
  for (let i = 0; i < occs.length; i++) {
    if (nowSky >= occs[i].land && nowSky < occs[i].end) return i * 2 + 1;
  }
  if (nowSky < occs[0].land) return 0;
  for (let i = 0; i < occs.length - 1; i++) {
    if (nowSky >= occs[i].end && nowSky < occs[i + 1].land) return i * 2 + 2;
  }
  return 6;
}

function placeIndicator(col, pos) {
  const indicator   = document.createElement('span');
  indicator.textContent = '▶';
  indicator.className   = 'time-indicator';
  col.appendChild(indicator);
  requestAnimationFrame(() => {
    const blocks = Array.from(col.querySelectorAll('.occ-block'));
    if (!blocks.length) { indicator.remove(); return; }
    let y;
    if (pos === 0) {
      y = blocks[0].offsetTop - 8;
    } else if (pos === 6) {
      const last = blocks[blocks.length - 1];
      y = last.offsetTop + last.offsetHeight - 2;
    } else if (pos % 2 === 0) {
      const prev = blocks[pos / 2 - 1];
      const next = blocks[pos / 2];
      y = (prev.offsetTop + prev.offsetHeight + next.offsetTop) / 2 - 5;
    } else {
      const block = blocks[(pos - 1) / 2];
      y = block.offsetTop + block.offsetHeight / 2 - 5;
    }
    indicator.style.top  = y + 'px';
    indicator.style.left = '-12px';
  });
}

function buildColumn(info, slots, isToday, pos) {
  const col      = document.createElement('div');
  col.className  = 'day-column' + (isToday ? ' today-col' : '');
  const dayLabel = isToday ? '今日' : '明日';
  const dateStr  = info.date.setLocale('ja').toFormat('M/d(EEE)');
  const badgeCls = info.isRed ? 'red' : 'black';
  const badgeTxt = info.isRed ? '🔴 赤' : '⚫ 黒';
  const reward   = info.isRed ? `${info.rewardAC}本` : '大キャン4つ分';
  col.innerHTML = `
    <div class="col-header">${dayLabel} · ${dateStr}</div>
    <div class="col-reward">
      <span class="shard-badge ${badgeCls}">${badgeTxt}</span>
      <span class="reward-text">${reward}</span>
    </div>
    <div class="col-sub">${info.realmJa} · ${info.location}</div>
  `;
  slots.forEach(slot => {
    const block     = document.createElement('div');
    block.className = `occ-block ${slot.state}`;
    block.innerHTML = `<div class="occ-fill" style="width:${slot.progress}%"></div><span class="occ-time">${slot.time}</span>`;
    col.appendChild(block);
  });
  if (isToday && pos !== null) placeIndicator(col, pos);
  return col;
}

function buildNoShardColumn(isToday, skyDate) {
  const col     = document.createElement('div');
  col.className = 'day-column';
  const dayLabel = isToday ? '今日' : '明日';
  const dateStr  = skyDate.setLocale('ja').toFormat('M/d(EEE)');
  col.innerHTML  = `
    <div class="col-header">${dayLabel} · ${dateStr}</div>
    <div class="no-shard-col">この日はシャードなし</div>
  `;
  return col;
}

function renderNextShard() {
  const nowSky  = luxon.DateTime.now().setZone('America/Los_Angeles');
  const info    = findNextShard(nowSky);
  const nextOcc = info.occurrences.find(occ => nowSky < occ.end) || info.occurrences[0];
  const isActive = nowSky >= nextOcc.land;
  const label    = isActive ? '現在シャード中' : '次のシャード';

  document.getElementById('next-shard-card').innerHTML = `
    <div class="next-shard-label-row">
      <div class="next-shard-label">${label}</div>
      ${badgeAndRewardHTML(info)}
    </div>
    ${timeRangeHTML(nextOcc.landLocal, nextOcc.endLocal)}
    <div class="next-shard-meta">
      <span class="next-shard-location">${info.realmJa} &nbsp;·&nbsp; ${info.location}</span>
    </div>
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
  renderNextShard();
  setInterval(renderNextShard, 60_000);

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
  }, { passive: true });

  calSection.addEventListener('touchmove', (e) => {
    if (isAnimating) return;
    const dx = e.touches[0].clientX - swipeStartX;
    const dy = e.touches[0].clientY - swipeStartY;

    if (!swipeAxis && Math.hypot(dx, dy) > AXIS_THRESHOLD) {
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
