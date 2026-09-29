// module/apps/scrounge.mjs
// ════════════════════════════════════════════════════════════════════════
//  Наскрести (Изгой) — Foundry-обвязка к module/rules/scrounge.mjs. Зовёт её
//  kind:"script" Черты (кнопка «▶ Запустить», цена — 1 Очко Бесчестия,
//  списывается после успешного кода): бросок 2d10 в чат и Обозреватель
//  компендиумов на эту добычу до R2 — категория за категорией, пока не
//  кончится число или игрок не скажет «Хватит». Отмена ДО броска — throw,
//  Очко остаётся; после броска добыча уже выпала, Очко тратится.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { openCompendiumBrowser } from "./compendium-browser.mjs";
import {
  SCROUNGE_DICE, SCROUNGE_MAX_AVAILABILITY, SCROUNGE_CATEGORIES, scroungeRemaining, scroungeFilters
} from "../rules/scrounge.mjs";

async function pickCategory(left) {
  const res = await foundry.applications.api.DialogV2.wait({
    window: { title: `Наскрести — осталось ${left}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<p style="margin:4px 6px;">Добыто ещё <b>${left}</b> расходников до R${SCROUNGE_MAX_AVAILABILITY}. Из чего выбрать?</p>`,
    rejectClose: false,
    buttons: [
      ...SCROUNGE_CATEGORIES.map((c, i) => ({ action: c.key, label: c.label, default: i === 0 })),
      { action: "done", label: "Хватит" }
    ]
  });
  return SCROUNGE_CATEGORIES.find(c => c.key === res) ?? null;
}

/** Создать выбранное: одинаковые записи — одним предметом с количеством. */
async function grantPicked(actor, uuids) {
  const counts = new Map();
  for (const u of uuids) counts.set(u, (counts.get(u) || 0) + 1);
  const names = [];
  for (const [uuid, qty] of counts) {
    const src = await fromUuid(uuid).catch(() => null);
    if (!src) continue;
    const data = src.toObject();
    delete data._id;
    if ("quantity" in (data.system || {})) data.system.quantity = qty;
    await actor.createEmbeddedDocuments("Item", [data]);
    names.push(`${esc(src.name)}${qty > 1 ? ` ×${qty}` : ""}`);
  }
  return names;
}

/**
 * Кнопка Черты: 2d10 расходников до R2.
 * @param {Actor} actor Изгой
 */
export async function scroungeSupplies(actor) {
  if (!actor) throw new Error("Нет персонажа-владельца Черты.");
  const ok = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Наскрести" },
    content: `<p>Потратить смену работы и Очко Бесчестия, чтобы добыть ${SCROUNGE_DICE} расходников до R${SCROUNGE_MAX_AVAILABILITY}?</p>`,
    yes: { label: "Наскрести" }, no: { label: "Отмена" }
  });
  if (!ok) throw new Error("Отменено — Очко Бесчестия не потрачено.");

  const roll = await new Roll(SCROUNGE_DICE).evaluate();
  const total = roll.total;
  let left = total;
  const got = [];
  while (left > 0) {
    const cat = await pickCategory(left);
    if (!cat) break;
    const picked = await openCompendiumBrowser(false, {
      pack: cat.pack, filters: scroungeFilters(cat), budget: { mode: "count", value: left, min: 1 },
      prompt: `Наскрести: ${cat.label} — до ${left} шт., до R${SCROUNGE_MAX_AVAILABILITY}`
    });
    const list = (Array.isArray(picked) ? picked : [picked]).filter(Boolean);
    if (!list.length) continue;
    got.push(...await grantPicked(actor, list));
    left = scroungeRemaining(left, list.length);
  }

  await postTestCard(actor, {
    icon: rollIcon("gear", "#c9a86a"),
    title: `${esc(actor.name)} — Наскрести`,
    lines: [
      `<div class="roll-threshold">Смена работы: добыто <b>${total}</b> расходников до R${SCROUNGE_MAX_AVAILABILITY} (${SCROUNGE_DICE}).</div>`,
      got.length ? `<div>Взято: ${got.join(", ")}.</div>` : "",
      left > 0 ? `<div>Не выбрано: <b>${left}</b> — можно дописать на лист вручную.</div>` : ""
    ]
  }, { rolls: [roll] });
}
