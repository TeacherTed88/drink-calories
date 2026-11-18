/**
 * Rendering layer — the ONLY module that builds DOM. It receives state and an
 * `actions` callback bag from app.js and knows nothing about storage or auth.
 * List-heavy sections re-render fully on each change: the dataset is tiny
 * (≤7×19 numbers), so simplicity wins over surgical DOM updates.
 */

import { DAY_NAMES, dayTotal, weekTotal, drinkFrequency, alcoholGrams, weekDrinkStats } from './core.js';

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
    canada: 'Canada',
    toronto: 'Toronto (LCBO)',
    tbs: 'The Beer Store (Ontario)',
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

  /** "vs last week" banner under the current-week header. */
  function renderComparison(data, drinks) {
    const host = $('wkCompare');
    const keys = Object.keys(data.hist).sort().reverse();
    if (keys.length === 0) { host.textContent = ''; return; }
    const prev = data.hist[keys[0]];
    const grams = drinks.map((d) => d.grams || 0);
    const prevTotal = dayTotal(prev.drinks, prev.kcal && prev.kcal.length ? prev.kcal : data.kcal);
    const prevGrams = alcoholGrams(prev.drinks, grams);
    const nowTotal = weekTotal(data.week, data.kcal);
    const nowGrams = data.week.reduce((s, d) => s + alcoholGrams(d, grams), 0);
    const before = prevTotal > 0 ? Math.round(((nowTotal - prevTotal) / prevTotal) * 100) : null;
    const kcalTxt = before === null ? '' : `kcal ${before > 0 ? '+' : ''}${before}%`;
    const gTxt = `alcohol ${nowGrams - prevGrams > 0 ? '+' : ''}${Math.round(nowGrams - prevGrams)} g`;
    host.textContent = `vs ${keys[0].slice(8)}/${keys[0].slice(5, 7)} — ${[kcalTxt, gTxt].filter(Boolean).join(' · ')}`;
  }

  /** All-time rollup line above the history list. */
  function renderAllTime(data, drinks) {
    const host = $('histSummary');
    const keys = Object.keys(data.hist);
    if (keys.length === 0) { host.textContent = ''; return; }
    const grams = drinks.map((d) => d.grams || 0);
    const rows = keys.map((k) => {
      const e = data.hist[k];
      return { kcal: dayTotal(e.drinks, e.kcal && e.kcal.length ? e.kcal : data.kcal),
               grams: alcoholGrams(e.drinks, grams) };
    });
    const cur = weekTotal(data.week, data.kcal);
    const tot = rows.reduce((s, r) => s + r.kcal, cur);
    const avg = Math.round(tot / (rows.length + 1));
    const sorted = [...rows].sort((x, y) => x.kcal - y.kcal);
    const light = sorted[0], heavy = sorted[sorted.length - 1];
    host.textContent = `${rows.length + 1} weeks · avg ${avg} kcal/week · lightest ${light.kcal} · heaviest ${heavy.kcal}`;
  }

  /** Week-detail sheet (opened from a history row). */
  function showWeekDetail(model) {
    $('wdTitle').textContent = model.title;
    const body = $('wdBody');
    body.innerHTML = '';
    const totals = el('div', 'wd-totals');
    totals.innerHTML =
      `<div><b class="num">${model.totalKcal}</b><span>kcal</span></div>` +
      `<div><b class="num">${model.totalGrams}</b><span>g alcohol</span></div>` +
      `<div><b class="num">${model.avgKcal}</b><span>kcal/day avg</span></div>`;
    body.append(totals);

    if (model.heaviestDay) {
      body.append(el('div', 'wd-line', `Heaviest day: <b>${model.heaviestDay}</b>`));
    }

    if (model.mvps.length) {
      const m = el('div', 'wd-mvps');
      model.mvps.forEach(([label, name, value]) => {
        m.append(el('div', 'wd-mvp', `<span>${label}</span><b>${name}</b><span class="num">${value}</span>`));
      });
      body.append(m);
    }

    if (model.days) {
      const chart = el('div', 'wd-days');
      const max = Math.max(...model.days, 1);
      const bars = el('div', 'wd-bars');
      model.days.forEach((v, i) => {
        const cell = el('div', 'wkc');
        const h = v > 0 ? Math.max(3, Math.round((v / max) * 70)) : 2;
        cell.innerHTML = `<span class="wkv num">${v || ''}</span><div class="bar" style="height:${h}px"></div><span class="wkl">${DAY_NAMES[i][0]}</span>`;
        bars.append(cell);
      });
      chart.append(bars);
      body.append(chart);
    }

    if (model.drinks.length) {
      const table = el('div', 'wd-table');
      model.drinks.forEach((d) => {
        table.append(el('div', 'wd-tr',
          `<span class="wd-tname">${d.name}</span>` +
          `<span class="num">×${d.units}</span>` +
          `<span class="num">${d.kcal}</span>` +
          `<span class="num">${Math.round(d.grams)} g</span>`));
      });
      const head = el('div', 'wd-tr wd-th',
        '<span class="wd-tname">Drink</span><span>units</span><span>kcal</span><span>alcohol</span>');
      table.prepend(head);
      body.append(table);
    }
    $('weekDetail').style.display = 'flex';
  }

  function hideWeekDetail() {
    $('weekDetail').style.display = 'none';
  }

  const topBy = (stats, key) => stats.reduce((best, t) => (t[key] > best[key] ? t : best), stats[0]);

  /** Week MVPs: which drink won units / pure alcohol / calories. */
  function renderMvps(drinks, data) {
    const host = $('mvps');
    host.innerHTML = '';
    const grams = drinks.map((drink) => drink.grams || 0);
    const stats = weekDrinkStats(data.week, data.kcal, grams);
    if (stats.length === 0) {
      host.append(el('div', 'hempty', 'No drinks logged this week yet.'));
      return;
    }
    const medals = ['🍺', '🥃', '🔥'];
    const rows = [
      ['Most units', topBy(stats, 'units'), (t) => `×${t.units}`],
      ['Most pure alcohol', topBy(stats, 'grams'), (t) => `${Math.round(t.grams)} g`],
      ['Most calories', topBy(stats, 'kcal'), (t) => `${t.kcal} kcal`],
    ];
    rows.forEach(([label, t, fmt], i) => {
      const row = el('div', 'mvp-row');
      row.innerHTML =
        `<span class="mvp-medal">${medals[i]}</span>` +
        `<span class="mvp-label">${label}</span>` +
        `<span class="mvp-name">${drinks[t.index].name}</span>` +
        `<span class="mvp-value num">${fmt(t)}</span>`;
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
      // Archived weeks store per-drink unit totals — the MVP is just the max.
      const topIdx = entry.drinks.indexOf(Math.max(...entry.drinks));
      const topTxt = entry.drinks[topIdx] > 0
        ? ` · most: ${drinks[topIdx] ? drinks[topIdx].name : '?'} ×${entry.drinks[topIdx]}`
        : '';
      const monday = new Date(`${key}T00:00:00`);
      const sunday = new Date(monday.getTime() + 6 * MS_PER_DAY);
      const row = el('button', 'hrow hrow-btn');
      row.onclick = () => actions.onOpenWeek(key);
      row.innerHTML =
        `<span class="hr-l num">${fmtDayMonth(monday)} – ${fmtDayMonth(sunday)}` +
        `<span class="hr-s num">avg ${Math.round(total / 7)} kcal/day · ${gramsHist} g alcohol${topTxt}</span></span>` +
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
    renderComparison(data, drinks);
    renderAllTime(data, drinks);
    renderWeekChart(data, selectedDay);
    renderMvps(drinks, data);
    renderHistory(data, drinks, data.weekKey);
    renderKcalEditor(drinks, data, actions.onUpdateKcal);
  }

  /* ------------------------------ wiring ------------------------------ */
  function bind() {
    bindAuth();
    $('drinkFilter').oninput = () => { if (lastView) render(lastView); };
    // The week rolls over on data load (sign-in). If the app sits open past
    // midnight Sunday, this re-checks the calendar every time it comes back
    // to the foreground — no refresh needed on Monday morning.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) actions.onResume();
    });
    $('editListBtn').onclick = () => {
      listEditMode = !listEditMode;
      if (lastView) render(lastView);
    };
    $('clearDay').onclick = actions.onClearDay;
    $('lockBtn').onclick = actions.onLock;
    $('userChip').onclick = actions.onLock; // tapping your name signs out too
    $('wdClose').onclick = actions.onCloseWeek;
    let editorOpen = false;
    $('gearBtn').onclick = () => {
      editorOpen = !editorOpen;
      $('edit').style.display = editorOpen ? 'block' : 'none';
      if (editorOpen) {
        setTimeout(() => $('edit').scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
      }
    };
  }

  return { bind, render, showAuth, hideAuth, toast, showWeekDetail, hideWeekDetail };
}
