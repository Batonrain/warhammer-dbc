// module/apps/mount-grant.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Скакун из стартового снаряжения Архетипа (Дикарь: «Скакун до R1», wdbc-zaesd).
//  Скакун — зверь-актор из Бестиария, а не предмет инвентаря: Мастер создания
//  предлагает выбор из Скакунов с Редкостью не выше указанной (Редкость — по
//  основной книге, флаг flags.warhammer-dbc.mountRarity на актёрах «Скакуны»),
//  импортирует выбранного в мир и сажает владельца в седло (system.mount.uuid —
//  тот же ключ связи, что у панели «ВЕРХОМ»). Набор брони «до R1» — отдельным
//  предметом остаётся указанием ГМу.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";
export const MOUNT_RARITY_FLAG = "mountRarity";
export const BESTIARY_PACK = "warhammer-dbc.bestiary";

/**
 * Скакуны, подходящие под потолок Редкости: [{ id, name, rarity }], по
 * возрастанию Редкости, затем по имени. Берутся записи индекса с флагом Редкости.
 * @param {object[]} index  записи индекса пака ({_id, name, flags})
 * @param {number|null} maxRarity  потолок (null — без потолка)
 */
export function mountCandidates(index, maxRarity = null) {
  return [...(index ?? [])]
    .map(e => ({ id: e._id ?? e.id, name: e.name, rarity: e.flags?.[NS]?.[MOUNT_RARITY_FLAG] }))
    .filter(e => e.id && Number.isFinite(Number(e.rarity)))
    .map(e => ({ ...e, rarity: Number(e.rarity) }))
    .filter(e => maxRarity == null || e.rarity <= Number(maxRarity))
    .sort((a, b) => a.rarity - b.rarity || String(a.name).localeCompare(String(b.name), "ru"));
}

/**
 * Выдать Скакуна: выбор → импорт в мир → связь «всадник — скакун».
 * @param {Actor} rider
 * @param {number|null} maxRarity
 * @param {object} [deps]  подмена для тестов: { pack, pick }
 * @returns {Promise<Actor|null>} созданный Скакун (null — отмена, нет кандидатов)
 */
export async function grantMount(rider, maxRarity, deps = {}) {
  const pack = deps.pack ?? game.packs?.get(BESTIARY_PACK);
  if (!pack) return null;
  const index = await pack.getIndex({ fields: [`flags.${NS}.${MOUNT_RARITY_FLAG}`] });
  const options = mountCandidates([...index], maxRarity);
  if (!options.length) return null;

  const pick = deps.pick ?? (async opts => foundry.applications.api.DialogV2.wait({
    window: { title: `Скакун${maxRarity != null ? ` (Редкость до R${maxRarity})` : ""} — ${rider.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<form style="padding:4px 6px;"><select name="mount" style="width:100%;">${
      opts.map((o, i) => `<option value="${i}">${esc(o.name)} — R${o.rarity}</option>`).join("")}</select></form>`,
    rejectClose: false,
    buttons: [
      { action: "ok", label: "Взять", default: true, callback: (_e, b) => Number(b.form.querySelector('select[name="mount"]')?.value) },
      { action: "cancel", label: "Без Скакуна", callback: () => null }
    ]
  }));
  const idx = await pick(options);
  const chosen = Number.isInteger(idx) ? options[idx] : null;
  if (!chosen) return null;

  const mount = await game.actors.importFromCompendium(pack, chosen.id, { ownership: rider.ownership ?? undefined });
  if (!mount) return null;
  await rider.update({ "system.mount.uuid": mount.uuid, "system.mount.skidUsed": false, "system.mount.bladesUsed": 0 });
  return mount;
}
