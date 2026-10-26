// module/rules/gunsmith-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТАЛАНТЫ «ОРУЖЕЙНИКА» главы 3 — чистые функции (Sahara 3-9d40). Бросков,
//  Foundry и листа здесь нет: актор, оружие и числа приходят аргументами,
//  читатели — combat/attack.mjs, combat/attack-card.mjs, hooks.mjs,
//  combat/vehicle.mjs.
//
//  Опознание Таланта — развилка «имя ИЛИ ключ» (hasAbility): предметы на
//  акторах — снимки, и персонаж, купивший Талант до появления в паке записи
//  Конструктора capability, ключа не несёт («ловушка Desiccated», 3-861e).
//
//  Модуль НЕ импортируется из rules/sources.mjs и ничего не регистрирует —
//  круга через source-registry нет (AGENTS.md, «Источники правил»).
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";
import { itemHasName } from "./predicates.mjs";

export const GUNSMITH_TALENTS = Object.freeze({
  shocker:  { key: "weaponsmith.core.shocker",  name: "Shocker" },
  wallop:   { key: "weaponsmith.core.wallop",   name: "Wallop" },
  sparks:   { key: "weaponsmith.core.sparks",   name: "Sparks" },
  welder:   { key: "weaponsmith.core.welder",   name: "Welder" },
  needlestorm: { key: "weaponsmith.core.needlestorm", name: "Needlestorm" },
  irradiate:   { key: "weaponsmith.core.irradiate",   name: "Irradiate" },
  weaponTech:  { key: "weaponsmith.core.weaponTech",  name: "Weapon-Tech" },
  lensTuning:  { key: "weaponsmith.core.lensTuning",  name: "Lens Tuning" },
  litanyOfCleaning: { key: "weaponsmith.core.litanyOfCleaning", name: "Litany of Cleaning" },
  igniter:     { key: "weaponsmith.core.igniter",     name: "Igniter" }
});

/** Есть ли у актора Талант из списка выше (по имени или по ключу). */
export function hasGunsmithTalent(actor, id) {
  const t = GUNSMITH_TALENTS[id];
  return !!t && hasAbility(actor, t.key, t.name, "talent");
}

/** Есть ли у оружия свойство с таким ключом (resolveWeaponPropsList или «сырые» записи). */
const hasProp = (props, key) => (props ?? []).some(p => (p?.key ?? p?.def?.key ?? p) === key);

// ── Оружие по имени ─────────────────────────────────────────────────────────
//  Типа «Гальваническое»/«Дуговое» в weaponType нет (всё это exotic), поэтому
//  по названию: Galvanic Carbine/Caster/Rifle, Arc Pistol/Rifle/Lance.

/** Гальваническое оружие (Galvanic Carbine / Caster / Rifle). */
export const isGalvanicWeapon = item => /galvanic|гальванич/i.test(String(item?.name ?? ""));

/** Дуговое оружие (Arc Pistol / Rifle / Lance, Combi-Arc). */
export const isArcWeapon = item => /(^|[^A-Za-z])arc([^A-Za-z]|$)|дугов/i.test(String(item?.name ?? ""));

// ── Шокер ───────────────────────────────────────────────────────────────────

/**
 * Шокер (core.json, «Оружейник»): «Когда он попадает Избирательной атакой
 * Гальванического оружия в голову (не в глаза или сочленения шеи), это
 * попадание получает свойство Shocking». В окне атаки «Голова» — value
 * "head"; глаз ("eye") и сочленение/шея ("joint") — отдельные значения, так
 * что строгое равенство уже исключает их.
 */
export function shockerGrantsShocking(actor, { item, isMelee, aimValue }) {
  return !isMelee && aimValue === "head" && isGalvanicWeapon(item)
    && hasGunsmithTalent(actor, "shocker");
}

// ── Поджигатель ─────────────────────────────────────────────────────────────

/** Фосфорное оружие — по названию (Phosphor Blaster/Carbine/Pistol/Serpenta…); граната «Phosphor» — не выстрел, Избирательной не бывает. */
export const isPhosphorWeapon = item => item?.system?.weaponType !== "grenade"
  && /phosphor|фосфор/i.test(String(item?.name ?? ""));

/**
 * Поджигатель (core.json, «Оружейник»): «Когда он совершает Избирательный
 * выстрел из Фосфорного оружия, оно получает дополнительные эффекты, в
 * зависимости от части тела, в которую попадет: Голова — свойство Blinding
 * игнорирует визоры и авточувства; Торс — цель должна перебрасывать успешный
 * тест A, чтобы не загореться; Рука — если цель Загорается, тест W+0, или
 * бросить то, что держала в этой руке; Нога — если цель Загорается, тест W+0,
 * или ее сбивает с ног».
 * Зона — значение Избирательной атаки окна ("head"/"torso"/"arm"/"leg");
 * глаз и сочленение шеи книга не называет (как и у Шокера) — эффекта нет.
 * @returns {"head"|"torso"|"arm"|"leg"|null}
 */
export function igniterZone(actor, { item, isMelee, aimValue }) {
  if (isMelee || !isPhosphorWeapon(item)) return null;
  if (!["head", "torso", "arm", "leg"].includes(aimValue)) return null;
  return hasGunsmithTalent(actor, "igniter") ? aimValue : null;
}

/** Строки карточки атаки по зоне Поджигателя — что система сделает сама на кнопках свойств. */
export const IGNITER_NOTES = Object.freeze({
  head:  "🔥 Поджигатель (голова): Blinding игнорирует визоры (кнопка «Ослепляющее» пропускает иммунитет визора; авточувства в системе отдельно не моделируются).",
  torso: "🔥 Поджигатель (торс): цель перебрасывает УСПЕШНЫЙ тест A против загорания (кнопка «Горение» делает сама).",
  arm:   "🔥 Поджигатель (рука): если цель загорелась — тест W+0, провал: роняет то, что держала (кнопка «Горение» бросает W+0 и даёт кнопки «Выронить»).",
  leg:   "🔥 Поджигатель (нога): если цель загорелась — тест W+0, провал: сбита с ног (кнопка «Горение» делает сама)."
});

/**
 * Что делает Поджигатель с целью, у которой свойство горения (Flame) УЖЕ
 * сыграло: рука/нога — второй шаг после теста на загорание.
 * @param {"head"|"torso"|"arm"|"leg"|""} zone
 * @param {boolean} ignited  цель на этом тесте Загорелась (не устояла и не иммунна)
 * @returns {"willTest"|null}  willTest — нужен тест W+0; при провале: рука — выронить, нога — упасть
 */
export function igniterFollowUp(zone, ignited) {
  return (ignited && (zone === "arm" || zone === "leg")) ? "willTest" : null;
}

// ── Трепка ──────────────────────────────────────────────────────────────────

/** Рейтинг Concussive по части тела: голова (0), нога или торс (–1), рука (–2). */
export const WALLOP_RATINGS = Object.freeze({ head: 0, torso: -1, leg: -1, arm: -2 });

/**
 * Трепка (core.json, «Оружейник»): «Когда он совершает Избирательный выстрел
 * с короткой дистанции или ближе из оружия со свойством Scatter, оно
 * получает свойство Concussive на первое попадание (после Избеганий), в
 * зависимости от части тела…». Возвращает рейтинг или null, если Талант не
 * сработал (сочленение/глаз книга не называет — Concussive не даётся).
 */
export function wallopConcussiveRating(actor, { isMelee, wp, aimValue, shortRange }) {
  if (isMelee || !shortRange || !wp?.scatter) return null;
  if (!Object.hasOwn(WALLOP_RATINGS, aimValue)) return null;
  return hasGunsmithTalent(actor, "wallop") ? WALLOP_RATINGS[aimValue] : null;
}

// ── Искры ───────────────────────────────────────────────────────────────────

/** Можно ли предложить кнопку «Искры» на попадании этого оружия. */
export function sparksAvailable(actor, { item, isMelee }) {
  return !isMelee && isArcWeapon(item) && hasGunsmithTalent(actor, "sparks");
}

/**
 * Искры (core.json, «Оружейник»): «бросает 2d10 и может выбрать заменить
 * один из кубиков урона оружия… на больший из этих двух кубиков в любом
 * попадании этой атаки (если выпал дубль, он может заменить один или оба)».
 *
 * Трактовка владельца 24.10.2026 (А): замена кубика урона оружия; кубик
 * свойства Haywire — отдельным шагом, здесь не считается. Выбирается лучший
 * для стрелка вариант: заменяется НАИМЕНЬШИЙ кубик, и только если новый
 * больше. При дубле — два наименьших кубика (обоими выпавшими).
 *
 * @param {number[]} dice   оставленные кубики урона одного попадания
 * @param {number[]} rolled результаты 2d10
 * @returns {{delta:number, swaps:Array<{from:number,to:number}>}}
 */
export function sparksSwap(dice, rolled) {
  const pool = [...(dice ?? [])].map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const [a, b] = (rolled ?? []).map(Number);
  if (!pool.length || !Number.isFinite(a) || !Number.isFinite(b)) return { delta: 0, swaps: [] };
  const candidates = a === b ? [a, b] : [Math.max(a, b)];
  const swaps = [];
  candidates.forEach((to, i) => {
    const from = pool[i];
    if (from != null && to > from) swaps.push({ from, to });
  });
  return { delta: swaps.reduce((s, x) => s + x.to - x.from, 0), swaps };
}

// ── Сварщик ─────────────────────────────────────────────────────────────────

/**
 * Сварщик (core.json, «Оружейник»): «Когда он попадает Избирательной атакой
 * из оружия со свойством Melta по машине и наносит непоглощенный урон, он
 * также наносит Критический Эффект 1d5+1 в ту часть машины, в которую он
 * целился». Здесь — первая половина (признак на карточке); непоглощённый
 * урон проверяет combat/vehicle.mjs при применении.
 */
export function welderMarksHit(actor, { wProps, aimValue, targetIsVehicle }) {
  return !!targetIsVehicle && !!aimValue && aimValue !== "underfoot"
    && hasProp(wProps, "melta") && hasGunsmithTalent(actor, "welder");
}

/** Уровень доп. Критического Эффекта Сварщика: 1d5+1 (2..6). */
export const welderCritLevel = d5 => (Number(d5) || 1) + 1;

// ── Иглошторм ───────────────────────────────────────────────────────────────

/** Флешетное и Игловое оружие — по названию и типу (weaponType needler). */
export const isFlechetteOrNeedleWeapon = item =>
  item?.system?.weaponType === "needler" || /flechette|needle|флешет|игл/i.test(String(item?.name ?? ""));

/**
 * Иглошторм (core.json, «Оружейник»): «Он может совершать Стрельбу на
 * Подавление из Флешетного и Иглового оружия за полудействие вместо полного
 * действия». true — подавление этим оружием стоит Полудействие.
 */
export function needlestormHalfAction(actor, item) {
  return isFlechetteOrNeedleWeapon(item) && hasGunsmithTalent(actor, "needlestorm");
}

/** Вид действия Стрельбы на Подавление этим оружием (книга: полное; Иглошторм — полудействие). */
export const suppressionActionType = (actor, item) =>
  needlestormHalfAction(actor, item) ? "Полудействие" : "Полное действие";

// ── Облучить ────────────────────────────────────────────────────────────────

/** Режимы Облучить: ничего / удвоить Felling / считать пробитие Rad без удвоения AP. */
export const IRRADIATE_MODES = Object.freeze({ none: "", felling: "felling", noDouble: "noDouble" });

/**
 * Облучить (core.json, «Оружейник»): «При стрельбе из Рад оружия он может
 * (до броска атаки) выбрать либо удвоить рейтинг его свойства Felling, либо
 * рассчитывать пробитие брони в расчете свойства Rad, не удваивая AP цели».
 * Возвращает выбранный режим, если он применим (Талант, не рукопашная, у
 * оружия есть Rad; для «felling» — ещё и Felling), иначе "".
 */
export function irradiateMode(actor, { toggles, isMelee, wProps }) {
  const m = toggles?.irradiate;
  if (!m || isMelee || !hasProp(wProps, "rad") || !hasGunsmithTalent(actor, "irradiate")) return "";
  if (m === IRRADIATE_MODES.felling) return hasProp(wProps, "felling") ? m : "";
  return m === IRRADIATE_MODES.noDouble ? m : "";
}

// ── Тех-Оружейник ───────────────────────────────────────────────────────────

/** Метка на оружии: усиленный выстрел уже сделан, оружие ждёт новой настройки. */
export const WEAPON_TECH_SPENT_FLAG = "weaponTechSpent";

/** Плазменное, мельта и экзотическое стрелковое оружие (weaponType). */
export const isWeaponTechWeapon = item => ["plasma", "melta", "exotic"].includes(item?.system?.weaponType);

/** Можно ли вообще предложить галочки Тех-Оружейника для этого оружия. */
export function weaponTechAvailable(actor, { item, isMelee }) {
  return !isMelee && isWeaponTechWeapon(item) && hasGunsmithTalent(actor, "weaponTech");
}

/**
 * Тех-Оружейник (core.json, «Оружейник»): «Он может увеличить Dmg и Pen
 * плазменного, мельта, или экзотического стрелкового оружия на I.b. Персонаж
 * должен потратить 5 минут на подготовку оружия к такому усиленному выстрелу
 * (что можно сделать заранее) и не может применять этот Талант к тому же
 * оружию второй раз, пока не настроит его заново».
 *
 * «Настройка» — галочка «перенастроено» (сбрасывает метку «потрачено» на
 * оружии), «усиленный выстрел» — вторая галочка; метка ставится при самом
 * выстреле. Перебросы того же выстрела (replay) метку не проверяют и не
 * ставят повторно.
 *
 * @returns {{bonus:number, retune:boolean, spend:boolean, refused:boolean}}
 *   bonus — I.b к Dmg и Pen; spend — поставить метку на оружие; retune — сначала снять метку;
 *   refused — выстрел заказан, но оружие не настроено заново.
 */
export function weaponTechShot(actor, { item, isMelee, toggles, spent, replay = false }) {
  const none = { bonus: 0, retune: false, spend: false, refused: false };
  if (!weaponTechAvailable(actor, { item, isMelee })) return none;
  const retune = !!toggles?.weaponTechRetune;
  if (!toggles?.weaponTech) return { ...none, retune };
  const isSpent = !!spent && !retune;
  if (isSpent && !replay) return { ...none, refused: true };
  const ib = Math.max(0, Number(actor?.system?.characteristics?.i?.bonus) || 0);
  return { bonus: ib, retune, spend: !replay, refused: false };
}

// ── Настройка Линз ──────────────────────────────────────────────────────────

/** Метка на лаз-оружии: число оставшихся «сверхточных» зарядов. */
export const LENS_CHARGES_FLAG = "lensCharges";

export const isLaserWeapon = item => item?.system?.weaponType === "laser";

export function lensTuningAvailable(actor, { item, isMelee }) {
  return !isMelee && isLaserWeapon(item) && hasGunsmithTalent(actor, "lensTuning");
}

/**
 * Настройка Линз (core.json, «Оружейник»): «Он может потратить 5 минут,
 * настраивая любое лаз-оружие, чтобы дать ему I.b зарядов. Совершая любую
 * атаку из такого оружия, он может потратить 1 заряд, чтобы дать оружию
 * свойства Felling(I.b) и Precise на эту атаку».
 *
 * Галочка «настроить» задаёт заряды = I.b (замена, не накопление), галочка
 * «потратить заряд» тратит один и даёт Felling(I.b)+Precise.
 * @returns {{charges:number, use:boolean, felling:number, tuned:boolean, empty:boolean}}
 *   charges — заряды ПОСЛЕ атаки; use — заряд потрачен/свойства даны.
 */
export function lensTuningShot(actor, { item, isMelee, toggles, charges, replay = false }) {
  const base = Math.max(0, Number(charges) || 0);
  const none = { charges: base, use: false, felling: 0, tuned: false, empty: false };
  if (!lensTuningAvailable(actor, { item, isMelee })) return none;
  const ib = Math.max(0, Number(actor?.system?.characteristics?.i?.bonus) || 0);
  const tuned = !!toggles?.lensTune;
  const have = tuned && !replay ? ib : base;
  if (!toggles?.lensUse) return { ...none, charges: have, tuned };
  if (have <= 0 && !replay) return { ...none, charges: have, tuned, empty: true };
  return { charges: replay ? have : have - 1, use: true, felling: ib, tuned, empty: false };
}

// ── Литания Чистки ──────────────────────────────────────────────────────────

/** Актор-метка: { <weaponType>: worldTime последней чистки }. «Сутки» — 24 часа. */
export const LITANY_CLEANED_FLAG = "litanyCleaned";
export const LITANY_WINDOW_SECONDS = 86400;

const LITANY_TYPES = [
  [/bolt|болт/i, "bolt"], [/flame|огнем/i, "flame"], [/grav|грав/i, "grav"], [/(^|[^a-z])las([^a-z]|$)|laser|лаз/i, "laser"],
  [/launcher|пуск/i, "launcher"], [/melta|мельт/i, "melta"], [/solid|твёрд|твердотел/i, "solid"], [/exotic|экзот/i, "exotic"]
];

/** weaponType, на который выбрана специализация Литании («Las» → laser), или "". */
export function litanyWeaponType(talentItem) {
  const spec = String(talentItem?.system?.specialization ?? "") + " " + (String(talentItem?.name ?? "").match(/\(([^)]*)\)/)?.[1] ?? "");
  // Строка-шаблон со всем списком («Bolt, Flame, …, Exotic (1 любой)») — выбор не сделан, тип неизвестен:
  // совпадение должно быть ровно одно, иначе Литания молча работала бы только на болтеры.
  const hits = LITANY_TYPES.filter(([re]) => re.test(spec));
  return hits.length === 1 ? hits[0][1] : "";
}

/** Варианты выбора специализации при покупке (sheets/item-picker.mjs, как у Weapon Training). */
export const LITANY_SPEC_OPTIONS = Object.freeze(["Bolt", "Flame", "Grav", "Las", "Launcher", "Melta", "Solid Projectile", "Exotic"]);

/** Литании актора: все предметы-Таланты с этим именем (по одному на выбранный тип). */
export function litanyTypesOf(actor) {
  const items = actor?.items ?? [];
  const out = new Set();
  for (const i of items) {
    if (i?.type === "talent" && itemHasName(i, GUNSMITH_TALENTS.litanyOfCleaning.name)) {
      const t = litanyWeaponType(i);
      if (t) out.add(t);
    }
  }
  return out;
}

/**
 * Литании актора, у которых тип оружия так и не выбран (Талант куплен до выбора специализации при покупке:
 * в specialization лежит весь список типов, litanyWeaponType даёт ""). Механика такой Литании молчит — окно
 * атаки подсказывает игроку вписать тип (sheets/attack/talent-toggles.mjs).
 */
export function litanyUnresolved(actor) {
  const out = [];
  for (const i of actor?.items ?? []) {
    if (i?.type === "talent" && itemHasName(i, GUNSMITH_TALENTS.litanyOfCleaning.name) && !litanyWeaponType(i)) out.push(i);
  }
  return out;
}

/** Талант выбран на тип этого оружия (по имени предмета-Таланта). */
export function litanyCoversWeapon(actor, item) {
  return !!item?.system?.weaponType && litanyTypesOf(actor).has(item.system.weaponType);
}

/**
 * Литания Чистки (core.json, «Оружейник»): «Если он тратит хотя бы по 30
 * минут в сутки на тщательную чистку и смазывание оружия выбранного в
 * специализации типа, это оружие получает +1 к Надежности в его руках».
 * Метка чистки лежит на акторе по типу оружия, действует 24 часа мирового
 * времени с момента чистки. @returns {number} 0 или 1
 */
export function litanyReliability(actor, { item, isMelee, cleaned, worldTime }) {
  if (isMelee || !litanyCoversWeapon(actor, item)) return 0;
  const at = Number(cleaned?.[item.system.weaponType]);
  if (!Number.isFinite(at)) return 0;
  const age = Number(worldTime) - at;
  return age >= 0 && age < LITANY_WINDOW_SECONDS ? 1 : 0;
}
