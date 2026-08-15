// module/apps/armour-history.mjs
// ════════════════════════════════════════════════════════════════════════
//  Истории и особенности комплекта силовой брони Астартес.
//  Особенность приписана к конкретному предмету брони: её можно выбрать
//  вручную или определить бросками (1к5 — таблица, 1к10 — особенность).
// ════════════════════════════════════════════════════════════════════════

import { PA_TABLES, PA_TABLE_ORDER, PA_TABLE_PICK, PA_SHIFT_RULE, PA_ZONES,
         entryByRoll, rangeLabel, shiftOptions } from "../constants/power-armour-lore.mjs";
import { isFeatureEnabled } from "../constants/features.mjs";
import { esc } from "../helpers/utils.mjs";

/** Истории есть только у силовой брони Астартес. */
export function supportsHistory(item) {
  return item?.type === "armor" && item.system?.armorType === "power";
}

/** Данные для блока «Особенность комплекта» на листе брони. */
export function armourHistoryContext(item) {
  if (!isFeatureEnabled("armourHistories") || !supportsHistory(item)) return null;
  const h = item.system.history || {};
  const cur = h.table ? PA_TABLES[h.table]?.entries.find(e => e.name === h.name) : null;

  return {
    enabled: true,
    table: h.table || "",
    name: h.name || "",
    desc: h.desc || "",
    effect: h.effect || "",
    roll: h.roll || 0,
    choice: h.choice || "",
    choiceLabel: cur?.choice?.label || "",
    choicePlaceholder: cur?.choice?.placeholder || "",
    needsChoice: !!cur?.choice,
    zoneRoll: !!cur?.zoneRoll,
    zones: PA_ZONES.map(z => ({ ...z, value: Number(h.zones?.[z.key]) || 0 })),
    hasZones: Object.values(h.zones || {}).some(v => Number(v) !== 0),
    second: h.second?.name ? { ...h.second, tableLabel: PA_TABLES[h.second.table]?.label || "" } : null,
    tables: PA_TABLE_ORDER.map(k => ({
      key: k, label: PA_TABLES[k].label, selected: k === h.table,
      entries: PA_TABLES[k].entries.map(e => ({
        key: e.name, label: `${rangeLabel(e)} — ${e.name}`, selected: e.name === h.name
      }))
    })),
    tablePick: PA_TABLE_PICK,
    shiftRule: PA_SHIFT_RULE
  };
}

/** Записать особенность в предмет (по названию из таблицы). */
export async function setArmourEntry(item, table, name, { second = false, roll = 0 } = {}) {
  const def = PA_TABLES[table]?.entries.find(e => e.name === name);
  if (!def) return;
  const path = second ? "system.history.second" : "system.history";
  const data = {
    [`${path}.table`]: table, [`${path}.key`]: def.name, [`${path}.roll`]: roll,
    [`${path}.name`]: def.name, [`${path}.desc`]: def.desc, [`${path}.effect`]: def.effect
  };
  if (!second) data["system.history.choice"] = "";
  await item.update(data);
}

/** Снять особенность (и вторую, если была). */
export async function clearArmourHistory(item) {
  await item.update({
    "system.history.table": "", "system.history.key": "", "system.history.roll": 0,
    "system.history.name": "", "system.history.desc": "", "system.history.effect": "",
    "system.history.choice": "", "system.history.zones": {},
    "system.history.second": { table: "", key: "", roll: 0, name: "", desc: "", effect: "", choice: "" }
  });
}

/** Бросок 1к5: какая таблица используется. */
export async function rollArmourTable(item) {
  const roll = await new Roll("1d5").evaluate();
  const pick = PA_TABLE_PICK.find(p => p.roll === roll.total);

  let msg = `<div class="wh-roll-result pa-chat">
    <div class="roll-header">Особенности брони — ${esc(item.name)}</div>
    <div class="roll-dice">1к5: <b>${roll.total}</b></div>
    <div class="pa-chat-pick">${esc(pick?.label || "")}</div>`;

  // 5 — две разные таблицы: бросаем, пока не выпадут два разных результата.
  if (pick?.table === "two") {
    const picked = [];
    let guard = 0;
    while (picked.length < 2 && guard++ < 40) {
      const r = await new Roll("1d5").evaluate();
      const p = PA_TABLE_PICK.find(x => x.roll === r.total);
      // Повторная пятёрка эффекта не имеет; берём только разные таблицы.
      if (!p || p.table === "two" || p.table === "any" || picked.includes(p.table)) continue;
      picked.push(p.table);
    }
    msg += `<div class="pa-chat-two">Таблицы: ${picked.map(t => esc(PA_TABLES[t].label)).join(" и ")}</div>`;
    for (let i = 0; i < picked.length; i++) {
      const r = await new Roll("1d10").evaluate();
      const e = entryByRoll(picked[i], r.total);
      if (e) await setArmourEntry(item, picked[i], e.name, { second: i === 1, roll: r.total });
      msg += `<div class="pa-chat-entry"><b>${esc(PA_TABLES[picked[i]].label)} (к10 = ${r.total}):</b>
        ${esc(e?.name || "—")}<div class="pa-chat-effect">${esc(e?.effect || "")}</div></div>`;
    }
  }
  else if (pick?.table === "any") {
    msg += `<div class="pa-chat-note">Выберите любую таблицу вручную на листе брони.</div>`;
  }
  else if (pick) {
    await item.update({ "system.history.table": pick.table });
    msg += `<div class="pa-chat-note">Теперь бросьте к10 по этой таблице.</div>`;
  }

  msg += "</div>";
  await ChatMessage.create(ChatMessage.applyRollMode(
    { content: msg, rolls: [roll] }, game.settings.get("core", "rollMode")));
}

/**
 * Бросок 1к10 по таблице. Если у владельца брони есть Inf.b, предлагаем
 * сдвинуть результат — по правилу книги это решение игрока.
 */
export async function rollArmourEntry(item, table) {
  if (!PA_TABLES[table]) return ui.notifications?.warn("Сначала выберите таблицу особенностей.");
  const roll = await new Roll("1d10").evaluate();
  const rv = roll.total;

  const infBonus = item.actor?.system?.characteristics?.inf?.bonus ?? 0;
  const options = shiftOptions(rv, infBonus);
  let chosen = rv;

  if (options.length > 1) {
    chosen = await promptShift(table, rv, options);
    if (chosen === null) chosen = rv;
  }

  const e = entryByRoll(table, chosen);
  if (e) await setArmourEntry(item, table, e.name, { roll: chosen });

  await ChatMessage.create(ChatMessage.applyRollMode({
    content: `<div class="wh-roll-result pa-chat">
      <div class="roll-header">${esc(PA_TABLES[table].label)} — ${esc(item.name)}</div>
      <div class="roll-dice">к10: <b>${rv}</b>${chosen !== rv ? ` → сдвинуто на <b>${chosen}</b>` : ""}</div>
      <div class="pa-chat-entry"><b>${esc(e?.name || "—")}</b>
        <div class="pa-chat-desc">${esc(e?.desc || "")}</div>
        <div class="pa-chat-effect">${esc(e?.effect || "")}</div></div>
    </div>`,
    rolls: [roll]
  }, game.settings.get("core", "rollMode")));
}

/** Диалог сдвига результата на ±½ Inf.b (окр.▲). */
function promptShift(table, rolled, options) {
  const opts = options.map(v => {
    const e = entryByRoll(table, v);
    return `<option value="${v}" ${v === rolled ? "selected" : ""}>${v} — ${esc(e?.name || "")}</option>`;
  }).join("");
  return new Promise(resolve => {
    let done = false;
    new Dialog({
      title: "Сдвиг результата",
      content: `<form class="hw-choice-form">
        <div class="hw-choice-desc">${esc(PA_SHIFT_RULE)}</div>
        <div class="hw-choice"><div class="hw-choice-label">Выпало ${rolled}. Итог:</div>
          <select id="pa-shift">${opts}</select></div>
      </form>`,
      buttons: {
        ok: { icon: '<i class="fas fa-check"></i>', label: "Принять",
          callback: h => { if (!done) { done = true; resolve(parseInt(h.find("#pa-shift").val()) || rolled); } } },
        keep: { label: "Оставить как есть",
          callback: () => { if (!done) { done = true; resolve(rolled); } } }
      },
      default: "ok",
      close: () => { if (!done) { done = true; resolve(rolled); } }
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "hw-choice-dialog"], width: 420 }).render(true);
  });
}

/** «Уничтоженный и восстановленный»: к10 за каждую зону (1-3 → −1, 8-10 → +1). */
export async function rollArmourZones(item) {
  const zones = {}, rolls = [], lines = [];
  for (const z of PA_ZONES) {
    const r = await new Roll("1d10").evaluate();
    rolls.push(r);
    const v = r.total <= 3 ? -1 : (r.total >= 8 ? 1 : 0);
    zones[z.key] = v;
    lines.push(`${z.label}: к10 = ${r.total} → ${v > 0 ? "+1" : (v < 0 ? "−1" : "без изменений")}`);
  }
  await item.update({ "system.history.zones": zones });
  await ChatMessage.create(ChatMessage.applyRollMode({
    content: `<div class="wh-roll-result pa-chat">
      <div class="roll-header">Уничтоженный и восстановленный — ${esc(item.name)}</div>
      <div class="pa-chat-zones">${lines.map(esc).join("<br/>")}</div>
    </div>`,
    rolls
  }, game.settings.get("core", "rollMode")));
}
