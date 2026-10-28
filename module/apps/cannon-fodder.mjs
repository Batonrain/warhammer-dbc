// module/apps/cannon-fodder.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Покупка Таланта «Пушечное Мясо» (Cannon Fodder, корбук стр. 113): «Этот
//  Талант можно взять несколько раз для каждого из Миньонов. Миньон теряет 20
//  Лояльности». Талант хранится на ХОЗЯИНЕ, а штраф получает конкретный слуга,
//  поэтому при покупке спрашивается, КТО он (решение владельца 24.10.2026,
//  Sahara 3-cross-actor): выбор пишется в system.targetMinion копии Таланта,
//  в system.specialization — подпись для списка Талантов.
//
//  Кого можно выбрать: слот Таланта «Миньон Хаоса» хозяина (значение
//  «slot:<id>», работает и до создания слуги, и после замены павшего) и
//  Миньонов хозяина без слота (значение — uuid актора).
// ════════════════════════════════════════════════════════════════════════════

import { minionSlots } from "../rules/minion-build.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import { minionSlotLabel } from "./minion-talent.mjs";
import { esc } from "../helpers/utils.mjs";

/** Копия Таланта «Пушечное Мясо»? */
export const isCannonFodder = item => item?.type === "talent" && itemHasName(item, "Cannon Fodder");

/**
 * Кандидаты на роль «пушечного мяса» у хозяина: [{ value, label }].
 * Слот занят живым Миньоном — подписываем его именем, чтобы игрок узнал слугу.
 */
export function cannonFodderOptions(actor, minions = null) {
  const owned = minions ?? [...(game.actors ?? [])]
    .filter(a => a?.type === "minion" && a.system?.masterUuid === actor?.uuid);
  const options = [];
  const bySlot = new Map();
  for (const m of owned) if (m.system?.slotTalentId) bySlot.set(m.system.slotTalentId, m);
  for (const slot of minionSlots(actor?.items ?? [])) {
    const live = bySlot.get(slot.talentId);
    const kind = slot.group && slot.tier ? minionSlotLabel(slot.group, slot.tier) : "слот без пары";
    options.push({ value: `slot:${slot.talentId}`, label: live ? `${live.name} — ${kind}` : `${kind} (ещё не создан)` });
  }
  for (const m of owned) {
    if (m.system?.slotTalentId) continue;
    options.push({ value: m.uuid, label: m.name });
  }
  return options;
}

/** Диалог выбора слуги. null — отмена (или выбирать некого). */
export async function promptCannonFodderMinion(actor, doc) {
  const options = cannonFodderOptions(actor);
  if (!options.length) {
    ui.notifications?.warn("У хозяина нет ни купленного «Миньона Хаоса», ни созданного Миньона — Пушечное Мясо брать не на кого.");
    return null;
  }
  const rows = options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");
  const value = await foundry.applications.api.DialogV2.prompt({
    window: { title: `${doc?.name || "Пушечное Мясо"}: чей Миньон` },
    content: `<div class="atk-dlg-row"><label>Миньон:</label>
      <select name="target" class="pm-input pm-wide">${rows}</select></div>
      <p class="dyn-hint">Этот слуга потеряет 20 Лояльности (стр. 113). Талант берётся отдельно на каждого Миньона.</p>`,
    ok: { label: "Купить", callback: (event, button) => button.form.elements.target.value },
    rejectClose: false
  });
  if (!value) return null;
  const picked = options.find(o => o.value === value);
  return { target: value, label: picked?.label || value };
}

/**
 * Модель выпадающего списка на листе Таланта: кандидаты + текущий выбор.
 * Выбор, которого нет среди кандидатов (слот «Миньон Хаоса» пересоздан и его
 * id сменился, слуга удалён), НЕ теряется молча: он остаётся в списке
 * пометкой, чтобы игрок увидел, что Талант больше ни на кого не указывает, и
 * выбрал нового слугу.
 *
 * @param {{value:string,label:string}[]} options  cannonFodderOptions(актор)
 * @param {string} current                         system.targetMinion
 */
export function cannonFodderSelectModel(options, current) {
  const cur = String(current ?? "");
  const rows = options.map(o => ({ ...o, selected: o.value === cur }));
  const stale = !!cur && !rows.some(o => o.selected);
  if (stale) rows.unshift({ value: cur, label: "⚠ слуга не найден — выберите заново", selected: true });
  else if (!cur) rows.unshift({ value: "", label: "— не выбран —", selected: true });
  return { rows, stale };
}

/** Панель «чей Миньон» для листа Таланта; пусто у прочих Талантов и у предмета вне актора. */
export function cannonFodderPanelHtml(item, actor) {
  if (!actor || !isCannonFodder(item)) return "";
  const { rows, stale } = cannonFodderSelectModel(cannonFodderOptions(actor), item.system?.targetMinion);
  const opts = rows.map(o => `<option value="${esc(o.value)}"${o.selected ? " selected" : ""}>${esc(o.label)}</option>`).join("");
  return `<div class="talent-action-panel">
    <div class="talent-action-status">${stale
      ? "Выбранный слуга больше не найден (слот пересоздан или Миньон удалён) — штраф Лояльности ни к кому не применяется."
      : "Этот слуга теряет 20 Лояльности (стр. 113)."}</div>
    <select class="cannon-fodder-pick" data-item-id="${esc(item.id)}">${opts}</select>
  </div>`;
}

/** Сменить слугу: поле выбора и подпись для списка Талантов (system.specialization) пишутся вместе. */
export async function setCannonFodderMinion(item, value) {
  const actor = item?.parent;
  const picked = cannonFodderOptions(actor).find(o => o.value === value);
  // Пометка «слуга не найден»/«не выбран» не выбор: ничего не пишем, прежнее значение остаётся.
  if (!picked) return false;
  await item.update({ "system.targetMinion": picked.value, "system.specialization": picked.label });
  return true;
}

/** Записать выбор в копию предмета перед созданием на листе. */
export function applyCannonFodderPick(obj, pick) {
  obj.system = obj.system || {};
  obj.system.targetMinion = pick.target;
  obj.system.specialization = pick.label;
  return obj;
}
