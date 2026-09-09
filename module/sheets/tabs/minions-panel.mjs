// module/sheets/tabs/minions-panel.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Блок «МИНЬОНЫ» на вкладке СОЦИУМ (корбук стр. 111-113).
//
//  Блока нет вовсе, пока не куплен хотя бы один Талант «Миньон Хаоса» И нет
//  уже привязанного слуги: слуг обычно даёт Талант, и пустая панель у того,
//  кто их не покупал, только занимала бы место. Но некоторые находки дают
//  слугу БЕЗ траты слота вовсе (wdbc-1rno, Инфернальный Оруженосец/Рыцарь
//  Бога — «контролировать как Миньона без траты слотов Миньонов») — такой
//  слуга приходит уже привязанным (system.masterUuid), Таланта под него нет
//  и не будет, и панель обязана показать его всё равно.
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
import { hasRuleFlag } from "../../rules/flags.mjs";

/**
 * Возможности, которые дают слугу БЕЗ слота Таланта: четыре Инфернальных
 * Оруженосца (по одному на Бога). Пока блок показывался только при Таланте
 * или УЖЕ привязанном слуге, у такого чемпиона выходил замкнутый круг: зона
 * дропа появлялась лишь после того, как слуга привязан, а привязать его было
 * нечем — лист Миньона умеет только открыть Хозяина (wdbc-8t8).
 */
const SLOTLESS_MINION_CAPS = [
  "gift.khorne.infernalArmiger", "gift.nurgle.infernalArmiger",
  "gift.slaanesh.infernalArmiger", "gift.tzeentch.infernalArmiger"
];

/** Может ли этот актор держать слугу без слота Таланта. */
export function canHoldSlotlessMinion(actor) {
  return SLOTLESS_MINION_CAPS.some(cap => hasRuleFlag(actor, cap));
}

/**
 * Клик по карточке слуги открывает его лист. Обработчик живёт здесь, рядом с
 * панелью: прежде он был общим с панелями «Записей», а тех больше нет.
 *
 * Зона дропа (wdbc-1rno) — тем же приёмом, что ОТНОШЕНИЯ (tabs/social.mjs):
 * перетащенный актор со сцены/боковой панели становится слугой БЕЗ слота —
 * пишет system.masterUuid на САМОМ перетащенном акторе, не на Хозяине. Нужна
 * для находок вроде Инфернального Оруженосца («контролировать как Миньона
 * без траты слотов») — Таланта под такого слугу нет и не будет. Чужого слугу
 * (уже привязан к другому Хозяину) не перехватывает молча.
 */
export function activateMinionPanelListeners(html, actor, root = null) {
  const el = root ?? (html?.jquery ? html[0] : html);
  el?.querySelectorAll?.(".minion-open-link").forEach(node => node.addEventListener("click", async ev => {
    ev.preventDefault();
    const doc = await fromUuid(ev.currentTarget.dataset.uuid).catch(() => null);
    doc?.sheet?.render(true);
  }));

  const zone = el?.querySelector?.(".minion-drop-zone");
  if (!zone || !actor?.uuid) return;
  zone.addEventListener("dragover", ev => { ev.preventDefault(); zone.classList.add("minion-drop-hover"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("minion-drop-hover"));
  zone.addEventListener("drop", async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    zone.classList.remove("minion-drop-hover");
    let data = null;
    try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { /* не наш дроп */ }
    if (!data?.uuid) return;
    const doc = await fromUuid(data.uuid).catch(() => null);
    const target = doc?.documentName === "Token" ? doc.actor : doc;
    if (!target || target.documentName !== "Actor") return;
    if (target.uuid === actor.uuid) return ui.notifications?.warn("Нельзя назначить актора миньоном самому себе.");
    if (target.system?.masterUuid && target.system.masterUuid !== actor.uuid) {
      return ui.notifications?.warn(`${target.name} уже слуга другого Хозяина.`);
    }
    // Поле masterUuid есть только у существ (module/data/actor/_creature.mjs):
    // технику, корабль или Орду Foundry молча выбросит из update, и игрок
    // увидит «ничего не произошло» без объяснения причины.
    if (!("masterUuid" in (target.system ?? {}))) {
      return ui.notifications?.warn(
        `${target.name} не может быть слугой: Хозяин назначается существам, а не технике или кораблю.`);
    }
    await target.update({ "system.masterUuid": actor.uuid });
  });
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
 * Контекст блока. `hasMinionTalent` (несмотря на имя — «есть, что показать»)
 * решает, показывать ли его вообще: Талант, уже привязанный слуга без слота
 * (wdbc-1rno) ИЛИ возможность держать слугу без слота — Инфернальный
 * Оруженосец (wdbc-8t8); `freeSlots` — сколько Талантов ждут своего слугу, и
 * есть ли смысл в «+».
 */
export function minionsPanelContext(actor, actors = []) {
  const items = [...(actor?.items ?? [])];
  const slots = minionSlots(items);
  const minions = minionsOfActor(actor, actors)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "ru"));
  if (!slots.length && !minions.length && !canHoldSlotlessMinion(actor))
    return { hasMinionTalent: false, minionRows: [], freeSlots: [] };

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
    // Слуги, под которых Таланта нет: заведены руками, Талант продан, или
    // Дар выдал слугу без слота (wdbc-1rno) — не ошибка, просто счётчик.
    minionExtra: extra.length,
    // Для зоны дропа в шаблоне (data-actor-uuid) — activateMinionPanelListeners
    // читает его же напрямую с актора, здесь только для рендера атрибута.
    actorUuid: actor?.uuid || ""
  };
}
