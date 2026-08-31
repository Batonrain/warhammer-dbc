// test/support/combat-fixtures.mjs
//
// Подставные актор, оружие и боеприпас для тестов атаки. Ровно те поля, которые
// читает module/combat/: ни документов Foundry, ни компендиумов.
//
// Значения по умолчанию взяты не с потолка, а с болтера и цепного меча из книги —
// так тест читается как боевой сценарий, а не как набор чисел.

/** Записать значение по пути «system.magazineCur» — это делает item.update(). */
function setPath(obj, path, value) {
  const keys = path.split(".");
  let cur = obj;
  for (const k of keys.slice(0, -1)) cur = (cur[k] ??= {});
  cur[keys.at(-1)] = value;
}

/** Характеристика в формате листа: важен только bonus (десятки). */
export const char = total => ({ total, bonus: Math.floor(total / 10) });

/**
 * Актор-стрелок. `items` — предметы на нём (оружие, боеприпас, модификации,
 * Черты): коллекция итерируется и отвечает на `.get(id)`, как у Foundry.
 */
export function actorFor({ items = [], ...system } = {}) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  return {
    id: "actor-1",
    name: "Подставной",
    system: {
      characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35) },
      corruption: { value: 0 },
      corruptionBonus: 0,
      ...system
    },
    items: list
  };
}

/** Оружие. Умеет `update()` — атака списывает патроны и метит Перезарядку. */
export function weaponFor(system = {}, { id = "weapon-1", name = "Болтер", flags = {} } = {}) {
  const item = {
    id, name,
    system: {
      weaponClass: "basic", weaponType: "", damage: "1d10+5", damageType: "X",
      penetration: 4, rof_single: 1, rof_semi: 2, rof_full: 0,
      magazineCur: 24, magazineMax: 24, weaponProps: [],
      ...system
    },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async update(data) { for (const [path, value] of Object.entries(data)) setPath(item, path, value); }
  };
  return item;
}

/** Заряженный боеприпас: оружие ссылается на него через system.loadedAmmoId. */
export function ammoFor(system = {}, { id = "ammo-1", name = "Боеприпас" } = {}) {
  return { id, name, type: "ammo", system: { properties: [], ...system }, getFlag: () => undefined };
}

/** Черта или Талант на акторе — их читает поиск флага «сдвинуть место попадания». */
export function traitFor(name, flags = {}) {
  return { id: `trait-${name}`, name, type: "trait", system: {}, getFlag: (scope, key) => flags[`${scope}.${key}`] };
}

/** Цели броска (game.user.targets): атака смотрит, не техника ли перед ней. */
export function setTargets(actors = []) {
  globalThis.game.user = { ...globalThis.game.user, targets: new Set(actors.map(actor => ({ actor }))) };
}
