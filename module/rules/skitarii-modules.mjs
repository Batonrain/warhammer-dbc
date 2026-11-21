// module/rules/skitarii-modules.mjs
//
// Модули Кибернетики Скитарии (корбук, «Кибернетика Скитарии»): «В Скитария
// можно установить не более ½ T.b (окр.▲) Модулей… или получает штраф –30 на
// все действия». Чистая арифметика — ни Foundry, ни одного импорта: её читает предикат rules/predicates.mjs::skitariiModulesOverLimit,
// а правило-штраф живёт данными в rules/library/skitarii.mjs.
//
// Таланты, двигающие лимит (группа «Скитарии»):
//  - Skitarii Alpha — «увеличивает максимум установленных и активных Модулей на 1»;
//  - Shifting Mantle — «можно установить до 2 дополнительных Модулей сверх лимита
//    (не увеличивая максимум активных)»; отключённый Модуль «не даёт бонусов/
//    штрафов и не мешает» — тот же флаг disabled импланта, что гасит его эффекты
//    (rules/item-gates.mjs::isImplantActive);
//  - Cyberdeacon — «может устанавливать кибернетику Механикум (кроме Энергосистем
//    и Фреймов) как Модули Лат Скитарии»: такая кибернетика считается в лимит.

const NS = "warhammer-dbc";

/** Сами Латы — основа, не Модуль. */
const WAR_PLATE_RE = /skitarii war plate|боевые латы скитарии/i;

/** Кибернетика Механикум, которую Кибердьякон ставит Модулем (Энергосистемы — mechEnergy — нет). */
export const CYBERDEACON_CATEGORIES = ["mechOther", "mechFocus"];

/** Флаг «в этом Ходу Мантия уже переключала» — {combatId, round, turn}. */
export const MANTLE_SWAP_FLAG = "shiftingMantleSwap";

/** Модуль ли это (с учётом Кибердьякона). */
export function isSkitariiModule(item, { cyberdeacon = false } = {}) {
  if (item?.type !== "implant") return false;
  const cat = item.system?.category;
  if (cat === "skitarii") return !WAR_PLATE_RE.test(String(item.name ?? ""));
  return !!cyberdeacon && CYBERDEACON_CATEGORIES.includes(cat);
}

const installed = item => !!item?.getFlag?.(NS, "installed");

/**
 * Лимиты: active — сколько Модулей может действовать, installed — сколько
 * может стоять в теле (Мантия: +2 «про запас», выключенными).
 */
export function moduleLimits({ tb = 0, alpha = false, mantle = false } = {}) {
  const active = Math.ceil(Math.max(0, Number(tb) || 0) / 2) + (alpha ? 1 : 0);
  return { active, installed: active + (mantle ? 2 : 0) };
}

/** Установленные/действующие Модули актора. */
export function moduleCounts(actor, { cyberdeacon = false } = {}) {
  const mods = [...(actor?.items ?? [])].filter(i => isSkitariiModule(i, { cyberdeacon }) && installed(i));
  // «Действует» — установлен и не отключён; подавление Дискордантом модуль не
  // снимает с лимита (он стоит и включён, просто глушится полем).
  const active = mods.filter(i => !i.getFlag?.(NS, "disabled"));
  return { installed: mods.length, active: active.length, modules: mods };
}

/**
 * Перегружен ли Скитарий: действующих больше лимита активных или установленных
 * больше лимита установленных. Без Мантии оба лимита равны, и выключенный
 * Модуль всё равно занимает место.
 */
export function modulesOverLimit(actor, { alpha = false, mantle = false, cyberdeacon = false } = {}) {
  const tb = actor?.system?.characteristics?.t?.bonus ?? 0;
  const lim = moduleLimits({ tb, alpha, mantle });
  const c = moduleCounts(actor, { cyberdeacon });
  return c.installed > lim.installed || c.active > lim.active;
}

/** Ключ Хода: Мантия переключает «раз в Ход»; вне боя — без ограничения. */
export function mantleTurnKey(combat) {
  if (!combat?.id) return null;
  return { combatId: combat.id, round: combat.round ?? 0, turn: combat.turn ?? 0 };
}

/**
 * Можно ли сейчас переключить Модуль Мантией: «раз в Ход … отключить один
 * Модуль и/или включить другой» — за Ход одно выключение и одно включение.
 * @param {"off"|"on"} dir
 */
export function mantleSwapAllowed(actor, combat, dir) {
  const key = mantleTurnKey(combat);
  if (!key) return true;
  const used = actor?.getFlag?.(NS, MANTLE_SWAP_FLAG);
  const same = used && used.combatId === key.combatId && used.round === key.round && used.turn === key.turn;
  return !(same && used[dir]);
}

/** Новое значение флага Хода после переключения (null — вне боя, писать нечего). */
export function mantleSwapMark(actor, combat, dir) {
  const key = mantleTurnKey(combat);
  if (!key) return null;
  const used = actor?.getFlag?.(NS, MANTLE_SWAP_FLAG);
  const same = used && used.combatId === key.combatId && used.round === key.round && used.turn === key.turn;
  return { ...key, off: same ? !!used.off : false, on: same ? !!used.on : false, [dir]: true };
}

/** Есть ли у актора Талант (английское имя — начало двуязычного «En / Ру»). */
function talentNamed(actor, en) {
  const low = en.toLowerCase();
  return [...(actor?.items ?? [])].some(i => i?.type === "talent"
    && String(i.name ?? "").toLowerCase().split("/")[0].trim() === low);
}

/** Таланты Скитариев, влияющие на Модули. */
export function skitariiModuleTalents(actor) {
  return {
    alpha: talentNamed(actor, "Skitarii Alpha"),
    mantle: talentNamed(actor, "Shifting Mantle"),
    cyberdeacon: talentNamed(actor, "Cyberdeacon")
  };
}

/**
 * Сводка для листа: null — у актора нет ни одного Модуля (строку не показываем).
 * @returns {{active:number, activeMax:number, installed:number, installedMax:number,
 *            over:boolean, mantle:boolean, ids:Set<string>}|null}
 */
export function skitariiModuleSummary(actor) {
  const t = skitariiModuleTalents(actor);
  const c = moduleCounts(actor, t);
  if (!c.installed) return null;
  const lim = moduleLimits({ tb: actor?.system?.characteristics?.t?.bonus ?? 0, ...t });
  return {
    active: c.active, activeMax: lim.active, installed: c.installed, installedMax: lim.installed,
    over: c.installed > lim.installed || c.active > lim.active, mantle: t.mantle,
    ids: new Set(c.modules.map(i => i.id))
  };
}

// ── Дар Омниссии ────────────────────────────────────────────────────────────
// «Подключившись к электросети и имея нужные сырые материалы, Скитарий за смену
// работы без инструментов и тестов может создать или перезарядить магазин для
// оружия Механикум или любого SP оружия». Оружие Механикум в паке — папка
// weapons/Имперское/Стрелковое/Механикум; на листе папки нет, поэтому список
// английских имён (сверку с паком держит test/rules/skitarii-modules.test.mjs).
export const MECHANICUM_WEAPONS = ["Arc Lance", "Arc Pistol", "Arc Rifle", "Combi-Arc", "Conversion Beamer",
  "Darkfire Cannon", "Eradication Ray", "Flechette Blaster", "Flechette Carbine", "Galvanic Carbine",
  "Galvanic Caster", "Galvanic Rifle", "Gamma Pistol", "Heavy Arc Rifle", "Irrad Cleanser",
  "Irradiation Engine", "Lightning Gun", "Magnarail Lance", "Nanite Replicator", "Phosphor Blast Carbine",
  "Phosphor Blast Pistol", "Phosphor Blaster", "Phosphor Pistol", "Phosphor Serpenta", "Photon Gauntlet",
  "Photon Thruster", "Radium Carbine", "Radium Jezzail", "Radium Pistol", "Radium Serpenta",
  "Torsion Cannon", "Transonic Cannon", "Transuranic Arqebus"];

const MECH_SET = new Set(MECHANICUM_WEAPONS.map(n => n.toLowerCase()));

/** Подходит ли оружие Дару: с магазином, и Механикум или SP (weaponType solid). */
export function boonWeaponOk(weapon) {
  if (weapon?.type !== "weapon") return false;
  if (!((Number(weapon.system?.magazineMax) || 0) > 0)) return false;
  const en = String(weapon.name ?? "").split("/")[0].trim().toLowerCase();
  return weapon.system?.weaponType === "solid" || MECH_SET.has(en);
}
