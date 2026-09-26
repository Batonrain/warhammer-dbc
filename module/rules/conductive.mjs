// module/rules/conductive.mjs
//
// «Электропроводящие броня и оружие» (Электродуга, Книга Аэльдари:
// Ответвления; wdbc-3hgd0): «Если он использует электропроводящую броню и
// оружие, его рукопашные атаки также получают это свойство». Броня —
// свойство брони Conductive / Проводящая (constants/items.mjs), оружие —
// свойство оружия «Электропроводящее» (constants/weapon-properties.mjs,
// conductive). Нужно и то, и другое. Чистая логика.

/** Надета ли броня со свойством Conductive. */
export function wearsConductiveArmour(actor) {
  return [...(actor?.items ?? [])].some(i =>
    i?.type === "armor" && i.system?.equipped && (i.system?.properties || []).includes("conductive"));
}

/** Есть ли у оружия свойство «Электропроводящее». */
export function isConductiveWeapon(item) {
  return (item?.system?.weaponProps || []).some(p => (p?.key ?? p) === "conductive");
}

/** Атака этим оружием — «электропроводящим оружием в электропроводящей броне». */
export function conductiveMeleeOf(actor, item) {
  return wearsConductiveArmour(actor) && isConductiveWeapon(item);
}
