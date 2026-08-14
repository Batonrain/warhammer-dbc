// module/apps/minions.mjs
// ════════════════════════════════════════════════════════════════════════
//  Миньоны (корбук стр. 111-113).
//
//  Миньон — НЕ отдельный тип актора: это обычный Персонаж или Демон, у
//  которого проставлен Хозяин (system.masterUuid), тип, уровень и Лояльность.
//  Лист у него свой обычный целиком — характеристики, навыки и снаряжение
//  задаются по таблицам книги вручную, как у любого актора.
//
//  Ссылку хранит МИНЬОН, а не Хозяин, и список миньонов собирается перебором
//  акторов. Хранить список на Хозяине значило бы держать одну связь в двух
//  документах: удалённый миньон оставлял бы висячую строку, а перепривязка
//  требовала бы двух правок вместо одной.
//
//  Базовую Лояльность даёт ЗНАЧЕНИЕ (total, не бонус) характеристики Хозяина,
//  своей у каждой группы миньонов (стр. 111): F у человека, P у зверя,
//  I у машины, W у демона.
//
//  Функции принимают актора и список акторов мира, а не game — поэтому
//  проверяются без запуска Foundry. Foundry остаётся только в
//  syncMinionLoyalty() и обработчиках панели.
// ════════════════════════════════════════════════════════════════════════

export const MINION_TYPES = {
  human:   { label: "Человек", masterChar: "fel" },
  beast:   { label: "Зверь",   masterChar: "per" },
  machine: { label: "Машина",  masterChar: "int" },
  daemon:  { label: "Демон",   masterChar: "wp"  }
};

export const MINION_TIERS = {
  lesser:   "Низший",
  standard: "Обычный",
  greater:  "Высший",
  horde:    "Орда Миньонов",
  superior: "Превосходящий Миньон"
};

/** Кто может иметь миньонов и кто может быть миньоном. */
export const MASTER_ACTOR_TYPES = ["character", "daemon", "demonPrince"];
export const MINION_ACTOR_TYPES = ["character", "daemon"];

/** Акторы, чей masterUuid указывает на этого — его миньоны. */
export function minionsOf(actor, actors = []) {
  if (!actor?.uuid) return [];
  return [...actors].filter(a => a?.system?.masterUuid === actor.uuid);
}

/** Базовая Лояльность миньона — значение нужной характеристики Хозяина. */
export function baseLoyaltyFor(master, minionType) {
  const charKey = MINION_TYPES[minionType]?.masterChar;
  if (!charKey || !master) return 0;
  return Number(master.system?.characteristics?.[charKey]?.total) || 0;
}

/**
 * Новое значение Лояльности после прибавки. Ниже нуля не опускается, а выше
 * максимума — только если максимум задан: у миньона, которому Лояльность ещё
 * не считали, max равен нулю, и потолок в ноль обнулял бы любую прибавку.
 */
export function loyaltyAfterChange(minion, delta) {
  const cur = Number(minion?.system?.loyalty?.value) || 0;
  const max = Number(minion?.system?.loyalty?.max)   || 0;
  const next = cur + (Number(delta) || 0);
  return Math.max(0, max ? Math.min(max, next) : next);
}

/** Контекст панелей «МИНЬОН» и «МОИ МИНЬОНЫ» для вкладки ЗАПИСИ. */
export function minionsContext(actor, actors = []) {
  const s = actor?.system ?? {};
  const masterUuid = s.masterUuid || "";
  const byName = (a, b) => String(a.name).localeCompare(String(b.name), "ru");

  return {
    isMinionCapable: MINION_ACTOR_TYPES.includes(actor?.type),
    canHaveMinions:  MASTER_ACTOR_TYPES.includes(actor?.type),
    masterUuid,
    // Хозяином может быть кто угодно из подходящих типов, кроме самого актора:
    // сам себе Хозяином быть нельзя, и список не должен это предлагать.
    masterOptions: [...actors]
      .filter(a => MASTER_ACTOR_TYPES.includes(a?.type) && a.id !== actor?.id)
      .sort(byName)
      .map(a => ({ uuid: a.uuid, name: a.name, selected: a.uuid === masterUuid })),
    minionTypeOptions: Object.entries(MINION_TYPES)
      .map(([key, def]) => ({ key, label: def.label, selected: s.minionType === key })),
    minionTierOptions: Object.entries(MINION_TIERS)
      .map(([key, label]) => ({ key, label, selected: s.minionTier === key })),
    minionLoyaltyValue: s.loyalty?.value ?? 0,
    minionLoyaltyMax:   s.loyalty?.max   ?? 0,
    myMinions: minionsOf(actor, actors).sort(byName).map(m => ({
      uuid: m.uuid, name: m.name,
      typeLabel: MINION_TYPES[m.system.minionType]?.label || "—",
      tierLabel: MINION_TIERS[m.system.minionTier] || "—",
      loyaltyValue: m.system.loyalty?.value ?? 0,
      loyaltyMax:   m.system.loyalty?.max   ?? 0
    }))
  };
}

/** Кнопка «🔄»: пересчитать Лояльность (и текущую, и максимум) от Хозяина. */
export async function syncMinionLoyalty(actor) {
  const masterUuid = actor.system?.masterUuid;
  if (!masterUuid) return ui.notifications?.warn("У этого актора не выбран Хозяин.");
  const master = await fromUuid(masterUuid).catch(() => null);
  if (!master) return ui.notifications?.warn("Хозяин не найден — возможно, был удалён.");
  if (!actor.system?.minionType) return ui.notifications?.warn("Не выбран Тип миньона.");
  const base = baseLoyaltyFor(master, actor.system.minionType);
  await actor.update({ "system.loyalty.max": base, "system.loyalty.value": base });
}

/** Обработчики панели — общие для листов Персонажа, Демона и Принца Демонов. */
export function activateMinionListeners(html, actor) {
  html.find(".minion-loyalty-sync-btn").on("click", async ev => {
    ev.preventDefault();
    await syncMinionLoyalty(actor);
  });
  html.find(".minion-open-link").on("click", async ev => {
    const doc = await fromUuid(ev.currentTarget.dataset.uuid).catch(() => null);
    doc?.sheet?.render(true);
  });
}
