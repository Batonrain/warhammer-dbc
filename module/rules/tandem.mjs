// module/rules/tandem.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Tandem / Тандем (core.json, «Оружейник», Sahara 3-9d40).
//
//  Книга: «Персонаж умеет встраивать ручное оружие в тяжелое, придавая ему немного
//  столь нужной гибкости. За ¼ смены он может встроить пистолет или винтовку в
//  тяжелое оружие, что позволяет стрелять из него, используя любой из двух
//  профилей. Встроенное оружие считается как тяжелое в расчете стрельбы в рукопашной
//  и использования как рукопашное и удваивает свой Rld, но в остальном ведет себя как
//  винтовка или пистолет. В руках персонажа без этого Таланта установка получает –2
//  к Надежности».
//
//  Как это устроено здесь (решение владельца 24.10.2026: «Делай. И Тандем тоже»):
//  встроенное оружие становится ПРОФИЛЕМ тяжёлого — тем же «своим стволом»
//  (ownFire, combat/weapon-profiles.mjs), что у комби-подствольника: свой магазин,
//  скорострельность, перезарядка, боеприпас, урон, пробитие и свойства. Окно атаки
//  уже умеет выбирать такой профиль. Профиль помечен `tandem: true` — по нему
//  Полный Огонь (rules/full-fire.mjs) узнаёт «встроенное оружие тяжёлого», а бросок
//  — штраф Надёжности. Класс остаётся «Тяжёлое» — этим выполняется «считается как
//  тяжёлое в расчёте стрельбы в рукопашной». Исходный предмет снимается с листа и
//  хранится целиком внутри профиля (`tandemSource`) — «Извлечь» возвращает его.
//
//  Чистые функции без Foundry. Поток (диалог, обновление предметов) —
//  combat/tandem.mjs. Модуль не импортируется из rules/sources.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";

export const TANDEM = Object.freeze({ key: "weaponsmith.core.tandem", name: "Tandem" });

/** Надёжность установки в руках персонажа без Таланта. */
export const TANDEM_RELIABILITY_PENALTY = -2;

export const hasTandem = actor => hasAbility(actor, TANDEM.key, TANDEM.name, "talent");

const hasRof = s => (Number(s?.rof_single) || 0) > 0 || (Number(s?.rof_semi) || 0) > 0 || (Number(s?.rof_full) || 0) > 0;

/** В какое оружие встраивают: Тяжёлое (не станковое/пусковое — книга говорит «тяжелое оружие»). */
export const tandemHostOk = item => item?.type === "weapon" && item.system?.weaponClass === "heavy";

/** Что встраивают: пистолет или винтовка (не длинная), которое стреляет. */
export const tandemGuestOk = item => item?.type === "weapon"
  && ["pistol", "basic"].includes(item.system?.weaponClass)
  && !(item.system?.weaponProps || []).some(p => (p?.key ?? p) === "longRifle")
  && hasRof(item.system);

/** Профили-тандемы предмета: [{profile, idx}]. */
export function tandemProfiles(host) {
  const list = Array.isArray(host?.system?.profiles) ? host.system.profiles : [];
  return list.map((profile, idx) => ({ profile, idx })).filter(({ profile }) => profile?.tandem);
}

/**
 * «Удваивает свой Rld»: ½ → 1 (Полудействие → одно Полное действие), N → 2N.
 * Формат без числового смысла («–», «†», «¼», «N×M») не трогаем — перезарядка там и так
 * не считается в ОД (combat/reload.mjs::reloadApCost).
 */
export function doubleReload(reload) {
  const raw = String(reload ?? "").trim();
  if (raw === "¼") return "½";
  if (raw === "½") return "1";
  if (/^\d+$/.test(raw)) return String(Number(raw) * 2);
  return raw;
}

/**
 * Профиль-тандем из снимка встраиваемого оружия.
 * @param {object} guestSys     system встраиваемого оружия
 * @param {string} name         имя встраиваемого оружия
 * @param {object} [source]     полный снимок предмета (item.toObject()) — для «Извлечь»
 */
export function buildTandemProfile(guestSys, name, source = null, guestId = "") {
  const s = guestSys ?? {};
  const n = k => Number(s[k]) || 0;
  return {
    label: `Тандем: ${name}`,
    tandem: true,
    tandemName: name,
    // id встроенного предмета: его модификации остаются на листе и действуют на выстрел этого профиля (weapon-mods.mjs).
    tandemGuestId: guestId || source?._id || "",
    tandemWeight: n("weight"),
    ownFire: true,
    range: n("range"),
    damage: s.damage ?? "",
    damageType: s.damageType || "impact",
    damageSubtype: s.damageSubtype ?? "",
    penetration: n("penetration"),
    weaponProps: structuredClone(Array.isArray(s.weaponProps) ? s.weaponProps : []),
    rof_single: n("rof_single"), rof_semi: n("rof_semi"), rof_full: n("rof_full"),
    magazineMax: n("magazineMax"), magazineCur: n("magazineCur"),
    reload: doubleReload(s.reload),
    weaponType: s.weaponType ?? "",
    loadedAmmoId: s.loadedAmmoId ?? "",
    tandemSource: source ? structuredClone(source) : null
  };
}

/**
 * Поправка Надёжности выстрела из профиля: −2, если это тандем в руках персонажа без Таланта.
 * @returns {number} 0 или TANDEM_RELIABILITY_PENALTY
 */
export function tandemReliabilityPenalty(actor, profile) {
  return profile?.tandem && !hasTandem(actor) ? TANDEM_RELIABILITY_PENALTY : 0;
}
