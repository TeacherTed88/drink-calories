/**
 * Rendering layer — the ONLY module that builds DOM. It receives state and an
 * `actions` callback bag from app.js and knows nothing about storage or auth.
 * List-heavy sections re-render fully on each change: the dataset is tiny
 * (≤7×19 numbers), so simplicity wins over surgical DOM updates.
 */

import { DAY_NAMES, dayTotal, weekTotal, drinkFrequency, alcoholGrams } from './core.js';

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
  let listEditMode = false; // reveals remove-buttons on the personal list
  let catalogPath = []; // drill-down location inside the catalog folder tree

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

  function drinkRowShell(drink, extraClass = '') {
    const row = el('div', 'row ' + extraClass);
    row.append(el('span', 'dot', ''));
    row.querySelector('.dot').style.background = `var(${drink.color})`;
    const info = el('div', 'info');
    info.append(el('div', 'name', drink.name));
    return { row, info };
  }

  /** Personal shortlist — counters; order is FROZEN at Monday's weekly reset,
   *  so tapping drinks never shuffles the list mid-week. */
  function renderPersonalList(drinks, data, selectedDay, onIncrement, onDecrement, filterText, actions) {
    const host = $('rows');
    host.innerHTML = '';
    const term = filterText.trim().toLowerCase();
    const stored = Array.isArray(data.myOrder) && data.myOrder.length ? data.myOrder : data.myDrinks;
    const mine = [...new Set(stored)] // de-dup, then append anything missing at the end
      .concat(data.myDrinks.filter((j) => !stored.includes(j)))
      .filter((j) => j < drinks.length)
      .filter((j) => !term || drinks[j].name.toLowerCase().includes(term));

    if (mine.length === 0) {
      host.append(el('div', 'hempty',
        term ? `No drinks in your list match "${filterText}"` : 'Your list is empty — add beers from the catalog below.'));
      return;
    }

    for (const j of mine) {
      const { row, info } = drinkRowShell(drinks[j]);
      info.append(el('div', 'serv num', `${drinks[j].serving} · ${data.kcal[j]} kcal`));
      const ctl = el('div', 'ctl');
      if (listEditMode) {
        const rm = el('button', 'cbtn rm', '✕');
        rm.title = 'Remove from your list (logged calories are kept)';
        rm.onclick = () => actions.onRemoveFromMine(j);
        ctl.append(rm);
      }
      ctl.append(createCounter(
        data.week[selectedDay][j],
        () => onDecrement(j),
        () => onIncrement(j)
      ));
      row.append(info, ctl);
      host.append(row);
    }
  }

  const PATH_LABELS = {
    china: 'Chinese beers 中国啤酒 (domestic)',
    intl: 'International 进口',
    asia: 'Asia',
    'north-america': 'North America',
    europe: 'Europe',
    japan: 'Japan 日本',
    thailand: 'Thailand 泰国',
    singapore: 'Singapore',
    philippines: 'Philippines',
    denmark: 'Denmark',
    netherlands: 'Netherlands',
    germany: 'Germany',
    france: 'France',
    ireland: 'Ireland',
    mexico: 'Mexico',
    usa: 'USA',
    canada: 'Canada (Toronto)',
    spirits: 'Spirits & wine',
  };
  const pathLabel = (seg) => PATH_LABELS[seg] || seg;
  const startsWithPath = (path, prefix) =>
    prefix.every((seg, k) => path[k] === seg);

  /** Master catalog: folder tree with drill-down. Folders render from the drink
   *  paths alone, so adding a country = adding one drink with a new path. */
  function renderCatalog(drinks, data, filterText, actions) {
    const host = $('catalog');
    host.innerHTML = '';
    const term = filterText.trim().toLowerCase();

    // Search flattens the whole tree and shows matches with their folder trail.
    if (term) {
      const matches = drinks
        .map((drink, index) => ({ drink, index }))
        .filter(({ drink, index }) =>
          !data.myDrinks.includes(index) &&
          drink.name.toLowerCase().includes(term));
      for (const { drink, index: j } of matches) {
        const { row, info } = drinkRowShell(drinks[j]);
        info.append(el('div', 'serv num',
          `${drink.path.map(pathLabel).join(' › ')} · ${drink.serving} · ${data.kcal[j]} kcal`));
        const add = el('button', 'addbtn', '＋ Add');
        add.onclick = () => actions.onAddToMine(j);
        row.append(info, add);
        host.append(row);
      }
      if (matches.length === 0) host.append(el('div', 'hempty', `No catalog drinks match "${filterText}"`));
      return;
    }

    // Breadcrumb back-button when drilled in.
    if (catalogPath.length > 0) {
      const back = el('button', 'cat-head', '');
      back.innerHTML = `<span class="cat-arrow">←</span> Back · ` +
        catalogPath.map(pathLabel).join(' › ');
      back.onclick = () => { catalogPath.pop(); if (lastView) render(lastView); };
      host.append(back);
    }

    // Subfolders at this level (each shows total drinks in its subtree).
    const childSegments = [...new Set(
      drinks.filter((d) => startsWithPath(d.path, catalogPath) && d.path.length > catalogPath.length)
            .map((d) => d.path[catalogPath.length]))];
    for (const seg of childSegments) {
      const subtree = drinks.filter((d) => startsWithPath(d.path, [...catalogPath, seg]));
      const available = subtree.filter((d) => !data.myDrinks.includes(drinks.indexOf(d))).length;
      if (available === 0) continue;
      const head = el('button', 'cat-head', '');
      head.innerHTML = `<span class="cat-arrow">▸</span> 📁 ${pathLabel(seg)} <span class="cat-count">${available}</span>`;
      head.onclick = () => { catalogPath.push(seg); if (lastView) render(lastView); };
      host.append(head);
    }

    // Drinks sitting directly in this folder.
    const here = drinks
      .map((drink, index) => ({ drink, index }))
      .filter(({ drink, index }) =>
        drink.path.length === catalogPath.length &&
        startsWithPath(drink.path, catalogPath) &&
        !data.myDrinks.includes(index));
    for (const { drink, index: j } of here) {
      const { row, info } = drinkRowShell(drinks[j]);
      info.append(el('div', 'serv num', `${drink.serving} · ${data.kcal[j]} kcal`));
      const add = el('button', 'addbtn', '＋ Add');
      add.onclick = () => actions.onAddToMine(j);
      row.append(info, add);
      host.append(row);
    }

    if (host.querySelectorAll('.row, .cat-head').length === (catalogPath.length > 0 ? 1 : 0)) {
      host.append(el('div', 'hempty', 'Everything here is already in your list.'));
    }
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

  function renderHistory(data, drinks, currentWeekKey) {
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
      const gramsHist = Math.round(alcoholGrams(entry.drinks, drinks.map((d) => d.grams || 0)));
      const monday = new Date(`${key}T00:00:00`);
      const sunday = new Date(monday.getTime() + 6 * MS_PER_DAY);
      const row = el('div', 'hrow');
      row.innerHTML =
        `<span class="hr-l num">${fmtDayMonth(monday)} – ${fmtDayMonth(sunday)}` +
        `<span class="hr-s num">avg ${Math.round(total / 7)} kcal/day · ${gramsHist} g alcohol</span></span>` +
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
    // Secondary metric: pure alcohol (grams), shown alongside calories.
    const grams = drinks.map((drink) => drink.grams || 0);
    const gramsDay = Math.round(alcoholGrams(data.week[selectedDay], grams));
    const gramsWeek = Math.round(data.week.reduce((sum, counts) => sum + alcoholGrams(counts, grams), 0));
    $('wkGrams').textContent = `${gramsWeek} g pure alcohol this week`;
    $('dayGrams').textContent = gramsDay;
    const todayIdx = (new Date().getDay() + 6) % 7;
    $('dayLbl').textContent =
      `${DAY_NAMES[selectedDay]} ${fmtDayMonth(weekDates[selectedDay])}` +
      (selectedDay === todayIdx ? ' · today' : '');

    renderDays(data, weekDates, selectedDay, actions.onSelectDay);
    renderPersonalList(drinks, data, selectedDay, actions.onIncrement, actions.onDecrement, filterText, actions);
    renderCatalog(drinks, data, filterText, actions);
    $('editListBtn').textContent = listEditMode ? 'Done' : 'Edit';
    renderWeekChart(data, selectedDay);
    renderHistory(data, drinks, data.weekKey);
    renderKcalEditor(drinks, data, actions.onUpdateKcal);
  }

  /* ------------------------------ wiring ------------------------------ */
  function bind() {
    bindAuth();
    $('drinkFilter').oninput = () => { if (lastView) render(lastView); };
    $('editListBtn').onclick = () => {
      listEditMode = !listEditMode;
      if (lastView) render(lastView);
    };
    $('clearDay').onclick = actions.onClearDay;
    $('lockBtn').onclick = actions.onLock;
    $('userChip').onclick = actions.onLock; // tapping your name signs out too
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
