// module/combat/ship-node-damage.mjs
// ─────────────────────────────────────────────────────────────────────────────
//  РЕАКЦИЯ НА ПОВРЕЖДЕНИЕ УЗЛА КОРАБЛЯ (wdbc-qhwb, продолжение wdbc-jr93)
//  system.status узла (component) — «Невредим/Обесточен/Повреждён/Уничтожен» —
//  уже существует и читается в module/rules/ship.mjs::prepareShipDerived, но
//  ГМ выставляет его вручную (select на листе узла) и до сих пор ничего на
//  эту смену не реагировало. Три директивы (explosive/fragileEngine/
//  robustDesign) — реакции именно на ЭТОТ переход, регистрируются хуком
//  updateItem в module/hooks.mjs, читают эту чистую функцию.
//
//  resolveNodeDamage — чистая функция (без Foundry внутри), принимает уже
//  разрешённые свойства узла (resolveShipProps) + kind + старый/новый статус
//  + инжектируемую rollFn(formula) → Promise<number> (обёртка над Foundry
//  Roll, подменяется в тестах на детерминированную) — тестируется без мира,
//  как module/combat/armor-properties.mjs.
// ─────────────────────────────────────────────────────────────────────────────

const ENGINE_KINDS = ["drive", "warp"];

/**
 * @param {{key:string, rating?:number, def:object}[]} props  resolveShipProps(item)
 * @param {string} kind    item.system.kind
 * @param {string} oldStatus
 * @param {string} newStatus
 * @param {(formula:string) => Promise<number>} rollFn
 * @returns {Promise<{forceStatus?:string, explosionDamage?:string, revertStatus?:string, note?:string}>}
 */
export async function resolveNodeDamage(props, kind, oldStatus, newStatus, rollFn) {
  if (oldStatus === newStatus) return {};

  // Хрупкий Двигатель: крит по двигателю/варп-двигателю всегда считается как
  // разрушение (результат 8–10 таблицы «Пролом в корпусе»), не «Повреждён».
  if (newStatus === "damaged" && ENGINE_KINDS.includes(kind) && props.some(p => p.key === "fragileEngine")) {
    return { forceStatus: "destroyed", note: "Хрупкий Двигатель: повреждение сразу считается разрушением." };
  }

  const enteringDamage = (newStatus === "damaged" || newStatus === "destroyed")
    && (oldStatus === "intact" || oldStatus === "unpowered");
  if (!enteringDamage) return {};

  // Надёжная конструкция: спасбросок 1d10 ≥ X отменяет эффект — узел остаётся
  // в прежнем состоянии.
  const robust = props.find(p => p.key === "robustDesign");
  if (robust) {
    const roll = await rollFn("1d10");
    const x = Number(robust.rating) || 0;
    if (roll >= x) {
      return { revertStatus: oldStatus, note: `Надёжная конструкция: 1d10 = ${roll} ≥ ${x} — узел спасён.` };
    }
  }

  // Взрывоопасный: 10% (1d10 = 10) — узел уничтожен, кораблю 2d5 урона Прочности.
  if (props.some(p => p.key === "explosive")) {
    const roll = await rollFn("1d10");
    if (roll === 10) {
      return { forceStatus: "destroyed", explosionDamage: "2d5", note: `Взрывоопасный: 1d10 = 10 — детонация!` };
    }
  }

  return {};
}

/**
 * Применяет урон Прочности корпуса кораблю: HI и экипаж (CP/CM) теряют по
 * фактически снятой Прочности. Общий helper — переиспользуется и кнопкой
 * «Применить урон Прочности» в чате (module/hooks.mjs), и авто-взрывом
 * Explosive выше, чтобы формула не дублировалась в двух местах.
 * @param {Actor} actor  корабль (изменяемый сразу)
 * @param {number} dmg
 * @returns {Promise<{cur:number, next:number, lost:number}>}
 */
export async function applyHullDamage(actor, dmg) {
  const d    = Number(dmg) || 0;
  const cur  = Number(actor.system.hullIntegrity?.value) || 0;
  const next = Math.max(0, cur - d);
  const lost = cur - next;
  const cp   = Number(actor.system.crew?.population) || 0;
  const cm   = Number(actor.system.crew?.morale) || 0;
  await actor.update({
    "system.hullIntegrity.value": next,
    "system.crew.population":     Math.max(0, cp - lost),
    "system.crew.morale":         Math.max(0, cm - lost)
  });
  return { cur, next, lost };
}
