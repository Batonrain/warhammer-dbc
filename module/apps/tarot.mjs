// ════════════════════════════════════════════════════════════════════════
//  Таро Императора — окно гадания (Warhammer DBC).
//  • Отдельное окно (как Мастерская/Когитаторы), кнопка в панели контролей.
//  • ГМ (или игрок) собирает расклад: для каждой позиции спреда выбирает
//    карту ВРУЧНУЮ из полной колоды ИЛИ бросает её случайно (🎲), а также
//    задаёт положение (Прямая/Перевёрнутая) вручную или случайно.
//  • Кнопка «Огласить» постит публичную карточку-расклад в чат.
//  Чистый отыгрыш: без тестов и эффектов на актёров.
// ════════════════════════════════════════════════════════════════════════

import { TAROT_DECK, SUITS, SUIT_HINTS, TAROT_SPREADS, TAROT_GUIDE,
         cardByN, cardTitle, cardSuitLine, cardImgSrc } from "../constants/tarot.mjs";
import { esc } from "../helpers/utils.mjs";

const { Application } = foundry.appv1.api;
function _emptySlots(spreadKey) {
  return (TAROT_SPREADS[spreadKey]?.positions || []).map(() => ({ cardN: null, reversed: false }));
}

// Имена для выбора Теоманта/Квирита: сначала токены текущей сцены, иначе — персонажи.
function _tokenNames() {
  const toks = canvas?.tokens?.placeables || [];
  let names = [...new Set(toks.map(t => t.name).filter(Boolean))];
  if (!names.length) names = game.actors.filter(a => a.type === "character").map(a => a.name);
  return names.sort((x, y) => x.localeCompare(y, "ru"));
}

export class TarotReader extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "wh-tarot",
      classes: ["warhammer-dbc", "wh-holo", "wh-tarot"],
      title: "Таро Императора — Гадание",
      template: "systems/warhammer-dbc/templates/apps/tarot.hbs",
      width: 920, height: 840, resizable: true,
      scrollY: [".wh-tarot-scroll"]
    });
  }

  constructor(...args) {
    super(...args);
    this.state = { tab: "reading", spread: "cross", question: "", teomant: "", quirit: "", slots: _emptySlots("cross") };
  }

  _usedN(except = -1) {
    return new Set(this.state.slots.map((x, i) => (i === except ? null : x.cardN)).filter(Boolean));
  }
  _rollSlot(i) {
    const used = this._usedN(i);
    const avail = TAROT_DECK.filter(c => !used.has(c.n));
    if (!avail.length) return;
    const card = avail[Math.floor(Math.random() * avail.length)];
    this.state.slots[i] = { cardN: card.n, reversed: Math.floor(Math.random() * 10) >= 5 };  // 1d10: 6–10 = перевёрнутая
  }
  _randomAll() { for (let i = 0; i < this.state.slots.length; i++) this._rollSlot(i); }

  // Подсказка ГМу: тема (Старшая Аркана) + доминирующая масть.
  _readHint() {
    const drawn = this.state.slots.map(x => (x.cardN ? cardByN(x.cardN) : null)).filter(Boolean);
    if (!drawn.length) return "";
    const majors = drawn.filter(c => c.suit === "major");
    const counts = {};
    for (const c of drawn) if (c.suit !== "major") counts[c.suit] = (counts[c.suit] || 0) + 1;
    let dom = null, dn = 0;
    for (const k in counts) if (counts[k] > dn) { dn = counts[k]; dom = k; }
    const majTxt = majors.length
      ? `Тему задаёт Старшая Аркана: ${majors.map(m => m.name).join(", ")}.`
      : "Нет Старших Арканов — дело касается смертных.";
    const domTxt = dom ? ` Доминирует ${SUITS[dom]}: ${SUIT_HINTS[dom]}` : "";
    return majTxt + domTxt;
  }

  getData() {
    const s = this.state;
    const sp = TAROT_SPREADS[s.spread];
    const suitGroups = Object.keys(SUITS).map(k => ({
      key: k, label: SUITS[k],
      cards: TAROT_DECK.filter(c => c.suit === k)
        .map(c => ({ n: c.n, label: `${c.n}. ${cardTitle(c)}` }))
    }));
    const slots = sp.positions.map((pos, i) => {
      const sl = s.slots[i];
      const card = sl.cardN ? cardByN(sl.cardN) : null;
      return {
        i, name: pos.name, signal: !!pos.signal,
        cardN: sl.cardN || "", reversed: !!sl.reversed,
        card: card ? {
          title: cardTitle(card), suitLine: cardSuitLine(card),
          img: cardImgSrc(card),
          meaning: sl.reversed ? card.rev : card.up
        } : null
      };
    });
    const tokens = _tokenNames();
    const guideSuits = Object.keys(SUITS).map(k => ({
      key: k, label: SUITS[k], hint: SUIT_HINTS[k],
      cards: TAROT_DECK.filter(c => c.suit === k)
        .map(c => ({ n: c.n, title: cardTitle(c), img: cardImgSrc(c), up: c.up, rev: c.rev, ch: c.ch }))
    }));
    return {
      isGM: game.user.isGM,
      tab: s.tab, isReading: s.tab === "reading", isGuide: s.tab === "guide",
      spreadKey: s.spread,
      spreadNote: sp.note,
      spreads: Object.entries(TAROT_SPREADS).map(([k, v]) => ({ key: k, label: v.label, selected: k === s.spread })),
      question: s.question, teomant: s.teomant, quirit: s.quirit,
      tokens,
      suitGroups, slots, readHint: this._readHint(),
      guide: TAROT_GUIDE, guideSuits
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const el = html[0] ?? html;
    const s = this.state;
    const rr = () => this.render(false);

    el.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => { s.tab = b.dataset.tab; rr(); }));
    if (s.tab !== "reading") return;
    // Ручной выбор карты (data-cardsel/data-orient) есть в DOM только у ГМ;
    // 🎲/случайный расклад/оглашение доступны и игрокам.

    el.querySelector("[name=spread]")?.addEventListener("change", e => { s.spread = e.target.value; s.slots = _emptySlots(s.spread); rr(); });
    el.querySelector("[name=question]")?.addEventListener("change", e => { s.question = e.target.value; });
    el.querySelector("[name=teomant]")?.addEventListener("change", e => { s.teomant = e.target.value; });
    el.querySelector("[name=quirit]")?.addEventListener("change", e => { s.quirit = e.target.value; });
    // Выбор из токенов сцены → заполняет соответствующее поле
    el.querySelectorAll("[data-pick]").forEach(sel => sel.addEventListener("change", e => {
      if (!e.target.value) return;
      s[sel.dataset.pick] = e.target.value; rr();
    }));

    el.querySelectorAll("[data-cardsel]").forEach(sel => sel.addEventListener("change", e => {
      const i = Number(sel.dataset.cardsel); s.slots[i].cardN = e.target.value ? Number(e.target.value) : null; rr();
    }));
    el.querySelectorAll("[data-orient]").forEach(sel => sel.addEventListener("change", e => {
      const i = Number(sel.dataset.orient); s.slots[i].reversed = e.target.value === "rev"; rr();
    }));
    el.querySelectorAll("[data-rollslot]").forEach(b => b.addEventListener("click", () => { this._rollSlot(Number(b.dataset.rollslot)); rr(); }));

    el.querySelector("[data-act=randomall]")?.addEventListener("click", () => { this._randomAll(); rr(); });
    el.querySelector("[data-act=clear]")?.addEventListener("click", () => { s.slots = _emptySlots(s.spread); rr(); });
    el.querySelector("[data-act=post]")?.addEventListener("click", () => this._post());
  }

  _post() {
    const s = this.state;
    const sp = TAROT_SPREADS[s.spread];
    if (!s.slots.some(x => x.cardN)) { ui.notifications?.warn("Таро: ни одна карта не выбрана."); return; }

    const rows = sp.positions.map((pos, i) => {
      const sl = s.slots[i];
      const sig = pos.signal ? ` <span class="tc-sig">знаковая</span>` : "";
      if (!sl.cardN) return `<div class="wh-tarot-card empty"><div class="tc-pos">${esc(pos.name)}${sig}</div><div class="tc-empty">— не вытянута —</div></div>`;
      const c = cardByN(sl.cardN);
      const rev = sl.reversed;
      const img = cardImgSrc(c);
      const imgHtml = img ? `<div class="tc-frame"><img class="tc-art" src="${img}" data-title="${esc(cardTitle(c))}" alt="" title="Открыть карту"/></div>` : "";
      return `<div class="wh-tarot-card${rev ? " reversed" : ""}">
        <div class="tc-pos">${esc(pos.name)}${sig}</div>
        ${imgHtml}
        <div class="tc-text">
          <div class="tc-name">${c.n}. ${esc(cardTitle(c))} <span class="tc-suit">(${esc(cardSuitLine(c))})</span></div>
          <div class="tc-orient">${rev ? "⭮ Перевёрнутая" : "⭯ Прямая"}</div>
          <div class="tc-mean">${esc(rev ? c.rev : c.up)}</div>
          <div class="tc-change">${esc(c.ch)}</div>
        </div>
      </div>`;
    }).join("");

    const meta = [];
    if (s.teomant) meta.push(`<span class="tr-meta-i"><b>Теомант:</b> ${esc(s.teomant)}</span>`);
    if (s.quirit)  meta.push(`<span class="tr-meta-i"><b>Квирит:</b> ${esc(s.quirit)}</span>`);
    const metaHtml = meta.length ? `<div class="tr-meta">${meta.join("")}</div>` : "";
    const qHtml = s.question ? `<div class="tr-question">«${esc(s.question)}»</div>` : "";
    const hint = this._readHint();
    const hintHtml = hint ? `<div class="tr-hint">${esc(hint)}</div>` : "";

    const content = `<div class="wh-tarot-reading">
      <div class="tr-head">✦ ТАРО ИМПЕРАТОРА · ${esc(sp.label)} ✦</div>
      ${qHtml}${metaHtml}
      <div class="tr-cards">${rows}</div>
      ${hintHtml}
    </div>`;

    ChatMessage.create({
      speaker: { alias: s.teomant ? `Теомант — ${s.teomant}` : "Таро Императора" },
      content
    });
  }
}

// ── Полноразмерный просмотр карты по клику (окно ImagePopout) ─────────────────
export function openCardImage(src, title = "Карта") {
  if (!src) return;
  try {
    if (globalThis.ImagePopout) { new globalThis.ImagePopout(src, { title, shareable: true }).render(true); return; }
  } catch (e) { /* fallthrough */ }
  try {
    const V2 = foundry.applications?.apps?.ImagePopout;
    if (V2) { new V2({ src, window: { title } }).render(true); return; }
  } catch (e) { console.warn("Warhammer DBC | ImagePopout:", e); }
}

// Делегированный клик по любой карте-миниатюре (в окне гадания/гайде и в чате).
Hooks.once("ready", () => {
  document.addEventListener("click", (ev) => {
    const img = ev.target?.closest?.("img.tr-pv-art, img.tr-gc-art, img.tc-art");
    if (!img) return;
    openCardImage(img.getAttribute("src"), img.dataset.title || "Карта");
  });
});

// ── Открытие ────────────────────────────────────────────────────────────────
let _reader = null;
export function openTarotReader() {
  if (!_reader) _reader = new TarotReader();
  _reader.render(true);
  return _reader;
}
