// module/apps/submutations.mjs
// ════════════════════════════════════════════════════════════════════════════
//  БРОСОК СУБМУТАЦИИ (корбук, стр. 440) и запись результата в предмет-мутацию.
//
//  Таблица берётся из текста самой мутации (rules/submutations.mjs), результат
//  ложится в `system.submutation` — одна определённая строка на предмет.
//
//  Правила, которые здесь исполняются:
//  • бросок d10 по таблице субмутаций;
//  • сдвиг результата на до ⅓Inf.b (окр.▼) вверх или вниз — но не тогда, когда
//    мутация получена от Порчи за Провал;
//  • Неделимые бросают дважды и выбирают результат (тоже не от Провала);
//  • строку своего Бога можно взять вместо выпавшей или вовсе не бросая;
//  • строка ВРАЖДЕБНОГО Бога закрыта (пары извечных соперников: Кхорн ↔ Слаанеш,
//    Тзинч ↔ Нургл), и если весь доступный участок таблицы закрыт — переброс.
//
//  Субмутации часто выдают естественные атаки (укус, рога, дыхание). Оружием
//  они здесь НЕ становятся, и своего механизма выдачи атак этот модуль не
//  заводит: для встроенных атак в Конструкторе МЕХАНИКА появляется вид записи
//  «Интегральная атака» (apps/mechanics.mjs) — он выдаёт оружие, надетое
//  навсегда. Когда до мутаций дойдёт очередь, привязкой послужит записанная
//  здесь строка `system.submutation`: у мутации известна не только сама
//  мутация, но и какая именно субмутация выпала.
// ════════════════════════════════════════════════════════════════════════════

import { parseSubmutations, submutationByRoll, subShiftLimit, subShiftOptions,
         isSubBlocked, patronSubmutation, needsReroll, SUB_GOD_LABELS }
  from "../rules/submutations.mjs";
import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Подпись строки таблицы для окна и карточки: «7 — Слизняк (Нургл)». */
function entryLabel(entry) {
  if (!entry) return "—";
  const god = entry.god ? ` (${SUB_GOD_LABELS[entry.god] || entry.god})` : "";
  return `${entry.label} — ${entry.name}${god}`;
}

/** Данные блока «Субмутация» на листе мутации; null — таблицы у мутации нет. */
export function submutationContext(item) {
  if (item?.type !== "mutation") return null;
  const table = parseSubmutations(item.system?.benefit || "");
  if (!table.entries.length) return null;

  const cur    = item.system?.submutation || {};
  const patron = item.actor?.system?.patronGod || "";
  const infB   = item.actor?.system?.characteristics?.inf?.bonus ?? 0;

  return {
    die: table.die,
    rollable: table.rollable,
    shiftLimit: subShiftLimit(infB),
    hasActor: !!item.actor,
    patronLabel: SUB_GOD_LABELS[patron] || "",
    name:  cur.name || "",
    label: cur.label || "",
    text:  cur.text || "",
    godLabel: cur.god ? (SUB_GOD_LABELS[cur.god] || cur.god) : "",
    rollLine: cur.roll
      ? `d${table.die}: ${cur.roll}${cur.shift ? ` ${cur.shift > 0 ? "+" : "−"}${Math.abs(cur.shift)} → ${cur.total}` : ""}`
      : (cur.name ? "выбрана без броска" : ""),
    entries: table.entries.map(e => ({
      key: e.label, label: entryLabel(e), selected: e.label === cur.label,
      blocked: isSubBlocked(e, patron)
    }))
  };
}

/** Записать строку таблицы в мутацию. */
export async function setSubmutation(item, entry, { roll = 0, shift = 0, total = 0 } = {}) {
  if (!entry) return;
  await item.update({
    "system.submutation.name":  entry.name,
    "system.submutation.label": entry.label,
    "system.submutation.text":  entry.text,
    "system.submutation.god":   entry.god || "",
    "system.submutation.roll":  roll,
    "system.submutation.shift": shift,
    "system.submutation.total": total
  });
}

/** Выбрать строку вручную (по подписи из таблицы мутации). */
export async function pickSubmutation(item, label) {
  const table = parseSubmutations(item.system?.benefit || "");
  const entry = table.entries.find(e => e.label === String(label));
  if (!entry) return;
  await setSubmutation(item, entry);
}

/** Снять записанную субмутацию. */
export async function clearSubmutation(item) {
  await item.update({
    "system.submutation.name": "", "system.submutation.label": "",
    "system.submutation.text": "", "system.submutation.god": "",
    "system.submutation.roll": 0, "system.submutation.shift": 0,
    "system.submutation.total": 0
  });
}

/** Карточка результата в чат. */
async function announce(item, actor, entry, { roll = 0, shift = 0, total = 0, blocked = false, die = 10 }) {
  const stat = (label, value) => `<span class="roll-stat"><label>${label}</label><b>${value}</b></span>`;
  const line = roll
    ? `<div class="roll-statline">${stat(`d${die}`, roll)}${
        shift ? stat("Сдвиг", `${shift > 0 ? "+" : "−"}${Math.abs(shift)}`) : ""}${
        shift ? stat("Итог", total) : ""}</div>`
    : `<div class="roll-statline">${stat("Выбор", "без броска")}</div>`;

  // Бросок по ТАБЛИЦЕ субмутаций, не тест: Порога нет. Кубик и сдвиг несёт
  // своя строка roll-statline (d10/d5, Сдвиг, Итог) — общая «Бросок: N» её
  // не заменяет, поэтому rv не передаётся.
  await postTestCard(actor ?? null, {
    title: `Субмутация — ${esc(item.name)}`,
    lines: [line],
    outcome: `<b>${esc(entryLabel(entry))}</b>`,
    sections: [
      entry?.text ? `<div class="ability-detail-text">${esc(entry.text)}</div>` : "",
      blocked ? `<div class="roll-note">Строка враждебного Бога — по правилу книги её брать нельзя.</div>` : ""
    ]
  }, { sound: false });
}

/**
 * Бросок субмутации для мутации-предмета.
 *
 * @param {Item}    item              предмет-мутация (уже на листе или в мире)
 * @param {object}  [options]
 * @param {Actor}   [options.actor]       владелец; по умолчанию — владелец предмета
 * @param {boolean} [options.fromFailure] мутация получена от Порчи за Провал:
 *                                        ни сдвига, ни второго броска
 */
export async function rollSubmutation(item, { actor = null, fromFailure = false } = {}) {
  const owner = actor || item.actor || null;
  const table = parseSubmutations(item.system?.benefit || "");
  if (!table.entries.length) return ui.notifications?.warn(`У мутации «${item.name}» нет субмутаций.`);

  const patron = owner?.system?.patronGod || "";
  const infB   = owner?.system?.characteristics?.inf?.bonus ?? 0;
  const mine   = patronSubmutation(table.entries, patron);

  // Таблица без бросков («Стальное Сердце», «Тёмная Душа») — строка определяется
  // покровителем. Есть покровитель — записываем без вопросов.
  if (!table.rollable) {
    if (mine) {
      await setSubmutation(item, mine);
      return announce(item, owner, mine, { die: table.die });
    }
    return pickDialog(item, owner, table);
  }

  const undivided = patron === "undivided";
  const roll1 = await new Roll(`1d${table.die}`).evaluate();
  const roll2 = undivided ? await new Roll(`1d${table.die}`).evaluate() : null;

  return shiftDialog(item, owner, table, { roll1, roll2, infB, patron, mine, fromFailure });
}

/** Окно выбора строки, когда бросать нечего (именная таблица без покровителя). */
function pickDialog(item, actor, table) {
  const opts = table.entries
    .map(e => `<option value="${esc(e.label)}">${esc(entryLabel(e))}</option>`).join("");
  return new Promise(resolve => {
    new Dialog({
      title: `🧬 Субмутация — ${item.name}`,
      content: `<form class="wh-attack-form" style="padding:6px;">
        <div class="atk-dlg-note">Строки этой таблицы не бросаются — субмутация определяется покровителем персонажа. Покровитель не выбран, поэтому строку назначает ГМ.</div>
        <div class="atk-dlg-row"><label>Субмутация:</label>
          <select id="sm-pick" class="pm-input">${opts}</select></div>
      </form>`,
      buttons: {
        ok: { label: "Записать", callback: async (html) => {
          const entry = table.entries.find(e => e.label === String(html.find("#sm-pick").val()));
          if (entry) { await setSubmutation(item, entry); await announce(item, actor, entry, { die: table.die }); }
          resolve(entry || null);
        } },
        cancel: { label: "Отмена", callback: () => resolve(null) }
      },
      default: "ok"
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo"], width: 460 }).render(true);
  });
}

/** Окно броска: сдвиг ±⅓Inf.b, выбор броска у Неделимых, строка своего Бога. */
function shiftDialog(item, actor, table, { roll1, roll2, infB, patron, mine, fromFailure }) {
  const limit0 = subShiftLimit(infB, { fromFailure });

  const resultFor = (base, shift) => submutationByRoll(table.entries, base + shift);

  const content = `
    <form class="wh-attack-form" style="padding:6px;">
      <div class="atk-dlg-row"><label>Мутация:</label><span><b>${esc(item.name)}</b></span></div>
      <div class="atk-dlg-row"><label>Бросок d${table.die}:</label><span><b>${roll1.total}</b></span></div>
      ${roll2 ? `<div class="atk-dlg-row"><label>Второй (Неделимый):</label><span><b>${roll2.total}</b></span></div>
      <div class="atk-dlg-row" id="sm-which-row"><label>Использовать:</label>
        <select id="sm-which" class="pm-input">
          <option value="1">Первый (${roll1.total})</option>
          <option value="2">Второй (${roll2.total})</option>
        </select></div>` : ""}
      <div class="atk-dlg-row">
        <label title="Мутация от Порчи за Провал не даёт ни сдвига, ни второго броска">От Порчи за Провал:</label>
        <input type="checkbox" id="sm-fail" ${fromFailure ? "checked" : ""}/>
      </div>
      <div class="atk-dlg-row">
        <label>Сдвиг (±⅓Inf.b ${limit0}):</label>
        <input type="number" id="sm-shift" value="0" min="-${limit0}" max="${limit0}" class="pm-input"/>
      </div>
      ${mine ? `<div class="atk-dlg-row"><label>Строка покровителя:</label>
        <label class="drug-fx-cb-label"><input type="checkbox" id="sm-mine"/> ${esc(entryLabel(mine))}</label></div>` : ""}
      <div class="atk-dlg-row"><label>Итог:</label><b id="sm-result">${esc(entryLabel(resultFor(roll1.total, 0)))}</b></div>
      <div class="atk-dlg-note" id="sm-note"></div>
    </form>`;

  /** Что диалог выберет при текущих полях — одна точка на превью и на «ОК». */
  const readForm = (html) => {
    const failed = html.find("#sm-fail").is(":checked");
    const limit  = subShiftLimit(infB, { fromFailure: failed });
    const base   = (roll2 && !failed && String(html.find("#sm-which").val()) === "2") ? roll2.total : roll1.total;
    const shift  = clamp(parseInt(html.find("#sm-shift").val()) || 0, -limit, limit);
    const useMine = !!mine && html.find("#sm-mine").is(":checked");
    const entry  = useMine ? mine : resultFor(base, shift);
    return { failed, limit, base, shift, useMine, entry,
             options: subShiftOptions(table.entries, base, limit, patron) };
  };

  return new Promise(resolve => {
    new Dialog({
      title: `🧬 Субмутация — ${item.name}`,
      content,
      buttons: {
        ok: { label: "Записать", callback: async (html) => {
          const { base, shift, useMine, entry } = readForm(html);
          if (!entry) return resolve(null);
          const rollInfo = useMine ? {} : { roll: base, shift, total: base + shift };
          await setSubmutation(item, entry, rollInfo);
          await announce(item, actor, entry,
            { ...rollInfo, die: table.die, blocked: isSubBlocked(entry, patron) });
          resolve(entry);
        } },
        // Переброс — средство книги против закрытого участка таблицы. Признак
        // Порчи за Провал переносится из окна, а не из вызова: игрок мог
        // отметить его уже здесь.
        reroll: { label: "Перебросить", callback: async (html) => {
          resolve(await rollSubmutation(item, { actor, fromFailure: readForm(html).failed }));
        } },
        cancel: { label: "Отмена", callback: () => resolve(null) }
      },
      default: "ok",
      render: html => {
        const upd = () => {
          const { limit, entry, options, useMine } = readForm(html);
          const shiftField = html.find("#sm-shift");
          shiftField.attr("min", -limit); shiftField.attr("max", limit);
          html.find("#sm-result").text(entryLabel(entry));
          const notes = [];
          if (isSubBlocked(entry, patron) && !useMine)
            notes.push("Эта строка отмечена цветом враждебного Бога — брать её нельзя.");
          if (needsReroll(options) && !useMine)
            notes.push("Весь доступный участок таблицы закрыт — бросок нужно перебросить.");
          html.find("#sm-note").text(notes.join(" "));
          html.find("#sm-which-row").toggle(!!roll2 && !html.find("#sm-fail").is(":checked"));
        };
        upd();
        html.find("#sm-fail, #sm-shift, #sm-which, #sm-mine").on("input change", upd);
      }
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo"], width: 460 }).render(true);
  });
}
