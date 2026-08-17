// module/sheets/tabs/minions-panel.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Блок «МИНЬОНЫ» на вкладке СОЦИУМ (корбук стр. 111-113).
//
//  Блока нет вовсе, пока не куплен хотя бы один Талант «Миньон Хаоса»: слуг
//  даёт Талант, и пустая панель у того, кто их не покупал, только занимала бы
//  место.
//
//  В шапке блока — сколько Миньонов какой группы есть и каков максимум:
//  наименьший бонус Характеристики по имеющимся группам (стр. 111). Кнопка «+»
//  появляется, когда Талантов куплено больше, чем заведено слуг: она и
//  запускает генератор.
//
//  Счёт слотов и потолок берутся из rules/minion-build.mjs — там же, откуда их
//  берёт сам генератор.
// ════════════════════════════════════════════════════════════════════════════

import { MINION_GROUPS, MINION_TIERS } from "../../constants/minions.mjs";
import { minionSlots, slotUsage, minionCapacity, groupTally } from "../../rules/minion-build.mjs";

/**
 * Клик по карточке слуги открывает его лист. Обработчик живёт здесь, рядом с
 * панелью: прежде он был общим с панелями «Записей», а тех больше нет.
 */
export function activateMinionPanelListeners(html, root = null) {
  const el = root ?? (html?.jquery ? html[0] : html);
  el?.querySelectorAll?.(".minion-open-link").forEach(node => node.addEventListener("click", async ev => {
    ev.preventDefault();
    const doc = await fromUuid(ev.currentTarget.dataset.uuid).catch(() => null);
    doc?.sheet?.render(true);
  }));
}

/** Акторы, чей Хозяин — этот актор. Ссылку хранит слуга, а не Хозяин. */
export function minionsOfActor(actor, actors = []) {
  if (!actor?.uuid) return [];
  return [...actors].filter(a => a?.system?.masterUuid === actor.uuid);
}

/** Строка слуги для панели: аватар, имя, группа, сила и Лояльность. */
function minionRow(minion) {
  const s = minion.system ?? {};
  const group = s.minionType || "";
  const tier  = s.minionTier || "";
  return {
    uuid: minion.uuid, name: minion.name, img: minion.img,
    groupLabel: MINION_GROUPS[group]?.label || "—",
    tierLabel:  MINION_TIERS[tier]?.label   || "—",
    loyaltyValue: s.loyalty?.value ?? 0,
    loyaltyMax:   s.loyalty?.max   ?? 0,
    // У Орды Миньонов Ран нет — вместо них Магнитуда (стр. 113).
    magnitude: MINION_TIERS[tier]?.isHorde ? (s.magnitude?.value ?? 0) : null
  };
}

/**
 * Контекст блока. `hasMinionTalent` решает, показывать ли его вообще;
 * `freeSlots` — сколько Талантов ждут своего слугу, и есть ли смысл в «+».
 */
export function minionsPanelContext(actor, actors = []) {
  const items = [...(actor?.items ?? [])];
  const slots = minionSlots(items);
  if (!slots.length) return { hasMinionTalent: false, minionRows: [], freeSlots: [] };

  const minions = minionsOfActor(actor, actors)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "ru"));
  const { free, extra } = slotUsage(items, minions);

  // Потолок считается по группам, которые у Хозяина уже есть, и по тем, на
  // которые куплены Таланты: иначе «максимум» рос бы ровно до того мига, когда
  // слуга появится, и тут же падал.
  const groups = [...minions.map(m => m.system?.minionType || ""), ...slots.map(s => s.group)];
  const tally  = groupTally(minions);

  return {
    hasMinionTalent: true,
    minionRows: minions.map(minionRow),
    minionCount: minions.length,
    minionCapacity: minionCapacity(actor, groups),
    // «Человек 2, Демон 1» — счётчик из шапки блока.
    minionTally: Object.entries(tally)
      .map(([key, count]) => ({ key, label: MINION_GROUPS[key]?.label || key, count })),
    freeSlots: free.map(slot => ({
      id: slot.id, talentId: slot.talentId,
      group: slot.group, tier: slot.tier,
      label: slot.group && slot.tier
        ? `${MINION_GROUPS[slot.group]?.label || slot.group}, ${MINION_TIERS[slot.tier]?.label || slot.tier}`
        : "Миньон не выбран"
    })),
    // Слуги, под которых Таланта нет: заведены руками или Талант продан.
    minionExtra: extra.length
  };
}
