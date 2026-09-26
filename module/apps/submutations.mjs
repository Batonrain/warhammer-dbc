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
         isSubBlocked, patronSubmutation, needsReroll, SUB_GOD_LABELS,
         multiRollCount, multiRollResults }
  from "../rules/submutations.mjs";
import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";

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
    // «Бросьте N раз» (Тройной Плод/Многокрылый, wdbc-1rno) — до N доп.
    // результатов сверх строки-заголовка выше (та описывает саму
    // multi-roll строку, не отдельный playable эффект).
    multi: Array.isArray(cur.multi) ? cur.multi.map(e => ({ ...e, godLabel: e.god ? (SUB_GOD_LABELS[e.god] || e.god) : "" })) : [],
    rollLine: cur.roll
      ? `d${table.die}: ${cur.roll}${cur.shift ? ` ${cur.shift > 0 ? "+" : "−"}${Math.abs(cur.shift)} → ${cur.total}` : ""}`
      : (cur.name ? "выбрана без броска" : ""),
    entries: table.entries.map(e => ({
      key: e.label, label: entryLabel(e), selected: e.label === cur.label,
      blocked: isSubBlocked(e, patron)
    }))
  };
}

/** Записать строку таблицы в мутацию. multi — доп. результаты «Бросьте N раз» (Тройной Плод/Многокрылый, wdbc-1rno), [] по умолчанию. */
export async function setSubmutation(item, entry, { roll = 0, shift = 0, total = 0, multi = [] } = {}) {
  if (!entry) return;
  await item.update({
    "system.submutation.name":  entry.name,
    "system.submutation.label": entry.label,
    "system.submutation.text":  entry.text,
    "system.submutation.god":   entry.god || "",
    "system.submutation.roll":  roll,
    "system.submutation.shift": shift,
    "system.submutation.total": total,
    "system.submutation.multi": multi.map(e => ({ name: e.name, label: e.label, text: e.text, god: e.god || "" }))
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
    "system.submutation.total": 0, "system.submutation.multi": []
  });
}

/** Карточка результата в чат. multi — доп. результаты «Бросьте N раз», если строка такая. */
async function announce(item, actor, entry, { roll = 0, shift = 0, total = 0, blocked = false, die = 10, multi = [] }) {
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
      blocked ? `<div class="roll-note">Строка враждебного Бога — по правилу книги её брать нельзя.</div>` : "",
      multi.length ? `<div class="roll-note">Три броска без сдвига Inf.b (дубликаты/самоссылка схлопнулись): ${
        multi.map(e => esc(entryLabel(e))).join("; ")}</div>` : ""
    ]
  }, { sound: false });
}

/**
 * «Бросьте N раз на субмутации без обычных модификаторов от Inf.b» (Тройной
 * Плод/Многокрылый, wdbc-1rno) — если entry такая строка, честно бросает N
 * дополнительных d{table.die} (БЕЗ сдвига Inf.b, книга явно это исключает) и
 * сворачивает их в список результатов. Не такая строка — пустой список, ничего
 * не меняет в обычном потоке.
 */
async function rollMultiExtra(table, entry) {
  const count = multiRollCount(entry);
  if (!count) return [];
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push((await new Roll(`1d${table.die}`).evaluate()).total);
  return multiRollResults(table.entries, rolls, entry.label);
}

/** Одна точка финализации: доп. броски «N раз» (если строка такая) + запись + карточка. */
async function finalizeSubmutation(item, actor, table, entry, rollInfo, { blocked = false } = {}) {
  const multi = await rollMultiExtra(table, entry);
  await setSubmutation(item, entry, { ...rollInfo, multi });
  await announce(item, actor, entry, { ...rollInfo, die: table.die, blocked, multi });
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
    if (mine) return finalizeSubmutation(item, owner, table, mine, {});
    return pickDialog(item, owner, table);
  }

  // Пасынки Богов (Зверолюд): «всегда бросая только один кубик на мутации и
  // субмутации» — второго броска Неделимых нет (mutation.singleDie).
  const undivided = patron === "undivided" && !(owner && hasRuleFlag(owner, "mutation.singleDie"));
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
          if (entry) await finalizeSubmutation(item, actor, table, entry, {});
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
          await finalizeSubmutation(item, actor, table, entry, rollInfo, { blocked: isSubBlocked(entry, patron) });
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

/**
 * Строки таблицы, доступные для выбора «в пределах 1–10» (Мутант: «может
 * выбирать субмутацию к этой мутации в пределах 1-10»): диапазон строки
 * целиком внутри 1–10. Строки враждебного Бога возвращаются с blocked — их
 * показываем, но не даём взять, как и при броске.
 */
export function choosableSubmutations(item, patron = "", maxRoll = 10) {
  const table = parseSubmutations(item?.system?.benefit || "");
  return table.entries
    .filter(e => e.lo !== null && e.lo >= 1 && e.hi <= maxRoll)
    .map(e => ({ entry: e, label: entryLabel(e), blocked: isSubBlocked(e, patron) }));
}

/**
 * Окно выбора субмутации вместо броска. Отмена — строка не пишется, её можно
 * выбрать позже на листе мутации (pickSubmutation). Таблицы нет — ничего.
 */
export async function chooseSubmutation(item, { actor = null, maxRoll = 10 } = {}) {
  const patron = (actor ?? item?.actor)?.system?.patronGod || "";
  const rows = choosableSubmutations(item, patron, maxRoll);
  if (!rows.length) return null;
  const DialogV2 = foundry.applications.api.DialogV2;
  const content = `<p>Субмутация «${esc(item.name)}» — выберите строку (1–${maxRoll}):</p>
    <div class="wh-submut-choice">${rows.map((r, i) => `<label style="display:block">
      <input type="radio" name="submut" value="${i}" ${r.blocked ? "disabled" : ""}/>
      ${esc(r.label)}${r.blocked ? " — закрыта (враждебный Бог)" : ""}</label>`).join("")}</div>`;
  const idx = await DialogV2.wait({
    window: { title: `Субмутация: ${item.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content,
    buttons: [
      { action: "pick", label: "Выбрать", default: true,
        callback: (ev, btn) => btn.form?.elements?.submut?.value ?? null },
      { action: "cancel", label: "Позже" }
    ],
    rejectClose: false
  }).catch(() => null);
  const row = rows[Number(idx)];
  if (idx === null || idx === "cancel" || !row || row.blocked) return null;
  await setSubmutation(item, row.entry);
  return row.entry;
}
