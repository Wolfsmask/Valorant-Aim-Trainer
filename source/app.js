/* ============================================================
   PF Debate Hub — app
   Single-file, fully offline. Data lives in this browser
   (localStorage) and can be saved into a new copy of the file.
   ============================================================ */
(function () {
  'use strict';
  const B = window.Brain;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = B.escapeHtml;
  const uid = () => Math.random().toString(36).slice(2, 9);
  const clone = o => JSON.parse(JSON.stringify(o));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const fmtClock = s => { const neg = s < 0; s = Math.abs(Math.round(s)); return (neg ? '-' : '') + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const fmtTime = t => t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
  const isTyping = () => { const a = document.activeElement; return a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };

  /* =========================================================
     STATE
     ========================================================= */
  const LS = 'pfhub.state.v1', LS_SNAP = 'pfhub.snaps.v1', LS_SEEN = 'pfhub.seenExports', LS_MODEL = 'pfhub.model';
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };

  function newRound(side) {
    return { id: uid(), started: Date.now(), side: side || 'pro', opponent: '', judge: '', room: '', first: '', notes: {}, xf: [], used: {}, plan: {}, prep: { us: 180, them: 180 } };
  }
  function freshState() {
    return {
      v: 1, docId: uid(), savedAt: 0, seed: SEED.version, side: 'pro', topic: SEED.meta.topic,
      sides: clone(SEED.sides), evidence: clone(SEED.evidence), changes: clone(SEED.changes),
      round: newRound('pro'), rounds: [],
      settings: { theme: 'auto', font: 16, showChanges: true, compact: false, collapsed: {}, aiPref: 'auto', aiAuto: true, gpu: true, autoLoadModel: true, rulesSeen: false }
    };
  }
  function migrate(st) {
    const f = freshState();
    st.settings = Object.assign({}, f.settings, st.settings || {});
    st.settings.collapsed = st.settings.collapsed || {};
    st.round = Object.assign(newRound(st.side), st.round || {});
    ['notes', 'used', 'plan'].forEach(k => { st.round[k] = st.round[k] || {}; });
    st.round.xf = st.round.xf || [];
    st.rounds = st.rounds || [];
    st.evidence = st.evidence || clone(SEED.evidence);
    st.changes = st.changes || clone(SEED.changes);
    if (!st.sides || !st.sides.pro) st.sides = clone(SEED.sides);
    if (!st.sides.con) st.sides.con = clone(SEED.sides.con);
    return st;
  }
  function readEmbedded() {
    const el = document.getElementById('pf-data'); if (!el) return null;
    try { const t = el.textContent.trim(); if (!t || t === 'null') return null; return JSON.parse(t); } catch (e) { return null; }
  }
  function snapshots() { try { return JSON.parse(lsGet(LS_SNAP) || '[]'); } catch (e) { return []; } }
  function pushSnapshot(st, label) {
    const list = snapshots();
    list.unshift({ id: uid(), at: Date.now(), label: label || 'Snapshot', data: st });
    while (list.length > 8) list.pop();
    let ok = lsSet(LS_SNAP, JSON.stringify(list));
    while (!ok && list.length > 1) { list.pop(); ok = lsSet(LS_SNAP, JSON.stringify(list)); }
    return ok;
  }

  let S, pendingShared = null, storageOK = true;
  (function load() {
    const emb = readEmbedded();
    let loc = null; try { loc = JSON.parse(lsGet(LS) || 'null'); } catch (e) { loc = null; }
    let seen = []; try { seen = JSON.parse(lsGet(LS_SEEN) || '[]'); } catch (e) { }
    if (emb && emb.exportId && !seen.includes(emb.exportId)) {
      if (!loc) { S = emb; seen.push(emb.exportId); lsSet(LS_SEEN, JSON.stringify(seen)); }
      else { S = loc; pendingShared = emb; }
    } else S = loc || emb || freshState();
    migrate(S);
    storageOK = lsSet('pfhub.test', '1');
  })();

  const SD = () => S.sides[S.side];
  const oppName = () => S.side === 'pro' ? 'Con' : 'Pro';
  const findSec = id => SD().sections.find(s => s.id === id);
  const findItem = (secId, itemId) => { const s = findSec(secId); return s && (s.items || []).find(i => i.id === itemId); };
  const evById = id => S.evidence.find(e => e.id === id);

  let saveTimer;
  function save(now) {
    clearTimeout(saveTimer);
    const doSave = () => {
      S.savedAt = Date.now();
      const ok = lsSet(LS, JSON.stringify(S));
      const el = $('#savedot'); if (el) el.textContent = ok ? 'Saved ✓' : '⚠ Not saved — use Save copy';
      if (!ok && storageOK) { storageOK = false; toast('This browser blocked saving. Use ⚙ → "Save a copy with my edits" before closing.', 6000); }
    };
    if (now) doSave(); else { const el = $('#savedot'); if (el) el.textContent = 'Saving…'; saveTimer = setTimeout(doSave, 450); }
  }

  let IDX;
  function reindex() { IDX = new B.Index().build(SD(), S.evidence); }
  const reindexSoon = debounce(() => { reindex(); renderChips(); }, 700);

  /* =========================================================
     SHELL
     ========================================================= */
  function shell() {
    let root = document.getElementById('app');
    if (!root) { root = document.createElement('div'); root.id = 'app'; document.body.prepend(root); }
    root.innerHTML = `
<header class="top">
  <button class="iconbtn hamb" id="hamb" aria-label="Menu">☰</button>
  <div class="brand"><div class="logo" id="logo">PF</div><div class="t">PF Debate Hub<small id="topicline"></small></div></div>
  <div class="seg" id="sideSeg" title="Switch side"><button data-side="pro">PRO</button><button data-side="con">CON</button></div>
  <div class="search"><span class="mag">🔍</span><input id="q" type="search" placeholder="Search every word…  ( / )" autocomplete="off" spellcheck="false" aria-label="Search">
    <div class="count" id="qcount"></div><div class="drop" id="qdrop"></div></div>
  <div class="timer" id="timer"><select id="tsel" aria-label="Speech"></select><span class="clock" id="tclock" title="Click for big timer">4:00</span>
    <button id="tplay" aria-label="Start/pause" title="Start/pause (T)">▶</button><button id="treset" aria-label="Reset" title="Reset">↺</button></div>
  <button class="livebtn" id="xfbtn" title="Crossfire helper (X)">⚡<span class="lt"> Crossfire</span></button>
  <span class="savedot" id="savedot">Saved ✓</span>
  <button class="iconbtn" id="setupbtn" title="Setup, offline AI & sharing" aria-label="Settings">⚙</button>
</header>
<div class="chips" id="chips"></div>
<nav class="side" id="side"></nav>
<main class="main"><div class="doc" id="doc"></div></main>
<aside class="live" id="live"></aside>
<div class="fmt" id="fmt"></div>
<div class="modal" id="modal"><div class="mbox" id="mbox"></div></div>
<div class="toast" id="toast"></div>
<div class="bigtimer" id="bigtimer"><div class="l" id="btl"></div><div class="d" id="btd">4:00</div><div class="row"><button id="btplay">Start / Pause</button><button id="btreset">Reset</button><button id="btclose">Close (Esc)</button></div></div>
<div class="cardpop" id="cardpop"></div>`;
  }

  function applyDisplay() {
    const r = document.documentElement;
    r.dataset.side = S.side;
    if (S.settings.theme === 'auto') delete r.dataset.theme; else r.dataset.theme = S.settings.theme;
    r.style.setProperty('--fs', (S.settings.font || 16) + 'px');
    document.body.classList.toggle('show-changes', !!S.settings.showChanges);
    document.body.classList.toggle('compact', !!S.settings.compact);
    $$('#sideSeg button').forEach(b => b.classList.toggle('on', b.dataset.side === S.side));
    $('#logo').textContent = S.side === 'pro' ? 'PRO' : 'CON';
    $('#topicline').textContent = 'Hyperscale data center moratorium';
  }

  let toastT;
  function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms || 2600); }

  /* =========================================================
     SIDEBAR + CHIPS
     ========================================================= */
  const PAGES = [
    { id: 'evidence', icon: '📚', title: 'Evidence Library', pf: 'Sources for card calls', key: 'E' },
    { id: 'factcheck', icon: '✅', title: 'Fact-Check Log', pf: 'What Claude changed & why' },
    { id: 'round', icon: '📝', title: 'This Round', pf: 'Notes, prep time, history' }
  ];
  function renderSide() {
    const secs = SD().sections;
    const nfix = S.changes.length;
    $('#side').innerHTML = `
      <h6>${esc(SD().label)} case</h6>
      ${secs.map((s, i) => `<button class="nav" data-go="${s.id}"><span class="ic">${s.icon}</span><span class="lbl">${esc(s.title)}<small>${esc(s.pf || '')}</small></span>${s.kind === 'cards' ? `<span class="badge" data-badge="${s.id}">${(s.items || []).length}</span>` : `<span class="badge" data-badge="${s.id}" hidden></span>`}${i < 9 ? `<span class="k">${i + 1}</span>` : ''}</button>`).join('')}
      <h6>Tools</h6>
      ${PAGES.map(p => `<button class="nav" data-go="${p.id}"><span class="ic">${p.icon}</span><span class="lbl">${esc(p.title)}<small>${esc(p.pf)}</small></span><span class="badge" data-badge="${p.id}">${p.id === 'evidence' ? S.evidence.length : p.id === 'factcheck' ? nfix : ''}</span></button>`).join('')}
      <button class="nav" id="navsetup"><span class="ic">⚙</span><span class="lbl">Setup &amp; Offline AI<small>Sharing, AI model, display</small></span></button>
      <button class="nav" id="navhelp"><span class="ic">❔</span><span class="lbl">How to use<small>Shortcuts &amp; tips</small></span><span class="k">?</span></button>
      <div class="foot">Works with no internet. Edits save in this browser automatically.<br><span id="sidefoot"></span></div>`;
    $('#sidefoot').textContent = 'Last saved ' + fmtTime(S.savedAt);
  }

  let topic = null, topicOnly = false;
  function renderChips() {
    if (!IDX) return;
    const counts = {};
    for (const d of IDX.docs) for (const [c, v] of Object.entries(d.concepts)) if (v >= 1.5 && c !== 'evidence') counts[c] = (counts[c] || 0) + 1;
    const list = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 18);
    $('#chips').innerHTML = `<span class="chip ghost" style="cursor:default">Topics:</span><button class="chip ${!topic ? 'on' : ''}" data-topic="">All</button>` +
      list.map(([c, n]) => `<button class="chip ${topic === c ? 'on' : ''}" data-topic="${c}" style="--kc:${B.CONCEPTS[c].color}"><i></i>${esc(B.CONCEPTS[c].label)} <span style="opacity:.6">${n}</span></button>`).join('') +
      `<button class="chip ghost" id="compactChip" title="Show only card titles (fast scanning)">${S.settings.compact ? '☰ Show full cards' : '☰ Titles only'}</button>` +
      (topic ? `<button class="chip ghost" id="onlyChip">${topicOnly ? 'Show all cards' : 'Hide other cards'}</button>` : '');
  }
  function applyTopic() {
    if (!IDX) return;
    const rel = new Set();
    if (topic) for (const d of IDX.docs) if ((d.concepts[topic] || 0) >= 1.2) rel.add(d.id);
    $$('.card').forEach(el => {
      const on = !topic || rel.has(el.dataset.card);
      el.classList.toggle('dim', !!topic && !on && !topicOnly);
      el.classList.toggle('hide', !!topic && !on && topicOnly);
    });
    highlightTopicWords();
  }

  /* =========================================================
     DOC RENDER
     ========================================================= */
  const labelFor = type => ({ rebuttal: `When ${oppName()} says`, counter: 'Opponents said', qa: `${oppName()} will ask`, askq: 'We ask' })[type] || '';
  function evChip(id) {
    const e = evById(id); if (!e) return '';
    return `<button class="evchip" data-act="ev" data-ev="${id}" title="${esc(e.tag)}">${id} · ${esc((e.who || e.cite).split(/[(,;]/)[0].trim().slice(0, 28))}</button>`;
  }
  function cardHTML(sec, it) {
    const used = !!S.round.used[it.id];
    const b = f => `data-bind="${sec.id}|${it.id}|${f}"`;
    const plan = S.round.plan[it.id];
    const tags = `${it.isNew ? '<span class="tag new" title="Added by Claude">new</span>' : ''}${it.changed ? `<span class="tag fix" data-act="chg" data-c="${it.changed}" title="Claude corrected something here — click to see why">fixed</span>` : ''}<span class="planbadge">${plan ? esc(plan) : ''}</span>`;
    const menu = `<span class="cmenu"><button class="iconbtn" data-act="cardmenu" aria-label="Card options" title="Options">⋯</button></span>`;
    let head = '', body = '';
    const lab = `<div class="clab" style="font-size:.7rem;color:var(--ink3);font-weight:600;text-transform:uppercase;letter-spacing:.04em">${labelFor(sec.cardType)}</div>`;
    if (sec.cardType === 'rebuttal' || sec.cardType === 'counter') {
      head = `<div class="ctrig">${lab}<div class="rt" contenteditable="true" ${b('trigger')}>${it.trigger || ''}</div></div>`;
      body = `<div class="rt" contenteditable="true" ${b('html')}>${it.html || ''}</div>`;
    } else if (sec.cardType === 'qa') {
      head = `<div class="ctrig">${lab}<div class="rt" contenteditable="true" ${b('q')}>${esc(it.q || '')}</div></div>`;
      body = `<div><span class="short rt" contenteditable="true" ${b('short')} title="Short answer (say this first)">${esc(it.short || 'Short answer')}</span></div>
        <div class="rt" contenteditable="true" ${b('html')}>${it.html || ''}</div>
        <div class="turn"><b>↩ Ask back:</b><span class="rt" contenteditable="true" ${b('turn')}>${esc(it.turn || '')}</span></div>
        <div class="alts"><b>Also matches:</b> <span class="rt" contenteditable="true" ${b('alts')} title="Other ways they might ask it — separate with ;">${esc((it.alts || []).join('; '))}</span></div>`;
    } else if (sec.cardType === 'askq') {
      head = `<div class="ctrig">${lab}<span class="lab rt" contenteditable="true" ${b('label')}>${esc(it.label || 'Question')}</span><span class="lab">:</span> <span class="rt" contenteditable="true" ${b('q')}>${it.q || ''}</span></div>`;
      body = `<div class="goal"><b>🎯 Goal:</b><span class="rt" contenteditable="true" ${b('goal')}>${esc(it.goal || '')}</span></div>
        <div class="follow"><b>↪ If they dodge:</b><span class="rt" contenteditable="true" ${b('follow')}>${esc(it.follow || '')}</span></div>`;
    }
    const foot = (it.ev || []).length ? `<div class="cfoot">${it.ev.map(evChip).join('')}</div>` : '';
    return `<article class="card ${used ? 'used' : ''} ${plan ? 'plan' : ''}" id="card-${it.id}" data-card="${it.id}" data-sec="${sec.id}">
      <div class="ch"><input type="checkbox" data-act="used" ${used ? 'checked' : ''} title="Used this round" aria-label="Used this round">${head}<div class="cmeta">${tags}${menu}</div></div>
      <div class="cb">${body}</div>${foot}</article>`;
  }
  function liveBtn(sec) {
    if (!sec.listen) return '';
    const xf = sec.listen === 'crossfire';
    return `<button class="btn ${xf ? 'pri' : ''}" data-act="live" data-sec="${sec.id}" title="${esc(sec.listenLabel || '')}">${xf ? '⚡ Crossfire helper' : '⌨ Type what they say'}</button>`;
  }
  function secHTML(sec) {
    const col = !!S.settings.collapsed[sec.id];
    const acts = `${liveBtn(sec)}${sec.time ? `<button class="btn" data-act="time" data-t="${sec.time}" data-l="${esc(sec.title)}" title="Start a ${fmtClock(sec.time)} timer">⏱ ${fmtClock(sec.time)}</button>` : ''}${sec.kind === 'cards' ? `<button class="btn sm" data-act="add" title="Add a card">＋ Card</button>` : ''}<button class="btn sm" data-act="collapse" title="Collapse / expand">${col ? '▸' : '▾'}</button>`;
    const inner = sec.kind === 'doc'
      ? `<div class="rt docbody" contenteditable="true" data-bind="${sec.id}||html">${sec.html || ''}</div>`
      : `${sec.intro ? `<p class="intro">${esc(sec.intro)}</p>` : ''}<div class="cards">${(sec.items || []).map(it => cardHTML(sec, it)).join('') || '<p class="empty">No cards yet — click ＋ Card.</p>'}</div>`;
    return `<section class="sec ${col ? 'collapsed' : ''}" id="sec-${sec.id}" data-sec="${sec.id}">
      <div class="sech"><span class="ic">${sec.icon}</span><div><h1>${esc(sec.title)}${sec.isNew ? ' <span class="tag new">new</span>' : ''}</h1><span class="pf">${esc(sec.pf || '')}</span></div><span class="sp"></span><div class="acts">${acts}</div></div>
      <div class="secb">${inner}</div></section>`;
  }
  function pageEvidence() {
    return `<section class="sec" id="sec-evidence" data-sec="evidence"><div class="sech"><span class="ic">📚</span><div><h1>Evidence Library</h1><span class="pf">If the other team asks to see a card, show them this: who, when, and the link</span></div><span class="sp"></span><div class="acts"><button class="btn sm" data-act="addev">＋ Evidence</button><button class="btn sm" data-act="collapse">${S.settings.collapsed.evidence ? '▸' : '▾'}</button></div></div>
      <div class="secb" ${S.settings.collapsed.evidence ? 'hidden' : ''}>${S.evidence.map(e => `<div class="ev" id="ev-${e.id}">
        <div><span class="eid">${e.id}</span><span class="etag rt" contenteditable="true" data-bind="@ev|${e.id}|tag">${esc(e.tag)}</span></div>
        <div class="ecite"><b>Who/when:</b> <span class="rt" contenteditable="true" data-bind="@ev|${e.id}|who">${esc(e.who || '')}</span></div>
        <div class="ecite"><b>Full cite:</b> <span class="rt" contenteditable="true" data-bind="@ev|${e.id}|cite">${esc(e.cite)}</span></div>
        <div class="etext rt" contenteditable="true" data-bind="@ev|${e.id}|text">${esc(e.text)}</div>
        <div class="eurl">🔗 <span class="rt" contenteditable="true" data-bind="@ev|${e.id}|url">${esc(e.url || '')}</span> ${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">open</a>` : ''} · <button class="btn sm" data-act="copycite" data-ev="${e.id}">Copy citation</button></div></div>`).join('')}</div></section>`;
  }
  function pageFactcheck() {
    return `<section class="sec" id="sec-factcheck" data-sec="factcheck"><div class="sech"><span class="ic">✅</span><div><h1>Fact-Check Log</h1><span class="pf">Everything Claude changed in your original doc, and why</span></div><span class="sp"></span><div class="acts"><button class="btn sm" data-act="togglechanges">${S.settings.showChanges ? 'Hide' : 'Show'} change highlights</button><button class="btn sm" data-act="collapse">${S.settings.collapsed.factcheck ? '▸' : '▾'}</button></div></div>
      <div class="secb" ${S.settings.collapsed.factcheck ? 'hidden' : ''}><p class="intro">In the document, <span style="box-shadow:inset 0 -2px 0 var(--warn);background:color-mix(in srgb,var(--warn) 18%,transparent)">orange-underlined text</span> was corrected and <span style="text-decoration:underline dotted var(--good);text-decoration-thickness:2px;text-underline-offset:3px">green dotted-underlined text</span> was added. Turn highlighting off above when you're done reviewing.</p>
      ${S.changes.map(c => `<div class="chg" id="chg-${c.id}"><div class="w">${esc(c.where)}</div><div class="o">${esc(c.original)}</div><div class="nw">${esc(c.now)}</div><div class="y"><b>Why:</b> ${esc(c.why)}</div>${(c.ev || []).length ? `<div class="cfoot" style="padding:6px 0 0">${c.ev.map(evChip).join('')}</div>` : ''}</div>`).join('')}</div></section>`;
  }
  function pageRound() {
    const R = S.round;
    const notes = Object.entries(R.notes || {}).filter(([, v]) => v && v.trim());
    return `<section class="sec" id="sec-round" data-sec="round"><div class="sech"><span class="ic">📝</span><div><h1>This Round</h1><span class="pf">Started ${fmtTime(R.started)} · resets with "New round"</span></div><span class="sp"></span><div class="acts"><button class="btn pri" data-act="newround">↻ New round</button></div></div>
      <div class="secb">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px">
          <label class="field">Opponent team<input data-rf="opponent" value="${esc(R.opponent || '')}" placeholder="e.g. Lincoln East AB"></label>
          <label class="field">Judge<input data-rf="judge" value="${esc(R.judge || '')}" placeholder="name / lay or flow?"></label>
          <label class="field">Room<input data-rf="room" value="${esc(R.room || '')}"></label>
          <label class="field">We speak<select data-rf="first"><option value="">—</option><option ${R.first === 'first' ? 'selected' : ''} value="first">First</option><option ${R.first === 'second' ? 'selected' : ''} value="second">Second</option></select></label>
        </div>
        <div class="lh">Prep time</div>
        <div class="prep">${['us', 'them'].map(k => `<div class="pt"><span>${k === 'us' ? 'Our prep' : 'Their prep'}</span><span class="clock" id="prep-${k}">${fmtClock(R.prep[k])}</span><button class="btn sm" data-act="prep" data-k="${k}">▶ / ❚❚</button><button class="btn sm" data-act="prepreset" data-k="${k}">↺</button></div>`).join('')}
          <label class="field" style="margin:0;align-self:center">Prep length <select id="preplen"><option value="120">2:00</option><option value="180" selected>3:00</option><option value="240">4:00</option></select></label></div>
        <div class="lh">What they said (your typed notes)</div>
        ${notes.length ? notes.map(([k, v]) => `<div class="blk"><h4>${esc(sectionTitle(k))}</h4><div style="white-space:pre-wrap;font-size:.9rem">${esc(v)}</div></div>`).join('') : '<p class="empty">Nothing yet. Use "⌨ Type what they say" on any section.</p>'}
        <div class="lh">Crossfire log</div>
        ${R.xf.length ? R.xf.slice().reverse().map(x => `<div class="hist"><b>Q: ${esc(x.q)}</b>${esc(x.a || '')}</div>`).join('') : '<p class="empty">Questions you type in the ⚡ Crossfire helper show up here.</p>'}
        <div class="lh">Cards used this round</div>
        <p style="font-size:.9rem">${Object.keys(R.used).filter(k => R.used[k]).length || 'None'} checked off. ${S.rounds.length ? `· ${S.rounds.length} earlier round(s) saved` : ''}</p>
        ${S.rounds.length ? `<details><summary style="cursor:pointer;font-size:.88rem">Earlier rounds</summary>${S.rounds.map(r => `<div class="blk"><h4>${esc(r.opponent || 'Round')} · ${fmtTime(r.started)} · ${esc((r.side || '').toUpperCase())}</h4>${Object.entries(r.notes || {}).filter(([, v]) => v).map(([k, v]) => `<div style="font-size:.82rem;white-space:pre-wrap"><b>${esc(sectionTitle(k))}:</b> ${esc(v)}</div>`).join('')}</div>`).join('')}</details>` : ''}
      </div></section>`;
  }
  function sectionTitle(k) { const s = findSec(k); return s ? s.title : k; }

  function renderDoc() {
    const secs = SD().sections;
    $('#doc').innerHTML = secs.map(secHTML).join('') + pageEvidence() + pageFactcheck() + pageRound();
    $$('.sec[data-sec="evidence"] .secb[hidden], .sec[data-sec="factcheck"] .secb[hidden]').forEach(el => el.closest('.sec').classList.add('collapsed'));
    $('#preplen') && ($('#preplen').value = String(prepLen));
    applyTopic();
    setupSpy();
    if (searchQ) runSearch(searchQ, true);
  }
  function renderAll() {
    applyDisplay(); reindex(); renderSide(); renderChips(); renderDoc(); renderTimerSelect();
    if (Live.open) renderLive();
  }

  /* =========================================================
     EDITING
     ========================================================= */
  function cleanHtml(html) {
    const t = document.createElement('template'); t.innerHTML = html;
    t.content.querySelectorAll('mark.hit').forEach(m => m.replaceWith(...m.childNodes));
    t.content.querySelectorAll('[style]').forEach(el => { if (!/^(SPAN|MARK)$/.test(el.tagName)) el.removeAttribute('style'); });
    return t.innerHTML.replace(/\u200b/g, '');
  }
  function onBindInput(el) {
    const [secId, itemId, field] = el.dataset.bind.split('|');
    if (secId === '@ev') {
      const e = evById(itemId); if (!e) return;
      e[field] = el.innerText.trim();
      save(); reindexSoon(); return;
    }
    const sec = findSec(secId); if (!sec) return;
    const plain = ['q', 'short', 'turn', 'label', 'goal', 'follow'];
    let val;
    if (field === 'alts') val = el.innerText.split(/[;\n]+/).map(s => s.trim()).filter(Boolean);
    else if (plain.includes(field) && !(field === 'q' && sec.cardType === 'askq')) val = el.innerText.trim();
    else val = cleanHtml(el.innerHTML);
    if (!itemId) sec[field] = val; else { const it = (sec.items || []).find(i => i.id === itemId); if (it) it[field] = val; }
    save(); reindexSoon();
  }

  function addCard(secId) {
    const sec = findSec(secId); if (!sec) return;
    const id = (sec.cardType || 'c')[0] + uid();
    const base = { id, tags: [], ev: [], isUser: true };
    const it = sec.cardType === 'qa' ? Object.assign(base, { q: 'Their question…', alts: [], short: 'Short answer', html: 'Your answer…', turn: '' })
      : sec.cardType === 'askq' ? Object.assign(base, { label: 'New', q: 'Your question…', goal: '', follow: '' })
        : Object.assign(base, { trigger: 'What they say…', html: 'Your response…' });
    sec.items = sec.items || []; sec.items.unshift(it);
    save(); renderDoc(); reindex(); renderSide();
    const el = $(`#card-${id} .ctrig .rt`); if (el) { el.focus(); document.execCommand && document.execCommand('selectAll'); }
  }
  function cardMenu(btn) {
    const card = btn.closest('.card'); const secId = card.dataset.sec, id = card.dataset.card;
    const sec = findSec(secId); const i = sec.items.findIndex(x => x.id === id);
    const seedSec = (SEED.sides[S.side].sections.find(s => s.id === secId) || {});
    const orig = (seedSec.items || []).find(x => x.id === id);
    const pop = $('#cardpop');
    pop.innerHTML = `<button data-m="up" ${i === 0 ? 'disabled' : ''}>↑ Move up</button><button data-m="down" ${i === sec.items.length - 1 ? 'disabled' : ''}>↓ Move down</button><button data-m="dup">⧉ Duplicate</button><button data-m="open">↕ Expand / collapse</button>${orig ? '<button data-m="reset">↺ Reset to original</button>' : ''}<button data-m="del" style="color:var(--bad)">🗑 Delete</button>`;
    const r = btn.getBoundingClientRect();
    pop.style.cssText = `position:fixed;z-index:80;top:${Math.min(r.bottom + 4, innerHeight - 250)}px;left:${Math.max(8, r.right - 180)}px;display:flex;flex-direction:column;background:var(--paper);border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow-lg);padding:4px;min-width:180px`;
    $$('button', pop).forEach(b => b.style.cssText = 'border:0;background:transparent;text-align:left;padding:8px 10px;border-radius:6px;font-size:.88rem');
    pop.onclick = e => {
      const m = e.target.closest('button'); if (!m || m.disabled) return;
      const act = m.dataset.m; pop.style.display = 'none';
      if (act === 'up' && i > 0) { [sec.items[i - 1], sec.items[i]] = [sec.items[i], sec.items[i - 1]]; }
      else if (act === 'down' && i < sec.items.length - 1) { [sec.items[i + 1], sec.items[i]] = [sec.items[i], sec.items[i + 1]]; }
      else if (act === 'dup') { const c = clone(sec.items[i]); c.id = id[0] + uid(); c.isNew = false; c.changed = null; sec.items.splice(i + 1, 0, c); }
      else if (act === 'open') { card.classList.toggle('open'); return; }
      else if (act === 'reset' && orig) { sec.items[i] = clone(orig); }
      else if (act === 'del') { if (!confirm('Delete this card?')) return; sec.items.splice(i, 1); }
      save(); renderDoc(); reindex(); renderSide();
      const el = $('#card-' + id); if (el && act !== 'del') { el.classList.add('flash'); }
    };
  }
  document.addEventListener('pointerdown', e => { const p = $('#cardpop'); if (p && p.style.display !== 'none' && !e.target.closest('#cardpop') && !e.target.closest('[data-act="cardmenu"]')) p.style.display = 'none'; });

  /* ---------- formatting toolbar ---------- */
  function fmtBar() {
    $('#fmt').innerHTML = `<button data-f="bold" title="Bold"><b>B</b></button><button data-f="italic" title="Italic"><i>I</i></button><button data-f="underline" title="Underline"><u>U</u></button><button data-f="hl" title="Highlight">🖍</button><span class="div"></span><button data-f="h2" title="Big heading">H1</button><button data-f="h3" title="Small heading">H2</button><button data-f="p" title="Normal text">¶</button><button data-f="ul" title="Bullet list">•</button><button data-f="box" title="Checkbox">☐</button><button data-f="cite" title="Insert evidence tag">❝</button><span class="div"></span><button data-f="clear" title="Clear formatting">✕</button>`;
    $('#fmt').addEventListener('mousedown', e => e.preventDefault());
    $('#fmt').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const f = b.dataset.f;
      const ex = (c, v) => document.execCommand(c, false, v);
      if (f === 'bold' || f === 'italic' || f === 'underline') ex(f);
      else if (f === 'hl') { const s = getSelection(); if (s.rangeCount && !s.isCollapsed) ex('insertHTML', `<mark class="hl">${esc(s.toString())}</mark>`); }
      else if (f === 'h2' || f === 'h3' || f === 'p') ex('formatBlock', f === 'p' ? 'P' : f.toUpperCase());
      else if (f === 'ul') ex('insertUnorderedList');
      else if (f === 'box') ex('insertText', '☐ ');
      else if (f === 'cite') { const id = prompt('Evidence ID to insert (e.g. E1). See the Evidence Library for IDs.'); const ev = id && evById(id.trim().toUpperCase()); if (ev) ex('insertHTML', `<cite data-ev="${ev.id}">${esc((ev.who || ev.id).split(/[(,]/)[0].trim())}</cite>&nbsp;`); else if (id) toast('No evidence with that ID'); }
      else if (f === 'clear') ex('removeFormat');
      const el = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-bind]');
      if (el) onBindInput(el);
    });
  }
  function placeFmt() {
    const fmt = $('#fmt'); const sel = getSelection();
    const host = sel.rangeCount && sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    const ed = host && host.closest && host.closest('[contenteditable="true"]');
    if (!ed || sel.isCollapsed) { fmt.classList.remove('show'); return; }
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (!r.width && !r.height) { fmt.classList.remove('show'); return; }
    fmt.classList.add('show');
    const w = fmt.offsetWidth;
    fmt.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    fmt.style.top = Math.max(60, r.top - 44) + 'px';
  }

  /* =========================================================
     NAVIGATION
     ========================================================= */
  function go(id, opts) {
    const el = document.getElementById('sec-' + id); if (!el) return;
    if (el.classList.contains('collapsed') && !(opts && opts.keepCollapsed)) toggleCollapse(id, false);
    el.scrollIntoView({ behavior: opts && opts.instant ? 'auto' : 'smooth', block: 'start' });
    document.body.classList.remove('nav-open');
  }
  function goCard(id) {
    const el = document.getElementById('card-' + id); if (!el) return;
    const sec = el.closest('.sec'); if (sec && sec.classList.contains('collapsed')) toggleCollapse(sec.dataset.sec, false);
    const c = document.getElementById('card-' + id);
    c.classList.add('open'); c.classList.remove('hide', 'dim');
    c.scrollIntoView({ behavior: 'smooth', block: 'center' });
    c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash');
    if (innerWidth < 900 && Live.open) closeLive();
  }
  function toggleCollapse(id, force) {
    const cur = !!S.settings.collapsed[id];
    const next = force === undefined ? !cur : force;
    S.settings.collapsed[id] = next; save();
    const el = document.getElementById('sec-' + id); if (!el) return;
    el.classList.toggle('collapsed', next);
    const b = $('[data-act="collapse"]', el); if (b) b.textContent = next ? '▸' : '▾';
    const sb = $('.secb', el); if (sb) sb.hidden = false;
  }
  let spy;
  function setupSpy() {
    if (spy) spy.disconnect();
    if (!('IntersectionObserver' in window)) return;
    const vis = new Map();
    spy = new IntersectionObserver(entries => {
      entries.forEach(en => vis.set(en.target.dataset.sec, en.isIntersecting ? en.intersectionRatio + (en.boundingClientRect.top < 200 ? 1 : 0) : 0));
      let best = null, bv = 0; vis.forEach((v, k) => { if (v > bv) { bv = v; best = k; } });
      if (best) { curSec = best; $$('.nav').forEach(n => n.classList.toggle('cur', n.dataset.go === best)); }
    }, { rootMargin: '-90px 0px -55% 0px', threshold: [0, 0.01, 0.25, 0.5] });
    $$('.sec').forEach(s => spy.observe(s));
  }
  let curSec = 'opening';

  /* =========================================================
     SEARCH (every word, across everything)
     ========================================================= */
  let searchQ = '', hits = [], hitI = -1;
  const hasHL = !!(window.CSS && CSS.highlights && window.Highlight);
  function clearMarks() { $$('mark.hit').forEach(m => m.replaceWith(...m.childNodes)); $$('#doc .secb').forEach(n => n.normalize()); }
  function textNodes(root) {
    const out = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.nodeValue.trim() && !n.parentElement.closest('button,select,input,.planbadge,.tag,.clab') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    let n; while ((n = w.nextNode())) out.push(n); return out;
  }
  function runSearch(q, keepIndex) {
    searchQ = q;
    if (hasHL) { CSS.highlights.delete('pf-search'); CSS.highlights.delete('pf-search-cur'); } else clearMarks();
    hits = [];
    const counts = {};
    if (q.length >= 2) {
      const needle = q.toLowerCase();
      for (const sec of $$('#doc .sec')) {
        for (const n of textNodes($('.secb', sec))) {
          const v = n.nodeValue.toLowerCase(); let i = v.indexOf(needle);
          while (i >= 0) {
            hits.push({ node: n, start: i, end: i + needle.length, sec: sec.dataset.sec });
            counts[sec.dataset.sec] = (counts[sec.dataset.sec] || 0) + 1;
            i = v.indexOf(needle, i + needle.length);
          }
        }
      }
      if (hasHL) {
        const ranges = hits.map(h => { const r = new Range(); r.setStart(h.node, h.start); r.setEnd(h.node, h.end); h.range = r; return r; });
        CSS.highlights.set('pf-search', new Highlight(...ranges));
      } else {
        // fallback: wrap (end → start so offsets stay valid)
        for (let k = hits.length - 1; k >= 0; k--) {
          const h = hits[k]; const r = document.createRange(); r.setStart(h.node, h.start); r.setEnd(h.node, h.end);
          const m = document.createElement('mark'); m.className = 'hit'; r.surroundContents(m); h.el = m;
        }
      }
    }
    $$('[data-badge]').forEach(b => {
      const k = b.dataset.badge; const c = counts[k];
      if (q.length >= 2) { b.hidden = !c; b.textContent = c || ''; b.classList.toggle('hot', !!c); }
      else { b.classList.remove('hot'); const s = findSec(k); b.hidden = !(s && s.kind === 'cards') && !['evidence', 'factcheck'].includes(k); b.textContent = s && s.kind === 'cards' ? (s.items || []).length : k === 'evidence' ? S.evidence.length : k === 'factcheck' ? S.changes.length : ''; }
    });
    if (!keepIndex) hitI = -1;
    updateCount();
    renderDrop(q);
  }
  function updateCount() {
    const c = $('#qcount');
    if (searchQ.length < 2) { c.innerHTML = ''; return; }
    c.innerHTML = `<span>${hits.length ? (hitI + 1 > 0 ? hitI + 1 : 0) + '/' + hits.length : 'no match'}</span><button data-hn="-1" aria-label="Previous">▲</button><button data-hn="1" aria-label="Next">▼</button>`;
  }
  function stepHit(d) {
    if (!hits.length) return;
    hitI = (hitI + d + hits.length) % hits.length;
    const h = hits[hitI];
    const secEl = document.getElementById('sec-' + h.sec);
    if (secEl && secEl.classList.contains('collapsed')) { toggleCollapse(h.sec, false); }
    const card = (h.el || h.node.parentElement).closest('.card'); if (card) { card.classList.add('open'); card.classList.remove('hide'); }
    if (hasHL && h.range) {
      CSS.highlights.set('pf-search-cur', new Highlight(h.range));
      const r = h.range.getBoundingClientRect();
      if (!r.height) h.node.parentElement.scrollIntoView({ block: 'center' });
      else window.scrollBy({ top: r.top - innerHeight / 2.5, behavior: 'smooth' });
    } else if (h.el) { $$('mark.hit.cur').forEach(m => m.classList.remove('cur')); h.el.classList.add('cur'); h.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    updateCount();
  }
  let dropSel = -1, dropItems = [];
  function renderDrop(q) {
    const d = $('#qdrop');
    if (q.length < 2) { d.classList.remove('show'); dropItems = []; return; }
    const ql = q.toLowerCase(); const items = [];
    for (const sec of SD().sections) {
      if (sec.kind === 'cards') for (const it of sec.items || []) {
        const title = B.stripHtml(it.trigger || it.q || it.label || '');
        const all = (title + ' ' + B.stripHtml(it.html || '') + ' ' + (it.short || '') + ' ' + (it.turn || '') + ' ' + (it.goal || '') + ' ' + (it.follow || '') + ' ' + (it.alts || []).join(' ')).toLowerCase();
        if (all.includes(ql)) items.push({ kind: 'card', id: it.id, title, sub: sec.icon + ' ' + sec.title });
      } else if (B.stripHtml(sec.html).toLowerCase().includes(ql)) items.push({ kind: 'sec', id: sec.id, title: sec.title, sub: 'Document' });
    }
    for (const e of S.evidence) if ((e.tag + ' ' + e.text + ' ' + e.cite).toLowerCase().includes(ql)) items.push({ kind: 'ev', id: e.id, title: e.id + ' · ' + e.tag, sub: '📚 Evidence' });
    let smart = [];
    if (items.length < 3 && IDX) smart = IDX.search(q, { limit: 4 }).results.filter(r => r.score > 0.5 && !items.find(x => x.id === r.doc.id)).map(r => ({ kind: 'card', id: r.doc.id, title: r.doc.head, sub: '✨ Related · ' + (findSec(r.doc.sec) || {}).title }));
    dropItems = items.slice(0, 10).concat(smart);
    dropSel = -1;
    d.innerHTML = dropItems.length ? dropItems.map((x, i) => `<button class="ri" data-ri="${i}"><b>${esc(x.title.slice(0, 110))}</b><span>${esc(x.sub)}</span></button>`).join('') + (items.length > 10 ? `<div style="padding:6px 12px;font-size:.75rem;color:var(--ink3)">+${items.length - 10} more — press Enter to step through every match</div>` : '') : `<div style="padding:10px 12px;font-size:.85rem;color:var(--ink3)">No exact matches. Try fewer letters.</div>`;
    d.classList.add('show');
  }
  function openDropItem(x) {
    $('#qdrop').classList.remove('show');
    if (x.kind === 'card') goCard(x.id);
    else if (x.kind === 'ev') showEvidence(x.id);
    else go(x.id);
  }

  /* topic-word highlighting (Highlight API only) */
  function highlightTopicWords() {
    if (!hasHL) return;
    CSS.highlights.delete('pf-topic');
    if (!topic) return;
    const terms = B.CONCEPTS[topic].terms.map(t => B.normalize(t)).filter(t => t.length >= 3);
    const re = new RegExp('\\b(' + terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')).join('|') + ')\\w*', 'gi');
    const ranges = [];
    for (const n of textNodes($('#doc'))) {
      let m; re.lastIndex = 0;
      while ((m = re.exec(n.nodeValue))) { const r = new Range(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length); ranges.push(r); if (ranges.length > 3000) break; }
    }
    if (ranges.length) CSS.highlights.set('pf-topic', new Highlight(...ranges));
  }

  /* =========================================================
     TIMER
     ========================================================= */
  const PRESETS = [
    ['Constructive', 240], ['Crossfire', 180], ['Rebuttal', 240], ['Summary', 180], ['Grand Crossfire', 180], ['Final Focus', 120], ['Custom 1:00', 60], ['Custom 5:00', 300]
  ];
  const T = { label: 'Constructive', total: 240, left: 240, running: false, last: 0, beeped: false };
  let prepLen = 180, prepRun = { us: false, them: false };
  function renderTimerSelect() {
    $('#tsel').innerHTML = PRESETS.map(([l, s]) => `<option value="${s}|${esc(l)}" ${T.label === l ? 'selected' : ''}>${esc(l)} ${fmtClock(s)}</option>`).join('');
  }
  function setTimer(sec, label, start) {
    T.total = sec; T.left = sec; T.label = label || T.label; T.beeped = false; T.running = !!start; T.last = performance.now();
    const opt = $$('#tsel option').find(o => o.value === `${sec}|${T.label}`); if (opt) $('#tsel').value = opt.value;
    drawTimer();
  }
  function drawTimer() {
    const s = T.left;
    const cls = s < 0 ? 'over' : s <= 10 ? 'crit' : s <= 30 ? 'warn' : '';
    const tm = $('#timer'); tm.className = 'timer ' + cls;
    $('#tclock').textContent = fmtClock(s);
    $('#tplay').textContent = T.running ? '❚❚' : '▶';
    const bt = $('#bigtimer'); bt.className = 'bigtimer ' + cls + (bt.classList.contains('show') ? ' show' : '');
    $('#btd').textContent = fmtClock(s); $('#btl').textContent = T.label + (T.running ? '' : ' — paused');
  }
  function beep(times) {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < (times || 1); i++) {
        const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
        const t0 = ac.currentTime + i * 0.35; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
        o.start(t0); o.stop(t0 + 0.3);
      }
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } catch (e) { }
  }
  function tick() {
    const now = performance.now();
    const dt = (now - (T.last || now)) / 1000; T.last = now;
    if (T.running) {
      const before = T.left; T.left -= dt;
      if (before > 30 && T.left <= 30) beep(1);
      if (before > 0 && T.left <= 0 && !T.beeped) { T.beeped = true; beep(3); }
      drawTimer();
    }
    for (const k of ['us', 'them']) if (prepRun[k]) {
      S.round.prep[k] = Math.max(0, S.round.prep[k] - dt);
      const el = $('#prep-' + k); if (el) el.textContent = fmtClock(S.round.prep[k]);
      if (S.round.prep[k] <= 0) { prepRun[k] = false; beep(2); save(); }
    }
  }

  /* =========================================================
     LIVE PANEL — type what they say
     ========================================================= */
  const Live = { open: false, sec: null, kind: null, aiAbort: null, lastAns: null };
  const KIND_INFO = {
    case: { t: 'Their constructive', hint: 'Type their case as they speak — shorthand is fine.\nExample:\nC1 economy - AI = 1% of GDP (Epoch)\nC2 China wins AI race\nC3 grid flexible - Duke 76 GW', btn: 'Clear' },
    attacks: { t: 'Their attacks', hint: 'Type what they say against you — each line is checked against your cards.\nExample: PPAs protect ratepayers / AI hacks were just tests', btn: 'Clear' },
    crossfire: { t: 'Crossfire helper', hint: 'Type their question… the best answer appears as you type.\nEnter = next question · Esc = close', btn: 'Next question' },
    summary: { t: 'Summary builder', hint: 'Anything else they said that your Summary should answer (optional). Your notes from other sections are used automatically.', btn: 'Clear' },
    closing: { t: 'Final Focus builder', hint: 'Anything else they said in their Summary / Final Focus (optional). Everything you typed this round is used automatically.', btn: 'Clear' }
  };
  function openLive(secId) {
    const sec = findSec(secId) || findSec('predictions');
    Live.open = true; Live.sec = sec.id; Live.kind = sec.listen || 'crossfire';
    document.body.classList.add('live-open');
    renderLive();
    setTimeout(() => { const ta = $('#liveta'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }, 60);
  }
  function closeLive() { Live.open = false; document.body.classList.remove('live-open'); if (Live.aiAbort) Live.aiAbort.abort(); clearPlanIfEmpty(); }
  function noteKey() { return Live.kind === 'crossfire' ? '__xf' : Live.sec; }
  function renderLive() {
    const info = KIND_INFO[Live.kind];
    const sec = findSec(Live.sec);
    const val = Live.kind === 'crossfire' ? (S.round.xfDraft || '') : (S.round.notes[Live.sec] || '');
    const aiLbl = AI.label();
    $('#live').innerHTML = `
      <div class="liveh"><h3>${esc(info.t)}<small>${esc(sec ? sec.icon + ' ' + sec.title : '')} · ${S.side.toUpperCase()} side · ${aiLbl}</small></h3>
        ${Live.kind !== 'crossfire' ? '' : '<button class="btn sm" id="liveSwitch" title="Analyze their case instead">Case notes</button>'}
        <button class="iconbtn" id="liveClose" aria-label="Close" title="Close (Esc)">✕</button></div>
      <div class="typebox" style="border-top:0;border-bottom:1px solid var(--line);flex-direction:column">
        <textarea id="liveta" placeholder="${esc(info.hint)}" style="height:${Live.kind === 'crossfire' ? '78px' : '140px'}">${esc(val)}</textarea>
        <div style="display:flex;gap:6px;align-items:center;font-size:.75rem;color:var(--ink3)"><span id="livewc">${wc(val)} words</span><span class="sp" style="flex:1"></span>
          ${Live.kind === 'crossfire' ? '<button class="btn sm" id="liveNext">⏎ Next question</button>' : `<button class="btn sm" id="liveClear">Clear</button>`}
          ${Live.kind === 'summary' || Live.kind === 'closing' ? `<button class="btn sm pri" id="liveBuild">Build ${Live.kind === 'summary' ? 'Summary' : 'Final Focus'}</button>` : ''}</div>
      </div>
      <div class="liveb" id="liveb">
        <div class="lh">Words detected <span class="sp"></span><span style="text-transform:none;letter-spacing:0;font-weight:500">tap a colored word to filter</span></div>
        <div class="transcript" id="livetx" data-empty="Every word you type shows up here, color-coded by topic."></div>
        <div id="livea"></div>
      </div>`;
    updateLive(true);
  }
  const wc = s => (String(s).trim().match(/\S+/g) || []).length;
  function updateLive(force) {
    const ta = $('#liveta'); if (!ta) return;
    const v = ta.value;
    $('#livewc').textContent = wc(v) + ' words';
    $('#livetx').innerHTML = v.trim() ? B.highlightWords(v) : '';
    if (Live.kind === 'crossfire') liveCrossfire(v, force);
    else if (Live.kind === 'case') liveCase(v);
    else if (Live.kind === 'attacks') liveAttacks(v);
    else if (Live.kind === 'summary') liveBuilderIntro('summary');
    else if (Live.kind === 'closing') liveBuilderIntro('closing');
  }
  const persistNote = debounce(v => {
    if (Live.kind === 'crossfire') S.round.xfDraft = v; else S.round.notes[Live.sec] = v;
    save();
  }, 400);

  /* ---------- crossfire ---------- */
  function liveCrossfire(v) {
    const box = $('#livea');
    const q = v.trim();
    if (q.length < 3) {
      box.innerHTML = `<div class="lh">Answer</div><p class="empty">Start typing their question. Shorthand works: "wont china win", "jobs?", "TMI nuclear".</p>${xfHistory()}`;
      return;
    }
    const a = B.answer(q, IDX);
    if (!a) return;
    renderHUD(a);
    scheduleAI(a);
  }
  function renderHUD(a) {
    const box = $('#livea'); if (!box) return;
    Live.lastAns = a;
    const modeTxt = a.alt ? '↔ Alternate card' : { prefire: '✓ Prepared answer', adapted: '≈ Closest prepared answer', generated: '⚡ New counter (no prefire)' }[a.mode];
    const ev = (a.evidence || []).map(e => evChip(e.id)).join('');
    const alts = a.cards.filter(c => !a.card || c.doc.id !== a.card.doc.id).slice(0, 3);
    const cardLink = a.card && a.mode !== 'generated' ? `<button class="lnk" data-gocard="${a.card.doc.id}">Open card ↗</button>` : '';
    box.innerHTML = `<div class="lh">Answer <span class="sp"></span>${cardLink}</div>
      <div class="hud">
        <span class="mode ${a.mode}">${modeTxt}</span>
        <div class="conf" title="Match confidence"><i style="width:${Math.round(a.confidence * 100)}%;background:${a.confidence > 0.7 ? 'var(--good)' : a.confidence > 0.45 ? 'var(--warn)' : 'var(--bad)'}"></i></div>
        ${a.opener ? `<div class="op">${esc(a.opener)}</div>` : ''}
        <div class="bd">${esc(a.body)}</div>
        ${a.bridge ? `<div class="br">${esc(a.bridge)}</div>` : ''}
        ${a.turn ? `<div class="tn">${esc(a.turn)}</div>` : ''}
        ${ev ? `<div class="evs">${ev}</div>` : ''}
        <div id="aiout"></div>
        ${alts.length ? `<div class="lh" style="margin-top:12px">Other matches</div><div class="alts2">${alts.map(c => `<button class="lnk" data-alt="${c.doc.id}">${esc(c.doc.head.slice(0, 70))}</button>`).join('')}</div>` : ''}
      </div>${xfHistory()}`;
    renderAIBox(a, 'idle');
  }
  function xfHistory() {
    const h = S.round.xf; if (!h.length) return '';
    return `<div class="lh">This round's crossfire</div>` + h.slice(-8).reverse().map((x, i) => `<div class="hist" data-hist="${h.length - 1 - i}"><b>Q: ${esc(x.q)}</b>${esc((x.a || '').slice(0, 140))}</div>`).join('');
  }
  function showAlt(id) {
    const d = IDX.docs.find(x => x.id === id); if (!d || !Live.lastAns) return;
    const it = d.item;
    const prev = Live.lastAns;
    const a = Object.assign({}, prev, {
      mode: 'adapted', alt: true, opener: it.short || '', body: B.stripHtml(it.html || ''), bridge: '', turn: it.turn || it.follow || '',
      card: { doc: d, score: 1 }, evidence: (it.ev || []).map(evById).filter(Boolean).slice(0, 2),
      cards: [{ doc: d, score: 1 }].concat(prev.cards.filter(c => c.doc.id !== d.id))
    });
    renderHUD(a);
  }
  function nextQuestion() {
    const ta = $('#liveta'); const q = ta.value.trim(); if (!q) return;
    const a = Live.lastAns;
    const aiTxt = ($('#aiout .aitext') || {}).textContent || '';
    S.round.xf.push({ q, a: aiTxt || ((a && a.opener ? a.opener + ' ' : '') + (a ? a.body : '')), t: Date.now(), card: a && a.card ? a.card.doc.id : null });
    if (a && a.card && a.mode !== 'generated') { S.round.used[a.card.doc.id] = true; const el = $('#card-' + a.card.doc.id); if (el) { el.classList.add('used'); const cb = $('input[data-act="used"]', el); if (cb) cb.checked = true; } }
    ta.value = ''; S.round.xfDraft = ''; save();
    updateLive(true); ta.focus();
  }

  /* ---------- their case → summary + round plan ---------- */
  function setPlan(map) {
    S.round.plan = map; save();
    $$('.card').forEach(el => { const p = map[el.dataset.card]; el.classList.toggle('plan', !!p); const b = $('.planbadge', el); if (b) b.textContent = p || ''; });
  }
  function clearPlanIfEmpty() { }
  function liveCase(v) {
    const box = $('#livea');
    if (wc(v) < 3) { box.innerHTML = '<div class="lh">Their case</div><p class="empty">Type at least a few words of their case. Signposts like "C1", "C2", "first", "second" help split contentions.</p>'; return; }
    const sum = B.summarizeCase(v, IDX);
    const plan = {};
    const blocks = sum.blocks.map(b => {
      b.rebuttals.slice(0, 2).forEach(r => { plan[r.doc.id] = plan[r.doc.id] || `Rebut their C${b.n}`; });
      b.ask.slice(0, 2).forEach(r => { plan[r.doc.id] = plan[r.doc.id] || `Ask vs C${b.n}`; });
      b.prep.slice(0, 2).forEach(r => { plan[r.doc.id] = plan[r.doc.id] || `They may ask (C${b.n})`; });
      const link = r => `<button class="lnk" data-gocard="${r.doc.id}">${esc(r.doc.head.slice(0, 60))}</button>`;
      return `<div class="blk"><h4><span class="n">C${b.n}</span>${esc(b.label)}</h4><q>${esc(b.key)}</q>
        ${b.evidence.length ? `<div class="plan-row"><b>Their ev</b><span style="font-size:.8rem">${b.evidence.map(e => esc(e.slice(0, 90))).join(' · ')} <i style="color:var(--ink3)">— ask for date/source in crossfire</i></span></div>` : ''}
        ${b.rebuttals.length ? `<div class="plan-row"><b>Rebut</b>${b.rebuttals.slice(0, 2).map(link).join('')}</div>` : '<div class="plan-row"><b>Rebut</b><span class="empty">No card — use ⚡ Crossfire helper to generate one</span></div>'}
        ${b.ask.length ? `<div class="plan-row"><b>Ask</b>${b.ask.slice(0, 2).map(link).join('')}</div>` : ''}
        ${b.prep.length ? `<div class="plan-row"><b>Prep for</b>${b.prep.slice(0, 2).map(link).join('')}</div>` : ''}
        <div class="plan-row"><b>Weigh</b><span style="font-size:.82rem">${esc(b.weigh)}</span></div></div>`;
    }).join('');
    setPlan(plan);
    const order = [];
    const firstAsk = Object.entries(plan).filter(([, v]) => /^Ask/.test(v)).map(([k]) => k).slice(0, 3);
    const reb = Object.entries(plan).filter(([, v]) => /^Rebut/.test(v)).map(([k]) => k).slice(0, 5);
    if (firstAsk.length) order.push(`<div class="plan-row"><b>Crossfire</b>${firstAsk.map(id => `<button class="lnk" data-gocard="${id}">${esc(cardTitle(id).slice(0, 40))}</button>`).join('')}</div>`);
    if (reb.length) order.push(`<div class="plan-row"><b>Rebuttal</b>${reb.map(id => `<button class="lnk" data-gocard="${id}">${esc(cardTitle(id).slice(0, 40))}</button>`).join('')}</div>`);
    order.push(`<div class="plan-row"><b>Summary</b><button class="lnk" data-gosec="summary">Build summary from this →</button></div>`);
    order.push(`<div class="plan-row"><b>Final Focus</b><button class="lnk" data-gosec="closing">Build final focus →</button></div>`);
    box.innerHTML = `<div class="lh">Round plan <span class="sp"></span><button class="lnk" id="clearPlan">Clear highlights</button></div><div class="blk" style="border-color:var(--plan)">${order.join('')}<p style="font-size:.76rem;color:var(--ink3);margin:6px 0 0">Purple cards in your doc = use them this round.</p></div>
      <div class="lh">Their case — ${sum.blocks.length} argument${sum.blocks.length === 1 ? '' : 's'} detected</div>${blocks || '<p class="empty">Keep typing — no clear arguments yet.</p>'}`;
  }
  function cardTitle(id) { const d = IDX.docs.find(x => x.id === id); return d ? d.head : id; }

  /* ---------- their attacks → matching cards ---------- */
  function liveAttacks(v) {
    const box = $('#livea');
    const lines = v.split(/\n+/).map(s => s.trim()).filter(s => wc(s) >= 2);
    if (!lines.length) { box.innerHTML = '<div class="lh">Matches</div><p class="empty">Type each thing they say on its own line.</p>'; return; }
    const plan = Object.assign({}, S.round.plan);
    const types = Live.sec === 'counter' ? ['counter', 'rebuttal', 'qa'] : ['rebuttal', 'counter', 'qa'];
    const rows = lines.slice(-12).map(line => {
      const r = IDX.search(line, { types, limit: 3, boost: { [types[0]]: 1.15 } }).results.filter(x => x.score > 0.4);
      if (r[0]) plan[r[0].doc.id] = plan[r[0].doc.id] || 'They said this';
      const a = r[0] ? null : B.answer(line, IDX);
      return `<div class="blk"><q>${esc(line)}</q>${r.length ? `<div class="plan-row"><b>Answer</b>${r.slice(0, 2).map(x => `<button class="lnk" data-gocard="${x.doc.id}">${esc(x.doc.head.slice(0, 64))}</button>`).join('')}</div><div style="font-size:.86rem;margin-top:6px">${esc(B.compress(B.stripHtml(r[0].doc.item.html), 40))}</div>` : `<div class="plan-row"><b>New</b><span style="font-size:.86rem">${esc((a.opener ? a.opener + ' ' : '') + a.body)}</span></div>`}</div>`;
    }).reverse().join('');
    setPlan(plan);
    box.innerHTML = `<div class="lh">Matches (newest first) <span class="sp"></span><button class="lnk" id="clearPlan">Clear highlights</button></div>${rows}`;
  }

  /* ---------- summary / final focus builders ---------- */
  function roundLog() {
    const out = [];
    for (const [k, v] of Object.entries(S.round.notes || {})) if (v && v.trim()) { const s = findSec(k); out.push({ section: s ? (s.listen === 'attacks' ? k : s.id) : k, text: v }); }
    for (const x of S.round.xf || []) out.push({ section: 'crossfire', text: x.q });
    return out;
  }
  function liveBuilderIntro(kind) {
    const box = $('#livea');
    const log = roundLog();
    const n = log.reduce((a, s) => a + wc(s.text), 0);
    const prev = S.round['built_' + kind];
    box.innerHTML = `<div class="lh">Uses everything typed this round</div><p style="font-size:.85rem;margin:0">${n} words of their arguments across ${log.length} note(s). ${n < 5 ? '<b>Tip:</b> type their case in 🎤 Opening → "⌨ Type what they say" first, or add their main points above.' : ''}</p>
      <div id="buildout">${prev ? builderOutput(kind, prev) : ''}</div>`;
  }
  function builderOutput(kind, res) {
    return `<div class="lh">Your ${kind === 'summary' ? 'Summary' : 'Final Focus'} <span class="sp"></span><span class="timeest">${res.words ? `~${res.words} words ≈ ${fmtClock(res.seconds)}` : ''}</span></div>
      <div class="builder rt" contenteditable="true" id="buildhtml">${res.html}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button class="btn sm pri" id="buildInsert">Insert into ${kind === 'summary' ? 'Summary' : 'Ending Statement'} doc</button><button class="btn sm" id="buildCopy">Copy text</button>${AI.ready() ? '<button class="btn sm" id="buildPolish">✨ Smooth it out with AI</button>' : ''}</div>
      <div id="polishout"></div>`;
  }
  function build(kind) {
    const extra = $('#liveta').value.trim();
    const log = roundLog();
    if (extra) log.push({ section: kind, text: extra });
    let res;
    if (kind === 'closing') {
      const base = (findSec('closing') || {}).html || '';
      res = B.buildFinalFocus(base, log, IDX);
    } else {
      res = B.buildSummary(log, SD(), IDX);
      const words = wc(B.stripHtml(res.html)); res.words = words; res.seconds = Math.round(words / 2.6);
    }
    S.round['built_' + kind] = { html: res.html, words: res.words, seconds: res.seconds }; save();
    $('#buildout').innerHTML = builderOutput(kind, S.round['built_' + kind]);
  }

  /* =========================================================
     OFFLINE AI (optional): Chrome built-in AI or a local model file
     ========================================================= */
  const AI = {
    chrome: { st: 'checking', base: null, progress: 0 },
    local: { st: 'none', w: null, name: '', tps: 0, err: '', progress: 0, saved: null },
    label() {
      const r = this.ready();
      return r === 'local' ? '🧠 AI: local model' : r === 'chrome' ? '🧠 AI: Chrome built-in' : '⚡ Instant engine';
    },
    ready() {
      const pref = S.settings.aiPref;
      if (pref === 'off') return null;
      if (pref !== 'chrome' && this.local.st === 'ready') return 'local';
      if (pref !== 'local' && this.chrome.st === 'ready') return 'chrome';
      if (this.local.st === 'ready') return 'local';
      return null;
    }
  };
  const LM_OPTS = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };
  async function detectChromeAI() {
    try {
      if (!('LanguageModel' in self)) { AI.chrome.st = 'unavailable'; return; }
      const a = await LanguageModel.availability(LM_OPTS);
      AI.chrome.st = a === 'available' ? 'available' : a === 'downloadable' ? 'downloadable' : a === 'downloading' ? 'downloading' : 'unavailable';
      if (AI.chrome.st === 'available' && S.settings.aiPref !== 'off' && S.settings.aiPref !== 'local') startChromeAI(true);
    } catch (e) { AI.chrome.st = 'unavailable'; }
    refreshAIBits();
  }
  async function startChromeAI(silent) {
    try {
      AI.chrome.st = AI.chrome.st === 'available' ? 'starting' : 'downloading'; refreshAIBits();
      const sys = B.llmPrompt('crossfire', { q: '', cards: [] }, S.side, S.topic).sys;
      AI.chrome.base = await LanguageModel.create(Object.assign({}, LM_OPTS, {
        initialPrompts: [{ role: 'system', content: sys }],
        monitor(m) { m.addEventListener('downloadprogress', e => { AI.chrome.progress = e.loaded; refreshAIBits(); }); }
      }));
      AI.chrome.st = 'ready'; if (!silent) toast('Chrome built-in AI is ready (works offline).');
    } catch (e) { AI.chrome.st = 'unavailable'; if (!silent) toast('Chrome AI could not start: ' + (e.message || e)); }
    refreshAIBits();
  }
  /* ---- local model via wllama (llama.cpp compiled to WebAssembly, embedded in this file) ---- */
  async function b64gzToBlob(id, type) {
    const el = document.getElementById(id); if (!el) throw new Error('AI engine not included in this copy');
    const bin = Uint8Array.from(atob(el.textContent.trim()), c => c.charCodeAt(0));
    if (!('DecompressionStream' in window)) throw new Error('This browser is too old for the local AI model');
    const ab = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    return new Blob([ab], { type });
  }
  let libLoaded = null;
  function ensureLib() {
    if (window.WllamaLib) return Promise.resolve();
    if (libLoaded) return libLoaded;
    libLoaded = (async () => {
      const src = document.getElementById('pf-wllama'); if (!src) throw new Error('AI engine not included in this copy');
      const blob = await b64gzToBlob('pf-wllama', 'text/javascript');
      const s = document.createElement('script'); s.textContent = await blob.text(); document.head.appendChild(s);
      if (!window.WllamaLib) throw new Error('AI engine failed to start');
    })();
    return libLoaded;
  }
  const quietLogger = { debug() { }, log() { }, warn() { }, error(...a) { console.error(...a); } };
  async function makeWllama() {
    await ensureLib();
    const wasmURL = URL.createObjectURL(await b64gzToBlob('pf-wasm-main', 'application/wasm'));
    const w = new WllamaLib.Wllama({ default: wasmURL }, { suppressNativeLog: true, logger: quietLogger });
    const jspi = typeof WebAssembly.Suspending === 'function';
    const firefox = /firefox/i.test(navigator.userAgent);
    if (!jspi && !firefox && document.getElementById('pf-wasm-compat')) {
      const cw = URL.createObjectURL(await b64gzToBlob('pf-wasm-compat', 'application/wasm'));
      const cj = URL.createObjectURL(await b64gzToBlob('pf-compat-js', 'text/javascript'));
      w.setCompat({ worker: cj, wasm: cw });
    } else w.setCompat(null);
    return w;
  }
  async function loadLocalModel(blob, name) {
    if (AI.local.st === 'loading') return;
    AI.local.st = 'loading'; AI.local.err = ''; AI.local.name = name || blob.name || 'model.gguf'; refreshAIBits();
    try {
      if (AI.local.w) { try { await AI.local.w.exit(); } catch (e) { } AI.local.w = null; }
      let w = await makeWllama();
      const useGpu = S.settings.gpu && !!navigator.gpu;
      try { await w.loadModel([blob], { n_ctx: 2048, n_gpu_layers: useGpu ? 99999 : 0 }); }
      catch (e) {
        if (!useGpu) throw e;
        try { await w.exit(); } catch (x) { }
        w = await makeWllama(); await w.loadModel([blob], { n_ctx: 2048, n_gpu_layers: 0 });
      }
      AI.local.w = w; AI.local.st = 'ready'; refreshAIBits();
      // quick speed test
      const t0 = performance.now();
      const r = await w.createChatCompletion({ messages: [{ role: 'user', content: 'Say: ready' }], max_tokens: 8, temperature: 0 });
      const n = (r.usage && r.usage.completion_tokens) || 4;
      AI.local.tps = n / ((performance.now() - t0) / 1000);
      toast(`Local AI ready (${AI.local.tps.toFixed(1)} words/sec).`);
    } catch (e) {
      AI.local.st = 'error'; AI.local.err = (e && e.message) || String(e);
      toast('Model failed to load: ' + AI.local.err, 6000);
    }
    refreshAIBits();
  }
  async function opfsDir() { if (!navigator.storage || !navigator.storage.getDirectory) return null; try { return await navigator.storage.getDirectory(); } catch (e) { return null; } }
  async function savedModelFile() {
    const d = await opfsDir(); if (!d) return null;
    try { const fh = await d.getFileHandle('pf-model.gguf'); const f = await fh.getFile(); return f.size > 1000 ? f : null; } catch (e) { return null; }
  }
  async function saveModelToBrowser(src, name, onProg) {
    const d = await opfsDir(); if (!d) throw new Error('This browser cannot store the model — you\'ll pick the file each time.');
    const fh = await d.getFileHandle('pf-model.gguf', { create: true });
    if (!fh.createWritable) throw new Error('This browser cannot store the model — you\'ll pick the file each time.');
    const w = await fh.createWritable();
    const total = src.size || 0; let done = 0;
    const reader = (src.body || src.stream()).getReader();
    for (; ;) { const { done: d2, value } = await reader.read(); if (d2) break; await w.write(value); done += value.length; onProg && onProg(done, total); }
    await w.close();
    try { navigator.storage.persist && navigator.storage.persist(); } catch (e) { }
    lsSet(LS_MODEL, JSON.stringify({ name, size: done, at: Date.now() }));
    return fh.getFile();
  }
  async function forgetModel() {
    const d = await opfsDir(); if (d) { try { await d.removeEntry('pf-model.gguf'); } catch (e) { } }
    lsSet(LS_MODEL, 'null'); AI.local.saved = null;
    if (AI.local.w) { try { await AI.local.w.exit(); } catch (e) { } }
    AI.local.w = null; AI.local.st = 'none'; refreshAIBits();
  }
  async function generate(p, onText, signal) {
    const eng = AI.ready(); if (!eng) throw new Error('No AI loaded');
    let acc = '';
    if (eng === 'chrome') {
      const s = await AI.chrome.base.clone({ signal });
      try {
        const stream = s.promptStreaming(p.user, { signal });
        for await (const chunk of stream) {
          if (chunk.startsWith(acc) && acc.length > 0) acc = chunk; else acc += chunk;
          onText(acc);
        }
      } finally { try { s.destroy(); } catch (e) { } }
      return acc;
    }
    const stream = await AI.local.w.createChatCompletion({ messages: [{ role: 'system', content: p.sys }, { role: 'user', content: p.user }], max_tokens: p.max || 160, temperature: 0.4, top_p: 0.9, stream: true, abortSignal: signal });
    for await (const chunk of stream) { const d = chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content; if (d) { acc += d; onText(acc); } }
    return acc;
  }
  const scheduleAI = debounce(a => {
    if (!AI.ready() || !S.settings.aiAuto || !Live.open || Live.kind !== 'crossfire') return renderAIBox(a, 'idle');
    runAI(a);
  }, 900);
  function renderAIBox(a, st) {
    const box = $('#aiout'); if (!box) return;
    if (!AI.ready()) { box.innerHTML = ''; return; }
    if (st === 'idle') box.innerHTML = `<div class="ai"><button class="btn sm" id="aiGo">✨ Rephrase this answer with AI</button></div>`;
  }
  async function runAI(a) {
    if (!a || !AI.ready()) return;
    if (Live.aiAbort) Live.aiAbort.abort();
    const ctl = new AbortController(); Live.aiAbort = ctl;
    const box = $('#aiout'); if (!box) return;
    box.innerHTML = `<div class="ai"><div class="aih">🧠 AI version <span style="color:var(--ink3);font-weight:500;text-transform:none">${AI.ready() === 'local' ? 'local model' : 'Chrome AI'} · offline</span><span class="sp" style="flex:1"></span><button class="lnk" id="aiStop">stop</button></div><div class="aitext">…</div></div>`;
    const cards = a.cards.slice(0, 3).map(c => B.compress(B.stripHtml((c.doc.item.short ? c.doc.item.short + ' ' : '') + (c.doc.item.html || '')), 70));
    const p = B.llmPrompt('crossfire', { q: a.query, cards }, S.side, S.topic);
    try {
      await generate(p, t => { const el = $('#aiout .aitext'); if (el && !ctl.signal.aborted) el.textContent = t.trim(); }, ctl.signal);
    } catch (e) { if (!ctl.signal.aborted) { const el = $('#aiout .aitext'); if (el) el.textContent = 'AI error: ' + (e.message || e); } }
  }
  async function polishBuilt() {
    const html = $('#buildhtml'); if (!html || !AI.ready()) return;
    const out = $('#polishout');
    out.innerHTML = `<div class="ai" style="margin-top:10px"><div class="aih">🧠 Smoothed version (check every fact!)</div><div class="builder aitext" contenteditable="true">…</div><button class="btn sm" id="polishUse" style="margin-top:6px">Use this version</button></div>`;
    const text = html.innerText;
    const p = B.llmPrompt('polish', { speech: Live.kind === 'summary' ? 'Summary speech' : 'Final Focus', seconds: Math.round(wc(text) / 2.6), text }, S.side, S.topic);
    try { await generate(p, t => { const el = $('#polishout .aitext'); if (el) el.textContent = t.trim(); }); }
    catch (e) { const el = $('#polishout .aitext'); if (el) el.textContent = 'AI error: ' + (e.message || e); }
  }
  function refreshAIBits() {
    const h = $('#live .liveh small'); if (h && Live.open) { const sec = findSec(Live.sec); h.textContent = `${sec ? sec.icon + ' ' + sec.title : ''} · ${S.side.toUpperCase()} side · ${AI.label()}`; }
    if ($('#aitab')) renderSetupTab('ai');
  }

  /* =========================================================
     MODALS
     ========================================================= */
  function modal(html, wide) {
    $('#mbox').innerHTML = html; $('#mbox').style.width = wide ? 'min(900px,100%)' : '';
    $('#modal').classList.add('show');
  }
  function closeModal() { $('#modal').classList.remove('show'); }
  function showEvidence(id) {
    const e = evById(id); if (!e) return;
    modal(`<div class="mh"><h2><span class="eid" style="font-family:var(--mono);font-size:.75rem;background:var(--ink);color:var(--paper);border-radius:4px;padding:0 5px;margin-right:6px">${e.id}</span>${esc(e.tag)}</h2><button class="iconbtn" data-close aria-label="Close">✕</button></div>
      <div class="mb"><p style="margin-top:0"><b>${esc(e.who || '')}</b></p><p style="font-size:.88rem;color:var(--ink2)">${esc(e.cite)}</p><p>${esc(e.text)}</p>${e.url ? `<p style="font-size:.85rem;word-break:break-all">🔗 <a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.url)}</a><br><span style="color:var(--ink3)">(link needs internet)</span></p>` : ''}</div>
      <div class="mf"><button class="btn" data-act="copycite" data-ev="${e.id}">Copy citation</button><button class="btn" data-goev="${e.id}">Edit in library</button><button class="btn pri" data-close>Done</button></div>`);
  }
  function showChange(id) {
    const c = S.changes.find(x => x.id === id); if (!c) return;
    modal(`<div class="mh"><h2>What Claude changed here</h2><button class="iconbtn" data-close aria-label="Close">✕</button></div>
      <div class="mb"><div class="chg" style="margin:0"><div class="w">${esc(c.where)}</div><div class="o">${esc(c.original)}</div><div class="nw">${esc(c.now)}</div><div class="y"><b>Why:</b> ${esc(c.why)}</div>${(c.ev || []).length ? `<div class="cfoot" style="padding:6px 0 0">${c.ev.map(evChip).join('')}</div>` : ''}</div></div>
      <div class="mf"><button class="btn" data-gosec2="factcheck">See all changes</button><button class="btn pri" data-close>Got it</button></div>`);
  }
  function showHelp() {
    const k = s => `<span class="kbd">${s}</span>`;
    modal(`<div class="mh"><h2>How to use PF Debate Hub</h2><button class="iconbtn" data-close aria-label="Close">✕</button></div><div class="mb" style="font-size:.92rem">
      <p><b>It's a doc you can edit.</b> Click any text to edit it. Select text for the formatting bar (bold, highlight, headings, evidence tags). Everything saves automatically in this browser.</p>
      <p><b>Find anything fast.</b> ${k('/')} jumps to search — it highlights <i>every</i> match across the whole case; ${k('Enter')} steps through them. Topic chips (Bills, Water, AI…) filter cards by subject. "☰ Titles only" shows just the card titles for quick scanning.</p>
      <p><b>⌨ Type what they say</b> (on each section): type the other team's words — shorthand is fine. Every word is detected and color-coded, and:</p>
      <ul><li>🎤 <b>Opening</b> → splits their case into contentions, and lights up (purple) which rebuttals, crossfire questions and answers to use</li><li>🛡️ <b>Rebuttal / Counter</b> → each line you type finds the card that answers it</li><li>⚡ <b>Crossfire</b> → the best prepared answer appears while you type their question (rephrased to fit it). No prepared answer? It writes a new counter from your cards in your style.</li><li>🧭 <b>Summary</b> / 🏁 <b>Final Focus</b> → builds your speech from everything they said this round.</li></ul>
      <p><b>Shortcuts</b> (when not typing): ${k('X')} crossfire helper · ${k('T')} start/pause timer · ${k('E')} evidence · ${k('1')}–${k('9')} jump to section · ${k('?')} this help · ${k('Esc')} close panels</p>
      <p><b>Sharing with your partner:</b> ⚙ → "Save a copy with my edits" downloads a new file with all your changes inside. Send it (AirDrop, email, USB, Google Drive) and your partner just opens it.</p>
      <p><b>Offline:</b> everything works with no internet. The optional AI model (⚙ → Offline AI) needs internet once to download.</p>
      <p><b>New round:</b> 📝 This Round → "New round" clears checkmarks, notes and highlights (your case stays).</p></div>
      <div class="mf"><button class="btn pri" data-close>Got it</button></div>`);
  }
  function showRules(first) {
    modal(`<div class="mh"><h2>${first ? 'Welcome! One quick note' : 'Tournament rules'}</h2><button class="iconbtn" data-close aria-label="Close">✕</button></div><div class="mb" style="font-size:.92rem">
      <div class="notice warn"><b>Check your tournament's rules before using the AI features during a real round.</b> NSDA rules ban getting outside help during a round, some state associations treat AI-written speeches as plagiarism, and Nebraska's new 2026 speech manual reportedly allows AI only for "limited support" like brainstorming and research. Ask your coach. Using this file as your evidence/flow doc is normally fine; the auto-generated answers are safest for practice and prep.</div>
      <p><b>Evidence ethics:</b> if the other team asks to see a card, you must show the source. Every stat in this file has a source in 📚 Evidence Library. Claude removed claims it couldn't source — see ✅ Fact-Check Log.</p></div>
      <div class="mf"><button class="btn pri" data-close data-rulesok>Got it</button></div>`);
  }

  /* ---------- setup ---------- */
  let setupTab = 'start';
  function showSetup(tab) {
    setupTab = tab || setupTab;
    modal(`<div class="mh"><h2>⚙ Setup</h2><button class="iconbtn" data-close aria-label="Close">✕</button></div>
      <div class="tabs">${[['start', 'Before the tournament'], ['ai', 'Offline AI'], ['share', 'Save & share'], ['display', 'Display'], ['rules', 'Rules']].map(([k, l]) => `<button data-tab="${k}" class="${setupTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="mb" id="setupbody"></div><div class="mf"><button class="btn pri" data-close>Done</button></div>`, true);
    renderSetupTab(setupTab);
  }
  function pill(st) {
    const m = { ready: ['ok', 'Ready'], available: ['mid', 'Available — not started'], downloadable: ['mid', 'Can download'], downloading: ['mid', 'Downloading…'], starting: ['mid', 'Starting…'], unavailable: ['off', 'Not on this device'], checking: ['off', 'Checking…'], none: ['off', 'No model loaded'], saved: ['mid', 'Saved — not loaded'], loading: ['mid', 'Loading…'], error: ['no', 'Error'] }[st] || ['off', st];
    return `<span class="pill ${m[0]}">${m[1]}</span>`;
  }
  const MODELS = [
    { n: 'Qwen2.5 1.5B Instruct (recommended)', size: '1.1 GB', url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf', note: 'Best answers on most laptops' },
    { n: 'Qwen2.5 0.5B Instruct (fast)', size: '0.5 GB', url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf', note: 'For older or slower laptops / Chromebooks' }
  ];
  function renderSetupTab(tab) {
    setupTab = tab; $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const body = $('#setupbody'); if (!body) return;
    if (tab === 'start') {
      const savedM = AI.local.saved;
      body.innerHTML = `<p style="margin-top:0">Do these at home <b>while you still have internet</b>, then test with Wi-Fi turned off.</p>
        <div class="st"><div class="si">${storageOK ? '✅' : '⚠️'}</div><div class="sx"><b>1. Keep this file somewhere safe</b><p>Save this .html file to your laptop (Desktop or Documents), not just a download link. Open it in <b>Chrome or Edge</b> for the best experience. Edits save in this browser automatically${storageOK ? '' : ' — <b>but this browser is blocking saving</b>, so use "Save a copy" often'}.</p></div></div>
        <div class="st"><div class="si">${AI.ready() ? '✅' : '➕'}</div><div class="sx"><b>2. (Optional) Download the offline AI model</b><p>The instant engine already answers questions with no download. The AI model adds smoother rephrasing. ${savedM ? 'Saved: ' + esc(savedM.name) : ''}</p><button class="btn sm" data-tab="ai">Set up offline AI →</button></div></div>
        <div class="st"><div class="si">🤝</div><div class="sx"><b>3. Send your partner a copy</b><p>"Save a copy with my edits" downloads a new file with everything inside. Your partner opens it — no install.</p><button class="btn sm" data-act="exporthtml">Save a copy with my edits</button></div></div>
        <div class="st"><div class="si">✈️</div><div class="sx"><b>4. Airplane-mode test</b><p>Turn off Wi-Fi, reopen this file, and try: search for "water", open ⚡ Crossfire and type "wont china win", type a fake case in 🎤 Opening → ⌨ Type what they say.</p><button class="btn sm" id="selftest">Run a self-test now</button><div id="selftestout" style="font-size:.85rem;margin-top:6px"></div></div></div>`;
    } else if (tab === 'ai') {
      const cs = AI.chrome.st, ls = AI.local.st;
      body.innerHTML = `<div id="aitab"></div>
        <div class="notice info">The <b>⚡ Instant engine</b> is always on: it matches their question to your prepared answers and writes new counters from your own cards — instantly, offline, on any device. The AI options below are <i>extra</i> polish.</div>
        <div class="st"><div class="si">🧠</div><div class="sx"><b>Local AI model (works in Chrome, Edge, Safari, Firefox)</b> ${pill(ls)}
          <p>A small language model that runs entirely on your laptop. Download it once with internet; after that it works offline.${AI.local.name ? '<br>Model: <b>' + esc(AI.local.name) + '</b>' : ''}${AI.local.tps ? ` · speed ≈ ${AI.local.tps.toFixed(1)} words/sec` : ''}${AI.local.err ? '<br><span style="color:var(--bad)">' + esc(AI.local.err) + '</span>' : ''}</p>
          <div class="prog" id="mprog" ${AI.local.progress ? '' : 'hidden'}><i style="width:${Math.round(AI.local.progress * 100)}%"></i></div>
          <div style="display:flex;flex-direction:column;gap:6px">
          ${MODELS.map((m, i) => `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn sm" data-dlmodel="${i}">⬇ Download ${esc(m.n)} · ${m.size}</button><span style="font-size:.78rem;color:var(--ink3)">${esc(m.note)}</span></div>`).join('')}
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px"><label class="btn sm" style="cursor:pointer">📂 I already have a .gguf file<input type="file" id="ggufpick" accept=".gguf" hidden></label>${AI.local.saved && ls !== 'ready' ? '<button class="btn sm pri" id="loadsaved">▶ Load saved model</button>' : ''}${AI.local.saved || ls === 'ready' ? '<button class="btn sm" id="forgetmodel">🗑 Remove model</button>' : ''}</div>
          <label style="font-size:.84rem;display:flex;gap:6px;align-items:center"><input type="checkbox" id="optAutoLoad" ${S.settings.autoLoadModel ? 'checked' : ''}> Load the saved model automatically when this file opens</label>
          <label style="font-size:.84rem;display:flex;gap:6px;align-items:center"><input type="checkbox" id="optGpu" ${S.settings.gpu ? 'checked' : ''}> Use the graphics card if possible (faster; turn off if it crashes)</label></div>
          <p style="font-size:.78rem;color:var(--ink3);margin-top:8px">If the download button fails, download the file in your browser from the link (right-click → Copy link) and use "I already have a .gguf file". Links: ${MODELS.map(m => `<a href="${m.url}" target="_blank" rel="noopener">${esc(m.n.split(' (')[0])}</a>`).join(' · ')}</p></div></div>
        <div class="st"><div class="si">🌐</div><div class="sx"><b>Chrome built-in AI (Gemini Nano)</b> ${pill(cs)}
          <p>Some newer computers running Chrome have a built-in offline AI. ${cs === 'unavailable' ? 'It isn\'t available on this device/browser — that\'s normal; use the local model instead.' : ''}${AI.chrome.progress ? ` Download: ${Math.round(AI.chrome.progress * 100)}%` : ''}</p>
          ${cs === 'downloadable' || cs === 'available' ? `<button class="btn sm" id="startchrome">${cs === 'downloadable' ? '⬇ Download & start (needs internet once)' : '▶ Start'}</button>` : ''}</div></div>
        <div class="st"><div class="si">⚙</div><div class="sx"><b>Which AI to use</b><p>
          <select id="aipref" style="border:1px solid var(--line2);border-radius:8px;padding:4px 8px;background:var(--bg)">${[['auto', 'Automatic'], ['local', 'Local model first'], ['chrome', 'Chrome AI first'], ['off', 'Off (instant engine only)']].map(([v, l]) => `<option value="${v}" ${S.settings.aiPref === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <label style="font-size:.84rem;display:inline-flex;gap:6px;align-items:center;margin-left:10px"><input type="checkbox" id="optAiAuto" ${S.settings.aiAuto ? 'checked' : ''}> Auto-rephrase in Crossfire helper</label></p>
          ${AI.ready() ? '<button class="btn sm" id="aitest">Test: ask the AI a crossfire question</button><div id="aitestout" style="font-size:.88rem;margin-top:6px;white-space:pre-wrap"></div>' : ''}</div></div>`;
    } else if (tab === 'share') {
      const snaps = snapshots();
      body.innerHTML = `<div class="st"><div class="si">💾</div><div class="sx"><b>Save a copy with my edits</b><p>Downloads a new .html file with your whole case, edits and notes inside. Send it to your partner or keep it as a backup.</p><button class="btn sm pri" data-act="exporthtml">⬇ Save a copy (.html)</button></div></div>
        <div class="st"><div class="si">📤</div><div class="sx"><b>Data only</b><p>Smaller file with just your content (for backups).</p><button class="btn sm" data-act="exportjson">⬇ Export data (.json)</button> <label class="btn sm" style="cursor:pointer">📂 Open a saved copy (.json or .html)<input type="file" id="importfile" accept=".json,.html,.htm" hidden></label></div></div>
        <div class="st"><div class="si">📋</div><div class="sx"><b>Import a pasted doc</b><p>Paste text from a Google Doc (like your CON doc). Lines like <i>When Pro says "…"</i>, <i>Opponent asks: "…" Your Answer: "…"</i> and section headings are turned into cards automatically.</p><button class="btn sm" id="pasteimport">Paste a doc…</button></div></div>
        <div class="st"><div class="si">🕓</div><div class="sx"><b>Snapshots</b><p>Backups saved automatically before big changes.</p><button class="btn sm" id="snapnow">Save snapshot now</button>
          ${snaps.length ? `<div style="margin-top:8px">${snaps.map(s => `<div style="display:flex;gap:8px;align-items:center;font-size:.85rem;padding:4px 0;border-top:1px solid var(--line)"><span style="flex:1">${esc(s.label)} · ${fmtTime(s.at)}</span><button class="btn sm" data-restore="${s.id}">Restore</button></div>`).join('')}</div>` : '<p class="empty">No snapshots yet.</p>'}</div></div>
        <div class="st"><div class="si">↺</div><div class="sx"><b>Start over</b><p>Go back to the original version Claude made (a snapshot of your current version is saved first).</p><button class="btn sm" id="resetall" style="color:var(--bad)">Reset everything to original</button></div></div>`;
    } else if (tab === 'display') {
      body.innerHTML = `<label class="field">Theme<select id="opttheme">${[['auto', 'Match my device'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<option value="${v}" ${S.settings.theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field">Text size: <b id="fsv">${S.settings.font}px</b><input type="range" id="optfont" min="13" max="22" value="${S.settings.font}"></label>
        <label style="display:flex;gap:6px;align-items:center;margin-bottom:8px"><input type="checkbox" id="optchanges" ${S.settings.showChanges ? 'checked' : ''}> Highlight what Claude changed/added (orange = fixed, green = new)</label>
        <label style="display:flex;gap:6px;align-items:center;margin-bottom:8px"><input type="checkbox" id="optcompact" ${S.settings.compact ? 'checked' : ''}> Titles only (collapse card bodies)</label>
        <button class="btn sm" onclick="window.print()">🖨 Print / save as PDF</button>`;
    } else if (tab === 'rules') {
      body.innerHTML = `<div class="notice warn"><b>Check your tournament's rules before using the AI features during a real round.</b> NSDA rules ban receiving outside help during a round; several state associations treat AI-written speeches as plagiarism; Nebraska's new 2026 speech manual reportedly allows AI only for "limited support" (brainstorming, research, organizing). Ask your coach which features are OK in competition.</div>
        <p>This file never records audio and never sends anything over the internet.</p>
        <p><b>Evidence ethics:</b> opponents can ask to see your evidence. Use 📚 Evidence Library — every number has who/when/link. Claude removed claims it couldn't source (✅ Fact-Check Log).</p>`;
    }
  }
  async function downloadModel(i) {
    const m = MODELS[i];
    if (!navigator.onLine) { toast('You need internet for this one-time download.'); return; }
    AI.local.st = 'loading'; AI.local.progress = 0.001; renderSetupTab('ai');
    try {
      const res = await fetch(m.url); if (!res.ok) throw new Error('Download failed (' + res.status + ')');
      const total = +res.headers.get('content-length') || 0;
      const name = m.url.split('/').pop();
      let file;
      try {
        file = await saveModelToBrowser({ body: res.body, size: total }, name, (d, t) => { AI.local.progress = t ? d / t : 0.5; const bar = $('#mprog i'); if (bar) bar.style.width = Math.round(AI.local.progress * 100) + '%'; });
        AI.local.saved = { name, size: file.size };
      } catch (e) {
        toast(e.message, 5000);
        const r2 = await fetch(m.url); file = new File([await r2.blob()], name);
        offerFileSave(file);
      }
      AI.local.progress = 0; AI.local.st = 'none';
      await loadLocalModel(file, name);
    } catch (e) { AI.local.st = 'error'; AI.local.err = (e.message || e) + ' — try the manual link below.'; AI.local.progress = 0; refreshAIBits(); }
    renderSetupTab('ai');
  }
  function offerFileSave(file) { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); toast('Saved the model file to your Downloads — keep it, you\'ll pick it next time.', 6000); }
  async function pickModel(file) {
    if (!file) return;
    AI.local.progress = 0.001; renderSetupTab('ai');
    let f = file;
    try { f = await saveModelToBrowser({ stream: () => file.stream(), size: file.size }, file.name, (d, t) => { AI.local.progress = d / t; const bar = $('#mprog i'); if (bar) bar.style.width = Math.round(AI.local.progress * 100) + '%'; }); AI.local.saved = { name: file.name, size: file.size }; }
    catch (e) { toast('Using the file directly (this browser can\'t store it): ' + e.message, 5000); f = file; }
    AI.local.progress = 0;
    await loadLocalModel(f, file.name);
    renderSetupTab('ai');
  }
  function selfTest() {
    const out = [];
    try { const a = B.answer("won't a moratorium kill jobs", IDX); out.push(a && a.card ? '✅ Crossfire engine: answers instantly (' + a.card.doc.id + ')' : '❌ Crossfire engine'); } catch (e) { out.push('❌ Crossfire engine: ' + e.message); }
    try { const s = B.summarizeCase('C1 economy jobs GDP\nC2 China wins AI race', IDX); out.push(s.blocks.length ? '✅ Case analyzer works' : '⚠️ Case analyzer found nothing'); } catch (e) { out.push('❌ Case analyzer: ' + e.message); }
    out.push(storageOK ? '✅ Saving works in this browser' : '⚠️ This browser blocks saving — use "Save a copy"');
    out.push(navigator.onLine ? 'ℹ️ You are online — turn Wi-Fi off and run again to be sure' : '✅ You are offline and everything above works');
    out.push(AI.ready() ? '✅ AI model loaded' : 'ℹ️ No AI model loaded (optional)');
    $('#selftestout').innerHTML = out.map(esc).join('<br>');
  }

  /* ---------- paste import ---------- */
  function showPasteImport() {
    modal(`<div class="mh"><h2>Import a pasted doc</h2><button class="iconbtn" data-close aria-label="Close">✕</button></div>
      <div class="mb"><p style="margin-top:0;font-size:.9rem">Copy everything from your Google Doc and paste it here. It goes into the <b>${S.side.toUpperCase()}</b> side (switch sides at the top first if needed).</p><textarea class="big" id="pastebox" placeholder="Opening statement&#10;…&#10;Rebuttal&#10;When Pro says &quot;…&quot;&#10;Rebuttal: …"></textarea><div id="pasteprev" style="font-size:.85rem;margin-top:8px"></div></div>
      <div class="mf"><button class="btn" data-close>Cancel</button><button class="btn pri" id="pastego">Add to ${S.side.toUpperCase()} side</button></div>`);
    $('#pastebox').addEventListener('input', () => {
      const p = B.parsePastedDoc($('#pastebox').value);
      $('#pasteprev').textContent = `Found: ${p.rebuttal.length} rebuttals · ${p.counter.length} counter-rebuttals · ${p.crossfire.length} crossfire questions · ${p.predictions.length} predicted questions · ${p.opening.length + p.summary.length + p.closing.length} paragraphs of speech text`;
    });
    $('#pastego').onclick = () => {
      const p = B.parsePastedDoc($('#pastebox').value);
      pushSnapshot(S, 'Before paste import');
      const sd = SD(); const g = id => sd.sections.find(s => s.id === id);
      const para = arr => arr.map(l => `<p>${esc(l)}</p>`).join('');
      const placeholder = /^<h2>[^<]*<\/h2><p><i>[\s\S]*<\/i><\/p>$/;
      for (const k of ['opening', 'summary', 'closing']) if (p[k].length && g(k)) { const s = g(k); s.html = (placeholder.test(s.html.trim()) ? `<h2>${esc(s.title)}</h2>` : s.html) + para(p[k]); }
      if (g('rebuttal')) g('rebuttal').items.push(...p.rebuttal.map(x => ({ id: 'r' + uid(), trigger: esc(x.trigger), html: esc(x.html), tags: [], ev: [], isUser: true })));
      if (g('counter')) g('counter').items.push(...p.counter.map(x => ({ id: 'k' + uid(), trigger: esc(x.trigger), html: esc(x.html), tags: [], ev: [], isUser: true })));
      if (g('crossfire')) g('crossfire').items.push(...p.crossfire.map(x => ({ id: 'q' + uid(), label: x.label, q: esc(x.q), goal: '', follow: '', tags: [], ev: [], isUser: true })));
      if (g('predictions')) g('predictions').items.push(...p.predictions.map(x => ({ id: 'p' + uid(), q: x.q, alts: [], short: '', html: esc(x.html), turn: '', tags: [], ev: [], isUser: true })));
      // drop the starter placeholder card on CON
      const rb = g('rebuttal'); if (rb && p.rebuttal.length) rb.items = rb.items.filter(i => i.id !== 'cr1');
      save(true); closeModal(); renderAll(); toast('Imported! Check each section.');
    };
  }

  /* ---------- export / import ---------- */
  function exportState() { const o = clone(S); o.exportId = uid(); o.exportedAt = Date.now(); o.savedAt = Date.now(); return o; }
  function download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  function stamp() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`; }
  function exportHTML() {
    const data = exportState();
    const json = JSON.stringify(data).replace(/</g, '\\u003c');
    const parts = ['<!doctype html>', '<html lang="en">', '<head>', '<meta charset="utf-8">', '<meta name="viewport" content="width=device-width, initial-scale=1">', `<title>${esc(document.title)}</title>`, `<style id="pf-style">${$('#pf-style').textContent}</style>`, '</head>', '<body>', '<div id="app"></div>'];
    for (const sc of $$('script[data-keep]')) {
      if (sc.id === 'pf-data') parts.push(`<script id="pf-data" type="application/json" data-keep>${json}<\/script>`);
      else parts.push(sc.outerHTML);
    }
    parts.push('</body>', '</html>');
    download(`PF-Debate-Hub_${stamp()}.html`, parts.join('\n'), 'text/html');
    toast('Saved! Send that file to your partner.');
  }
  function importFile(file) {
    const rd = new FileReader();
    rd.onload = () => {
      let data = null; const txt = String(rd.result);
      try {
        if (/^\s*\{/.test(txt)) data = JSON.parse(txt);
        else { const m = txt.match(/<script id="pf-data"[^>]*>([\s\S]*?)<\/script>/); if (m && m[1].trim() !== 'null') data = JSON.parse(m[1]); }
      } catch (e) { data = null; }
      if (!data || !data.sides) { toast('That file has no PF Debate Hub data in it.'); return; }
      if (!confirm('Replace what\'s here with the copy saved ' + fmtTime(data.savedAt) + '? (Your current version is kept as a snapshot.)')) return;
      pushSnapshot(S, 'Before opening ' + file.name);
      const keep = S.settings; S = migrate(data); S.settings = Object.assign(S.settings, { theme: keep.theme, font: keep.font });
      save(true); closeModal(); renderAll(); toast('Opened ' + file.name);
    };
    rd.readAsText(file);
  }
  function maybeAskShared() {
    if (!pendingShared) return;
    const sh = pendingShared;
    modal(`<div class="mh"><h2>This file has a shared copy inside</h2></div><div class="mb"><p>The file you opened was saved <b>${fmtTime(sh.savedAt)}</b> (maybe by your partner). This browser also has your own version from <b>${fmtTime(S.savedAt)}</b>.</p><p>Which do you want to use? The other one is kept as a snapshot (⚙ → Save & share).</p></div>
      <div class="mf"><button class="btn" id="keepmine">Keep my version</button><button class="btn pri" id="useshared">Use the shared copy</button></div>`);
    const mark = () => { let seen = []; try { seen = JSON.parse(lsGet(LS_SEEN) || '[]'); } catch (e) { } seen.push(sh.exportId); lsSet(LS_SEEN, JSON.stringify(seen.slice(-50))); pendingShared = null; };
    $('#keepmine').onclick = () => { pushSnapshot(sh, 'Shared copy from ' + fmtTime(sh.savedAt)); mark(); closeModal(); };
    $('#useshared').onclick = () => { pushSnapshot(S, 'My version before shared copy'); const keep = S.settings; S = migrate(sh); S.settings = Object.assign(S.settings, { theme: keep.theme, font: keep.font }); mark(); save(true); closeModal(); renderAll(); toast('Using the shared copy.'); };
  }

  function newRoundFlow() {
    if (!confirm('Start a new round? This clears checkmarks, typed notes, crossfire log and purple highlights. Your case stays.')) return;
    const R = S.round;
    if (Object.values(R.notes || {}).some(v => v && v.trim()) || R.xf.length) { S.rounds.unshift({ id: R.id, started: R.started, side: R.side, opponent: R.opponent, judge: R.judge, notes: R.notes, xf: R.xf }); S.rounds = S.rounds.slice(0, 6); }
    S.round = newRound(S.side); S.round.prep = { us: prepLen, them: prepLen }; prepRun = { us: false, them: false };
    save(true); renderAll(); go('round'); toast('New round started. Good luck!');
  }

  /* =========================================================
     EVENTS
     ========================================================= */
  function wire() {
    const doc = $('#doc');
    doc.addEventListener('input', e => {
      const el = e.target.closest('[data-bind]'); if (el) onBindInput(el);
      const rf = e.target.closest('[data-rf]'); if (rf) { S.round[rf.dataset.rf] = rf.value; save(); }
    });
    doc.addEventListener('change', e => {
      const rf = e.target.closest('[data-rf]'); if (rf) { S.round[rf.dataset.rf] = rf.value; save(); }
      if (e.target.id === 'preplen') { prepLen = +e.target.value; S.round.prep = { us: prepLen, them: prepLen }; save(); $('#prep-us').textContent = fmtClock(prepLen); $('#prep-them').textContent = fmtClock(prepLen); }
    });
    doc.addEventListener('paste', e => {
      const ed = e.target.closest && e.target.closest('[contenteditable="true"]'); if (!ed) return;
      e.preventDefault();
      const t = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, t);
    });
    doc.addEventListener('keydown', e => {
      const ed = e.target.closest && e.target.closest('[data-bind]');
      if (ed && e.key === 'Enter' && !ed.classList.contains('docbody') && /\|(trigger|q|short|turn|label|goal|follow|tag|who|cite|url)$/.test(ed.dataset.bind)) { e.preventDefault(); ed.blur(); }
    });
    document.addEventListener('click', onClick);
    document.addEventListener('selectionchange', debounce(placeFmt, 60));
    window.addEventListener('scroll', debounce(placeFmt, 60), { passive: true });

    // top bar
    $('#hamb').onclick = () => document.body.classList.toggle('nav-open');
    $('#sideSeg').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.dataset.side === S.side) return;
      S.side = b.dataset.side; S.round.plan = {}; save(); topic = null; renderAll();
      toast(S.side === 'con' ? 'CON side — paste your Con doc with ⚙ → Save & share → Import a pasted doc' : 'PRO side');
      if (AI.chrome.base) { try { AI.chrome.base.destroy(); } catch (x) { } AI.chrome.base = null; AI.chrome.st = 'available'; detectChromeAI(); }
    });
    const q = $('#q');
    const doSearch = debounce(() => runSearch(q.value.trim()), 120);
    q.addEventListener('input', doSearch);
    q.addEventListener('focus', () => { if (q.value.trim().length >= 2) renderDrop(q.value.trim()); });
    q.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); if (!dropItems.length) return;
        dropSel = (dropSel + (e.key === 'ArrowDown' ? 1 : -1) + dropItems.length) % dropItems.length;
        $$('#qdrop .ri').forEach((b, i) => b.classList.toggle('sel', i === dropSel));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (dropSel >= 0 && dropItems[dropSel]) { openDropItem(dropItems[dropSel]); return; }
        $('#qdrop').classList.remove('show'); stepHit(e.shiftKey ? -1 : 1);
      } else if (e.key === 'Escape') { q.value = ''; runSearch(''); q.blur(); }
    });
    document.addEventListener('pointerdown', e => { if (!e.target.closest('.search')) $('#qdrop').classList.remove('show'); });
    $('#qcount').addEventListener('click', e => { const b = e.target.closest('[data-hn]'); if (b) stepHit(+b.dataset.hn); });

    // timer
    $('#tsel').addEventListener('change', e => { const [s, l] = e.target.value.split('|'); setTimer(+s, l, false); });
    $('#tplay').onclick = () => { T.running = !T.running; T.last = performance.now(); drawTimer(); };
    $('#treset').onclick = () => setTimer(T.total, T.label, false);
    $('#tclock').onclick = () => { $('#bigtimer').classList.add('show'); drawTimer(); };
    $('#btplay').onclick = () => { T.running = !T.running; T.last = performance.now(); drawTimer(); };
    $('#btreset').onclick = () => setTimer(T.total, T.label, false);
    $('#btclose').onclick = () => $('#bigtimer').classList.remove('show');

    $('#xfbtn').onclick = () => (Live.open && Live.kind === 'crossfire') ? closeLive() : openLive('predictions');
    $('#setupbtn').onclick = () => showSetup();

    // live panel
    const live = $('#live');
    live.addEventListener('input', e => {
      if (e.target.id === 'liveta') { persistNote(e.target.value); (Live.kind === 'crossfire' ? updateLive : debounceLive)(); }
      if (e.target.id === 'buildhtml') { const k = 'built_' + Live.kind; if (S.round[k]) { S.round[k].html = e.target.innerHTML; save(); } }
    });
    live.addEventListener('keydown', e => {
      if (e.target.id === 'liveta' && Live.kind === 'crossfire' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); nextQuestion(); }
      if (e.key === 'Escape') { e.preventDefault(); closeLive(); }
    });
    live.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('#liveClose')) return closeLive();
      if (t.closest('#liveSwitch')) return openLive('opening');
      if (t.closest('#liveNext')) return nextQuestion();
      if (t.closest('#liveClear')) { if (!$('#liveta').value || confirm('Clear what you typed here?')) { $('#liveta').value = ''; persistNote(''); if (Live.kind === 'case' || Live.kind === 'attacks') setPlan({}); updateLive(true); } return; }
      if (t.closest('#liveBuild')) return build(Live.kind);
      if (t.closest('#buildInsert')) {
        const sec = findSec(Live.kind === 'summary' ? 'summary' : 'closing'); const html = $('#buildhtml').innerHTML;
        pushSnapshot(S, 'Before inserting built ' + Live.kind);
        sec.html = (sec.html || '') + `<h3>Built for round vs ${esc(S.round.opponent || 'opponent')} (${fmtTime(Date.now())})</h3>` + html;
        save(true); renderDoc(); go(sec.id); toast('Added to the bottom of ' + sec.title); return;
      }
      if (t.closest('#buildCopy')) { copyText($('#buildhtml').innerText); return; }
      if (t.closest('#buildPolish')) return polishBuilt();
      if (t.closest('#polishUse')) { const el = $('#polishout .aitext'); if (el) { $('#buildhtml').innerHTML = el.innerText.split(/\n+/).map(p => `<p>${esc(p)}</p>`).join(''); const k = 'built_' + Live.kind; S.round[k].html = $('#buildhtml').innerHTML; save(); } return; }
      if (t.closest('#aiGo')) return runAI(Live.lastAns);
      if (t.closest('#aiStop')) { if (Live.aiAbort) Live.aiAbort.abort(); return; }
      if (t.closest('#clearPlan')) { setPlan({}); toast('Highlights cleared'); return; }
      const alt = t.closest('[data-alt]'); if (alt) return showAlt(alt.dataset.alt);
      const kw = t.closest('.kw'); if (kw) { topic = kw.dataset.concept; renderChips(); applyTopic(); toast('Filtering: ' + B.CONCEPTS[topic].label); return; }
      const hi = t.closest('[data-hist]'); if (hi) { const x = S.round.xf[+hi.dataset.hist]; if (x) { $('#liveta').value = x.q; updateLive(true); } return; }
    });

    // chips
    $('#chips').addEventListener('click', e => {
      if (e.target.closest('#compactChip')) { S.settings.compact = !S.settings.compact; save(); applyDisplay(); renderChips(); return; }
      if (e.target.closest('#onlyChip')) { topicOnly = !topicOnly; renderChips(); applyTopic(); return; }
      const c = e.target.closest('[data-topic]'); if (!c) return;
      topic = c.dataset.topic || null; if (!topic) topicOnly = false;
      renderChips(); applyTopic();
      if (topic) { const first = $('.card:not(.dim):not(.hide)'); if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });

    // sidebar
    $('#side').addEventListener('click', e => {
      if (e.target.closest('#navsetup')) return showSetup();
      if (e.target.closest('#navhelp')) return showHelp();
      const n = e.target.closest('[data-go]'); if (n) go(n.dataset.go);
    });

    // modal
    $('#modal').addEventListener('click', e => {
      const t = e.target;
      if (t === $('#modal') || t.closest('[data-close]')) { if (t.closest('[data-rulesok]')) { S.settings.rulesSeen = true; save(); } closeModal(); return; }
      const tab = t.closest('[data-tab]'); if (tab) return renderSetupTab(tab.dataset.tab);
      const ge = t.closest('[data-goev]'); if (ge) { closeModal(); go('evidence'); setTimeout(() => { const el = $('#ev-' + ge.dataset.goev); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); } }, 350); return; }
      const gs = t.closest('[data-gosec2]'); if (gs) { closeModal(); go(gs.dataset.gosec2); return; }
      const dm = t.closest('[data-dlmodel]'); if (dm) return downloadModel(+dm.dataset.dlmodel);
      const rs = t.closest('[data-restore]'); if (rs) { const sn = snapshots().find(x => x.id === rs.dataset.restore); if (sn && confirm('Restore "' + sn.label + '"? Your current version is saved as a snapshot first.')) { pushSnapshot(S, 'Before restoring'); const keep = S.settings; S = migrate(sn.data); S.settings = keep; save(true); closeModal(); renderAll(); toast('Restored.'); } return; }
      if (t.closest('#selftest')) return selfTest();
      if (t.closest('#startchrome')) return startChromeAI(false);
      if (t.closest('#loadsaved')) { savedModelFile().then(f => f ? loadLocalModel(f, (AI.local.saved || {}).name) : toast('Saved model not found — pick the file again.')).then(() => renderSetupTab('ai')); return; }
      if (t.closest('#forgetmodel')) { if (confirm('Remove the AI model from this browser?')) forgetModel().then(() => renderSetupTab('ai')); return; }
      if (t.closest('#aitest')) { const out = $('#aitestout'); out.textContent = '…'; const a = B.answer("Won't a moratorium hurt the economy?", IDX); const p = B.llmPrompt('crossfire', { q: a.query, cards: a.cards.slice(0, 3).map(c => B.compress(B.stripHtml(c.doc.item.html || ''), 70)) }, S.side, S.topic); generate(p, txt => { out.textContent = txt; }).catch(err => { out.textContent = 'Error: ' + err.message; }); return; }
      if (t.closest('#pasteimport')) return showPasteImport();
      if (t.closest('#snapnow')) { pushSnapshot(S, 'Manual snapshot') ? toast('Snapshot saved') : toast('Not enough space for snapshots — use Save a copy'); renderSetupTab('share'); return; }
      if (t.closest('#resetall')) { if (confirm('Reset everything back to the original version? (A snapshot of your current version is saved first.)')) { pushSnapshot(S, 'Before reset'); const keep = S.settings; S = freshState(); S.settings = keep; save(true); closeModal(); renderAll(); toast('Back to the original.'); } return; }
    });
    $('#modal').addEventListener('change', e => {
      const t = e.target;
      if (t.id === 'ggufpick') return pickModel(t.files[0]);
      if (t.id === 'importfile') return importFile(t.files[0]);
      if (t.id === 'aipref') { S.settings.aiPref = t.value; save(); if (t.value !== 'off' && t.value !== 'local' && AI.chrome.st === 'available') startChromeAI(true); refreshAIBits(); }
      if (t.id === 'optAiAuto') { S.settings.aiAuto = t.checked; save(); }
      if (t.id === 'optAutoLoad') { S.settings.autoLoadModel = t.checked; save(); }
      if (t.id === 'optGpu') { S.settings.gpu = t.checked; save(); }
      if (t.id === 'opttheme') { S.settings.theme = t.value; save(); applyDisplay(); }
      if (t.id === 'optchanges') { S.settings.showChanges = t.checked; save(); applyDisplay(); }
      if (t.id === 'optcompact') { S.settings.compact = t.checked; save(); applyDisplay(); renderChips(); }
    });
    $('#modal').addEventListener('input', e => { if (e.target.id === 'optfont') { S.settings.font = +e.target.value; $('#fsv').textContent = S.settings.font + 'px'; applyDisplay(); save(); } });

    // keyboard
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'f') && !e.shiftKey) { e.preventDefault(); $('#q').focus(); $('#q').select(); return; }
      if (e.key === 'Escape') {
        if ($('#modal').classList.contains('show')) return closeModal();
        if ($('#bigtimer').classList.contains('show')) return $('#bigtimer').classList.remove('show');
        if (Live.open && !isTyping()) return closeLive();
        $('#fmt').classList.remove('show'); return;
      }
      if (isTyping() || e.ctrlKey || e.metaKey || e.altKey) return;
      if ($('#modal').classList.contains('show')) return;
      const k = e.key.toLowerCase();
      if (k === '/') { e.preventDefault(); $('#q').focus(); }
      else if (k === 'x') { e.preventDefault(); $('#xfbtn').click(); }
      else if (k === 't') { e.preventDefault(); $('#tplay').click(); }
      else if (k === 'e') { e.preventDefault(); go('evidence'); }
      else if (k === '?') { e.preventDefault(); showHelp(); }
      else if (/^[1-9]$/.test(k)) { const s = SD().sections[+k - 1]; if (s) { e.preventDefault(); go(s.id); } }
    });
    window.addEventListener('beforeunload', () => { if (saveTimer) save(true); });
    window.addEventListener('online', () => refreshAIBits());
  }
  const debounceLive = debounce(() => updateLive(), 350);

  function onClick(e) {
    const t = e.target;
    const cite = t.closest('cite[data-ev]'); if (cite && !(t.closest('[contenteditable="true"]') && document.activeElement === t.closest('[contenteditable="true"]'))) { e.preventDefault(); return showEvidence(cite.dataset.ev); }
    if (cite && e.altKey) return showEvidence(cite.dataset.ev);
    const gc = t.closest('[data-gocard]'); if (gc) { goCard(gc.dataset.gocard); return; }
    const gs = t.closest('[data-gosec]'); if (gs) { const id = gs.dataset.gosec; go(id); if (findSec(id) && findSec(id).listen) openLive(id); return; }
    const a = t.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act; const secEl = a.closest('.sec');
    if (act === 'used') { const card = a.closest('.card'); S.round.used[card.dataset.card] = a.checked; card.classList.toggle('used', a.checked); save(); }
    else if (act === 'live') openLive(a.dataset.sec);
    else if (act === 'time') { setTimer(+a.dataset.t, a.dataset.l, true); toast('Timer started: ' + a.dataset.l + ' ' + fmtClock(+a.dataset.t)); }
    else if (act === 'add') addCard(secEl.dataset.sec);
    else if (act === 'collapse') toggleCollapse(secEl.dataset.sec);
    else if (act === 'cardmenu') cardMenu(a);
    else if (act === 'ev') showEvidence(a.dataset.ev);
    else if (act === 'chg') showChange(a.dataset.c);
    else if (act === 'copycite') { const ev = evById(a.dataset.ev); copyText(`${ev.who || ''} — ${ev.cite}. ${ev.url || ''}`); }
    else if (act === 'togglechanges') { S.settings.showChanges = !S.settings.showChanges; save(); applyDisplay(); a.textContent = (S.settings.showChanges ? 'Hide' : 'Show') + ' change highlights'; }
    else if (act === 'newround') newRoundFlow();
    else if (act === 'prep') { const k = a.dataset.k; prepRun[k] = !prepRun[k]; T.last = T.last || performance.now(); }
    else if (act === 'prepreset') { const k = a.dataset.k; prepRun[k] = false; S.round.prep[k] = prepLen; $('#prep-' + k).textContent = fmtClock(prepLen); save(); }
    else if (act === 'addev') { const id = 'E' + (Math.max(0, ...S.evidence.map(x => +String(x.id).replace(/\D/g, '') || 0)) + 1); S.evidence.push({ id, who: '', tag: 'New evidence — what it proves', cite: 'Author, title, publication, date', url: '', text: 'Quote or summary', tags: [] }); save(); renderDoc(); setTimeout(() => { const el = $('#ev-' + id); if (el) el.scrollIntoView({ block: 'center' }); }, 50); }
    else if (act === 'exporthtml') exportHTML();
    else if (act === 'exportjson') { download(`PF-Debate-Hub-data_${stamp()}.json`, JSON.stringify(exportState(), null, 1), 'application/json'); }
  }
  function copyText(t) {
    const done = () => toast('Copied');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => fallbackCopy(t));
    else fallbackCopy(t);
    function fallbackCopy(x) { const ta = document.createElement('textarea'); ta.value = x; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed'); } ta.remove(); }
  }

  /* =========================================================
     BOOT
     ========================================================= */
  function boot() {
    shell(); fmtBar(); wire();
    prepLen = Math.max(S.round.prep.us, S.round.prep.them) > 200 ? 240 : Math.max(S.round.prep.us, S.round.prep.them) > 150 ? 180 : 120;
    renderAll(); setTimer(240, 'Constructive', false);
    setInterval(tick, 200);
    save(true);
    try { const m = JSON.parse(lsGet(LS_MODEL) || 'null'); if (m) AI.local.saved = m; } catch (e) { }
    detectChromeAI();
    if (AI.local.saved && S.settings.autoLoadModel && S.settings.aiPref !== 'off' && document.getElementById('pf-wasm-main')) {
      savedModelFile().then(f => { if (f) loadLocalModel(f, AI.local.saved.name); else AI.local.saved = null; });
    }
    if (pendingShared) maybeAskShared();
    else if (!S.settings.rulesSeen) showRules(true);
    window.PF = { get state() { return S; }, B, IDX: () => IDX, AI, openLive, closeLive, exportHTML, go, goCard, runSearch, save };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
