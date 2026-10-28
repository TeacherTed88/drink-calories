/**
 * Rendering layer — the ONLY module that builds DOM. It receives state and an
 * `actions` callback bag from app.js and knows nothing about storage or auth.
 * List-heavy sections re-render fully on each change: the dataset is tiny
 * (≤7×19 numbers), so simplicity wins over surgical DOM updates.
 */

import { DAY_NAMES, dayTotal, weekTotal } from './core.js';

const MS_PER_DAY = 864e5;

const fmtDayMonth = (date) => `${date.getDate()}/${date.getMonth() + 1}`;

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function createCounter(value, onMinus, onPlus) {
  const wrap = el('div', 'ctl');
  const minus = el('button', 'cbtn', '−');
  const count = el('span', 'cnt num', String(value));
  const plus = el('button', 'cbtn', '+');
  minus.disabled = value === 0;
  minus.onclick = onMinus;
  plus.onclick = onPlus;
  wrap.append(minus, count, plus);
  return wrap;
}

export function createUI(actions) {
  const $ = (id) => document.getElementById(id);
  let lastView = null; // remembered so the search box can re-render on its own

  /* ------------------------------ toast ------------------------------ */
  let toastTimer = null;
  function toast(message) {
    const node = $('toast');
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('show'), 1400);
  }

  /* --------------------------- auth screen --------------------------- */
  function bindAuth() {
    $('authForm').onsubmit = (event) => {
      event.preventDefault();
      const name = $('authName').value;
      const password = $('authPassword').value;
      $('authError').textContent = '';
      actions.onSignIn(name, password);
    };
    $('authCreate').onclick = () => {
      const name = $('authName').value;
      const password = $('authPassword').value;
      $('authError').textContent = '';
      actions.onCreateAccount(name, password);
    };
  }

  function showAuth(error = '') {
    $('authError').textContent = error;
    $('authView').style.display = 'flex';
  }

  function hideAuth() {
    $('authView').style.display = 'none';
    $('authPassword').value = '';
  }

  /* --------------------------- main screens --------------------------- */
  function renderDays(data, weekDates, selectedDay, onSelect) {
    const host = $('days');
    host.innerHTML = '';
    DAY_NAMES.forEach((dayName, i) => {
      const button = el('button', 'day' + (i === selectedDay ? ' sel' : ''));
      const total = dayTotal(data.week[i], data.kcal);
      button.innerHTML =
        `<span class="d">${dayName}</span>` +
        `<span class="n num">${weekDates[i].getDate()}</span>` +
        `<span class="k num">${total || ''}</span>`;
      button.onclick = () => onSelect(i);
      host.append(button);
    });
  }

  function renderDrinkRows(drinks, data, selectedDay, onIncrement, onDecrement, filterText) {
    const host = $('rows');
    host.innerHTML = '';
    const term = filterText.trim().toLowerCase();
    const visible = drinks
      .map((drink, index) => ({ drink, index }))
      .filter(({ drink }) => !term || drink.name.toLowerCase().includes(term));
    if (visible.length === 0) {
      host.append(el('div', 'hempty', `No drinks match "${filterText}"`));
      return;
    }
    visible.forEach(({ drink, index: j }) => {
      const row = el('div', 'row');
      const info = el('div', 'info');
      info.append(
        el('div', 'name', drink.name),
        el('div', 'serv num', `${drink.serving} · ${data.kcal[j]} kcal`)
      );
      row.append(
        el('span', 'dot', ''),
        info,
        createCounter(
          data.week[selectedDay][j],
          () => onDecrement(j),
          () => onIncrement(j)
        )
      );
      row.querySelector('.dot').style.background = `var(${drink.color})`;
      host.append(row);
    });
  }

  function renderWeekChart(data, selectedDay) {
    const host = $('wk');
    host.innerHTML = '';
    const totals = data.week.map((counts) => dayTotal(counts, data.kcal));
    const max = Math.max(...totals, 0);
    totals.forEach((total, i) => {
      const height = max > 0 ? Math.max(3, Math.round((total / max) * 76)) : 3;
      const cell = el('div', 'wkc' + (i === selectedDay ? ' today' : ''));
      cell.title = `${DAY_NAMES[i]}: ${total} kcal`;
      cell.innerHTML =
        `<span class="wkv num">${total || ''}</span>` +
        `<div class="bar" style="height:${height}px"></div>` +
        `<span class="wkl">${DAY_NAMES[i][0]}</span>`;
      host.append(cell);
    });
  }

  function renderHistory(data, currentWeekKey) {
    const host = $('hist');
    host.innerHTML = '';
    const keys = Object.keys(data.hist)
      .filter((key) => key !== currentWeekKey)
      .sort()
      .reverse();
    if (keys.length === 0) {
      host.append(el('div', 'hempty', 'No finished weeks yet — each week is saved automatically when a new one starts.'));
      return;
    }
    for (const key of keys) {
      const entry = data.hist[key];
      const total = dayTotal(entry.drinks, entry.kcal);
      const monday = new Date(`${key}T00:00:00`);
      const sunday = new Date(monday.getTime() + 6 * MS_PER_DAY);
      const row = el('div', 'hrow');
      row.innerHTML =
        `<span class="hr-l num">${fmtDayMonth(monday)} – ${fmtDayMonth(sunday)}` +
        `<span class="hr-s num">avg ${Math.round(total / 7)} kcal/day</span></span>` +
        `<span class="hr-v num">${total} kcal</span>`;
      host.append(row);
    }
  }

  function renderKcalEditor(drinks, data, onUpdate) {
    const host = $('edit');
    host.innerHTML = '';
    drinks.forEach((drink, j) => {
      const row = el('div', 'edrow');
      row.innerHTML =
        `<span style="flex:1">${drink.name} <span class="serv num">(${drink.serving})</span></span>` +
        `<input type="number" inputmode="numeric" min="0" step="5" value="${data.kcal[j]}"><span class="serv">kcal</span>`;
      row.querySelector('input').onchange = (event) => {
        const value = Math.round(parseFloat(event.target.value));
        if (Number.isFinite(value) && value >= 0 && value <= 2000) {
          onUpdate(j, value);
        } else {
          event.target.value = data.kcal[j]; // reject nonsense, restore last good value
        }
      };
      host.append(row);
    });
  }

  /** Full repaint from state. Cheap at this scale and eliminates sync bugs. */
  function render(view) {
    lastView = view;
    const { user, drinks, data, weekDates, selectedDay } = view;
    const filterText = $('drinkFilter') ? $('drinkFilter').value : '';
    $('userChip').textContent = user.name;
    $('wrange').textContent =
      `Week ${fmtDayMonth(weekDates[0])} – ${fmtDayMonth(weekDates[6])}`;
    $('wkTotal').textContent = weekTotal(data.week, data.kcal);
    $('dayTotal').textContent = dayTotal(data.week[selectedDay], data.kcal);
    const todayIdx = (new Date().getDay() + 6) % 7;
    $('dayLbl').textContent =
      `${DAY_NAMES[selectedDay]} ${fmtDayMonth(weekDates[selectedDay])}` +
      (selectedDay === todayIdx ? ' · today' : '');

    renderDays(data, weekDates, selectedDay, actions.onSelectDay);
    renderDrinkRows(drinks, data, selectedDay, actions.onIncrement, actions.onDecrement, filterText);
    renderWeekChart(data, selectedDay);
    renderHistory(data, data.weekKey);
    renderKcalEditor(drinks, data, actions.onUpdateKcal);
  }

  /* ------------------------------ wiring ------------------------------ */
  function bind() {
    bindAuth();
    $('drinkFilter').oninput = () => { if (lastView) render(lastView); };
    $('clearDay').onclick = actions.onClearDay;
    $('lockBtn').onclick = actions.onLock;
    let editorOpen = false;
    $('gearBtn').onclick = () => {
      editorOpen = !editorOpen;
      $('edit').style.display = editorOpen ? 'block' : 'none';
      if (editorOpen) {
        setTimeout(() => $('edit').scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
      }
    };
  }

  return { bind, render, showAuth, hideAuth, toast };
}
