// module/sheets/tabs/disorders.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Ментальные расстройства: случайный бросок по таблице, пикер записей и тест
//  конкретного расстройства. Функции принимают актора, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS } from "../../constants/characteristics.mjs";
import { FEAR_RATINGS, DISORDER_LIBRARY, rollDisorderEntry } from "../../constants/fear-tables.mjs";
import { _executeFearRoll, _executeTraumaRoll } from "../../combat/fear.mjs";
import { _degWord, esc } from "../../helpers/utils.mjs";
import { rollIcon } from "../../constants/roll-icons.mjs";
import { centerPicker, pickerPos } from "../picker-ui.mjs";
import { ruleRollModsHtml } from "../../rules/roll-mods.mjs";
import { testOutcome } from "../../rules/roll-outcome.mjs";

/** Сумма отмеченных галочек «Правила» диалога — общий приём с _showSkillRollDialog. */
function checkedRuleMods(form) {
  let sum = 0;
  for (const cb of form?.querySelectorAll?.(".rule-mod:checked") ?? []) sum += parseInt(cb.dataset.value) || 0;
  return sum;
}

/** Диалог теста Страха: форма живёт рядом с остальными кнопками безумия. */
export function openFearDialog(actor) {
  const ratingOpts = Object.entries(FEAR_RATINGS).map(([key, rating]) =>
    `<option value="${key}">${rating.label} — важный W${rating.important >= 0 ? "+" : ""}${rating.important}, Infamy ${rating.infamy}+</option>`
  ).join("");
  // Галочки правил (Конструктор, kind:"testMod", область char:wp) — та же
  // область, что у Травмы ниже: Каталептический Узел и подобное сюда же.
  const rm = ruleRollModsHtml(actor, { kind: "skill", char: "wp" });

  new Dialog({
    title: "😱 Тест Страха",
    content: `
      <form class="wh-attack-form" style="padding:6px;">
        <div class="atk-dlg-row"><label>Рейтинг Страха:</label><select id="fear-rating">${ratingOpts}</select></div>
        <div class="atk-dlg-row"><label>Тип персонажа:</label>
          <select id="fear-type"><option value="important">Важный (игрок)</option><option value="normal">Обычный</option></select></div>
        <div class="atk-dlg-row"><label>Infamy:</label><input id="fear-infamy" type="number" value="0"/></div>
        <div class="atk-dlg-row"><label>Доп. модификатор:</label><input id="fear-mod" type="number" value="0"/></div>
        <div class="atk-dlg-section">Свойства</div>
        <div class="atk-dlg-row"><label><input id="fear-prop-demon" type="checkbox"/> Демон</label></div>
        ${rm.html}
      </form>`,
    buttons: {
      roll: {
        icon: '<i class="fas fa-dice-d10"></i>',
        label: "Бросок!",
        callback: async html => {
          const ratingKey = html.find("#fear-rating").val();
          const type = html.find("#fear-type").val();
          const infamy = parseInt(html.find("#fear-infamy").val()) || 0;
          const mod = (parseInt(html.find("#fear-mod").val()) || 0) + checkedRuleMods(html[0]);
          // Свойства источника Страха — читаются в карточку/флаги сообщения;
          // Демон уже даёт бесплатный переброс при провале (см. fear.mjs).
          const properties = { demon: html.find("#fear-prop-demon").is(":checked") };
          await _executeFearRoll(actor, ratingKey, type, infamy, mod, properties);
        }
      },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 380 }).render(true);
}

/** Тест Ментальной Травмы (W+0) → при провале таблица Травмы. Без диалога — прежнее поведение для программных вызовов. */
export async function rollTrauma(actor) {
  return _executeTraumaRoll(actor);
}

/**
 * Диалог перед тестом Ментальной Травмы — раньше кнопка катала сразу, без
 * шага выбора: у теста не было ни одного модификатора, спрашивать было не о
 * чем. Появились галочки правил (Каталептический Узел и подобное, область
 * char:wp) — тем же диалоговым приёмом, что и у Страха выше.
 */
export function openTraumaDialog(actor) {
  const rm = ruleRollModsHtml(actor, { kind: "skill", char: "wp" });
  if (!rm.mods.length) return rollTrauma(actor);   // нечего выбирать — как раньше, сразу бросок

  new Dialog({
    title: "🧠 Тест Ментальной Травмы",
    content: `
      <form class="wh-attack-form" style="padding:6px;">
        <div class="atk-dlg-row"><label>Доп. модификатор:</label><input id="trauma-mod" type="number" value="0"/></div>
        ${rm.html}
      </form>`,
    buttons: {
      roll: {
        icon: '<i class="fas fa-dice-d10"></i>',
        label: "Бросок!",
        callback: async html => {
          const mod = (parseInt(html.find("#trauma-mod").val()) || 0) + checkedRuleMods(html[0]);
          await _executeTraumaRoll(actor, mod);
        }
      },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 340 }).render(true);
}

/** Создаёт предмет-расстройство на акторе из записи библиотеки (без дублей по имени). */
export async function createDisorderItem(actor, entry) {
  if (actor.items.some(i => i.type === "mentalDisorder" && i.name === entry.name)) {
    ui.notifications.info(`Расстройство «${entry.name}» уже есть.`);
    return null;
  }
  const [item] = await actor.createEmbeddedDocuments("Item", [{
    name: entry.name,
    type: "mentalDisorder",
    system: { description: entry.desc || "", testChar: "wp", testMod: entry.testMod || 0 }
  }]);
  return item;
}

/** Случайное Ментальное Расстройство (d100) — создаёт предмет и сообщает в чат. */
export async function rollDisorder(actor) {
  const roll = await new Roll("1d100").evaluate();
  const row = rollDisorderEntry(roll.total);
  if (row) await createDisorderItem(actor, row);
  const rollMode = game.settings.get("core", "rollMode");
  const dice = await roll.render();
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("dice","#6fe6ff")}Ментальное Расстройство — ${esc(actor.name)}</div>
        <div class="roll-dice">Бросок d100: <b>${roll.total}</b></div>
        <div class="roll-outcome"><span class="roll-failure">${rollIcon("warn","#ffb84d")}${esc(row?.name) ?? "—"}</span></div>
        ${row?.desc ? `<div class="roll-threshold">${row.desc}</div>` : ""}
        <details class="roll-dice-details"><summary>${rollIcon("chart","#8fd0ff")}Показать кубы</summary>${dice}</details>
      </div>`,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  }, rollMode));
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

/** Тест конкретного расстройства (W + его testMod). */
export async function rollDisorderTest(actor, item) {
  const system = item.system;
  const charKey = system.testChar || "wp";
  const meta = CHARACTERISTICS[charKey];
  const charVal = actor.system.characteristics[charKey]?.total ?? 0;
  const eff = charVal + (system.testMod || 0);
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const { success, deg } = testOutcome(rv, eff);
  const rollMode = game.settings.get("core", "rollMode");
  const dice = await roll.render();
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("spark","#c98bff")}${esc(item.name)} — ${esc(actor.name)}</div>
        <div class="roll-threshold">${meta?.abbr ?? charKey}: <b>${charVal}</b>${system.testMod ? ` ${system.testMod >= 0 ? "+" : ""}${system.testMod}` : ""} → Порог: <b>${eff}</b></div>
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${success
          ? `<span class="roll-success">Успех — контроль удержан (${deg} ${_degWord(deg)})</span>`
          : `<span class="roll-failure">Провал — расстройство проявляется (${deg} ${_degWord(deg)})</span>`}</div>
        ${system.description ? `<div class="roll-threshold" style="font-size:0.9em;">${system.description}</div>` : ""}
        <details class="roll-dice-details"><summary>${rollIcon("chart","#8fd0ff")}Показать кубы</summary>${dice}</details>
      </div>`,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  }, rollMode));
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
