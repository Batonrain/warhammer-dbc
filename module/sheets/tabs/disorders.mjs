// module/sheets/tabs/disorders.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Ментальные расстройства: случайный бросок по таблице, пикер записей и тест
//  конкретного расстройства. Функции принимают актора, а не лист.
//
//  Авто-встречный чекбокс/делегирование (wdbc-j814/wdbc-uez7) сюда сознательно
//  НЕ перенесены (wdbc-qc6d): Тест Страха/Травмы/конкретного Расстройства —
//  всегда тест самого actor (W + рейтинг/testMod записи), без соперника с
//  симметричным Навыком/Характеристикой на другой стороне — авто-резолву
//  через skillTotal/characteristics опонента тут просто нечего считать, а
//  делегировать (просить ЧУЖОГО актора бросить ЗА этого) книжно бессмысленно:
//  это не тест «за пациента» (Лечение), а собственная психика этого actor.
// ════════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS } from "../../constants/characteristics.mjs";
import { FEAR_RATINGS, DISORDER_LIBRARY, rollDisorderEntry } from "../../constants/fear-tables.mjs";
import { _executeFearRoll, _executeTraumaRoll, fearChar } from "../../combat/fear.mjs";
import { _degWord, esc } from "../../helpers/utils.mjs";
import { rollIcon } from "../../constants/roll-icons.mjs";
import { centerPicker, pickerPos } from "../picker-ui.mjs";
import { autoTestMods, ruleRollModsHtml, ruleRerollsHtml } from "../../rules/roll-mods.mjs";
import { postTestCard, rollStatLine } from "../../helpers/test-card.mjs";
import { resolveKindOutcome } from "../../rules/kind-outcome.mjs";
import { fatiguePenalty } from "./conditions.mjs";
import { testKindHtml, diceModeHtml, readTestKind, readDiceChoice,
         mergeReroll, wireTestKindLive, rollD100WithReroll } from "../../rules/test-kind-widget.mjs";
import { collectTestMods } from "../../rules/roll-mods.mjs";
import { severityTestMod, effectiveSeverity, stepSeverity } from "../../rules/disorder-severity.mjs";

/** Сумма отмеченных галочек «Правила» диалога — общий приём с _showSkillRollDialog. */
function checkedRuleMods(form) {
  let sum = 0;
  for (const cb of form?.querySelectorAll?.(".rule-mod:checked") ?? []) sum += parseInt(cb.dataset.value) || 0;
  return sum;
}

/** Выбранный именной переброс (радиокнопки ruleRerollsHtml) — общий приём с attack-dialog.mjs. */
function namedReroll(form) {
  const el = form?.querySelector?.(".rule-reroll-opt:checked");
  const idx = parseInt(el?.dataset?.idx ?? "-1");
  return idx >= 0 ? { mode: el.dataset.mode, rolls: parseInt(el.dataset.rolls) || 2 } : null;
}

/**
 * Адаптер `val(selector)` для читателей rules/test-kind-widget.mjs поверх
 * jQuery-обёртки старого `Dialog`. `.val()` на несовпавшей выборке (реальный
 * jQuery) или на несуществующем ключе (заглушка теста, test/support/
 * foundry-stub.mjs::fakeHtml) одинаково отдаёт `undefined` — оба случая
 * приводятся к `null`, как ждёт readTestKind/readDiceChoice.
 */
function valOf(html) {
  return sel => { const v = html.find(sel).val(); return v === undefined ? null : v; };
}

/** Адаптер `checked(selector)` — независимые галочки Вида теста (стр. 25-26,
 *  wdbc-y9i8), .val() чекбокса даёт статичный "on", не текущее состояние. */
function checkedOf(html) {
  return sel => !!html.find(sel).prop("checked");
}

/**
 * Что диалог Страха может подставить сам (стр. 53), чтобы игроку не сверять
 * числа руками:
 *  - Infamy — ХАРАКТЕРИСТИКА (Inf), не Очки Бесчестия: пороги книги 20+…80+,
 *    пул Очков (≤ Inf.b) до них не дотягивает никогда;
 *  - рейтинг — Страх выделенного на сцене источника (system.fearRating);
 *  - «Демон» — источник типа daemon или с Чертой Daemonic;
 *  - «Важный» — у персонажа есть игрок-владелец; ГМ переключит для важного NPC.
 */
export function fearDialogDefaults(actor, source = null) {
  const infamy = Math.max(0, Number(actor?.system?.characteristics?.inf?.total) || 0);
  const srcFear = Number(source?.system?.fearRating) || 0;
  const rating = Math.min(4, Math.max(1, srcFear || 1));
  const demon = !!source && (source.type === "daemon"
    || [...(source.items ?? [])].some(i => i.type === "trait" && /^Daemonic\s*([(/]|$)/i.test(i.name ?? "")));
  const important = actor?.hasPlayerOwner ?? true;
  return { infamy, rating, demon, important };
}

/** Диалог теста Страха: форма живёт рядом с остальными кнопками безумия. */
export function openFearDialog(actor) {
  const ratingOpts = rating => Object.entries(FEAR_RATINGS).map(([key, r]) =>
    `<option value="${key}"${Number(key) === rating ? " selected" : ""}>${r.label} — важный W${r.important >= 0 ? "+" : ""}${r.important}, Infamy ${r.infamy}+</option>`
  ).join("");
  // Галочки правил (Конструктор, kind:"testMod", область char:wp/morale) —
  // та же область testMod, что у Травмы ниже: Каталептический Узел и
  // подобное сюда же. morale:true подключает и переброс (Lord of the
  // Exodites и т.п. — wdbc-zepq), которого раньше в этом диалоге не было.
  //
  // targetActor (wdbc-1rno, 12.09.2026) — выделенный на сцене токен, тот же
  // приём, что у attack-dialog.mjs::attackCtx: Тест Страха книжно не привязан
  // к конкретному токену (игрок выбирает числовой рейтинг руками), но если
  // источник угрозы всё же выделен, cross-actor правила (Ненависть) могут его
  // прочитать. Без выделенного токена — null, ведёт себя как раньше.
  const targetActor = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  // Машина без свободы воли (стр. 53) проходит Страх на Int — и галочки,
  // и предпросмотр Порога считаются по той же характеристике, что бросок.
  const char = fearChar(actor);
  const ctx = { kind: "skill", char, morale: true, targetActor };
  const pre = fearDialogDefaults(actor, targetActor);
  const rm = ruleRollModsHtml(actor, ctx);
  const rr = ruleRerollsHtml(actor, ctx);
  new Dialog({
    title: "😱 Тест Страха",
    content: `
      <form class="wh-attack-form" style="padding:6px;">
        <div class="atk-dlg-row"><label>Рейтинг Страха:</label><select id="fear-rating">${ratingOpts(pre.rating)}</select></div>
        <div class="atk-dlg-row"><label>Тип персонажа:</label>
          <select id="fear-type"><option value="important"${pre.important ? " selected" : ""}>Важный (игрок)</option><option value="normal"${pre.important ? "" : " selected"}>Обычный</option></select></div>
        <div class="atk-dlg-row"><label>Infamy:</label><input id="fear-infamy" type="number" value="${pre.infamy}"/></div>
        <div class="atk-dlg-row"><label>Доп. модификатор:</label><input id="fear-mod" type="number" value="0"/></div>
        <div class="atk-dlg-section">Свойства</div>
        <div class="atk-dlg-row"><label><input id="fear-prop-demon" type="checkbox"${pre.demon ? " checked" : ""}/> Демон</label></div>
        ${rm.html}
        ${rr.html}
        ${testKindHtml({ label: "Тест Страха" })}
        ${diceModeHtml()}
        <div id="auto-outcome-note" class="roll-dlg-note"></div>
      </form>`,
    buttons: {
      roll: {
        icon: '<i class="fas fa-dice-d10"></i>',
        label: "Бросок!",
        callback: async html => {
          const val = valOf(html);
          const ratingKey = html.find("#fear-rating").val();
          const type = html.find("#fear-type").val();
          const infamy = parseInt(html.find("#fear-infamy").val()) || 0;
          const mod = (parseInt(html.find("#fear-mod").val()) || 0) + checkedRuleMods(html[0]);
          // Свойства источника Страха — читаются в карточку/флаги сообщения;
          // Демон уже даёт бесплатный переброс при провале (см. fear.mjs).
          const properties = { demon: html.find("#fear-prop-demon").is(":checked") };
          const tk = readTestKind(val, checkedOf(html), { label: "Тест Страха" });
          tk.reroll = mergeReroll(namedReroll(html[0]), readDiceChoice(val));
          await _executeFearRoll(actor, ratingKey, type, infamy, mod, properties, { tk });
        }
      },
      cancel: { label: "Отмена" }
    },
    default: "roll",
    render: html => {
      const root = html[0];
      const wp = actor.system.characteristics[char]?.total ?? 0;
      const { updateAutoOutcomeNote } = wireTestKindLive(root, {
        actor, label: "Тест Страха",
        getBaseEff: () => {
          const ratingKey = html.find("#fear-rating").val();
          const type = html.find("#fear-type").val();
          const r = FEAR_RATINGS[ratingKey] || FEAR_RATINGS[1];
          const ratingMod = type === "important" ? r.important : r.normal;
          const mod = (parseInt(html.find("#fear-mod").val()) || 0) + checkedRuleMods(root);
          const difficulty = parseInt(root.querySelector("#test-difficulty")?.value) || 0;
          // autoTestMods, не collectTestMods: галочки правил уже сложены в
          // `mod` строкой выше (checkedRuleMods) — общий сбор задвоил бы их.
          // Предпросмотр обязан совпадать с тем, что посчитает сам бросок
          // (combat/fear.mjs), иначе игрок видит один Порог, а получает другой.
          return wp + ratingMod + mod + difficulty
            + autoTestMods(actor, { kind: "skill", char, morale: true, targetActor }).total;
        }
      });
      root.querySelectorAll("#fear-rating, #fear-type, #fear-mod, .rule-mod").forEach(el =>
        el.addEventListener("change", updateAutoOutcomeNote));
    }
  }, { classes: ["dialog", "wh-attack-dialog"], width: 380 }).render(true);
}

/** Тест Ментальной Травмы (W+0) → при провале таблица Травмы. Без диалога — прежнее поведение для программных вызовов. */
export async function rollTrauma(actor) {
  return _executeTraumaRoll(actor);
}

/**
 * Диалог перед тестом Ментальной Травмы. Раньше при пустом списке галочек
 * правил кнопка катала сразу — спрашивать было не о чем; теперь есть ещё Вид
 * теста/Сложность/Кубик, так что диалог нужен всегда.
 */
export function openTraumaDialog(actor) {
  const rm = ruleRollModsHtml(actor, { kind: "skill", char: "wp" });
  const wp = actor.system.characteristics.wp?.total ?? 0;

  new Dialog({
    title: "🧠 Тест Ментальной Травмы",
    content: `
      <form class="wh-attack-form" style="padding:6px;">
        <div class="atk-dlg-row"><label>Доп. модификатор:</label><input id="trauma-mod" type="number" value="0"/></div>
        ${rm.html}
        ${testKindHtml({ label: "Ментальная Травма" })}
        ${diceModeHtml()}
        <div id="auto-outcome-note" class="roll-dlg-note"></div>
      </form>`,
    buttons: {
      roll: {
        icon: '<i class="fas fa-dice-d10"></i>',
        label: "Бросок!",
        callback: async html => {
          const val = valOf(html);
          const mod = (parseInt(html.find("#trauma-mod").val()) || 0) + checkedRuleMods(html[0]);
          const tk = readTestKind(val, checkedOf(html), { label: "Ментальная Травма" });
          tk.reroll = mergeReroll(null, readDiceChoice(val));
          await _executeTraumaRoll(actor, mod, tk);
        }
      },
      cancel: { label: "Отмена" }
    },
    default: "roll",
    render: html => {
      const root = html[0];
      const { updateAutoOutcomeNote } = wireTestKindLive(root, {
        actor, label: "Ментальная Травма",
        getBaseEff: () => {
          const mod = (parseInt(html.find("#trauma-mod").val()) || 0) + checkedRuleMods(root);
          const difficulty = parseInt(root.querySelector("#test-difficulty")?.value) || 0;
          return wp + mod + difficulty;
        }
      });
      root.querySelectorAll("#trauma-mod, .rule-mod").forEach(el =>
        el.addEventListener("change", updateAutoOutcomeNote));
    }
  }, { classes: ["dialog", "wh-attack-dialog"], width: 340 }).render(true);
}

/**
 * Создаёт предмет-расстройство на акторе из записи библиотеки (без дублей по имени).
 * extra.system — поля сверх книжных (Тяжесть, предел, «неизлечимо»),
 * extra.flags — метки выдачи (кто выдал — чтобы снятие источника убрало и его).
 */
export async function createDisorderItem(actor, entry, extra = {}) {
  if (actor.items.some(i => i.type === "mentalDisorder" && i.name === entry.name)) {
    ui.notifications.info(`Расстройство «${entry.name}» уже есть.`);
    return null;
  }
  const [item] = await actor.createEmbeddedDocuments("Item", [{
    name: entry.name,
    type: "mentalDisorder",
    system: { description: entry.desc || "", testChar: "wp", testMod: entry.testMod || 0, ...(extra.system || {}) },
    ...(extra.flags ? { flags: extra.flags } : {})
  }]);
  return item;
}

/**
 * Случайное Ментальное Расстройство (d100) — создаёт предмет и сообщает в чат.
 * opts — то же extra, что у createDisorderItem, плюс note — строка в карточку
 * (почему выдано и чем особенно). Возвращает созданный предмет или null.
 */
export async function rollDisorder(actor, opts = {}) {
  const roll = await new Roll("1d100").evaluate();
  const row = rollDisorderEntry(roll.total);
  const item = row ? await createDisorderItem(actor, row, opts) : null;
  const dice = await roll.render();
  // Выдача по таблице: Порога нет, подпись броска своя («Бросок d100»),
  // поэтому строкой в lines, а не через общий rv (helpers/test-card.mjs).
  await postTestCard(actor, {
    icon: rollIcon("dice", "#6fe6ff"), title: `Ментальное Расстройство — ${esc(actor.name)}`,
    lines: [`<div class="roll-dice">Бросок d100: <b>${roll.total}</b></div>`],
    outcome: `<span class="roll-failure">${rollIcon("warn","#ffb84d")}${esc(row?.name) ?? "—"}</span>`,
    sections: [
      opts.note ? `<div class="roll-threshold"><b>${esc(opts.note)}</b></div>` : "",
      row?.desc ? `<div class="roll-threshold">${row.desc}</div>` : "",
      `<details class="roll-dice-details"><summary>${rollIcon("chart","#8fd0ff")}Показать кубы</summary>${dice}</details>`
    ]
  }, { rolls: [roll] });
  return item;
}

/**
 * Стартовое расстройство от источника (Архетип «Беглый Псайкер»: «начинает
 * игру со случайным ментальным расстройством. Оно неизлечимо и его тяжесть не
 * может опуститься ниже −2»). Зовётся записью Конструктора kind:"script"
 * источника — один раз при выдаче; повторный запуск («▶ Запустить») второго
 * расстройства не даёт, пока выданное лежит на листе.
 * Выданное помечается источником (grantedByItem и его originGrant), так что
 * смена Архетипа снимает и расстройство.
 * @returns {Promise<{ok:boolean, reason?:string, item?:Item}>}
 */
export async function grantStartingDisorder(actor, sourceItem, { severityMin = null, incurable = true, label = "" } = {}) {
  if (!actor) return { ok: false, reason: "Нет актора." };
  const prevId = sourceItem?.getFlag?.("warhammer-dbc", "startingDisorderId");
  if (prevId && actor.items.get(prevId)) {
    return { ok: false, reason: `Стартовое расстройство уже выдано: «${actor.items.get(prevId).name}».` };
  }
  const originGrant = sourceItem?.getFlag?.("warhammer-dbc", "originGrant");
  const flags = { "warhammer-dbc": {
    ...(sourceItem?.id ? { grantedByItem: sourceItem.id } : {}),
    ...(originGrant ? { originGrant } : {})
  } };
  const floor = severityMin === null || severityMin === undefined ? null : Number(severityMin);
  const who = label || sourceItem?.name || "";
  const note = `${who ? `${who}: ` : ""}стартовое расстройство${incurable ? ", неизлечимо" : ""}` +
    `${floor !== null ? `, Тяжесть не ниже ${floor < 0 ? "−" : ""}${Math.abs(floor)}` : ""}.`;
  const item = await rollDisorder(actor, {
    system: { severity: 0, severityMin: floor, incurable: !!incurable }, flags, note
  });
  if (!item) return { ok: false, reason: "Выпавшее расстройство уже есть на листе — ГМ выбирает другое." };
  if (sourceItem?.setFlag) await sourceItem.setFlag("warhammer-dbc", "startingDisorderId", item.id);
  return { ok: true, item };
}

/**
 * Пикер ментальных расстройств (стр. 292) — в одном стиле с пикерами талантов,
 * черт и мутаций: поиск, диапазон d100, раскрытие описания стрелкой, добавление
 * по «＋» прямо из строки.
 */
export function openDisorderPicker(actor) {
  const have = new Set(actor.items.filter(i => i.type === "mentalDisorder").map(i => i.name));
  const rows = DISORDER_LIBRARY.map((disorder, i) => {
    const rng = disorder.min === disorder.max ? String(disorder.min) : `${disorder.min}\u2013${disorder.max}`;
    const test = `W${disorder.testMod >= 0 ? "+" : ""}${disorder.testMod}`;
    // Поиск по Set — вне разметки: в Set лежат сырые имена, и экранированное
    // сюда подставлять нельзя. Заодно две одинаковые проверки становятся одной.
    const owned = have.has(disorder.name);
    const own = owned ? '<span class="pick-owned">уже есть</span>' : "";
    return `
      <div class="pick-row${owned ? " pick-row-owned" : ""}" data-name="${esc(disorder.name.toLowerCase())}">
        <div class="pick-head">
          <button type="button" class="pick-exp" title="Показать описание">▸</button>
          <span class="pick-name" title="Раскрыть">${esc(disorder.name)}</span>
          <span class="pick-tier">${test}</span>
          <span class="pick-req">d100 ${rng}</span>${own}
          <button type="button" class="pick-add" data-idx="${i}" title="Добавить на лист">＋</button>
        </div>
        <div class="pick-desc" style="display:none;">${esc(disorder.desc || "—")}</div>
      </div>`;
  }).join("");

  new Dialog({
    title: "🧠 Добавить расстройство",
    content: `<div class="wh-item-picker">
      <div class="pick-top"><input type="text" class="pick-search" placeholder="Поиск расстройства…"/></div>
      <div class="pick-list">
        <div class="pick-group">
          <div class="pick-group-head">Ментальные расстройства <span class="pick-count">${DISORDER_LIBRARY.length}</span></div>
          <div class="pick-group-body">${rows}</div>
        </div>
      </div>
    </div>`,
    buttons: { close: { label: "Закрыть" } },
    default: "close",
    render: html => activateDisorderPicker(html, actor)
  }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-item-picker-dialog"], ...pickerPos(560, 620) }).render(true);
}

function activateDisorderPicker(html, actor) {
  centerPicker(html);
  html.find(".pick-add").on("click", async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    const entry = DISORDER_LIBRARY[parseInt(ev.currentTarget.dataset.idx)];
    if (!entry) return;
    const item = await createDisorderItem(actor, entry);
    if (item) {
      $(ev.currentTarget).closest(".pick-row").addClass("just-added");
      item.sheet?.render(true);
    }
  });
  const toggle = row => {
    const desc = row.querySelector(".pick-desc");
    const exp = row.querySelector(".pick-exp");
    const open = desc.style.display !== "none";
    desc.style.display = open ? "none" : "block";
    exp.textContent = open ? "▸" : "▾";
  };
  html.find(".pick-exp").on("click", ev => {
    ev.preventDefault();
    toggle(ev.currentTarget.closest(".pick-row"));
  });
  html.find(".pick-name").on("click", ev => toggle(ev.currentTarget.closest(".pick-row")));
  html.find(".pick-search").on("input", ev => {
    const q = ev.currentTarget.value.toLowerCase().trim();
    // ВАЖНО: тело в фигурных скобках. classList.toggle возвращает булево, а
    // jQuery .each() прерывает обход, если колбэк вернул false — из-за этого
    // фильтр обрывался на первой же СОВПАВШЕЙ строке и остаток списка не
    // фильтровался вовсе.
    html.find(".pick-row").each((_, row) => {
      row.classList.toggle("pick-hidden", !!q && !(row.dataset.name || "").includes(q));
    });
  });
}

/**
 * Тест конкретного расстройства (W + его testMod). Раньше катился сразу по
 * клику, без диалога — ни одного модификатора выбирать было не нужно.
 * Появились Вид теста/Сложность/Кубик, поэтому маленький DialogV2 перед
 * броском, как и у остальных раскатанных тестов.
 */
export async function rollDisorderTest(actor, item) {
  const system = item.system;
  const charKey = system.testChar || "wp";
  const meta = CHARACTERISTICS[charKey];
  const charVal = actor.system.characteristics[charKey]?.total ?? 0;
  // Общий сбор модификаторов (wdbc-asuc): подавление Расстройства считалось
  // мимо реестра. Именно collectTestMods, а не autoTestMods: галочек правил
  // этот диалог не показывает (в отличие от соседнего диалога Страха), и
  // задвоить нечего — см. docs/rules-format.md.
  const suppressMods = collectTestMods(actor, { kind: "skill", char: charKey });
  // Тяжесть расстройства: все связанные с ним тесты −5×Тяжесть (корбук,
  // «Ментальные расстройства»; rules/disorder-severity.mjs).
  const sevMod = severityTestMod(system);
  const baseEffNoDiff = charVal + (system.testMod || 0) + sevMod + suppressMods.total;

  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: item.name },
    classes: ["wh-roll-dialog-window"],
    position: { width: 340 },
    content: `
      <div class="wh-skill-roll-form">
        <div class="roll-dlg-header"><span>${esc(item.name)}</span></div>
        <div class="roll-dlg-row"><label>${meta?.abbr ?? charKey}:</label><span>${baseEffNoDiff}</span></div>
        ${testKindHtml({ label: item.name })}
        ${diceModeHtml()}
        <div id="auto-outcome-note" class="roll-dlg-note"></div>
      </div>`,
    buttons: [
      {
        action: "roll", icon: "fas fa-dice-d10", label: "Бросок", default: true,
        callback: (event, button) => {
          const form = button.form;
          const val  = sel => form.querySelector(sel)?.value ?? null;
          const checked = sel => !!form.querySelector(sel)?.checked;
          const tk = readTestKind(val, checked, { label: item.name });
          tk.reroll = mergeReroll(null, readDiceChoice(val));
          return tk;
        }
      },
      { action: "cancel", label: "Отмена", callback: () => false }
    ],
    render: (event, dialog) => {
      wireTestKindLive(dialog.element, {
        actor, label: item.name,
        getBaseEff: () => baseEffNoDiff + (parseInt(dialog.element.querySelector("#test-difficulty")?.value) || 0)
      });
    },
    rejectClose: false
  });
  if (!result) return;
  const { difficulty, combined, extended, opposed, reroll } = result;

  const { roll, rv, rolls, rerollNote } = await rollD100WithReroll(reroll);

  const eff0 = baseEffNoDiff + difficulty;
  const outcome = await resolveKindOutcome(actor, {
    baseEff: eff0, rv, combined, extended, opposed,
    ctx: { actor, kind: "skill", char: charKey }
  });
  const { success, deg } = outcome;
  const dice = await roll.render();
  await postTestCard(actor, {
    icon: rollIcon("spark", "#c98bff"),
    title: `${esc(item.name)}${outcome.kindLabel ? ` · ${outcome.kindLabel}` : ""} — ${esc(actor.name)}`,
    threshold: rollStatLine({
      label: meta?.abbr ?? charKey, base: charVal,
      parts: [
        ...(system.testMod ? [`${system.testMod >= 0 ? "+" : ""}${system.testMod}`] : []),
        ...(sevMod ? [`${sevMod >= 0 ? "+" : ""}${sevMod} (Тяжесть ${effectiveSeverity(system)})`] : []),
        ...suppressMods.parts,
        ...(difficulty !== 0 ? [`${difficulty >= 0 ? "+" : ""}${difficulty} (📊 Сложность)`] : [])
      ],
      threshold: eff0, rv
    }),
    lines: [outcome.combinedLine],
    rerollNote, critLine: outcome.critLine,
    outcome: success
      ? `<span class="roll-success">Успех — контроль удержан (${deg} ${_degWord(deg)})</span>`
      : `<span class="roll-failure">Провал — расстройство проявляется (${deg} ${_degWord(deg)})</span>`,
    sections: [
      system.description ? `<div class="roll-threshold" style="font-size:0.9em;">${system.description}</div>` : "",
      outcome.extendedLine, outcome.opposedLine,
      `<details class="roll-dice-details"><summary>${rollIcon("chart","#8fd0ff")}Показать кубы</summary>${dice}</details>`
    ]
  }, { rolls: [roll] });
}

/**
 * Подавление активной Травмы или Расстройства (стр. 473).
 *
 * Одна запись — сразу тест, несколько — сперва выбор какую именно. Тест обоим
 * типам катает один и тот же rollDisorderTest: порогом служит характеристика
 * самой записи плюс её собственный модификатор, поэтому Расстройства с разным
 * штрафом считаются каждое по-своему.
 */
export async function suppressMental(actor, type) {
  const label = type === "mentalTrauma" ? "Травмы" : "Расстройства";
  const items = actor.items.filter(i => i.type === type);
  if (!items.length) return ui.notifications.info(`Подавлять нечего: активных записей ${label} нет.`);
  if (items.length === 1) return rollDisorderTest(actor, items[0]);

  const opts = items.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join("");
  return new Promise(resolve => {
    new Dialog({
      title: `Подавление ${label}: что именно?`,
      content: `<form class="wh-attack-form" style="padding:6px;">
        <div class="atk-dlg-row"><label>Запись:</label><select id="suppress-pick">${opts}</select></div>
      </form>`,
      buttons: {
        roll: {
          label: "Тест",
          callback: async html => {
            const item = actor.items.get(html.find("#suppress-pick").val());
            if (item) await rollDisorderTest(actor, item);
            resolve();
          }
        },
        cancel: { label: "Отмена", callback: () => resolve() }
      },
      default: "roll",
      close: () => resolve()
    }, { classes: ["dialog", "wh-attack-dialog"], width: 340 }).render(true);
  });
}

/**
 * Кнопки безумия на вкладке ЭФФЕКТЫ: тесты Страха, Травмы и Порчи, случайное
 * расстройство, пикер и строки уже полученных.
 * rollCharacteristic — бросок листа: диалог характеристики остаётся его частью.
 */
export function activateDisorderListeners(html, actor, { rollCharacteristic } = {}) {
  html.find(".fear-roll").click(() => openFearDialog(actor));
  html.find(".trauma-roll").click(() => openTraumaDialog(actor));
  html.find(".trauma-suppress").click(() => suppressMental(actor, "mentalTrauma"));
  html.find(".disorder-suppress").click(() => suppressMental(actor, "mentalDisorder"));
  html.find(".disorder-roll, .disorder-roll-btn").click(() => rollDisorder(actor));
  html.find(".disorder-add-btn").click(() => openDisorderPicker(actor));
  html.find(".disorder-test-btn").click(ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) rollDisorderTest(actor, item);
  });
  // Тяжесть ±1 — итог теста ГМа на изменение Тяжести (успех −1, провал +1);
  // пределы (−5…+5 и свой «не ниже» неизлечимого) держит stepSeverity.
  html.find(".disorder-sev-btn").click(async ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (!item) return;
    const next = stepSeverity(item.system, Number(ev.currentTarget.dataset.delta) || 0);
    if (next !== item.system.severity) await item.update({ "system.severity": next });
  });
  html.find(".disorder-remove-btn").click(async ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) await item.delete();
  });
  html.find(".disorder-name-link").click(ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) item.sheet?.render(true);
  });
  html.find(".corruption-roll").click(() => {
    const wp = actor.system.characteristics.wp?.total ?? 0;
    rollCharacteristic("Воля (Порча)", "WP", wp, "wp");
  });
}
