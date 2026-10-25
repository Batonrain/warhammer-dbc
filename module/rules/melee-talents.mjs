// module/rules/melee-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТАЛАНТЫ «РУКОПАШНЫЕ» главы 3 (Sahara 3-8dc5), вторая пачка — чистые
//  функции. Бросков, Foundry и листа здесь нет: актор и числа приходят
//  аргументами, читатели — combat/attack.mjs, sheets/attack/selection.mjs.
//
//  Опознание Таланта — «имя ИЛИ ключ Возможности» (rules/ability-by-key.mjs):
//  предметы на акторах снимки, и персонаж, купивший Талант до записи
//  Конструктора в паке, ключа не несёт («ловушка Desiccated», тикет 3-861e).
//
//  Модуль НЕ импортируется из rules/sources.mjs и ничего не регистрирует —
//  круга через source-registry нет (AGENTS.md, «Источники правил»).
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";
import { heldWeapons } from "./dual-wield-talents.mjs";
import { talentSpecs } from "./dual-wield.mjs";

/** Ключи Возможностей (module/constants/capabilities.mjs) и имена Талантов. */
export const MELEE_TALENTS = Object.freeze({
  fleshRender: { key: "meleeCore.core.fleshRender", name: "Flesh Render" },
  grind:       { key: "meleeCore.core.grind",       name: "Grind" },
  raptor:      { key: "meleeCore.core.raptor",      name: "Raptor" },
  blademaster: { key: "meleeCore.core.blademaster", name: "Blademaster" },
  riposte:     { key: "meleeCore.core.riposte",     name: "Riposte" },
  falseAdvance:{ key: "meleeCore.core.falseAdvance", name: "False Advance" },
  cleave:      { key: "meleeCore.core.cleave",       name: "Cleave" },
  unstoppableCharge: { key: "rider.core.unstoppableCharge", name: "Unstoppable Charge" }
});

/** Есть ли у актора Талант «Рукопашных» из списка выше (по имени или по ключу). */
export function hasMeleeTalent(actor, id) {
  const t = MELEE_TALENTS[id];
  return !!t && hasAbility(actor, t.key, t.name, "talent");
}

// ── Перемолоть ──────────────────────────────────────────────────────────────

/** Флаги Захвата (combat/grapple.mjs: ROLE_FLAG, PARTNER_FLAG) — читаются без импорта Борьбы. */
const GRAPPLE_ROLE = "grappleRole";
const GRAPPLE_PARTNER = "grapplePartnerUuid";

/**
 * Держит ли `actor` цель в Борьбе как Атакующий: роль «attacker» и партнёр —
 * именно эта цель. `targetUuids` — все uuid цели (actorIdentityUuids: токен и
 * мировой актор; несвязанный токен знает партнёра под своим uuid).
 *
 * Захват, заведённый до появления ролей (флаг роли пуст), не считается:
 * кто в нём держит, неизвестно, а Талант даётся только держащему.
 */
export function holdsInGrapple(actor, targetUuids) {
  const get = k => actor?.getFlag?.("warhammer-dbc", k) ?? actor?.flags?.["warhammer-dbc"]?.[k];
  if (get(GRAPPLE_ROLE) !== "attacker") return false;
  const partner = get(GRAPPLE_PARTNER);
  return !!partner && !!targetUuids?.has?.(partner);
}

/**
 * Перемолоть / Grind (core.json, pdf-стр. 61): «Когда он проводит прием Пила
 * против противника, которого он держит в Борьбе, этот прием использует его
 * полный S.b для урона, вместо половины как обычно.»
 *
 * @returns {boolean} true — у приёма Пила снять «½S.b»
 */
export function grindFullSb(actor, { maneuverKey, holdsTarget }) {
  return maneuverKey === "saw" && !!holdsTarget && hasMeleeTalent(actor, "grind");
}

// ── Мастер Клинка ───────────────────────────────────────────────────────────

/** Имя метки «раз в Раунд» (apps/game-session.mjs: isRoundCapabilityAvailable/markRoundCapabilityUsed). */
export const BLADEMASTER_ROUND_FLAG = "blademaster";

/**
 * «Клинковое рукопашное оружие». Книга (core.json) определения не даёт — «клинковым»
 * называет мечи и ножи (рядом стоят Танцор с Клинками — «парные мечи» и Запасной
 * Клинок — нож). Это решение, а не цитата: включить Глефу/Топор/Когти — одна строка здесь.
 */
export const BLADE_CATEGORIES = Object.freeze(["Меч", "Нож"]);

/** Клинковое ли рукопашное оружие (по категории рукопашного типа). */
export function isBladeWeapon(item) {
  const sys = item?.system;
  if (!sys || sys.weaponClass !== "melee") return false;
  return BLADE_CATEGORIES.includes(String(sys.meleeCategory ?? "").trim());
}

/**
 * Мастер Клинка / Blademaster (core.json, pdf-стр. 61): «Один раз в Раунд он
 * может перебросить любой неудачный тест на атаку клинковым рукопашным оружием.»
 *
 * Предложение переброса на карточке атаки: Талант есть, атака рукопашная
 * клинковым оружием, тест провален, эта атака ещё не переброшена (переброс
 * переброса книга не даёт), и в этом Раунде Талант ещё не использован.
 * Бесплатный: Очко Судьбы не тратится (в отличие от обычного переброса).
 *
 * @param {object} p
 * @param {object} p.item          оружие карточки
 * @param {boolean} p.isMelee      карточка — рукопашная атака
 * @param {number} p.rv            выпавшее d100
 * @param {number} p.threshold     Порог
 * @param {boolean} p.rerolled     карточка уже переброшена
 * @param {boolean} p.roundAvailable  Талант в этом Раунде ещё не использован
 */
export function blademasterRerollOffered(actor, { item, isMelee, rv, threshold, rerolled, roundAvailable }) {
  if (!isMelee || rerolled || !roundAvailable) return false;
  if (!isBladeWeapon(item)) return false;
  if (!(Number(rv) > Number(threshold))) return false;     // тест не провален
  return hasMeleeTalent(actor, "blademaster");
}

// ── Неостановимый Натиск ────────────────────────────────────────────────────

/**
 * Неостановимый Натиск / Unstoppable Charge (core.json, Таланты «Всадник»): «Когда
 * персонаж верхом на скакуне или байке совершает Натиск, рукопашные атаки персонажа
 * (но не атаки скакуна и не атаки лезвиями на байке) получают свойство Felling
 * (½WS.b (окр.▲)).»
 *
 * Атаки скакуна и лезвий байка бросает не сам всадник и не его оружием, поэтому в этот
 * путь они не попадают. По Базе ЭТОЙ атаки (opts.baseKey), как Удар Молота.
 *
 * @returns {number} рейтинг Felling (0 — Талант не действует)
 */
export function unstoppableChargeFelling(actor, { isMelee, baseKey, mounted, wsBonus }) {
  if (!isMelee || baseKey !== "charge" || !mounted) return 0;
  if (!hasMeleeTalent(actor, "unstoppableCharge")) return 0;
  return Math.ceil((Number(wsBonus) || 0) / 2);
}

// ── Разрубить ───────────────────────────────────────────────────────────────

/** Порог непоглощённого урона Таланта. */
export const CLEAVE_MIN_DAMAGE = 16;
/** Штраф дополнительной атаки. */
export const CLEAVE_PENALTY = -10;

/**
 * Разрубить / Cleave (core.json, pdf-стр. 61): «Если его рукопашная атака нанесла
 * цели 16 и более непоглощенного урона и вывела ее из строя, персонаж может за
 * свободное действие атаковать базовой атакой еще одного персонажа рядом с
 * изначальной целью, но с модификатором –10. Эта дополнительная атака не может
 * генерировать еще атаки с помощью этого Талантa.»
 *
 * «Вывела из строя» — Раны цели до удара были выше 0, а после упали до 0 и ниже
 * (книга нигде не называет иного определения; отрицательные Раны — уже из строя).
 *
 * @param {object} p
 * @param {boolean} p.melee       удар рукопашный
 * @param {boolean} p.cleaveChild это сама дополнительная атака Таланта (не порождает новых)
 * @param {number} p.net          непоглощённый урон попадания
 * @param {number} p.woundsBefore Раны цели до удара
 * @param {number} p.woundsAfter  Раны цели после удара
 */
export function cleaveTriggered(actor, { melee, cleaveChild, net, woundsBefore, woundsAfter }) {
  if (!melee || cleaveChild) return false;
  if (!((Number(net) || 0) >= CLEAVE_MIN_DAMAGE)) return false;
  if (!((Number(woundsBefore) || 0) > 0 && (Number(woundsAfter) || 0) <= 0)) return false;
  return hasMeleeTalent(actor, "cleave");
}

// ── Ложный Натиск ───────────────────────────────────────────────────────────

/**
 * Ложный Натиск / False Advance (core.json, pdf-стр. 62): «Когда он заканчивает
 * Полудвижение или Полное движение в контакте с врагом, он может провести против
 * него один Финт или Давление за свободное действие.»
 *
 * Финт и Давление и так не списывают ОД программно (techniques.mjs: «прочие
 * Состязания ОД не списывают»), поэтому «свободное действие» отдельной цены не
 * требует; Талант автоматизирует МОМЕНТ — кнопки на карточке Движения, раз на
 * карточку. «В контакте с врагом» система не меряет — подтверждает сам игрок.
 */
export function falseAdvanceOffered(actor) {
  return hasMeleeTalent(actor, "falseAdvance");
}

// ── Рипост ──────────────────────────────────────────────────────────────────

/** Имя метки «раз в Раунд» Рипоста. */
export const RIPOSTE_ROUND_FLAG = "riposte";
/** «Броски на Избегание против этой атаки получают штраф –20». */
export const RIPOSTE_EVASION_PENALTY = -20;

const cls = w => String(w?.system?.weaponClass ?? "");
const balanceOf = w => Number.parseInt(w?.system?.balance ?? 0, 10) || 0;

/**
 * Рипост / Riposte (core.json, pdf-стр. 62): «Если он вооружен двумя оружиями и
 * успешно парирует атаку противника, персонаж может тут же атаковать противника
 * базовой атакой с бонусом +0 другим оружием, если его Баланс не ниже 0. Броски на
 * Избегание против этой атаки получают штраф –20. Контратака не тратит реакций
 * или действий, но персонаж может совершить ее только один раз в Раунд. Если
 * персонаж владеет Талантом Two Weapon Wielder (Ranged), он может использовать
 * пистолеты (но не винтовки) для рипоста.»
 *
 * @param {object} parryWeapon  оружие, которым только что парировали
 * @param {object} p
 * @param {boolean} p.roundAvailable  Рипост в этом Раунде ещё не использован
 * @param {boolean} p.crossblock      парировали обоими (Крестовой Блок) — Рипост запрещён
 * @returns {?object} оружие для ответной атаки или null
 */
export function riposteWeapon(actor, parryWeapon, { roundAvailable, crossblock = false }) {
  if (!roundAvailable || crossblock || !parryWeapon) return null;
  if (!hasMeleeTalent(actor, "riposte")) return null;
  const held = heldWeapons(actor);
  if (held.length < 2) return null;                       // «вооружён двумя оружиями»
  const pistolsOk = talentSpecs(actor).has("ranged");
  return held.find(w => w.id !== parryWeapon.id && balanceOf(w) >= 0
    && (cls(w) === "melee" || (pistolsOk && cls(w) === "pistol"))) ?? null;
}

// ── Раптор ──────────────────────────────────────────────────────────────────

/**
 * Раптор / Raptor (core.json, pdf-стр. 61): «Совершая Натиск в полёте, персонаж
 * наносит +1d10 Dmg на 2+ Успехах на попадание и ещё +1d10 Dmg на 4+ Успехах.»
 *
 * «Ещё» — кубы складываются: 2–3 Успеха дают один лишний d10, 4+ — два. Кубы
 * бросаются отдельным броском (как у Меткого), поэтому Экстремальный урон не
 * вызывают. «В полёте» решает вызывающий (isChargeFromFlight, rules/die-swap.mjs).
 *
 * @param {number} deg  Успехи на попадание
 * @returns {number} сколько d10 добавить к урону первого попадания
 */
export function raptorBonusDice(actor, { chargeFromFlight, deg }) {
  if (!chargeFromFlight || !hasMeleeTalent(actor, "raptor")) return 0;
  const d = Number(deg) || 0;
  return (d >= 2 ? 1 : 0) + (d >= 4 ? 1 : 0);
}

// ── Терзатель Плоти ─────────────────────────────────────────────────────────

/**
 * Терзатель Плоти / Flesh Render (core.json, pdf-стр. 61): «Он получает +2
 * кубика на урон рукопашным оружием со свойством Tearing, вместо обычного +1,
 * и отбрасывает два наименьших.»
 *
 * Рвущее само даёт один лишний куб и отбрасывает один (applyDamageDiceMods).
 * Талант добавляет ЕЩЁ один — в том же поле extraDropLowest, что у
 * Легионера-Виртуоза: итого +2 куба и два отброшенных наименьших (1d10 →
 * 3d10kh1). Рвущее ставит само свойство, поэтому без него Талант молчит.
 *
 * @returns {number} сколько кубов добавить к extraDropLowest (0 или 1)
 */
export function fleshRenderExtraDrop(actor, { isMelee, tearing }) {
  if (!isMelee || !tearing) return 0;
  return hasMeleeTalent(actor, "fleshRender") ? 1 : 0;
}
