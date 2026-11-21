// module/rules/null-zones.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Ауры субрас Парии и Дискорданта (корбук, глава I — Субрасы Людей).
//
//  Сама зона — движок аур (module/regions/auras.mjs): Черта носителя несёт
//  запись kind:"aura" радиусом W.b×3 м «на всех, включая себя», и каждому в
//  радиусе выдаётся Черта-метка — «В Пустоте Парии» (флаг pariah.void) или
//  «В Поле Дискорданта» (discordant.field). Здесь — только решения «что
//  нельзя/что меняется в зоне»; встроены они в места, где это происходит:
//
//  Пустота Парии
//   • психосилы (кроме Непрямых) не срабатывают ни у кастера в зоне, ни по
//     цели в зоне — sheets/tabs/psychic.mjs, hooks.mjs;
//   • Очки Бесчестия/Судьбы нельзя тратить и сжигать — apps/infamy-points.mjs,
//     sheets/tabs/death.mjs;
//   • Порча не прибавляется (у Парии Cor не выше 0 — он всегда в своей
//     ауре) — warhammer-dbc.mjs preUpdateActor;
//   • сверхъестественные мутации и дары (system.supernatural) гаснут —
//     apps/mechanics.mjs::syncNullZoneSuppression;
//   • псайкеры −PR×3, демоны −30 ко всем тестам; Пария −30 к социальным
//     (кроме Запугивания), −60 с псайкерами/демонами, против бездушных
//     (Пария, Машина, техника) — без штрафа — rules/library/null-zones.mjs;
//   • успешный тест Морали перебрасывается (кроме Парий) — rules/morale-test.mjs,
//     combat/fear.mjs через rules/pariah-morale.mjs; псайкеры и демоны теряют
//     автоуспехи Морали — rules/morale-auto.mjs, combat/fear.mjs;
//   • демон проходит Нестабильность каждый Ход со штрафом −W Парии —
//     combat/warp-instability.mjs;
//   • ритуал в Пустоте или с Парией обрывается без последствий —
//     apps/ritual-cast.mjs::castRitual;
//   • касание Парии (кнопка на Черте) — combat/pariah-touch.mjs.
//
//  Поле Дискорданта (как Haywire (7) для электрики)
//   • электрическое стрелковое оружие не стреляет, рукопашное — как
//     выключенное (примитивное) — combat/attack.mjs;
//   • электрические импланты отключены — syncNullZoneSuppression;
//   • техночудо с целью в поле — Критический Провал — sheets/tabs/tech.mjs;
//   • механика клинит через 1d5+1 Ходов в поле, силовая броня гаснет на
//     время поля, биоорганы отторгаются — combat/discordant-field.mjs;
//   • медицина −10…−60 — галочки, rules/library/null-zones.mjs;
//   • Наследие, демоническое и рунное оружие поле не берёт — isFieldExemptWeapon.
//  Не сделано (task-be12): «сжатие» ауры псайкером до 2 м, исключения для
//  Некронов/Орков, спорные папки оружия с techClass "none".
//
//  Хвосты Пустоты, ещё не сделанные (task-1452): вместилища демонов
//  (демоническое оружие/скакуны/одержимые), невидимость ауры для демонов в
//  Истинной Форме, запрет лечить раны касания сверхъестественным.
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "./flags.mjs";
import { isDaemonActor, isSoullessActor } from "./predicates.mjs";

export { isSoullessActor };

export const PARIAH_VOID = "pariah.void";
export const PARIAH_SELF = "pariah.self";
export const DISCORDANT_FIELD = "discordant.field";

export const inPariahVoid = actor => !!actor && hasRuleFlag(actor, PARIAH_VOID);
export const inDiscordantField = actor => !!actor && hasRuleFlag(actor, DISCORDANT_FIELD);

/**
 * Непрямая сила (system психосилы): основной тип «Непрямое» или доп. тип
 * {type:"indirect"} в extraTypes. В книге «Непрямое» почти всегда не первое
 * в строке типа («Атака · Стрельба · Непрямое» у Тарана), поэтому в паке оно
 * лежит доп. типом. Карточки чата несут ответ готовым (data-psy-indirect).
 */
export function isIndirectPower(sys) {
  return sys?.powerType === "indirect" || (sys?.extraTypes ?? []).some(e => e?.type === "indirect");
}

/** Сила развеивается в Пустоте: любая, кроме Непрямой. */
export function voidBlocksPower(actor, power) {
  return inPariahVoid(actor) && !isIndirectPower(power?.system);
}

/**
 * Порча в Пустоте не прибавляется: вернуть значение, которое оставить. Сам
 * Пария (pariah.self) не поднимает Cor и без токена на сцене — он всегда в
 * своей ауре. Уменьшение не трогаем.
 */
export function corruptionInVoid(actor, oldValue, newValue) {
  const o = Number(oldValue) || 0, n = Number(newValue) || 0;
  if (n <= o) return n;
  if (inPariahVoid(actor) || hasRuleFlag(actor, PARIAH_SELF)) return o;
  return n;
}

/**
 * Запасной класс по weaponType — для оружия без system.techClass (старые
 * предметы на акторах). Основной источник — techClass, проставленный в паке
 * по папкам (утверждено владельцем 26.09.2026): лазер/плазма/мельта/волькит/
 * гравитон/силовое/шоковое — электрика; болтер/стаб/огнемёт/гранатомёт/
 * ракетные установки/цепное — механика. «exotic» без techClass не угадывается.
 */
export const WEAPON_TYPE_TECH = {
  laser: "electric", plasma: "electric", melta: "electric", grav: "electric",
  power: "electric", shock: "electric",
  bolt: "mechanical", solid: "mechanical", flame: "mechanical",
  launcher: "mechanical", chain: "mechanical"
};

export function weaponTechClass(weapon) {
  const own = weapon?.system?.techClass;
  if (own) return own;
  return WEAPON_TYPE_TECH[weapon?.system?.weaponType] || "none";
}

/**
 * Оружие, на которое поле Дискорданта не действует вовсе (task-be12):
 * «психические и демонические устройства и Оружие Наследия (если оно в руках
 * своего хозяина)». Демоническое/рунное — daemonWeapon.bound/runic; Наследие
 * на акторе считается в руках хозяина (поля «хозяин» у Наследия нет). Класс
 * техники (weaponTechClass) не меняется — его читает и Саботаж.
 */
export function isFieldExemptWeapon(weapon) {
  const s = weapon?.system;
  return !!(s?.daemonWeapon?.bound || s?.daemonWeapon?.runic || s?.legacy?.active);
}

/* ── Хвосты поля Дискорданта (task-be12) ────────────────────────────────── */

/**
 * «Полностью механические устройства… заклинивая или начиная работать
 * неправильно через 1d5+1 Ходов непрерывного пребывания в ауре (бросается при
 * входе в ауру)». Бросок — при выдаче Черты-метки, счётчик — флаг актора,
 * убывает в начале каждого его Хода в поле (combat/discordant-field.mjs).
 */
export const FIELD_JAM_FORMULA = "1d5+1";
export const FIELD_JAM_FLAG = "discordantJamIn";
export const FIELD_ARMOUR_OFF_FLAG = "discordantArmourOff";
export const FIELD_BIO_FLAG = "discordantBio";

/**
 * Ход в поле: счётчик −1. На нуле — механика клинит (jamNow), дальше счётчик
 * не нужен (null). null на входе — счёт не идёт (уже заклинило или не в поле).
 * @returns {{remaining:number|null, jamNow:boolean}}
 */
export function fieldJamTick(remaining) {
  if (remaining == null || !Number.isFinite(Number(remaining))) return { remaining: null, jamNow: false };
  const left = Number(remaining) - 1;
  return left <= 0 ? { remaining: null, jamNow: true } : { remaining: left, jamNow: false };
}

/** Механическое оружие актора, которое поле заклинивает (ещё не заклинившее). */
export function fieldJammableWeapons(actor) {
  return [...(actor?.items ?? [])].filter(i => i?.type === "weapon"
    && !isFieldExemptWeapon(i) && weaponTechClass(i) === "mechanical" && !i.system?.jammed);
}

/**
 * Биоорганы (органы Астартес, Геносемя): «тест Т+0 за каждые 10 минут
 * непрерывного пребывания в ауре… за каждые Т.b×2 накопленных Провалов один
 * из таких органов отторгается… Провалы не теряются при выходе из ауры, и
 * теряются пассивно по 1 в час».
 */
export const FIELD_BIO_INTERVAL = 600;
export const FIELD_BIO_DECAY = 3600;

/** Есть ли у актора биоорганы под действие поля. */
export function hasFieldBioOrgans(actor) {
  return [...(actor?.items ?? [])].some(i =>
    (i?.type === "implant" && i.system?.category === "astartes")
    || (i?.type === "trait" && /^gene[- ]seed\b/i.test(String(i.name ?? "").trim())));
}

/**
 * Шаг учёта биоорганов. Чистая арифметика: броски приходят снаружи.
 * @param {{fails?:number, checkedAt?:number, decayAt?:number}|null} state флаг актора
 * @param {{now:number, inField:boolean, tBonus:number, rollTest:(n:number)=>number}} o
 *   rollTest(n) — сколько Провалов дали n тестов T+0
 * @returns {{state:object|null, tests:number, newFails:number, rejected:number}}
 */
export function fieldBioStep(state, { now, inField, tBonus, rollTest }) {
  const s = { fails: Number(state?.fails) || 0, checkedAt: state?.checkedAt, decayAt: state?.decayAt };
  let tests = 0, newFails = 0, rejected = 0;
  if (inField) {
    if (s.checkedAt == null) s.checkedAt = now;
    tests = Math.max(0, Math.floor((now - s.checkedAt) / FIELD_BIO_INTERVAL));
    if (tests > 0) {
      newFails = Math.max(0, Number(rollTest(tests)) || 0);
      s.fails += newFails;
      s.checkedAt += tests * FIELD_BIO_INTERVAL;
    }
    const per = Math.max(1, (Number(tBonus) || 0) * 2);
    rejected = Math.floor(s.fails / per);
    s.fails -= rejected * per;
  } else {
    // Вне поля непрерывность прерывается: следующий вход начнёт отсчёт заново.
    s.checkedAt = undefined;
  }
  // Пассивная убыль: по 1 в час, отсчёт — с появления первого Провала.
  if (s.fails > 0) {
    if (s.decayAt == null) s.decayAt = now;
    const hours = Math.floor((now - s.decayAt) / FIELD_BIO_DECAY);
    if (hours > 0) { s.fails = Math.max(0, s.fails - hours); s.decayAt += hours * FIELD_BIO_DECAY; }
  } else s.decayAt = undefined;
  const empty = s.fails === 0 && s.checkedAt == null;
  return { state: empty ? null : { fails: s.fails, ...(s.checkedAt != null ? { checkedAt: s.checkedAt } : {}), ...(s.decayAt != null ? { decayAt: s.decayAt } : {}) },
           tests, newFails, rejected };
}


/** Оружие выключено полем: электрика у владельца, стоящего в поле. */
export function fieldDisablesWeapon(actor, weapon) {
  return inDiscordantField(actor) && !isFieldExemptWeapon(weapon) && weaponTechClass(weapon) === "electric";
}

/**
 * Стрелять нельзя: электрическое оружие в поле, и это не рукопашная атака.
 * Одна проверка на окно атаки (sheets/attack-dialog.mjs) и на сам бросок
 * (combat/attack.mjs::_executeAttackRoll): пути мимо окна (огонь с листа
 * техники, рукопашный класс со стрелковым профилем) запрет, стоявший только в
 * нём, обходили (task-be12).
 * Электрическое рукопашное запрета не получает — оно бьёт выключенным.
 */
export function fieldForbidsShot(actor, weapon, isMelee) {
  return !isMelee && fieldDisablesWeapon(actor, weapon);
}

/** Имплант выключен полем: электроника (system.techClass "electric"). */
export function fieldDisablesImplant(actor, implant) {
  return inDiscordantField(actor) && implant?.system?.techClass === "electric";
}

/** Мутация/Дар гаснет в Пустоте: помечен сверхъестественным. */
export function voidSuppressesMutation(actor, mutation) {
  return inPariahVoid(actor) && !!mutation?.system?.supernatural;
}

/** Техночудо: цель (или сам техножрец без цели) в поле — Критический Провал. */
export function fieldFailsTechPower(caster, target = null) {
  return inDiscordantField(target ?? caster);
}

/* ── Хвосты Пустоты Парии (task-1452) ───────────────────────────────────── */

/** Пария — несёт флаг pariah.self расовой Черты. */
export const isPariah = actor => !!actor && hasRuleFlag(actor, PARIAH_SELF);

/** Псайкер — Пси-Рейтинг ≥ 1 или признак isPsyker (NPC бестиария несёт один из двух). */
export const isPsykerActor = actor =>
  !!actor && (!!actor.system?.isPsyker || (Number(actor.system?.psyker?.rating) || 0) >= 1);

/**
 * «Все, кроме Парий, должны перебрасывать успешные тесты Морали» — в Пустоте.
 * Решение принимается по исходу ПЕРВОГО броска, перебросом остаётся второй
 * (rules/reroll-pick.mjs, режим rerollSuccess).
 */
export function voidRerollsMorale(actor) {
  return inPariahVoid(actor) && !isPariah(actor);
}

/**
 * «Псайкеры и демоны в его ауре игнорируют любые эффекты, что позволяли бы им
 * проходить эти тесты автоматически» — Ярость, Бесстрашный, иммунитет к
 * Страху и прочие автоуспехи Морали не действуют.
 */
export function voidStripsMoraleAuto(actor) {
  return inPariahVoid(actor) && (isPsykerActor(actor) || isDaemonActor(actor));
}

/**
 * Демон в Пустоте проходит Нестабильность каждый Ход, «независимо от нанесения
 * или получения урона, со штрафом в W Парии». Прочтение-догадка (task-1452):
 * штраф — значение Характеристики W Парии целиком (не W.b); под несколькими
 * Париями — сильнейший. Пусто — штрафа нет.
 * @param {number[]} pariahWps
 */
export function voidInstabilityPenalty(pariahWps = []) {
  const w = Math.max(0, ...pariahWps.map(n => Number(n) || 0));
  return -w;
}

/**
 * Ритуал в Пустоте: «мгновенно обрываются… без обычных последствий срыва»,
 * «Пария не может участвовать в Ритуалах никоим образом».
 * @returns {null|"pariah"|"void"} причина или null — ритуал идёт как обычно
 */
export function voidBreaksRitual(actor) {
  if (isPariah(actor)) return "pariah";
  if (inPariahVoid(actor)) return "void";
  return null;
}

/**
 * Ритуал целиком: ритуалист и ассистенты. Первый, кто Пария или в Пустоте,
 * обрывает ритуал. Пария-ассистент — «не может участвовать никоим образом»;
 * его аура и так накрыла бы ритуал, так что сама причина одна и та же.
 * @returns {null|{actor:object, reason:"pariah"|"void"}}
 */
export function ritualVoidBreak(ritualist, assistants = []) {
  for (const a of [ritualist, ...assistants]) {
    const reason = voidBreaksRitual(a);
    if (reason) return { actor: a, reason };
  }
  return null;
}

export const VOID_RITUAL_TEXT = {
  pariah: "Пария не может участвовать в Ритуалах никоим образом.",
  void: "Ритуал оборван Пустотой Парии — собранные энергии Варпа безвредно втянуты в его чёрную душу. Последствий срыва нет."
};

/**
 * Касание Парии: что происходит с тем, кого коснулись.
 *  - Пария/бездушный — ничего;
 *  - демон — авто-провал, 3d10 непоглощаемого R Dmg в торс;
 *  - псайкер — авто-провал, бPR (базовый Пси-Рейтинг) непоглощаемого R Dmg в торс;
 *  - прочие — тест W−10, провал — «обязан разорвать контакт».
 * Демон-псайкер считается демоном («бPR или 3d10 соответственно»).
 * @returns {{kind:"none"|"daemon"|"psyker"|"human", formula?:string, testMod?:number}}
 */
export function pariahTouchOutcome(target) {
  if (!target || isPariah(target) || isSoullessActor(target)) return { kind: "none" };
  if (isDaemonActor(target)) return { kind: "daemon", formula: "3d10" };
  if (isPsykerActor(target)) {
    const pr = Math.max(1, Number(target.system?.psyker?.rating) || 0);
    return { kind: "psyker", formula: String(pr) };
  }
  return { kind: "human", testMod: -10 };
}
