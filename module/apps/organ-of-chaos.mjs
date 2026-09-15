// module/apps/organ-of-chaos.mjs
// ════════════════════════════════════════════════════════════════════════
//  Мутация «Organ of Chaos/Орган Хаоса» (Общие Мутации, wdbc-1rno): «Даёт
//  Трейт Unnatural Characteristic (+1) соответственно заменённому органу и
//  демону по решению ГМа и незначительную способность... по решению ГМа.»
//
//  Книга не называет ни характеристику, ни малую способность — ГМ выбирает
//  их заново на КАЖДУЮ выдачу (примеры «язык Демонетки → Unnatural F» и
//  «рога Кровопускателя»/«когти Фурии»/«глаз Чумоноса» — не формула). Значит
//  фиксировать одну запись в компендиумном шаблоне значило бы придумывать
//  за ГМа. Вместо этого — кнопка «Настроить Орган» на КОНКРЕТНОМ экземпляре
//  предмета у конкретного персонажа: ГМ выбирает характеристику из списка и
//  вписывает малую способность текстом, код дописывает ей же самой запись
//  kind:"characteristic" (charKey/field:"bonus"/value:1 — то же «Unnatural
//  X (+1)», что уже даёт этот вид записи везде в системе, blankMechEntry) —
//  тот же приём выбора-при-выдаче, что apps/hand-of-khorne.mjs::setApEntry
//  (найти-или-создать запись по фиксированному id, чтобы повторная
//  настройка ПЕРЕЗАПИСЫВАЛА, а не копила дубли).
//
//  Малая способность («поцелуй считается попаданием со свойством
//  Hallucinogenic(0)» и т.п.) — свободный текст, не механизирована: она
//  меняется от органа к органу настолько, что общего вида записи под неё
//  нет и не должно быть — записывается в system.notes самого предмета,
//  видна на листе как обычное текстовое поле Мутации.
// ════════════════════════════════════════════════════════════════════════

import { itemIs } from "../rules/item-marker.mjs";
import { getItemMechanics, blankMechEntry, syncMechanicsEffects } from "./mechanics.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const NAME = "Organ of Chaos";
const ENTRY_ID = "organ-of-chaos-unnatural";

/** Это предмет-Мутация «Орган Хаоса»? */
export function isOrganOfChaosItem(item) {
  return itemIs(item, "mutation", "mutation.organOfChaos", NAME);
}

/** Уже выбранная характеристика ("" — ещё не настроена). */
function chosenCharKey(item) {
  for (const g of getItemMechanics(item)) {
    for (const e of g.entries || []) if (e.id === ENTRY_ID) return e.charKey || "";
  }
  return "";
}

/** Пишет/обновляет запись kind:"characteristic" (Unnatural X +1) на этом экземпляре предмета. */
async function setUnnaturalEntry(item, charKey) {
  const abbr = CHARACTERISTICS[charKey]?.abbr || charKey;
  const groups = foundry.utils.deepClone(getItemMechanics(item));
  let found = false;
  for (const g of groups) {
    for (const e of g.entries || []) {
      if (e.id === ENTRY_ID) {
        e.charKey = charKey; e.field = "bonus"; e.op = "add"; e.value = 1;
        e.label = `Unnatural ${abbr} (+1) — Орган Хаоса`;
        found = true;
      }
    }
  }
  if (!found) {
    const entry = blankMechEntry("characteristic");
    entry.id = ENTRY_ID;
    entry.charKey = charKey; entry.field = "bonus"; entry.op = "add"; entry.value = 1;
    entry.label = `Unnatural ${abbr} (+1) — Орган Хаоса`;
    groups.push({ id: foundry.utils.randomID(), operator: "AND", entries: [entry] });
  }
  await item.setFlag("warhammer-dbc", "mechanics", groups);
  await syncMechanicsEffects(item);
}

/** Диалог: какая Характеристика получает Unnatural (+1) + текст малой способности. */
async function promptOrgan(current, currentNotes) {
  const opts = Object.entries(CHARACTERISTICS)
    .map(([key, def]) => `<option value="${key}" ${key === current ? "selected" : ""}>${esc(def.label)} (${def.abbr})</option>`)
    .join("");
  const content = `<form class="wh-attack-form" style="padding:6px;">
    <div class="atk-dlg-row"><label>Unnatural Characteristic (+1):</label>
      <select id="ooc-char" class="pm-input">${opts}</select></div>
    <div class="atk-dlg-row" style="align-items:flex-start;"><label>Малая способность (текст):</label>
      <textarea id="ooc-ability" class="pm-input" rows="3" placeholder="напр. поцелуй считается попаданием со свойством Hallucinogenic (0)">${esc(currentNotes || "")}</textarea></div>
    <div class="sq-hint">Книга не даёт формулы — ГМ выбирает орган/демона и решает оба поля на месте выдачи (стр. 440-452).</div>
  </form>`;
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Орган Хаоса" },
    classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog"],
    content,
    rejectClose: false,
    buttons: [
      {
        action: "ok", label: "Настроить", icon: "fas fa-eye", default: true,
        callback: (event, button) => ({
          charKey: String(button.form.querySelector("#ooc-char").value || ""),
          ability: String(button.form.querySelector("#ooc-ability").value || "")
        })
      },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
}

/** Нажатие кнопки на листе Мутации. */
export async function useOrganOfChaos(actor, item) {
  if (!isOrganOfChaosItem(item)) return;
  const picked = await promptOrgan(chosenCharKey(item), item.system?.notes);
  if (!picked || !picked.charKey) return;

  await setUnnaturalEntry(item, picked.charKey);
  await item.update({ "system.notes": picked.ability });

  const abbr = CHARACTERISTICS[picked.charKey]?.abbr || picked.charKey;
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("bolt", "#8fd0ff")}Орган Хаоса — ${esc(actor?.name || "")}</div>
      <div class="roll-threshold">Unnatural ${abbr} (+1) закреплён за этим органом.</div>
      ${picked.ability ? `<div class="roll-threshold">Малая способность: ${esc(picked.ability)}</div>` : ""}
    </div>`
  }, game.settings.get("core", "rollMode")));
}

/** Кнопка/статус для листа предмета — пусто, если это не «Орган Хаоса». */
export function organOfChaosButtonHtml(item, actor) {
  if (!isOrganOfChaosItem(item)) return "";
  const charKey = chosenCharKey(item);
  const status = charKey
    ? `${rollIcon("bolt", "#8fd0ff")}Unnatural <b>${esc(CHARACTERISTICS[charKey]?.abbr || charKey)}</b> (+1)`
    : "Орган ещё не настроен ГМом.";
  return `<div class="hand-of-death-panel">
    <div class="hand-of-death-status">${status}</div>
    <button type="button" class="organ-of-chaos-btn" data-item-id="${item.id}">
      ${rollIcon("bolt", "#8fd0ff")}${charKey ? "Перенастроить орган" : "Настроить орган"}
    </button>
  </div>`;
}
