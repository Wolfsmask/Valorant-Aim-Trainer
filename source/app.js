/* ============================================================
   PF Debate Hub — step-by-step round guide
   Start: pick side + speaking order (locked). Then ONE step at a
   time, in real PF order, each with its own timer.
   Fully offline. Data lives in this browser (localStorage) and can
   be saved into a new copy of this file for your partner.
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
  const wc = s => (String(s || '').trim().match(/\S+/g) || []).length;

  /* =========================================================
     STATE
     ========================================================= */
  const LS = 'pfhub.state.v1', LS_SNAP = 'pfhub.snaps.v1', LS_SEEN = 'pfhub.seenExports', LS_MODEL = 'pfhub.model';
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };

  function newRound() {
    return { active: false, id: uid(), side: null, order: null, step: 0, started: 0, opponent: '',
      notes: { theirCon: '', theirReb: '', theirSum: '', theirFF: '' }, xf: { xf1: [], xf2: [], gxf: [] }, xfDraft: {},
      asked: {}, picks: {}, built: {}, prep: { us: 180, them: 180 } };
  }
  function freshState() {
    return {
      v: 2, docId: uid(), savedAt: 0, seed: SEED.version, topic: SEED.meta.topic,
      sides: clone(SEED.sides), evidence: clone(SEED.evidence), changes: clone(SEED.changes),
      round: newRound(), rounds: [],
      settings: { theme: 'auto', font: 17, showChanges: false, aiPref: 'auto', aiAuto: true, gpu: true, autoLoadModel: true, rulesSeen: false, prepLen: 180 }
    };
  }
  function migrate(st) {
    const f = freshState();
    st.settings = Object.assign({}, f.settings, st.settings || {});
    if (st.v !== 2) { st.v = 2; st.round = newRound(); st.settings.showChanges = false; if ((st.settings.font || 16) < 17) st.settings.font = 17; }
    st.round = Object.assign(newRound(), st.round || {});
    st.round.notes = Object.assign(newRound().notes, st.round.notes || {});
    st.round.xf = Object.assign(newRound().xf, st.round.xf || {});
    ['xfDraft', 'asked', 'picks', 'built'].forEach(k => { st.round[k] = st.round[k] || {}; });
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

  const R = () => S.round;
  const sideKey = () => (R().active && R().side) || editSide;
  const SD = () => S.sides[sideKey()];
  const oppName = () => sideKey() === 'pro' ? 'Con' : 'Pro';
  const findSec = (id, side) => (side ? S.sides[side] : SD()).sections.find(s => s.id === id);
  const evById = id => S.evidence.find(e => e.id === id);

  let saveTimer;
  function save(now) {
    clearTimeout(saveTimer);
    const doSave = () => {
      S.savedAt = Date.now();
      const ok = lsSet(LS, JSON.stringify(S));
      if (!ok && storageOK) { storageOK = false; toast('This browser blocked saving. Use ⚙ → "Save a copy with my edits" before closing.', 6000); }
    };
    if (now) doSave(); else saveTimer = setTimeout(doSave, 400);
  }

  let IDX, idxSide = null;
  function reindex() { idxSide = sideKey(); IDX = new B.Index().build(SD(), S.evidence, idxSide); }
  function idx() { if (!IDX || idxSide !== sideKey()) reindex(); return IDX; }
  const reindexSoon = debounce(reindex, 600);

  /* =========================================================
     ROUND STEPS (real PF order)
     ========================================================= */
  const SPEECH = {
    con: { name: 'Constructive', t: 240, who: 'usually your 1st speaker', sec: 'opening' },
    reb: { name: 'Rebuttal', t: 240, who: 'usually your 2nd speaker', sec: 'rebuttal' },
    sum: { name: 'Summary', t: 180, who: 'usually your 1st speaker', sec: 'summary' },
    ff: { name: 'Final Focus', t: 120, who: 'usually your 2nd speaker', sec: 'closing' }
  };
  function steps(order) {
    const out = [];
    const pair = sp => {
      const us = { k: 'our' + sp, kind: 'our', sp, title: 'Your ' + SPEECH[sp].name, t: SPEECH[sp].t };
      const them = { k: 'their' + sp, kind: 'their', sp, title: 'Their ' + SPEECH[sp].name, t: SPEECH[sp].t };
      if (order === 'first') out.push(us, them); else out.push(them, us);
    };
    pair('con');
    out.push({ k: 'xf1', kind: 'xf', title: 'Crossfire', sub: '1st speakers from each team', t: 180 });
    pair('reb');
    out.push({ k: 'xf2', kind: 'xf', title: 'Crossfire', sub: '2nd speakers from each team', t: 180 });
    pair('sum');
    out.push({ k: 'gxf', kind: 'xf', title: 'Grand Crossfire', sub: 'All four debaters', t: 180 });
    pair('ff');
    return out;
  }
  const NOTE_KEY = { con: 'theirCon', reb: 'theirReb', sum: 'theirSum', ff: 'theirFF' };
  const curSteps = () => steps(R().order);
  const curStep = () => curSteps()[R().step];

  /* =========================================================
     SHELL + VIEWS
     ========================================================= */
  let view = 'home', setupStage = 0, editSide = 'pro';
  function shell() {
    let root = document.getElementById('app');
    if (!root) { root = document.createElement('div'); root.id = 'app'; document.body.prepend(root); }
    root.innerHTML = `<header class="top" id="top"></header><div class="dots" id="dots"></div><main class="main" id="main"></main>
      <div class="fmt" id="fmt"></div>
      <div class="modal" id="modal"><div class="mbox" id="mbox"></div></div>
      <div class="toast" id="toast"></div>
      <div class="cardpop" id="cardpop"></div>`;
  }
  function applyDisplay() {
    const r = document.documentElement;
    r.dataset.side = sideKey() || 'pro';
    if (S.settings.theme === 'auto') delete r.dataset.theme; else r.dataset.theme = S.settings.theme;
    r.style.setProperty('--fs', (S.settings.font || 17) + 'px');
    document.body.classList.toggle('show-changes', !!S.settings.showChanges);
    document.body.dataset.view = view;
  }
  let toastT;
  function toast(msg, ms) { const t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms || 2600); }

  function render() {
    if (view === 'round' && !R().active) view = 'home';
    applyDisplay();
    $('#fmt').classList.remove('show');
    renderTop();
    const m = $('#main');
    if (view === 'home') m.innerHTML = homeHTML();
    else if (view === 'setup') m.innerHTML = setupHTML();
    else if (view === 'round') { m.innerHTML = roundHTML(); afterRoundRender(); }
    else if (view === 'edit') { m.innerHTML = editHTML(); if (searchQ) runSearch(searchQ); }
    else if (view === 'done') m.innerHTML = doneHTML();
    window.scrollTo(0, 0);
  }
  function go(v) { view = v; if (v !== 'edit') searchQ = ''; render(); }

  /* ---------- top bar ---------- */
  function renderTop() {
    const top = $('#top'); const dots = $('#dots');
    dots.innerHTML = ''; dots.hidden = true;
    if (view === 'round') {
      const st = curSteps(); const i = R().step;
      top.innerHTML = `<div class="lock" title="Side and speaking order are locked for this round">🔒 <b>${R().side.toUpperCase()}</b> · speaking ${R().order === 'first' ? '1st' : '2nd'}</div>
        <div class="toptitle">Step ${i + 1} of ${st.length}</div>
        <button class="pill-btn" id="prepbtn" title="Prep time">⏱ Prep <span id="prepmini">${fmtClock(R().prep.us)}</span></button>
        <button class="iconbtn" id="roundmenu" aria-label="Menu" title="Menu">⋯</button>`;
      dots.hidden = false;
      dots.innerHTML = st.map((s, k) => `<button class="dot ${k < i ? 'done' : k === i ? 'cur' : ''} ${s.kind}" data-jump="${k}" title="${k + 1}. ${esc(s.title)}" aria-label="Step ${k + 1}: ${esc(s.title)}"></button>`).join('');
    } else if (view === 'edit') {
      top.innerHTML = `<button class="iconbtn back" data-go="home" aria-label="Back to home">←</button>
        <div class="seg" id="editSeg"><button data-eside="pro" class="${editSide === 'pro' ? 'on' : ''}">PRO case</button><button data-eside="con" class="${editSide === 'con' ? 'on' : ''}">CON case</button></div>
        <div class="search"><span class="mag">🔍</span><input id="q" type="search" placeholder="Find any word…" autocomplete="off" spellcheck="false" value="${esc(searchQ)}"><div class="count" id="qcount"></div></div>`;
    } else {
      top.innerHTML = `${view === 'home' ? '' : '<button class="iconbtn back" data-go="home" aria-label="Back to home">←</button>'}<div class="brand"><span class="logo">PF</span>Debate Hub</div><span class="sp"></span><button class="iconbtn" id="setupbtn" aria-label="Settings" title="Settings & sharing">⚙</button>`;
    }
  }

  /* ---------- home ---------- */
  function conHasContent() { const c = S.sides.con; return c.sections.some(s => (s.items || []).some(i => !/Your Con response here/.test(i.html || ''))); }
  function homeHTML() {
    const r = R();
    const cont = r.active ? `<button class="big pri" data-act="continue">▶ Continue round<small>${r.side.toUpperCase()} · speaking ${r.order === 'first' ? '1st' : '2nd'} · Step ${r.step + 1}: ${esc(curSteps()[r.step].title)}</small></button>` : '';
    return `<div class="home">
      <div class="hero"><h1>PF Debate Hub</h1><p>${esc(SEED.meta.topic)}</p></div>
      ${cont}
      <button class="big ${r.active ? '' : 'pri'}" data-act="startsetup">${r.active ? '↻ Start a new round' : '▶ Start a round'}<small>Pick your side and speaking order, then go step by step</small></button>
      <div class="homegrid">
        <button class="tile" data-act="edit" data-side="pro"><span>✎</span><b>Review / edit PRO case</b><small>Your speeches, rebuttals &amp; answers</small></button>
        <button class="tile" data-act="edit" data-side="con"><span>✎</span><b>Review / edit CON case</b><small>${conHasContent() ? 'Your Con case' : 'Not added yet — paste it in'}</small></button>
        <button class="tile" data-act="evidence"><span>📚</span><b>Evidence</b><small>Sources to show if they ask</small></button>
        <button class="tile" data-act="factcheck"><span>✅</span><b>What Claude fixed</b><small>${S.changes.length} changes to your doc, and why</small></button>
      </div>
      <p class="homefoot">Works with no internet · edits save automatically on this device · <button class="linkbtn" id="setupbtn2">⚙ Settings, sharing &amp; offline AI</button></p>
    </div>`;
  }

  /* ---------- setup (one question at a time) ---------- */
  let pending = { side: null, order: null, opponent: '' };
  function setupHTML() {
    const n = setupStage;
    const prog = `<div class="qprog">${[0, 1, 2].map(k => `<i class="${k <= n ? 'on' : ''}"></i>`).join('')}</div>`;
    if (n === 0) return `<div class="ask">${prog}<h1>Which side are you on?</h1>
      <div class="choices"><button class="choice pro" data-pick-side="pro"><b>PRO</b><small>For the moratorium</small></button>
      <button class="choice con" data-pick-side="con"><b>CON</b><small>Against the moratorium</small>${conHasContent() ? '' : '<em>Con case not added yet — notes &amp; timers still work</em>'}</button></div></div>`;
    if (n === 1) return `<div class="ask">${prog}<h1>Do you speak first or second?</h1>
      <div class="choices"><button class="choice" data-pick-order="first"><b>First</b><small>You give the first Constructive</small></button>
      <button class="choice" data-pick-order="second"><b>Second</b><small>They speak first — you take notes, then answer</small></button></div>
      <button class="linkbtn" data-setup-back>← Back</button></div>`;
    const list = steps(pending.order);
    return `<div class="ask">${prog}<h1>Ready?</h1>
      <div class="confirm"><div class="cbadge ${pending.side}">${pending.side.toUpperCase()}</div><div>speaking <b>${pending.order === 'first' ? 'FIRST' : 'SECOND'}</b></div></div>
      <label class="field">Other team's name (optional)<input id="oppname" value="${esc(pending.opponent)}" placeholder="e.g. East AB" autocomplete="off"></label>
      <ol class="preview">${list.map(s => `<li class="${s.kind}">${esc(s.title)}${s.sub ? ` <small>· ${esc(s.sub)}</small>` : ''} <span>${fmtClock(s.t)}</span></li>`).join('')}</ol>
      <p class="note">🔒 Your side and order are locked until the round ends.</p>
      <button class="big pri" data-act="beginround">Start round ▶</button>
      <button class="linkbtn" data-setup-back>← Back</button></div>`;
  }

  /* =========================================================
     ROUND VIEW — one step at a time
     ========================================================= */
  function roundHTML() {
    const st = curStep(); const all = curSteps(); const i = R().step;
    const next = all[i + 1];
    const kicker = st.kind === 'our' ? `YOUR SPEECH · ${SPEECH[st.sp].who}` : st.kind === 'their' ? `THEIR SPEECH · take notes` : `CROSSFIRE · ${st.sub}`;
    return `<div class="stage ${st.kind}">
      <div class="stephead"><div class="kicker">${kicker}</div><h1>${esc(st.title)}</h1></div>
      <div class="timerbox" id="timerbox"><div class="tbig" id="tbig">${fmtClock(T.left)}</div>
        <div class="tbtns"><button class="tbtn pri" id="tplay">▶ Start</button><button class="tbtn" id="treset" title="Reset timer" aria-label="Reset timer">↺</button></div></div>
      <div class="stepbody" id="stepbody">${stepBody(st)}</div>
    </div>
    <footer class="navbar"><button class="navb" data-nav="-1" ${i === 0 ? 'disabled' : ''}>← Back</button>
      <div class="navlbl">${next ? 'Next: <b>' + esc(next.title) + '</b>' : 'Last step'}</div>
      <button class="navb pri" data-nav="1">${next ? 'Next →' : 'Finish ✓'}</button></footer>`;
  }
  function stepBody(st) {
    if (st.kind === 'our' && st.sp === 'con') return ourConstructive();
    if (st.kind === 'our' && st.sp === 'reb') return ourRebuttal();
    if (st.kind === 'our') return ourBuilt(st.sp);
    if (st.kind === 'their') return theirNotes(st);
    if (st.kind === 'xf') return crossfire(st);
    return '';
  }
  function afterRoundRender() {
    const st = curStep();
    if (st.kind === 'their') updateHelps();
    if (st.kind === 'xf') updateXF();
    if (st.kind === 'our' && (st.sp === 'sum' || st.sp === 'ff') && !(R().built[st.sp] && R().built[st.sp].edited)) build(st.sp, true);
    drawTimer();
  }

  /* ---------- our constructive ---------- */
  function ourConstructive() {
    const sec = findSec('opening');
    return `<p class="hint">Read it out loud at a steady pace. Tap any text to fix it — changes save automatically.</p>
      <article class="speech rt" contenteditable="true" data-bind="opening||html">${sec ? sec.html : ''}</article>`;
  }

  /* ---------- their speeches: notes + what to say back ---------- */
  function theirNotes(st) {
    const key = NOTE_KEY[st.sp];
    const ph = {
      con: 'Type what they say — one point per line. Shorthand is fine.\nC1 economy - AI = 1% of GDP (Epoch)\nC2 China wins the AI race\nC3 grid is flexible (Duke)',
      reb: 'Type each attack on your case — one per line.\ne.g. PPAs protect ratepayers\nthe AI hacks were just tests',
      sum: 'Type what they extend or weigh — one point per line.',
      ff: 'Optional — type what they say. Nothing to answer after this speech.'
    }[st.sp];
    return `<label class="lbl" for="notes">What they're saying</label>
      <textarea id="notes" class="notes" data-note="${key}" placeholder="${esc(ph)}">${esc(R().notes[key] || '')}</textarea>
      <div id="helps"></div>`;
  }
  function updateHelps() {
    const st = curStep(); if (!st || st.kind !== 'their') return;
    const box = $('#helps'); if (!box) return;
    const v = R().notes[NOTE_KEY[st.sp]] || '';
    if (st.sp === 'ff') { box.innerHTML = `<div class="calm">🏁 Last speech of the round — nothing left to answer. Just listen.</div>`; return; }
    if (wc(v) < 2) { box.innerHTML = `<div class="calm">As you type, your best answers show up right here.</div>`; return; }
    if (st.sp === 'con') {
      const sum = B.summarizeCase(v, idx());
      if (!sum.blocks.length) { box.innerHTML = `<div class="calm">Keep typing — no clear arguments yet.</div>`; return; }
      box.innerHTML = `<div class="lh">Their arguments → your answers</div>` + sum.blocks.map(b => {
        const reb = b.rebuttals[0]; const ask = b.ask[0];
        return `<div class="arg"><div class="argh"><span class="n">C${b.n}</span>${esc(b.label)}</div><q>${esc(b.key)}</q>
          ${reb ? `<div class="ans"><div class="ansl">Answer in your rebuttal</div>${cardSnippet(reb.doc)}</div>` : `<div class="ans"><div class="ansl">No prepared card</div><p>${esc(genAnswer(b.text))}</p></div>`}
          ${ask ? `<div class="ans q"><div class="ansl">Ask them in crossfire</div><p>${B.stripHtml(ask.doc.item.q)}</p></div>` : ''}</div>`;
      }).join('');
      return;
    }
    const lines = v.split(/\n+/).map(s => s.trim()).filter(s => wc(s) >= 2);
    box.innerHTML = `<div class="lh">${st.sp === 'reb' ? 'Their attacks → how to defend' : 'Their points → your answers'}</div>` + lines.slice(-10).reverse().map(line => {
      const r = idx().search(line, { types: ['counter', 'rebuttal', 'qa'], limit: 2, boost: { counter: 1.15 } }).results.filter(x => x.score > 0.4);
      return `<div class="arg"><q>${esc(line)}</q>${r[0] ? `<div class="ans">${cardSnippet(r[0].doc)}</div>` : `<div class="ans"><div class="ansl">No prepared card</div><p>${esc(genAnswer(line))}</p></div>`}</div>`;
    }).join('');
  }
  function genAnswer(text) { const a = B.answer(text, idx()); return a ? ((a.opener ? a.opener + ' ' : '') + a.body) : ''; }
  function cardSnippet(d, full) {
    const it = d.item;
    const head = d.type === 'qa' || d.type === 'askq' ? it.q : it.trigger;
    const short = it.short ? `<span class="short">${esc(it.short)}</span>` : '';
    const body = full ? (it.html || '') : esc(B.compress(B.stripHtml(it.html || ''), 55));
    return `<div class="snip"><div class="snh">${esc(B.stripHtml(head || ''))}</div>${short}<div class="snb">${body}</div>${(it.ev || []).length ? `<div class="evs">${it.ev.slice(0, 3).map(evChip).join('')}</div>` : ''}</div>`;
  }
  function evChip(id) {
    const e = evById(id); if (!e) return '';
    return `<button class="evchip" data-ev="${id}" title="${esc(e.tag)}">📎 ${esc((e.who || e.cite).split(/[(,;]/)[0].trim().slice(0, 30))}</button>`;
  }

  /* ---------- our rebuttal ---------- */
  function ourRebuttal() {
    const theirCon = R().notes.theirCon || '';
    const theirReb = R().notes.theirReb || '';
    let html = '';
    if (wc(theirCon) >= 2) {
      const sum = B.summarizeCase(theirCon, idx());
      html += `<div class="lh">Answer their case, point by point</div>` + (sum.blocks.length ? sum.blocks.map(b => {
        const opts = b.rebuttals; const key = 'reb' + b.n;
        const pick = Math.min(R().picks[key] || 0, Math.max(0, opts.length - 1));
        const d = opts[pick] && opts[pick].doc;
        return `<div class="arg big"><div class="argh"><span class="n">C${b.n}</span>${esc(b.label)}</div><q>${esc(b.key)}</q>
          ${d ? `<div class="ans">${cardSnippet(d, true)}</div>${opts.length > 1 ? `<button class="linkbtn" data-nextpick="${key}" data-max="${opts.length}">↻ Show a different card (${pick + 1}/${opts.length})</button>` : ''}`
            : `<div class="ans"><div class="ansl">No prepared card</div><p>${esc(genAnswer(b.text))}</p></div>`}
          ${b.weigh ? `<div class="weigh">⚖ ${esc(b.weigh)}</div>` : ''}</div>`;
      }).join('') : `<div class="calm">Couldn't find clear arguments in your notes. Use the full list below.</div>`);
    } else {
      html += `<div class="calm">You didn't type notes on their constructive, so here are all your rebuttal cards. Tap one to open it.</div>`;
    }
    if (R().order === 'second' && wc(theirReb) >= 2) {
      const lines = theirReb.split(/\n+/).map(s => s.trim()).filter(s => wc(s) >= 2);
      html += `<div class="lh">Then defend your case against their rebuttal</div>` + lines.map(line => {
        const r = idx().search(line, { types: ['counter', 'rebuttal', 'qa'], limit: 1, boost: { counter: 1.2 } }).results.filter(x => x.score > 0.4);
        return `<div class="arg"><q>${esc(line)}</q><div class="ans">${r[0] ? cardSnippet(r[0].doc) : `<p>${esc(genAnswer(line))}</p>`}</div></div>`;
      }).join('');
    }
    html += allCardsList('rebuttal', wc(theirCon) >= 2);
    return html;
  }
  function allCardsList(secId, collapsed) {
    const sec = findSec(secId); if (!sec) return '';
    return `<details class="allcards" ${collapsed ? '' : 'open'}><summary>All ${esc(sec.title.toLowerCase())} cards (${(sec.items || []).length})</summary>
      <input class="filter" data-filter="${secId}" placeholder="Filter… (e.g. water, jobs, China)">
      <div class="clist">${(sec.items || []).map(it => `<details class="ci" data-ci="${it.id}"><summary>${esc(B.stripHtml(it.trigger || it.q || ''))}</summary><div class="cib">${it.short ? `<span class="short">${esc(it.short)}</span>` : ''}${it.html || ''}${(it.ev || []).length ? `<div class="evs">${it.ev.map(evChip).join('')}</div>` : ''}</div></details>`).join('')}</div></details>`;
  }

  /* ---------- our summary / final focus (auto-built) ---------- */
  function roundLog() {
    const n = R().notes; const out = [];
    if (n.theirCon) out.push({ section: 'opening', text: n.theirCon });
    if (n.theirReb) out.push({ section: 'rebuttal', text: n.theirReb });
    if (n.theirSum) out.push({ section: 'summary', text: n.theirSum });
    for (const k of ['xf1', 'xf2', 'gxf']) for (const x of R().xf[k] || []) out.push({ section: 'crossfire', text: x.q });
    return out;
  }
  function ourBuilt(sp) {
    const b = R().built[sp];
    return `<p class="hint">${sp === 'sum' ? 'Built from your notes on what they said. Edit anything, then read it.' : 'Your ending, plus final answers to what they pushed hardest. Edit anything, then read it.'}</p>
      <div class="builtbar"><span class="timeest" id="timeest"></span><span class="sp"></span>
        <button class="btn sm" data-act="rebuild" data-sp="${sp}">↻ Rebuild from my notes</button>${AI.ready() ? `<button class="btn sm" data-act="polish" data-sp="${sp}">✨ Smooth with AI</button>` : ''}</div>
      <article class="speech rt" contenteditable="true" id="builtspeech" data-built="${sp}">${b ? b.html : ''}</article>
      <div id="polishout"></div>
      <details class="allcards"><summary>Your saved ${sp === 'sum' ? 'Summary template' : 'Ending Statement'}</summary><div class="speech small">${(findSec(SPEECH[sp].sec) || {}).html || ''}</div></details>`;
  }
  function build(sp, quiet) {
    const log = roundLog();
    let html;
    if (sp === 'ff') html = B.buildFinalFocus((findSec('closing') || {}).html || '', log, idx()).html;
    else html = log.length ? B.buildSummary(log, SD(), idx()).html : ((findSec('summary') || {}).html || '');
    R().built[sp] = { html, at: Date.now() }; save();
    const el = $('#builtspeech'); if (el) el.innerHTML = html;
    updateTimeEst();
    if (!quiet) toast('Rebuilt from your notes');
  }
  function updateTimeEst() { const el = $('#builtspeech'), t = $('#timeest'); if (!el || !t) return; const w = wc(el.innerText); t.textContent = `~${w} words ≈ ${fmtClock(Math.round(w / 2.6))} at speaking pace`; }

  /* ---------- crossfire ---------- */
  let showAllQs = false, lastAns = null, aiAbort = null;
  function crossfire(st) {
    const draft = R().xfDraft[st.k] || '';
    return `<div class="xfgrid">
      <section class="xfask"><label class="lbl" for="xfq">They ask → type their question</label>
        <textarea id="xfq" class="xfq" rows="2" placeholder="e.g. wont a moratorium kill jobs   (Enter = next question)">${esc(draft)}</textarea>
        <div id="xfans"></div><div id="xfhist"></div></section>
      <section class="xfours"><div class="lh">Your questions to ask them</div><div id="ourqs">${ourQuestions()}</div></section>
    </div>`;
  }
  function ourQuestions() {
    const sec = findSec('crossfire'); const items = (sec && sec.items) || [];
    if (!items.length) return `<div class="calm">No crossfire questions saved for this side yet.</div>`;
    const notes = [R().notes.theirCon, R().notes.theirReb, R().notes.theirSum].filter(Boolean).join('\n');
    let order = items.map(i => i.id);
    if (wc(notes) >= 3) {
      const ranked = idx().search(notes, { types: ['askq'], limit: items.length }).results.map(r => r.doc.id);
      order = ranked.concat(order.filter(id => !ranked.includes(id)));
    }
    const show = showAllQs ? order : order.slice(0, 5);
    return show.map(id => {
      const it = items.find(x => x.id === id); if (!it) return ''; const asked = !!R().asked[id];
      return `<div class="qcard ${asked ? 'asked' : ''}"><div class="qt"><b>${esc(it.label || '')}:</b> ${B.stripHtml(it.q || '')}</div>${it.follow ? `<div class="qf">If they dodge: ${esc(it.follow)}</div>` : ''}<button class="btn sm" data-ask="${id}">${asked ? '✓ Asked' : 'Mark asked'}</button></div>`;
    }).join('') + (order.length > 5 ? `<button class="linkbtn" data-act="allqs">${showAllQs ? 'Show fewer' : `Show all ${order.length} questions`}</button>` : '');
  }
  function updateXF() {
    const st = curStep(); if (!st || st.kind !== 'xf') return;
    const ta = $('#xfq'); const box = $('#xfans'); if (!ta || !box) return;
    const q = ta.value.trim();
    if (q.length < 3) { box.innerHTML = `<div class="calm">Start typing their question — the best answer appears instantly. Shorthand works: "wont china win", "jobs?", "tmi nuclear".</div>`; renderXFHist(); return; }
    const a = B.answer(q, idx()); if (!a) return;
    renderHUD(a); renderXFHist(); scheduleAI(a);
  }
  function renderHUD(a) {
    lastAns = a;
    const box = $('#xfans'); if (!box) return;
    const modeTxt = a.alt ? '↔ Other card' : { prefire: '✓ Prepared answer', adapted: '≈ Closest prepared answer', generated: '⚡ New answer (no prepared card)' }[a.mode];
    const alts = a.cards.filter(c => !a.card || c.doc.id !== a.card.doc.id).slice(0, 3);
    box.innerHTML = `<div class="hud ${a.mode}"><span class="mode ${a.mode}">${modeTxt}</span>
      ${a.opener ? `<div class="op">${esc(a.opener)}</div>` : ''}
      <div class="bd">${esc(a.body)}</div>
      ${a.bridge ? `<div class="br">${esc(a.bridge)}</div>` : ''}
      ${a.turn ? `<div class="tn">${esc(a.turn)}</div>` : ''}
      ${(a.evidence || []).length ? `<div class="evs">${a.evidence.map(e => evChip(e.id)).join('')}</div>` : ''}
      <div id="aiout"></div>
      ${alts.length ? `<div class="altrow"><span>Not it?</span>${alts.map(c => `<button class="lnk" data-alt="${c.doc.id}">${esc(c.doc.head.slice(0, 60))}</button>`).join('')}</div>` : ''}</div>`;
    renderAIBox();
  }
  function showAlt(id) {
    const d = idx().docs.find(x => x.id === id); if (!d || !lastAns) return;
    const it = d.item;
    renderHUD(Object.assign({}, lastAns, { mode: 'adapted', alt: true, opener: it.short || '', body: B.stripHtml(it.html || ''), bridge: '', turn: it.turn || it.follow || '',
      card: { doc: d, score: 1 }, evidence: (it.ev || []).map(evById).filter(Boolean).slice(0, 2), cards: [{ doc: d, score: 1 }].concat(lastAns.cards.filter(c => c.doc.id !== d.id)) }));
  }
  function renderXFHist() {
    const st = curStep(); const h = (R().xf[st.k] || []); const el = $('#xfhist'); if (!el) return;
    el.innerHTML = h.length ? `<div class="lh">Asked so far</div>` + h.slice().reverse().map((x, i) => `<div class="hist" data-hist="${h.length - 1 - i}"><b>${esc(x.q)}</b><span>${esc((x.a || '').slice(0, 120))}</span></div>`).join('') : '';
  }
  function nextQuestion() {
    const st = curStep(); const ta = $('#xfq'); const q = ta.value.trim(); if (!q) return;
    const a = lastAns; const aiTxt = ($('#aiout .aitext') || {}).textContent || '';
    (R().xf[st.k] = R().xf[st.k] || []).push({ q, a: aiTxt.length > 5 ? aiTxt : ((a && a.opener ? a.opener + ' ' : '') + (a ? a.body : '')), t: Date.now() });
    ta.value = ''; R().xfDraft[st.k] = ''; save();
    updateXF(); ta.focus();
  }

  /* =========================================================
     TIMERS (speech + prep)
     ========================================================= */
  const T = { total: 240, left: 240, running: false, beeped: false };
  let prepRun = { us: false, them: false }, lastTick = performance.now();
  function setTimer(sec) { T.total = sec; T.left = sec; T.running = false; T.beeped = false; drawTimer(); }
  function drawTimer() {
    const el = $('#tbig'); if (!el) return;
    const s = T.left; el.textContent = fmtClock(s);
    $('#timerbox').className = 'timerbox ' + (s < 0 ? 'over' : s <= 10 ? 'crit' : s <= 30 ? 'warn' : '') + (T.running ? ' running' : '');
    const b = $('#tplay'); if (b) b.textContent = T.running ? '❚❚ Pause' : (T.left !== T.total ? '▶ Resume' : '▶ Start');
  }
  function beep(times) {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < (times || 1); i++) {
        const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
        const t0 = ac.currentTime + i * 0.35; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
        o.start(t0); o.stop(t0 + 0.3);
      }
      if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
    } catch (e) { }
  }
  let prepSaveAt = 0;
  function tick() {
    const now = performance.now(); const dt = Math.min(2, (now - lastTick) / 1000); lastTick = now;
    if (T.running) {
      const before = T.left; T.left -= dt;
      if (before > 30 && T.left <= 30) beep(1);
      if (before > 0 && T.left <= 0 && !T.beeped) { T.beeped = true; beep(3); }
      drawTimer();
    }
    let changed = false;
    for (const k of ['us', 'them']) if (prepRun[k]) {
      R().prep[k] = Math.max(0, R().prep[k] - dt); changed = true;
      if (R().prep[k] <= 0) { prepRun[k] = false; beep(2); }
    }
    if (changed) {
      const m = $('#prepmini'); if (m) m.textContent = fmtClock(R().prep.us);
      for (const k of ['us', 'them']) { const el = $('#prep-' + k); if (el) el.textContent = fmtClock(R().prep[k]); }
      if (now - prepSaveAt > 5000) { prepSaveAt = now; save(); }
    }
    const pb = $('#prepbtn'); if (pb) pb.classList.toggle('on', prepRun.us || prepRun.them);
  }
  function showPrep() {
    modal(`<div class="mh"><h2>Prep time</h2><button class="iconbtn" data-close aria-label="Close">✕</button></div><div class="mb">
      <div class="prepgrid">${['us', 'them'].map(k => `<div class="pt"><div class="ptl">${k === 'us' ? 'Our prep' : 'Their prep'}</div><div class="clock" id="prep-${k}">${fmtClock(R().prep[k])}</div><div class="row"><button class="btn pri" data-prep="${k}">${prepRun[k] ? '❚❚ Pause' : '▶ Start'}</button><button class="btn" data-prepreset="${k}" aria-label="Reset">↺</button></div></div>`).join('')}</div>
      <p class="note">Prep keeps counting if you close this.</p>
      <label class="field">Prep time per team<select id="preplen">${[120, 180, 240].map(v => `<option value="${v}" ${S.settings.prepLen === v ? 'selected' : ''}>${fmtClock(v)}</option>`).join('')}</select></label></div>`);
  }

  /* =========================================================
     EDIT MODE (review / edit your case like a doc)
     ========================================================= */
  const labelFor = type => ({ rebuttal: `When ${oppName()} says`, counter: 'They attacked our case with', qa: `${oppName()} might ask`, askq: 'We ask' })[type] || '';
  function editHTML() {
    const secs = SD().sections;
    return `<div class="doc">
      <nav class="toc"><b>${editSide.toUpperCase()} case · jump to:</b> ${secs.map(s => `<button class="linkbtn" data-toc="${s.id}">${s.icon} ${esc(s.title)}</button>`).join('')}<button class="linkbtn" data-toc="evidence">📚 Evidence</button><button class="linkbtn" data-toc="factcheck">✅ What Claude fixed</button></nav>
      ${editSide === 'con' && !conHasContent() ? `<div class="notice info">Your CON case isn't added yet. <button class="btn sm" id="pasteimport">📋 Paste your Con doc</button></div>` : ''}
      ${secs.map(secHTML).join('')}${evidenceHTML()}${factcheckHTML()}</div>`;
  }
  function secHTML(sec) {
    const inner = sec.kind === 'doc'
      ? `<div class="rt docbody" contenteditable="true" data-bind="${sec.id}||html">${sec.html || ''}</div>`
      : `${sec.intro ? `<p class="intro">${esc(sec.intro)}</p>` : ''}<div class="cards">${(sec.items || []).map(it => cardHTML(sec, it)).join('') || '<p class="calm">No cards yet.</p>'}</div>`;
    return `<section class="sec" id="sec-${sec.id}" data-sec="${sec.id}"><div class="sech"><span class="ic">${sec.icon}</span><h2>${esc(sec.title)}</h2><span class="pf">${esc(sec.pf || '')}</span><span class="sp"></span>${sec.kind === 'cards' ? `<button class="btn sm" data-act="add">＋ Add card</button>` : ''}</div><div class="secb">${inner}</div></section>`;
  }
  function cardHTML(sec, it) {
    const b = f => `data-bind="${sec.id}|${it.id}|${f}"`;
    const tags = it.changed ? `<button class="tag fix" data-chg="${it.changed}" title="Claude corrected something here — tap to see why">fixed</button>` : it.isNew ? '<span class="tag new" title="Added by Claude">new</span>' : '';
    const lab = `<div class="clab">${labelFor(sec.cardType)}</div>`;
    let head = '', body = '';
    if (sec.cardType === 'rebuttal' || sec.cardType === 'counter') {
      head = `${lab}<div class="ctrig rt" contenteditable="true" ${b('trigger')}>${it.trigger || ''}</div>`;
      body = `${it.short !== undefined ? `<div><span class="short rt" contenteditable="true" ${b('short')} title="Say this first">${esc(it.short || '')}</span></div>` : ''}<div class="rt" contenteditable="true" ${b('html')}>${it.html || ''}</div>${it.turn !== undefined ? `<div class="turn"><b>↩ Ask back:</b> <span class="rt" contenteditable="true" ${b('turn')}>${esc(it.turn || '')}</span></div>` : ''}`;
    } else if (sec.cardType === 'qa') {
      head = `${lab}<div class="ctrig rt" contenteditable="true" ${b('q')}>${esc(it.q || '')}</div>`;
      body = `<div><span class="short rt" contenteditable="true" ${b('short')} title="Say this first">${esc(it.short || '')}</span></div>
        <div class="rt" contenteditable="true" ${b('html')}>${it.html || ''}</div>
        <div class="turn"><b>↩ Ask back:</b> <span class="rt" contenteditable="true" ${b('turn')}>${esc(it.turn || '')}</span></div>
        <div class="alts"><b>Also matches:</b> <span class="rt" contenteditable="true" ${b('alts')} title="Other ways they might ask it — separate with ;">${esc((it.alts || []).join('; '))}</span></div>`;
    } else if (sec.cardType === 'askq') {
      head = `${lab}<div class="ctrig"><span class="lab rt" contenteditable="true" ${b('label')}>${esc(it.label || 'Question')}</span>: <span class="rt" contenteditable="true" ${b('q')}>${it.q || ''}</span></div>`;
      body = `<div class="turn"><b>🎯 Goal:</b> <span class="rt" contenteditable="true" ${b('goal')}>${esc(it.goal || '')}</span></div>
        <div class="turn"><b>↪ If they dodge:</b> <span class="rt" contenteditable="true" ${b('follow')}>${esc(it.follow || '')}</span></div>`;
    }
    const foot = (it.ev || []).length ? `<div class="evs">${it.ev.map(evChip).join('')}</div>` : '';
    return `<article class="card" id="card-${it.id}" data-card="${it.id}" data-sec="${sec.id}"><div class="ch"><div class="chm">${head}</div><div class="cmeta">${tags}<button class="iconbtn" data-act="cardmenu" aria-label="Card options">⋯</button></div></div><div class="cb">${body}${foot}</div></article>`;
  }
  function evidenceHTML() {
    return `<section class="sec" id="sec-evidence" data-sec="evidence"><div class="sech"><span class="ic">📚</span><h2>Evidence</h2><span class="pf">Show this if the other team asks to see a card</span><span class="sp"></span><button class="btn sm" data-act="addev">＋ Add</button></div>
      <div class="secb">${S.evidence.map(e => `<div class="ev" id="ev-${e.id}">
        <div><span class="eid">${e.id}</span><span class="etag rt" contenteditable="true" data-bind="@ev|${e.id}|tag">${esc(e.tag)}</span></div>
        <div class="ecite"><b>Who/when:</b> <span class="rt" contenteditable="true" data-bind="@ev|${e.id}|who">${esc(e.who || '')}</span></div>
        <div class="ecite"><b>Full cite:</b> <span class="rt" contenteditable="true" data-bind="@ev|${e.id}|cite">${esc(e.cite)}</span></div>
        <div class="etext rt" contenteditable="true" data-bind="@ev|${e.id}|text">${esc(e.text)}</div>
        <div class="eurl">🔗 <span class="rt" contenteditable="true" data-bind="@ev|${e.id}|url">${esc(e.url || '')}</span></div></div>`).join('')}</div></section>`;
  }
  function factcheckHTML() {
    return `<section class="sec" id="sec-factcheck" data-sec="factcheck"><div class="sech"><span class="ic">✅</span><h2>What Claude fixed</h2><span class="pf">Changes to your original doc, and why</span><span class="sp"></span><button class="btn sm" data-act="togglechanges">${S.settings.showChanges ? 'Hide' : 'Show'} changes in the text</button></div>
      <div class="secb">${S.changes.map(c => `<div class="chg" id="chg-${c.id}"><div class="w">${esc(c.where)}</div><div class="o">${esc(c.original)}</div><div class="nw">${esc(c.now)}</div><div class="y"><b>Why:</b> ${esc(c.why)}</div>${(c.ev || []).length ? `<div class="evs">${c.ev.map(evChip).join('')}</div>` : ''}</div>`).join('')}</div></section>`;
  }

  /* ---------- editing ---------- */
  function cleanHtml(html) {
    const t = document.createElement('template'); t.innerHTML = html;
    t.content.querySelectorAll('mark.hit').forEach(m => m.replaceWith(...m.childNodes));
    return t.innerHTML.replace(/​/g, '');
  }
  function onBindInput(el) {
    const [secId, itemId, field] = el.dataset.bind.split('|');
    if (secId === '@ev') { const e = evById(itemId); if (e) { e[field] = el.innerText.trim(); save(); reindexSoon(); } return; }
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
        : Object.assign(base, { trigger: 'What they say…', short: '', html: 'Your response…', turn: '' });
    sec.items = sec.items || []; sec.items.unshift(it);
    save(); reindex(); const y = scrollY; render(); scrollTo(0, y);
    const el = $(`#card-${id}`); if (el) { el.scrollIntoView({ block: 'center' }); const rt = $('.ctrig.rt, .ctrig .rt', el); if (rt) rt.focus(); }
  }
  function cardMenu(btn) {
    const card = btn.closest('.card'); const secId = card.dataset.sec, id = card.dataset.card;
    const sec = findSec(secId); const i = sec.items.findIndex(x => x.id === id);
    const seedSec = (SEED.sides[editSide].sections.find(s => s.id === secId) || {});
    const orig = (seedSec.items || []).find(x => x.id === id);
    const pop = $('#cardpop');
    pop.innerHTML = `<button data-m="up" ${i === 0 ? 'disabled' : ''}>↑ Move up</button><button data-m="down" ${i === sec.items.length - 1 ? 'disabled' : ''}>↓ Move down</button><button data-m="dup">⧉ Duplicate</button>${orig ? '<button data-m="reset">↺ Reset to original</button>' : ''}<button data-m="del" class="danger">🗑 Delete</button>`;
    const r = btn.getBoundingClientRect();
    pop.style.cssText = `display:flex;top:${Math.min(r.bottom + 4, innerHeight - 230)}px;left:${Math.max(8, r.right - 190)}px`;
    pop.onclick = e => {
      const m = e.target.closest('button'); if (!m || m.disabled) return;
      const act = m.dataset.m; pop.style.display = 'none';
      if (act === 'up' && i > 0) [sec.items[i - 1], sec.items[i]] = [sec.items[i], sec.items[i - 1]];
      else if (act === 'down' && i < sec.items.length - 1) [sec.items[i + 1], sec.items[i]] = [sec.items[i], sec.items[i + 1]];
      else if (act === 'dup') { const c = clone(sec.items[i]); c.id = id[0] + uid(); c.isNew = false; c.changed = null; sec.items.splice(i + 1, 0, c); }
      else if (act === 'reset' && orig) sec.items[i] = clone(orig);
      else if (act === 'del') { if (!confirm('Delete this card?')) return; sec.items.splice(i, 1); }
      const y = scrollY; save(); reindex(); render(); scrollTo(0, y);
    };
  }
  document.addEventListener('pointerdown', e => { const p = $('#cardpop'); if (p && p.style.display !== 'none' && !e.target.closest('#cardpop') && !e.target.closest('[data-act="cardmenu"]')) p.style.display = 'none'; });

  function fmtBar() {
    $('#fmt').innerHTML = `<button data-f="bold" title="Bold"><b>B</b></button><button data-f="italic" title="Italic"><i>I</i></button><button data-f="underline" title="Underline"><u>U</u></button><button data-f="hl" title="Highlight">🖍</button><span class="div"></span><button data-f="h3" title="Heading">H</button><button data-f="p" title="Normal text">¶</button><button data-f="ul" title="Bullets">•</button><span class="div"></span><button data-f="clear" title="Clear formatting">✕</button>`;
    $('#fmt').addEventListener('mousedown', e => e.preventDefault());
    $('#fmt').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const f = b.dataset.f; const ex = (c, v) => document.execCommand(c, false, v);
      if (f === 'bold' || f === 'italic' || f === 'underline') ex(f);
      else if (f === 'hl') { const s = getSelection(); if (s.rangeCount && !s.isCollapsed) ex('insertHTML', `<mark class="hl">${esc(s.toString())}</mark>`); }
      else if (f === 'h3' || f === 'p') ex('formatBlock', f.toUpperCase());
      else if (f === 'ul') ex('insertUnorderedList');
      else if (f === 'clear') ex('removeFormat');
      const el = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-bind],[data-built]');
      if (el) el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  function placeFmt() {
    const fmt = $('#fmt'); const sel = getSelection();
    const host = sel.rangeCount && sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    const ed = host && host.closest && host.closest('[contenteditable="true"]');
    if (!ed || sel.isCollapsed) { fmt.classList.remove('show'); return; }
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (!r.width && !r.height) { fmt.classList.remove('show'); return; }
    fmt.classList.add('show'); const w = fmt.offsetWidth;
    fmt.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    fmt.style.top = Math.max(64, r.top - 46) + 'px';
  }

  /* ---------- search (edit mode) ---------- */
  let searchQ = '', hits = [], hitI = -1;
  const hasHL = !!(window.CSS && CSS.highlights && window.Highlight);
  function textNodes(root) {
    const out = []; if (!root) return out;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.nodeValue.trim() && !n.parentElement.closest('button,select,input,.tag,.clab') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    let n; while ((n = w.nextNode())) out.push(n); return out;
  }
  function runSearch(q) {
    searchQ = q;
    if (hasHL) { CSS.highlights.delete('pf-search'); CSS.highlights.delete('pf-search-cur'); } else { $$('mark.hit').forEach(m => m.replaceWith(...m.childNodes)); }
    hits = []; hitI = -1;
    if (q.length >= 2) {
      const needle = q.toLowerCase();
      for (const n of textNodes($('.doc'))) { const v = n.nodeValue.toLowerCase(); let i = v.indexOf(needle); while (i >= 0) { hits.push({ node: n, start: i, end: i + needle.length }); i = v.indexOf(needle, i + needle.length); } }
      if (hasHL) CSS.highlights.set('pf-search', new Highlight(...hits.map(h => { const r = new Range(); r.setStart(h.node, h.start); r.setEnd(h.node, h.end); h.range = r; return r; })));
      else for (let k = hits.length - 1; k >= 0; k--) { const h = hits[k]; const r = document.createRange(); r.setStart(h.node, h.start); r.setEnd(h.node, h.end); const m = document.createElement('mark'); m.className = 'hit'; r.surroundContents(m); h.el = m; }
    }
    updateCount();
  }
  function updateCount() {
    const c = $('#qcount'); if (!c) return;
    if (searchQ.length < 2) { c.innerHTML = ''; return; }
    c.innerHTML = `<span>${hits.length ? Math.max(hitI + 1, 0) + '/' + hits.length : 'none'}</span><button data-hn="-1" aria-label="Previous match">▲</button><button data-hn="1" aria-label="Next match">▼</button>`;
  }
  function stepHit(d) {
    if (!hits.length) return;
    hitI = (hitI + d + hits.length) % hits.length; const h = hits[hitI];
    if (hasHL && h.range) { CSS.highlights.set('pf-search-cur', new Highlight(h.range)); const r = h.range.getBoundingClientRect(); window.scrollBy({ top: r.top - innerHeight / 2.5, behavior: 'smooth' }); }
    else if (h.el) { $$('mark.hit.cur').forEach(m => m.classList.remove('cur')); h.el.classList.add('cur'); h.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    updateCount();
  }

  /* =========================================================
     OFFLINE AI (optional): Chrome built-in AI or a local model file
     ========================================================= */
  const AI = {
    chrome: { st: 'checking', base: null, progress: 0 },
    local: { st: 'none', w: null, name: '', tps: 0, err: '', progress: 0, saved: null },
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
    refreshAI();
  }
  async function startChromeAI(silent) {
    try {
      AI.chrome.st = AI.chrome.st === 'available' ? 'starting' : 'downloading'; refreshAI();
      AI.chrome.base = await LanguageModel.create(Object.assign({}, LM_OPTS, {
        initialPrompts: [{ role: 'system', content: 'You help a high-school Public Forum debate team. Be brief, confident and accurate. Use only facts you are given.' }],
        monitor(m) { m.addEventListener('downloadprogress', e => { AI.chrome.progress = e.loaded; refreshAI(); }); }
      }));
      AI.chrome.st = 'ready'; if (!silent) toast('Chrome built-in AI is ready (works offline).');
    } catch (e) { AI.chrome.st = 'unavailable'; if (!silent) toast('Chrome AI could not start: ' + (e.message || e)); }
    refreshAI();
  }
  async function b64gzToBlob(id, type) {
    const el = document.getElementById(id); if (!el) throw new Error('The AI engine is not included in this copy');
    if (!('DecompressionStream' in window)) throw new Error('This browser is too old for the local AI model');
    const bin = Uint8Array.from(atob(el.textContent.trim()), c => c.charCodeAt(0));
    const ab = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    return new Blob([ab], { type });
  }
  let libLoaded = null, wasmURL = null, compatURLs = null;
  function ensureLib() {
    if (window.WllamaLib) return Promise.resolve();
    if (libLoaded) return libLoaded;
    libLoaded = (async () => {
      const blob = await b64gzToBlob('pf-wllama', 'text/javascript');
      const s = document.createElement('script'); s.textContent = await blob.text(); document.head.appendChild(s);
      if (!window.WllamaLib) throw new Error('AI engine failed to start');
    })().catch(e => { libLoaded = null; throw e; });
    return libLoaded;
  }
  const quietLogger = { debug() { }, log() { }, warn() { }, error(...a) { console.error(...a); } };
  async function makeWllama() {
    await ensureLib();
    if (!wasmURL) wasmURL = URL.createObjectURL(await b64gzToBlob('pf-wasm-main', 'application/wasm'));
    const w = new WllamaLib.Wllama({ default: wasmURL }, { suppressNativeLog: true, logger: quietLogger });
    const jspi = typeof WebAssembly.Suspending === 'function';
    const firefox = /firefox/i.test(navigator.userAgent);
    if (!jspi && !firefox && document.getElementById('pf-wasm-compat')) {
      if (!compatURLs) compatURLs = { wasm: URL.createObjectURL(await b64gzToBlob('pf-wasm-compat', 'application/wasm')), worker: URL.createObjectURL(await b64gzToBlob('pf-compat-js', 'text/javascript')) };
      w.setCompat({ worker: compatURLs.worker, wasm: compatURLs.wasm });
    } else w.setCompat(null);
    return w;
  }
  async function loadLocalModel(blob, name) {
    if (AI.local.st === 'loading' && AI.local.w) return;
    AI.local.st = 'loading'; AI.local.err = ''; AI.local.name = name || blob.name || 'model.gguf'; refreshAI();
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
      AI.local.w = w; AI.local.st = 'ready'; refreshAI();
      const t0 = performance.now();
      const r = await w.createChatCompletion({ messages: [{ role: 'user', content: 'Say: ready' }], max_tokens: 8, temperature: 0 });
      AI.local.tps = ((r.usage && r.usage.completion_tokens) || 4) / ((performance.now() - t0) / 1000);
      toast(`Offline AI ready (${AI.local.tps.toFixed(1)} words/sec).`);
    } catch (e) {
      AI.local.st = 'error'; AI.local.err = (e && e.message) || String(e);
      toast('AI model failed to load: ' + AI.local.err, 6000);
    }
    refreshAI();
  }
  async function opfsDir() { if (!navigator.storage || !navigator.storage.getDirectory) return null; try { return await navigator.storage.getDirectory(); } catch (e) { return null; } }
  async function savedModelFile() { const d = await opfsDir(); if (!d) return null; try { const f = await (await d.getFileHandle('pf-model.gguf')).getFile(); return f.size > 1000 ? f : null; } catch (e) { return null; } }
  async function saveModelToBrowser(src, name, onProg) {
    const d = await opfsDir(); if (!d) throw new Error('This browser can\'t store the model — you\'ll pick the file each time.');
    const fh = await d.getFileHandle('pf-model.gguf', { create: true });
    if (!fh.createWritable) throw new Error('This browser can\'t store the model — you\'ll pick the file each time.');
    const w = await fh.createWritable(); const total = src.size || 0; let done = 0;
    const reader = (src.body || src.stream()).getReader();
    try { for (; ;) { const { done: d2, value } = await reader.read(); if (d2) break; await w.write(value); done += value.length; onProg && onProg(done, total); } await w.close(); }
    catch (e) { try { await w.abort(); } catch (x) { } throw e; }
    try { navigator.storage.persist && navigator.storage.persist(); } catch (e) { }
    AI.local.saved = { name, size: done, at: Date.now() }; lsSet(LS_MODEL, JSON.stringify(AI.local.saved));
    return fh.getFile();
  }
  async function forgetModel() {
    const d = await opfsDir(); if (d) { try { await d.removeEntry('pf-model.gguf'); } catch (e) { } }
    lsSet(LS_MODEL, 'null'); AI.local.saved = null;
    if (AI.local.w) { try { await AI.local.w.exit(); } catch (e) { } }
    AI.local.w = null; AI.local.st = 'none'; refreshAI();
  }
  async function generate(p, onText, signal) {
    const eng = AI.ready(); if (!eng) throw new Error('No AI loaded');
    let acc = '';
    if (eng === 'chrome') {
      const s = await AI.chrome.base.clone({ signal });
      try {
        for await (const chunk of s.promptStreaming(p.sys + '\n\n' + p.user, { signal })) { if (acc && chunk.startsWith(acc)) acc = chunk; else acc += chunk; onText(acc); }
      } finally { try { s.destroy(); } catch (e) { } }
      return acc;
    }
    const stream = await AI.local.w.createChatCompletion({ messages: [{ role: 'system', content: p.sys }, { role: 'user', content: p.user }], max_tokens: p.max || 160, temperature: 0.4, top_p: 0.9, stream: true, abortSignal: signal });
    for await (const chunk of stream) { const d = chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content; if (d) { acc += d; onText(acc); } }
    return acc;
  }
  const scheduleAI = debounce(a => { if (AI.ready() && S.settings.aiAuto && view === 'round' && curStep().kind === 'xf' && lastAns === a) runAI(a); }, 900);
  function renderAIBox() { const box = $('#aiout'); if (!box) return; box.innerHTML = AI.ready() ? `<button class="linkbtn" id="aiGo">✨ Reword with offline AI</button>` : ''; }
  async function runAI(a) {
    if (!a || !AI.ready()) return;
    if (aiAbort) aiAbort.abort();
    const ctl = new AbortController(); aiAbort = ctl;
    const box = $('#aiout'); if (!box) return;
    box.innerHTML = `<div class="ai"><div class="aih">🧠 AI wording <button class="linkbtn" id="aiStop">stop</button></div><div class="aitext">…</div></div>`;
    const cards = a.cards.slice(0, 3).map(c => B.compress(B.stripHtml((c.doc.item.short ? c.doc.item.short + ' ' : '') + (c.doc.item.html || '')), 70));
    const p = B.llmPrompt('crossfire', { q: a.query, cards }, sideKey(), S.topic);
    try { await generate(p, t => { const el = $('#aiout .aitext'); if (el && !ctl.signal.aborted && aiAbort === ctl) el.textContent = t.trim(); }, ctl.signal); }
    catch (e) { if (!ctl.signal.aborted) { const el = $('#aiout .aitext'); if (el) el.textContent = 'AI error: ' + (e.message || e); } }
  }
  async function polishBuilt(sp) {
    const el = $('#builtspeech'); if (!el || !AI.ready()) return;
    const out = $('#polishout');
    out.innerHTML = `<div class="ai"><div class="aih">🧠 Smoothed version — check every fact!</div><div class="speech small aitext" contenteditable="true">…</div><button class="btn sm" id="polishUse">Use this version</button></div>`;
    const text = el.innerText;
    const p = B.llmPrompt('polish', { speech: sp === 'sum' ? 'Summary speech' : 'Final Focus', seconds: Math.round(wc(text) / 2.6), text }, sideKey(), S.topic);
    try { await generate(p, t => { const x = $('#polishout .aitext'); if (x) x.textContent = t.trim(); }); }
    catch (e) { const x = $('#polishout .aitext'); if (x) x.textContent = 'AI error: ' + (e.message || e); }
  }
  function refreshAI() { if ($('#aitab')) renderSetupTab('ai'); }

  /* =========================================================
     MODALS
     ========================================================= */
  function modal(html, wide) { $('#mbox').innerHTML = html; $('#mbox').classList.toggle('wide', !!wide); $('#modal').classList.add('show'); }
  function closeModal() { $('#modal').classList.remove('show'); }
  function showEvidence(id) {
    const e = evById(id); if (!e) return;
    modal(`<div class="mh"><h2>${esc(e.tag)}</h2><button class="iconbtn" data-close aria-label="Close">✕</button></div>
      <div class="mb"><p class="who">${esc(e.who || '')}</p><p class="cite">${esc(e.cite)}</p><p>${esc(e.text)}</p>${e.url ? `<p class="url">🔗 ${esc(e.url)}<br><small>(link needs internet)</small></p>` : ''}</div>
      <div class="mf"><button class="btn" data-copycite="${e.id}">Copy citation</button><button class="btn pri" data-close>Done</button></div>`);
  }
  function showChange(id) {
    const c = S.changes.find(x => x.id === id); if (!c) return;
    modal(`<div class="mh"><h2>What Claude changed here</h2><button class="iconbtn" data-close aria-label="Close">✕</button></div>
      <div class="mb"><div class="chg"><div class="w">${esc(c.where)}</div><div class="o">${esc(c.original)}</div><div class="nw">${esc(c.now)}</div><div class="y"><b>Why:</b> ${esc(c.why)}</div></div></div>
      <div class="mf"><button class="btn pri" data-close>Got it</button></div>`);
  }
  function showRules() {
    modal(`<div class="mh"><h2>Welcome! 👋</h2></div><div class="mb">
      <p><b>How it works:</b> tap <b>Start a round</b>, pick your side and whether you speak first or second. Then the app walks you through the round <b>one step at a time</b> — each step has its own timer.</p>
      <div class="notice warn"><b>Check your tournament's rules</b> before using the auto-generated answers in a real round — some leagues count AI help during a round as outside assistance. Ask your coach. Using this as your case file and timer is normally fine.</div>
      <p class="note">Everything works without internet. Your edits save on this device automatically.</p></div>
      <div class="mf"><button class="btn pri" data-close data-rulesok>Got it</button></div>`);
  }
  function roundMenu() {
    modal(`<div class="mh"><h2>Round menu</h2><button class="iconbtn" data-close aria-label="Close">✕</button></div><div class="mb menu">
      <button class="big" data-act="gohome">🏠 Home<small>The round stays saved — come back any time</small></button>
      <button class="big" data-act="settings">⚙ Settings &amp; offline AI</button>
      <button class="big danger" data-act="endround">⏹ End this round<small>Unlocks side and order</small></button></div>`);
  }

  /* ---------- settings ---------- */
  let setupTab = 'start';
  function showSettings(tab) {
    setupTab = tab || setupTab;
    modal(`<div class="mh"><h2>⚙ Settings</h2><button class="iconbtn" data-close aria-label="Close">✕</button></div>
      <div class="tabs">${[['start', 'Before the tournament'], ['share', 'Share & backup'], ['ai', 'Offline AI'], ['display', 'Display']].map(([k, l]) => `<button data-tab="${k}" class="${setupTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="mb" id="setupbody"></div><div class="mf"><button class="btn pri" data-close>Done</button></div>`, true);
    renderSetupTab(setupTab);
  }
  function pill(st) {
    const m = { ready: ['ok', 'Ready'], available: ['mid', 'Available'], downloadable: ['mid', 'Can download'], downloading: ['mid', 'Downloading…'], starting: ['mid', 'Starting…'], unavailable: ['off', 'Not on this device'], checking: ['off', 'Checking…'], none: ['off', 'No model loaded'], loading: ['mid', 'Loading…'], error: ['no', 'Error'] }[st] || ['off', st];
    return `<span class="pill ${m[0]}">${m[1]}</span>`;
  }
  const MODELS = [
    { n: 'Qwen2.5 1.5B (recommended)', size: '1.1 GB', url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf', note: 'Best answers on most laptops' },
    { n: 'Qwen2.5 0.5B (fast)', size: '0.5 GB', url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf', note: 'For older laptops / Chromebooks' }
  ];
  function renderSetupTab(tab) {
    setupTab = tab; $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const body = $('#setupbody'); if (!body) return;
    if (tab === 'start') {
      body.innerHTML = `<ol class="checklist">
        <li><b>Save this file to your laptop</b> (Desktop or Documents) and open it in <b>Chrome or Edge</b>.${storageOK ? '' : ' <span class="pill no">This browser is blocking saving — use "Save a copy" often</span>'}</li>
        <li><b>Send your partner a copy</b> with your edits inside: <button class="btn sm" data-act="exporthtml">⬇ Save a copy with my edits</button></li>
        <li><b>Optional:</b> download the offline AI model (Offline AI tab) — the app already works without it.</li>
        <li><b>Test with Wi-Fi off:</b> start a practice round and type a question in Crossfire. <button class="btn sm" id="selftest">Run self-test</button><div id="selftestout" class="note"></div></li></ol>`;
    } else if (tab === 'share') {
      const snaps = snapshots();
      body.innerHTML = `<div class="st"><b>Save a copy with my edits</b><p>Downloads a new .html file with your whole case and edits inside. Send it to your partner (AirDrop, email, Drive, USB) — they just open it.</p><button class="btn pri" data-act="exporthtml">⬇ Save a copy (.html)</button></div>
        <div class="st"><b>Open a copy</b><p>Load a copy your partner sent (.html) or a backup (.json).</p><label class="btn" style="cursor:pointer">📂 Choose file<input type="file" id="importfile" accept=".json,.html,.htm" hidden></label> <button class="btn" data-act="exportjson">⬇ Backup (.json)</button></div>
        <div class="st"><b>Paste a doc (e.g. your CON case)</b><p>Copy your Google Doc and paste it — lines like <i>When Pro says "…"</i> and <i>Opponent asks: "…" Your Answer: "…"</i> become cards automatically.</p><button class="btn" id="pasteimport">📋 Paste a doc…</button></div>
        <div class="st"><b>Backups</b><p>Saved automatically before big changes.</p><button class="btn sm" id="snapnow">Save a backup now</button>
          ${snaps.map(s => `<div class="snap"><span>${esc(s.label)} · ${fmtTime(s.at)}</span><button class="btn sm" data-restore="${s.id}">Restore</button></div>`).join('')}</div>
        <div class="st"><b>Start over</b><p>Go back to the version Claude made (your current version is backed up first).</p><button class="btn sm danger" id="resetall">Reset everything</button></div>`;
    } else if (tab === 'ai') {
      const cs = AI.chrome.st, ls = AI.local.st;
      body.innerHTML = `<div id="aitab"></div><div class="notice info">The crossfire helper already works instantly with no download. An AI model is <b>optional</b> — it rewords answers more smoothly. After a one-time download it runs <b>on your laptop with no internet</b>.</div>
        <div class="st"><b>Offline AI model</b> ${pill(ls)}<p>${AI.local.name ? 'Model: ' + esc(AI.local.name) + (AI.local.tps ? ` · ${AI.local.tps.toFixed(1)} words/sec` : '') : 'Download one (needs internet once):'}${AI.local.err ? `<br><span class="bad">${esc(AI.local.err)}</span>` : ''}</p>
          <div class="prog" id="mprog" ${AI.local.progress ? '' : 'hidden'}><i style="width:${Math.round(AI.local.progress * 100)}%"></i></div>
          ${MODELS.map((m, i) => `<div class="mrow"><button class="btn sm" data-dlmodel="${i}">⬇ ${esc(m.n)} · ${m.size}</button><small>${esc(m.note)}</small></div>`).join('')}
          <div class="mrow"><label class="btn sm" style="cursor:pointer">📂 I already have a .gguf file<input type="file" id="ggufpick" accept=".gguf" hidden></label>${AI.local.saved && ls !== 'ready' ? '<button class="btn sm pri" id="loadsaved">▶ Load saved model</button>' : ''}${AI.local.saved || ls === 'ready' ? '<button class="btn sm" id="forgetmodel">🗑 Remove</button>' : ''}</div>
          <label class="check"><input type="checkbox" id="optAutoLoad" ${S.settings.autoLoadModel ? 'checked' : ''}> Load it automatically when the app opens</label>
          <label class="check"><input type="checkbox" id="optGpu" ${S.settings.gpu ? 'checked' : ''}> Use the graphics card if possible (faster)</label>
          <label class="check"><input type="checkbox" id="optAiAuto" ${S.settings.aiAuto ? 'checked' : ''}> Reword crossfire answers automatically</label>
          <p class="note">If a download button fails, download the file in your browser and use "I already have a .gguf file": ${MODELS.map(m => `<a href="${m.url}" target="_blank" rel="noopener">${esc(m.n.split(' (')[0])}</a>`).join(' · ')}</p>
          ${AI.ready() ? '<button class="btn sm" id="aitest">Test the AI</button><div id="aitestout" class="note"></div>' : ''}</div>
        <div class="st"><b>Chrome built-in AI</b> ${pill(cs)}<p>${cs === 'unavailable' ? 'Not available on this device — that\'s normal. Use the model above.' : 'Some newer computers have a built-in offline AI in Chrome.'}</p>${cs === 'downloadable' || cs === 'available' ? `<button class="btn sm" id="startchrome">${cs === 'downloadable' ? '⬇ Download & start' : '▶ Start'}</button>` : ''}</div>`;
    } else if (tab === 'display') {
      body.innerHTML = `<label class="field">Theme<select id="opttheme">${[['auto', 'Match my device'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<option value="${v}" ${S.settings.theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field">Text size: <b id="fsv">${S.settings.font}px</b><input type="range" id="optfont" min="14" max="24" value="${S.settings.font}"></label>
        <label class="check"><input type="checkbox" id="optchanges" ${S.settings.showChanges ? 'checked' : ''}> Show what Claude changed in the text (orange = fixed, green = new)</label>
        <button class="btn sm" onclick="window.print()">🖨 Print / save as PDF</button>`;
    }
  }
  async function downloadModel(i) {
    const m = MODELS[i];
    if (!navigator.onLine) { toast('You need internet for this one-time download.'); return; }
    AI.local.st = 'loading'; AI.local.progress = 0.001; AI.local.err = ''; renderSetupTab('ai');
    try {
      const res = await fetch(m.url); if (!res.ok) throw new Error('Download failed (' + res.status + ')');
      const total = +res.headers.get('content-length') || 0; const name = m.url.split('/').pop();
      let file;
      try { file = await saveModelToBrowser({ body: res.body, size: total }, name, (d, t) => { AI.local.progress = t ? d / t : 0.5; const bar = $('#mprog i'); if (bar) bar.style.width = Math.round(AI.local.progress * 100) + '%'; }); }
      catch (e) { toast(e.message, 5000); const r2 = await fetch(m.url); file = new File([await r2.blob()], name); const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click(); }
      AI.local.progress = 0; AI.local.st = 'none';
      await loadLocalModel(file, name);
    } catch (e) { AI.local.st = 'error'; AI.local.err = (e.message || e) + ' — try the manual link below.'; AI.local.progress = 0; }
    renderSetupTab('ai');
  }
  async function pickModel(file) {
    if (!file) return;
    AI.local.progress = 0.001; renderSetupTab('ai');
    let f = file;
    try { f = await saveModelToBrowser({ stream: () => file.stream(), size: file.size }, file.name, (d, t) => { AI.local.progress = d / t; const bar = $('#mprog i'); if (bar) bar.style.width = Math.round(AI.local.progress * 100) + '%'; }); }
    catch (e) { toast('Using the file directly: ' + e.message, 5000); f = file; }
    AI.local.progress = 0;
    await loadLocalModel(f, file.name); renderSetupTab('ai');
  }
  function selfTest() {
    const out = [];
    try { const a = B.answer("won't a moratorium kill jobs", idx()); out.push(a && a.card ? '✅ Crossfire helper answers instantly' : '❌ Crossfire helper'); } catch (e) { out.push('❌ Crossfire helper: ' + e.message); }
    try { const s = B.summarizeCase('C1 economy jobs GDP\nC2 China wins AI race', idx()); out.push(s.blocks.length ? '✅ Note analyzer works' : '⚠️ Note analyzer found nothing'); } catch (e) { out.push('❌ Note analyzer: ' + e.message); }
    out.push(storageOK ? '✅ Saving works' : '⚠️ Saving is blocked in this browser — use "Save a copy"');
    out.push(navigator.onLine ? 'ℹ️ You\'re online — turn Wi-Fi off and run again to be sure' : '✅ You\'re offline and everything works');
    $('#selftestout').innerHTML = out.map(esc).join('<br>');
  }
  function showPasteImport() {
    modal(`<div class="mh"><h2>Paste a doc</h2><button class="iconbtn" data-close aria-label="Close">✕</button></div>
      <div class="mb"><label class="field">Add it to<select id="pasteside"><option value="con" ${editSide === 'con' ? 'selected' : ''}>CON case</option><option value="pro" ${editSide === 'pro' ? 'selected' : ''}>PRO case</option></select></label>
      <textarea class="big" id="pastebox" placeholder="Paste everything from your Google Doc here"></textarea><div id="pasteprev" class="note"></div></div>
      <div class="mf"><button class="btn" data-close>Cancel</button><button class="btn pri" id="pastego">Add it</button></div>`);
  }
  function doPasteImport() {
    const side = $('#pasteside').value;
    const p = B.parsePastedDoc($('#pastebox').value);
    pushSnapshot(S, 'Before paste import');
    const sd = S.sides[side]; const g = id => sd.sections.find(s => s.id === id);
    const para = arr => arr.map(l => `<p>${esc(l)}</p>`).join('');
    const placeholder = /^<h2>[^<]*<\/h2><p><i>[\s\S]*<\/i><\/p>$/;
    for (const k of ['opening', 'summary', 'closing']) if (p[k].length && g(k)) { const s = g(k); s.html = (placeholder.test((s.html || '').trim()) ? `<h2>${esc(s.title)}</h2>` : s.html) + para(p[k]); }
    if (g('rebuttal')) { if (p.rebuttal.length) g('rebuttal').items = g('rebuttal').items.filter(i => i.id !== 'cr1'); g('rebuttal').items.push(...p.rebuttal.map(x => ({ id: 'r' + uid(), trigger: esc(x.trigger), html: esc(x.html), tags: [], ev: [], isUser: true }))); }
    if (g('counter')) g('counter').items.push(...p.counter.map(x => ({ id: 'k' + uid(), trigger: esc(x.trigger), html: esc(x.html), tags: [], ev: [], isUser: true })));
    if (g('crossfire')) g('crossfire').items.push(...p.crossfire.map(x => ({ id: 'q' + uid(), label: x.label, q: esc(x.q), goal: '', follow: '', tags: [], ev: [], isUser: true })));
    if (g('predictions')) g('predictions').items.push(...p.predictions.map(x => ({ id: 'p' + uid(), q: x.q, alts: [], short: '', html: esc(x.html), turn: '', tags: [], ev: [], isUser: true })));
    save(true); closeModal(); editSide = side; IDX = null; go('edit'); toast('Added! Check each section.');
  }

  /* ---------- export / import ---------- */
  function exportState() { const o = clone(S); o.exportId = uid(); o.exportedAt = Date.now(); o.savedAt = Date.now(); o.round = newRound(); return o; }
  function download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  function stamp() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`; }
  function exportHTML() {
    const json = JSON.stringify(exportState()).replace(/</g, '\\u003c');
    const parts = ['<!doctype html>', '<html lang="en">', '<head>', '<meta charset="utf-8">', '<meta name="viewport" content="width=device-width, initial-scale=1">', `<title>${esc(document.title)}</title>`, `<style id="pf-style">${$('#pf-style').textContent}</style>`, '</head>', '<body>', '<div id="app"></div>'];
    for (const sc of $$('script[data-keep]')) parts.push(sc.id === 'pf-data' ? `<script id="pf-data" type="application/json" data-keep>${json}<\/script>` : sc.outerHTML);
    parts.push('</body>', '</html>');
    download(`PF-Debate-Hub_${stamp()}.html`, parts.join('\n'), 'text/html');
    toast('Saved! Send that file to your partner.');
  }
  function importFile(file) {
    const rd = new FileReader();
    rd.onload = () => {
      let data = null; const txt = String(rd.result);
      try { if (/^\s*\{/.test(txt)) data = JSON.parse(txt); else { const m = txt.match(/<script id="pf-data"[^>]*>([\s\S]*?)<\/script>/); if (m && m[1].trim() !== 'null') data = JSON.parse(m[1]); } } catch (e) { data = null; }
      if (!data || !data.sides) { toast('That file has no PF Debate Hub data in it.'); return; }
      if (!confirm('Replace what\'s here with the copy saved ' + fmtTime(data.savedAt) + '? (Your current version is backed up first.)')) return;
      pushSnapshot(S, 'Before opening ' + file.name);
      const keep = S.settings; const r = S.round; S = migrate(data); S.settings = Object.assign(S.settings, { theme: keep.theme, font: keep.font }); if (r.active) S.round = r;
      IDX = null; save(true); closeModal(); go('home'); toast('Opened ' + file.name);
    };
    rd.readAsText(file);
  }
  function maybeAskShared() {
    const sh = pendingShared; if (!sh) return;
    modal(`<div class="mh"><h2>This file has a shared copy inside</h2></div><div class="mb"><p>The file you opened was saved <b>${fmtTime(sh.savedAt)}</b> (maybe by your partner). This device also has your own version from <b>${fmtTime(S.savedAt)}</b>.</p><p>Which do you want? The other one is kept as a backup.</p></div>
      <div class="mf"><button class="btn" id="keepmine">Keep mine</button><button class="btn pri" id="useshared">Use the shared copy</button></div>`);
    const mark = () => { let seen = []; try { seen = JSON.parse(lsGet(LS_SEEN) || '[]'); } catch (e) { } seen.push(sh.exportId); lsSet(LS_SEEN, JSON.stringify(seen.slice(-50))); pendingShared = null; };
    $('#keepmine').onclick = () => { pushSnapshot(sh, 'Shared copy from ' + fmtTime(sh.savedAt)); mark(); closeModal(); };
    $('#useshared').onclick = () => { pushSnapshot(S, 'My version before shared copy'); const keep = S.settings; const r = S.round; S = migrate(sh); S.settings = Object.assign(S.settings, { theme: keep.theme, font: keep.font }); if (r.active) S.round = r; mark(); IDX = null; save(true); closeModal(); render(); toast('Using the shared copy.'); };
  }

  /* =========================================================
     ROUND FLOW
     ========================================================= */
  function beginRound() {
    archiveRound();
    const r = newRound();
    r.active = true; r.side = pending.side; r.order = pending.order; r.opponent = (($('#oppname') || {}).value || '').trim();
    r.started = Date.now(); r.prep = { us: S.settings.prepLen, them: S.settings.prepLen };
    S.round = r; prepRun = { us: false, them: false }; IDX = null; save(true);
    view = 'round'; setTimer(curStep().t); render();
  }
  function archiveRound() {
    const r = R();
    if (r.active && (Object.values(r.notes).some(v => v && v.trim()) || Object.values(r.xf).some(a => a.length))) {
      S.rounds.unshift({ id: r.id, started: r.started, side: r.side, order: r.order, opponent: r.opponent, notes: r.notes, xf: r.xf });
      S.rounds = S.rounds.slice(0, 8);
    }
  }
  function goStep(i) {
    const n = curSteps().length;
    if (i >= n) { finishRound(); return; }
    R().step = Math.max(0, i); save();
    if (aiAbort) aiAbort.abort();
    lastAns = null; setTimer(curStep().t); showAllQs = false; render();
  }
  let lastRound = null;
  function finishRound() { archiveRound(); lastRound = clone(R()); S.round = newRound(); prepRun = { us: false, them: false }; save(true); view = 'done'; render(); }
  function doneHTML() {
    const r = lastRound || {};
    return `<div class="ask"><h1>Round done 🎉</h1><p class="note">${r.side ? r.side.toUpperCase() + ' · spoke ' + (r.order === 'first' ? '1st' : '2nd') : ''}${r.opponent ? ' · vs ' + esc(r.opponent) : ''}</p>
      <button class="big pri" data-act="startsetup">▶ Start another round</button><button class="big" data-go="home">🏠 Home</button>
      <p class="note">Your notes from this round are saved on this device.</p></div>`;
  }
  function endRound() { if (!confirm('End this round? Side and order will unlock.')) return; archiveRound(); S.round = newRound(); prepRun = { us: false, them: false }; save(true); closeModal(); go('home'); }

  /* =========================================================
     EVENTS
     ========================================================= */
  const notesInput = debounce(() => updateHelps(), 250);
  const runSearchSoon = debounce(q => runSearch(q), 150);
  function toggleTimer() { T.running = !T.running; drawTimer(); }
  function wire() {
    document.addEventListener('click', onClick);
    document.addEventListener('input', e => {
      const t = e.target;
      const b = t.closest && t.closest('[data-bind]'); if (b) { onBindInput(b); return; }
      if (t.id === 'notes') { R().notes[t.dataset.note] = t.value; save(); notesInput(); return; }
      if (t.id === 'xfq') { R().xfDraft[curStep().k] = t.value; save(); updateXF(); return; }
      if (t.id === 'builtspeech') { R().built[t.dataset.built] = { html: t.innerHTML, at: Date.now(), edited: true }; save(); updateTimeEst(); return; }
      if (t.id === 'q') { runSearchSoon(t.value.trim()); return; }
      if (t.dataset && t.dataset.filter) { const v = t.value.toLowerCase(); $$('.clist .ci', t.closest('.allcards')).forEach(ci => { ci.hidden = !!v && !ci.textContent.toLowerCase().includes(v); }); return; }
      if (t.id === 'optfont') { S.settings.font = +t.value; $('#fsv').textContent = S.settings.font + 'px'; applyDisplay(); save(); return; }
      if (t.id === 'pastebox') { const p = B.parsePastedDoc(t.value); $('#pasteprev').textContent = `Found: ${p.rebuttal.length} rebuttals · ${p.counter.length} counter-rebuttals · ${p.crossfire.length} crossfire questions · ${p.predictions.length} predicted questions · ${p.opening.length + p.summary.length + p.closing.length} speech paragraphs`; }
    });
    document.addEventListener('change', e => {
      const t = e.target;
      if (t.id === 'ggufpick') return pickModel(t.files[0]);
      if (t.id === 'importfile') return importFile(t.files[0]);
      if (t.id === 'optAiAuto') { S.settings.aiAuto = t.checked; save(); }
      if (t.id === 'optAutoLoad') { S.settings.autoLoadModel = t.checked; save(); }
      if (t.id === 'optGpu') { S.settings.gpu = t.checked; save(); }
      if (t.id === 'opttheme') { S.settings.theme = t.value; save(); applyDisplay(); }
      if (t.id === 'optchanges') { S.settings.showChanges = t.checked; save(); applyDisplay(); }
      if (t.id === 'preplen') { S.settings.prepLen = +t.value; for (const k of ['us', 'them']) if (!prepRun[k]) R().prep[k] = S.settings.prepLen; save(); showPrep(); }
    });
    document.addEventListener('paste', e => {
      const ed = e.target.closest && e.target.closest('[contenteditable="true"]'); if (!ed) return;
      e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
    });
    document.addEventListener('keydown', e => {
      const t = e.target;
      if (t.id === 'xfq' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); nextQuestion(); return; }
      if (t.id === 'q') { if (e.key === 'Enter') { e.preventDefault(); stepHit(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') { t.value = ''; runSearch(''); } return; }
      const ed = t.closest && t.closest('[data-bind]');
      if (ed && e.key === 'Enter' && !ed.classList.contains('docbody') && /\|(trigger|q|short|turn|label|goal|follow|tag|who|cite|url)$/.test(ed.dataset.bind)) { e.preventDefault(); ed.blur(); return; }
      if (e.key === 'Escape') { if ($('#modal').classList.contains('show') && !$('[data-rulesok]')) closeModal(); $('#fmt').classList.remove('show'); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && view === 'edit') { e.preventDefault(); const q = $('#q'); if (q) { q.focus(); q.select(); } return; }
      if (isTyping() || e.ctrlKey || e.metaKey || e.altKey || $('#modal').classList.contains('show')) return;
      if (view === 'round' && e.key === ' ') { e.preventDefault(); toggleTimer(); }
    });
    document.addEventListener('selectionchange', debounce(placeFmt, 60));
    window.addEventListener('scroll', debounce(placeFmt, 60), { passive: true });
    window.addEventListener('beforeunload', () => save(true));
  }

  function onClick(e) {
    const t = e.target;
    const cite = t.closest('cite[data-ev]');
    if (cite) { const ed = cite.closest('[contenteditable="true"]'); if (!ed || document.activeElement !== ed) { e.preventDefault(); return showEvidence(cite.dataset.ev); } }
    const ev = t.closest('button[data-ev]'); if (ev) return showEvidence(ev.dataset.ev);
    if (t === $('#modal')) { if (!$('[data-rulesok]')) closeModal(); return; }
    if (t.closest('[data-close]')) { if (t.closest('[data-rulesok]')) { S.settings.rulesSeen = true; save(); } return closeModal(); }
    const g = t.closest('[data-go]'); if (g) { closeModal(); return go(g.dataset.go); }
    const ps = t.closest('[data-pick-side]'); if (ps) { pending.side = ps.dataset.pickSide; setupStage = 1; return render(); }
    const po = t.closest('[data-pick-order]'); if (po) { pending.order = po.dataset.pickOrder; setupStage = 2; return render(); }
    if (t.closest('[data-setup-back]')) { const o = $('#oppname'); if (o) pending.opponent = o.value; setupStage = Math.max(0, setupStage - 1); return render(); }
    const nav = t.closest('[data-nav]'); if (nav) return goStep(R().step + (+nav.dataset.nav));
    const jump = t.closest('[data-jump]'); if (jump) { const k = +jump.dataset.jump; const st = curSteps()[k]; if (k !== R().step && confirm(`Go to step ${k + 1}: ${st.title}?`)) goStep(k); return; }
    if (t.closest('#tplay')) return toggleTimer();
    if (t.closest('#treset')) return setTimer(curStep().t);
    if (t.closest('#prepbtn')) return showPrep();
    const pr = t.closest('[data-prep]'); if (pr) { const k = pr.dataset.prep; prepRun[k] = !prepRun[k]; pr.textContent = prepRun[k] ? '❚❚ Pause' : '▶ Start'; return; }
    const prr = t.closest('[data-prepreset]'); if (prr) { const k = prr.dataset.prepreset; prepRun[k] = false; R().prep[k] = S.settings.prepLen; save(); return showPrep(); }
    if (t.closest('#roundmenu')) return roundMenu();
    if (t.closest('#setupbtn') || t.closest('#setupbtn2')) return showSettings();
    const tab = t.closest('[data-tab]'); if (tab) return renderSetupTab(tab.dataset.tab);
    const alt = t.closest('[data-alt]'); if (alt) return showAlt(alt.dataset.alt);
    const hi = t.closest('[data-hist]'); if (hi) { const x = (R().xf[curStep().k] || [])[+hi.dataset.hist]; if (x) { $('#xfq').value = x.q; updateXF(); } return; }
    const ask = t.closest('[data-ask]'); if (ask) { const id = ask.dataset.ask; R().asked[id] = !R().asked[id]; save(); $('#ourqs').innerHTML = ourQuestions(); return; }
    const np = t.closest('[data-nextpick]'); if (np) { const k = np.dataset.nextpick; R().picks[k] = ((R().picks[k] || 0) + 1) % (+np.dataset.max); save(); const y = scrollY; $('#stepbody').innerHTML = stepBody(curStep()); scrollTo(0, y); return; }
    const toc = t.closest('[data-toc]'); if (toc) { const el = $('#sec-' + toc.dataset.toc); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const es = t.closest('[data-eside]'); if (es) { editSide = es.dataset.eside; IDX = null; searchQ = ''; return render(); }
    const chg = t.closest('[data-chg]'); if (chg) return showChange(chg.dataset.chg);
    const hn = t.closest('[data-hn]'); if (hn) return stepHit(+hn.dataset.hn);
    const cc = t.closest('[data-copycite]'); if (cc) { const x = evById(cc.dataset.copycite); return copyText(`${x.who || ''} — ${x.cite}. ${x.url || ''}`); }
    const dm = t.closest('[data-dlmodel]'); if (dm) return downloadModel(+dm.dataset.dlmodel);
    const rs = t.closest('[data-restore]'); if (rs) { const sn = snapshots().find(x => x.id === rs.dataset.restore); if (sn && confirm('Restore "' + sn.label + '"? Your current version is backed up first.')) { pushSnapshot(S, 'Before restoring'); const keep = S.settings; S = migrate(sn.data); S.settings = keep; IDX = null; save(true); closeModal(); go('home'); toast('Restored.'); } return; }
    if (t.closest('#aiGo')) return runAI(lastAns);
    if (t.closest('#aiStop')) { if (aiAbort) aiAbort.abort(); return; }
    if (t.closest('#polishUse')) { const x = $('#polishout .aitext'); const el = $('#builtspeech'); if (x && el) { el.innerHTML = x.innerText.split(/\n+/).map(p => `<p>${esc(p)}</p>`).join(''); el.dispatchEvent(new Event('input', { bubbles: true })); } return; }
    if (t.closest('#selftest')) return selfTest();
    if (t.closest('#startchrome')) return startChromeAI(false);
    if (t.closest('#loadsaved')) { savedModelFile().then(f => f ? loadLocalModel(f, (AI.local.saved || {}).name) : toast('Saved model not found — pick the file again.')).then(() => renderSetupTab('ai')); return; }
    if (t.closest('#forgetmodel')) { if (confirm('Remove the AI model from this device?')) forgetModel().then(() => renderSetupTab('ai')); return; }
    if (t.closest('#aitest')) { const out = $('#aitestout'); out.textContent = '…'; const a = B.answer("Won't a moratorium hurt the economy?", idx()); generate(B.llmPrompt('crossfire', { q: a.query, cards: a.cards.slice(0, 3).map(c => B.compress(B.stripHtml(c.doc.item.html || ''), 70)) }, sideKey(), S.topic), x => { out.textContent = x; }).catch(err => { out.textContent = 'Error: ' + err.message; }); return; }
    if (t.closest('#pasteimport')) return showPasteImport();
    if (t.closest('#pastego')) return doPasteImport();
    if (t.closest('#snapnow')) { pushSnapshot(S, 'Manual backup') ? toast('Backup saved') : toast('Not enough space — use Save a copy'); return renderSetupTab('share'); }
    if (t.closest('#resetall')) { if (confirm('Reset everything back to the version Claude made? (Your current version is backed up first.)')) { pushSnapshot(S, 'Before reset'); const keep = S.settings; S = freshState(); S.settings = keep; IDX = null; save(true); closeModal(); go('home'); toast('Back to the original.'); } return; }
    const a = t.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act;
    if (act === 'startsetup') { if (R().active && !confirm('This ends your current round. Start a new one?')) return; if (R().active) { archiveRound(); S.round = newRound(); save(); } pending = { side: null, order: null, opponent: '' }; setupStage = 0; return go('setup'); }
    if (act === 'continue') { view = 'round'; setTimer(curStep().t); return render(); }
    if (act === 'beginround') return beginRound();
    if (act === 'edit') { editSide = a.dataset.side; IDX = null; return go('edit'); }
    if (act === 'evidence' || act === 'factcheck') { editSide = 'pro'; IDX = null; go('edit'); setTimeout(() => { const el = $('#sec-' + act); if (el) el.scrollIntoView({ block: 'start' }); }, 30); return; }
    if (act === 'gohome') { closeModal(); return go('home'); }
    if (act === 'settings') { closeModal(); return showSettings(); }
    if (act === 'endround') return endRound();
    if (act === 'allqs') { showAllQs = !showAllQs; $('#ourqs').innerHTML = ourQuestions(); return; }
    if (act === 'rebuild') { const b = R().built[a.dataset.sp]; if (b && b.edited && !confirm('Rebuild? Your edits to this speech will be replaced.')) return; return build(a.dataset.sp); }
    if (act === 'polish') return polishBuilt(a.dataset.sp);
    if (act === 'add') return addCard(a.closest('.sec').dataset.sec);
    if (act === 'cardmenu') return cardMenu(a);
    if (act === 'addev') { const id = 'E' + (Math.max(0, ...S.evidence.map(x => +String(x.id).replace(/\D/g, '') || 0)) + 1); S.evidence.push({ id, who: '', tag: 'New evidence — what it proves', cite: 'Author, title, publication, date', url: '', text: 'Quote or summary', tags: [] }); save(); render(); setTimeout(() => { const el = $('#ev-' + id); if (el) el.scrollIntoView({ block: 'center' }); }, 30); return; }
    if (act === 'togglechanges') { S.settings.showChanges = !S.settings.showChanges; save(); applyDisplay(); a.textContent = (S.settings.showChanges ? 'Hide' : 'Show') + ' changes in the text'; return; }
    if (act === 'exporthtml') return exportHTML();
    if (act === 'exportjson') return download(`PF-Debate-Hub-backup_${stamp()}.json`, JSON.stringify(exportState(), null, 1), 'application/json');
  }
  function copyText(t) {
    const done = () => toast('Copied');
    const fb = () => { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed'); } ta.remove(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, fb); else fb();
  }

  /* =========================================================
     BOOT
     ========================================================= */
  function boot() {
    shell(); fmtBar(); wire();
    view = R().active ? 'round' : 'home';
    if (R().active) setTimer(curStep().t);
    render();
    setInterval(tick, 200);
    save(true);
    try { const m = JSON.parse(lsGet(LS_MODEL) || 'null'); if (m) AI.local.saved = m; } catch (e) { }
    detectChromeAI();
    if (AI.local.saved && S.settings.autoLoadModel && S.settings.aiPref !== 'off' && document.getElementById('pf-wasm-main')) {
      savedModelFile().then(f => { if (f) loadLocalModel(f, AI.local.saved.name); else AI.local.saved = null; });
    }
    if (pendingShared) maybeAskShared();
    else if (!S.settings.rulesSeen) showRules();
    window.PF = { get state() { return S; }, B, idx, AI, go, goStep, render, save, exportHTML, get view() { return view; } };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
