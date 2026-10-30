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
import { fmtMeters, PATH_EPS } from "./movement-path.mjs";

/** Ключи Возможностей (module/constants/capabilities.mjs) и имена Талантов. */
export const MELEE_TALENTS = Object.freeze({
  fleshRender: { key: "meleeCore.core.fleshRender", name: "Flesh Render" },
  grind:       { key: "meleeCore.core.grind",       name: "Grind" },
  raptor:      { key: "meleeCore.core.raptor",      name: "Raptor" },
  blademaster: { key: "meleeCore.core.blademaster", name: "Blademaster" },
  riposte:     { key: "meleeCore.core.riposte",     name: "Riposte" },
  falseAdvance:{ key: "meleeCore.core.falseAdvance", name: "False Advance" },
  cleave:      { key: "meleeCore.core.cleave",       name: "Cleave" },
  stockGrip:   { key: "meleeCore.core.stockGrip",    name: "Stock Grip" },
  bladeBinding: { key: "meleeCore.core.bladeBinding", name: "Blade Binding" },
  reverseStrike: { key: "meleeCore.core.reverseStrike", name: "Reverse Strike" },
  savior:      { key: "meleeCore.core.savior",       name: "Savior" },
  tenacity:    { key: "meleeCore.core.tenacity",     name: "Tenacity" },
  hamstring:   { key: "meleeCore.core.hamstring",    name: "Hamstring" },
  strangeTechnique: { key: "meleeCore.core.strangeTechnique", name: "Strange Technique" },
  reaper:      { key: "meleeCore.core.reaper",       name: "Reaper" },
  showOff:     { key: "meleeCore.core.showOff",      name: "Show-Off" },
  unstoppableCharge: { key: "rider.core.unstoppableCharge", name: "Unstoppable Charge" }
});

/** Есть ли у актора Талант «Рукопашных» из списка выше (по имени или по ключу). */
export function hasMeleeTalent(actor, id) {
  const t = MELEE_TALENTS[id];
  return !!t && hasAbility(actor, t.key, t.name, "talent");
}

// ── Обратный Удар ───────────────────────────────────────────────────────────

/** Подпись профиля и категория оружия, которыми книга называет «профиль посоха». */
export const STAFF_PROFILE_LABEL = "Посох";
export const STAFF_CATEGORY = "Посох";

/**
 * Профиль посоха для второй атаки Обратного Удара (core.json: «используя профиль посоха»).
 * Решение владельца 26.10.2026: оружие категории «Посох» без профилей (12 предметов пака) тоже
 * годится — вторая атака идёт базовым профилем самого оружия.
 *
 * @param {object} item      оружие
 * @param {object[]} [profiles] профили оружия (по умолчанию авторские system.profiles)
 * @returns {number|null} индекс профиля с подписью «Посох» (≥ 0); -1 — базовый профиль оружия
 *   категории «Посох» (профиля с такой подписью нет); null — вторая атака невозможна
 */
export function reverseStrikeSecondProfileIdx(item, profiles) {
  const list = Array.isArray(profiles) ? profiles : (Array.isArray(item?.system?.profiles) ? item.system.profiles : []);
  const idx = list.findIndex(p => String(p?.label ?? "").includes(STAFF_PROFILE_LABEL));
  if (idx >= 0) return idx;
  return String(item?.system?.meleeCategory ?? "").trim() === STAFF_CATEGORY ? -1 : null;
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

// ── Жнец ────────────────────────────────────────────────────────────────────

/** Флаг Хода: токен (uuid) начальной цели цепочки Жнеца — от него меряется Полудвижение. */
export const REAPER_CHAIN_FLAG = "reaperInitialTarget";

/**
 * Жнец / Reaper (core.json, Таланты «Рукопашные»): «Когда он совершает Натиск и убивает цель, но
 * еще имеет непотраченные атаки, он может продолжить движение до следующей цели и атаковать ее,
 * но не дальше полной дистанции Натиска и не дальше дистанции полудвижения (SPD) от начальной цели.»
 *
 * Решения владельца 26.10.2026: «убивает» — смерть цели констатирована (setDeceased, combat/reaper-chain.mjs::
 * offerReaperAfterKill); «непотраченные атаки» — сам Талант даёт +1 Атаку цепочки за каждое такое убийство
 * — это сама карточка «Жнец» (одно убийство = одна карточка = одна Атака, тратится кнопкой), так что обычному
 * бойцу надбавка к лимиту Атак не нужна и состояния на актора не пишется.
 * Здесь — условие по самому удару: рукопашный, Базой «Натиск», у убийцы есть Талант.
 */
export function reaperTriggered(actor, { melee, chargeBase }) {
  if (!melee || !chargeBase) return false;
  return hasMeleeTalent(actor, "reaper");
}

/**
 * Замер Жнеца по токенам сцены. Метры приходят измеренными; здесь только вердикт.
 *
 * @param {object} p
 * @param {number} p.charge          дистанция Натиска персонажа (SPD×3, system.movement.charge)
 * @param {number} p.halfMove        Полудвижение (SPD, system.movement.halfMove)
 * @param {number} p.walked          сколько метров токен уже прошёл за этот Ход
 * @param {number} p.initialToNext   от начальной цели цепочки до новой цели (центр — центр)
 * @param {number} p.attackerToNext  сколько ещё идти атакующему до базового контакта с новой целью
 * @returns {{ok:boolean, problems:string[], chargeLeft:number}}
 */
export function reaperMeasure({ charge, halfMove, walked, initialToNext, attackerToNext }) {
  const bad = v => v == null || !Number.isFinite(Number(v));
  const problems = [];
  if (bad(initialToNext) || bad(attackerToNext) || bad(walked)) {
    return { ok: false, problems: ["расстояния по токенам не измерены"], chargeLeft: 0 };
  }
  if (!(Number(charge) > 0) || !(Number(halfMove) > 0)) {
    return { ok: false, problems: ["скорость персонажа неизвестна (Натиск или Полудвижение равны нулю)"], chargeLeft: 0 };
  }
  const chargeLeft = Math.max(0, Number(charge) - Number(walked));
  if (Number(initialToNext) > Number(halfMove) + PATH_EPS) {
    problems.push(`от начальной цели до новой ${fmtMeters(initialToNext)} м — дальше Полудвижения (${fmtMeters(halfMove)} м)`);
  }
  if (Number(walked) + Number(attackerToNext) > Number(charge) + PATH_EPS) {
    problems.push(`Натиск: уже пройдено ${fmtMeters(walked)} м, до новой цели ещё ${fmtMeters(attackerToNext)} м — вместе больше дистанции Натиска (${fmtMeters(charge)} м)`);
  }
  return { ok: problems.length === 0, problems, chargeLeft };
}

// ── Свободные рукопашные атаки Талантов ──────────────────────────────────────

/**
 * Что снимает окно атаки с атак, порождённых Талантами (опции techniqueOpts окна):
 * Упорство и Рисовка — свободные и атакой не считаются; Жнец — продолжение Натиска: ОД не
 * списываются (Натиск уже оплачен), а сама атака — дополнительная Атака Таланта (карточка «Жнец»), в лимит Хода не идёт.
 * Яростный Штурм — «еще одна атака ... за свободное действие» (её цена — Реакция, payOnRoll окна).
 * @returns {{noAp:boolean, uncounted:boolean, skipChargeGate:boolean}}
 */
export function freeMeleeFlags(opts) {
  const free = !!(opts?.tenacityRepeat || opts?.showOffFree || opts?.reaperFollow || opts?.furiousAssault || opts?.kneeStrike || opts?.executionFollow);
  return { noAp: free, uncounted: free, skipChargeGate: free };
}

/**
 * Свободные атаки Талантов не должны давать бесплатно поднять Базу или Приём (ОД и лимит с них сняты):
 * Рисовка — «базовая рукопашная атака» (Стандартная База, Обычная Атака); Упорство — «с той же базой
 * и приемом»; Жнец — тот же Натиск (Приём свободный).
 * @param {object} opts  techniqueOpts окна (showOffFree/tenacityRepeat/reaperFollow/furiousAssault, forceBase, technique)
 * @param {{baseKey:string, maneuverKey:string}} sel  выбранное в окне
 * @returns {string} причина отказа или ""
 */
export function freeAttackLockProblem(opts, { baseKey, maneuverKey }) {
  if (opts?.showOffFree) {
    if (baseKey !== "standard") return "Рисовка: свободная атака — Стандартная База";
    if (maneuverKey !== "standard") return "Рисовка: свободная атака — Обычная Атака (без Приёма)";
  }
  if (opts?.tenacityRepeat) {
    if (opts.forceBase && baseKey !== opts.forceBase) return "Упорство: повтор идёт с той же Базой, что и первая атака";
    if (maneuverKey !== (opts.technique || "standard")) return "Упорство: повтор идёт с тем же Приёмом, что и первая атака";
  }
  if (opts?.furiousAssault) {
    if (baseKey !== "fullatk") return "Яростный Штурм: ещё одна атака — с Базой Полная Атака";
    if (maneuverKey !== (opts.technique || "standard")) return "Яростный Штурм: ещё одна атака — с тем же Приёмом";
  }
  if (opts?.kneeStrike) {
    if (baseKey !== "standard") return "Удар с Колена: пинок — Стандартная База";
    if (maneuverKey !== "standard") return "Удар с Колена: пинок — Обычная Атака (без Приёма)";
  }
  if (opts?.executionFollow) {
    if (opts.forceBase && baseKey !== opts.forceBase) return "Казнь: дополнительная атака идёт с той же Базой, что и первая";
    if (maneuverKey !== "standard") return "Казнь: дополнительная атака — Обычная Атака (без Приёма)";
  }
  if (opts?.reaperFollow && baseKey !== "charge") return "Жнец: атака по следующей цели — это тот же Натиск; выберите Базу «Натиск»";
  return "";
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

// ── Прикладный Хват ─────────────────────────────────────────────────────────

/** WS вторичного одноручного хвата штыка с Талантом (вместо –5 как обычно). */
export const STOCK_GRIP_SECONDARY_WS = -10;

/**
 * Прикладный Хват / Stock Grip (core.json, Таланты «Рукопашные»): «Он может
 * использовать штыки в одноручном хвате, это дает –10 на все тесты WS с ними,
 * а не –5 как обычно.»
 *
 * Штык в паке несёт хват «2р (Бл)», одноручного нет, поэтому «1р» ему выдаёт
 * сам Талант (окно атаки и HUD добавляют его в список хватов), а как
 * вторичный хват «1р» тянет остальное по таблице хватов без изменений: –1 куб
 * урона, Баланс –1, +1 Rng. Здесь решается только «Талант есть и это штык».
 */
export function stockGripActive(actor, item) {
  const sys = item?.system;
  if (!sys || sys.weaponClass !== "melee") return false;
  if (String(sys.meleeCategory ?? "").trim() !== "Штык") return false;
  return hasMeleeTalent(actor, "stockGrip");
}

// ── Странная Техника ────────────────────────────────────────────────────────

/**
 * Странная Техника / Strange Technique (core.json, Таланты «Рукопашные»): «Он
 * получает дополнительную Реакцию, которую он может потратить только на атаки,
 * вроде атак хвостом, мехадендритами, или бонусных приемов Повалить от попаданий
 * крюком или посохом, но не для бонусных атак от Таланта Furious Assault.»
 *
 * Это отдельный пул (system.reactions.strangeValue, по образцу defenseValue
 * Защитной Стойки), а не +1 к общему reactions.max, как было раньше: общая
 * Реакция годилась и на Избегание. Максимум не хранится — читается с Таланта.
 *
 * @returns {number} 1 с Талантом, иначе 0
 */
export function strangeReactionMax(actor) {
  return hasMeleeTalent(actor, "strangeTechnique") ? 1 : 0;
}

// ── Подрезать Сухожилья ─────────────────────────────────────────────────────

/** Метка «раз в Ход» Подрезать Сухожилья (apps/game-session.mjs; Ход = Раунд персонажа, см. ниже). */
export const HAMSTRING_ROUND_FLAG = "hamstring";
/** Успехов встречного теста, дающих потерю полудействия в следующий Ход цели. */
export const HAMSTRING_HALF_ACTION_DEG = 5;
/** Приёмы, с которыми Талант не работает (книга: «приемами от Талантов Swift Attack и Lightning Attack»). */
export const HAMSTRING_EXCLUDED_TECHNIQUES = Object.freeze(["swift", "lightning"]);

/**
 * Подрезать Сухожилья / Hamstring (core.json, Таланты «Рукопашные»): «Раз в Ход,
 * когда Избирательная рукопашная атака персонажа в ногу наносит непоглощенный
 * урон по цели, он может пройти встречный тест A+0 vs A+0 и при Успехе сбить цель
 * с ног. Если персонаж побеждает на 5+ Успехов, цель также теряет одно полудействие
 * в свой следующий Ход. Этот Талант не работает с приемами от Талантов Swift Attack
 * и Lightning Attack.»
 *
 * Шаг 1 — в момент атаки: попадание рукопашной Избирательной атакой в Ногу не
 * приёмом Быстрой/Молниеносной Атаки и Талант есть → карточка урона несёт метку.
 *
 * @param {string} p.aimValue    aimTarget.value атаки («leg» — Избирательная в Ногу)
 * @param {string} p.technique   ключ Приёма (MELEE_MANEUVERS)
 */
export function hamstringArmed(actor, { isMelee, hit, aimValue, technique }) {
  if (!isMelee || !hit || aimValue !== "leg") return false;
  if (HAMSTRING_EXCLUDED_TECHNIQUES.includes(technique)) return false;
  return hasMeleeTalent(actor, "hamstring");
}

/**
 * Шаг 2 — в момент урона: кнопка предлагается, если карточка несёт метку, урон
 * реально прошёл (непоглощённый > 0), цель ещё на ногах и в этом Раунде Талант не
 * использован. «Раз в Ход» отмерено Раундом: за Раунд у персонажа один Ход
 * (отдельной единицы «Ход» в системе нет); внеочередные атаки (Свободная Атака)
 * делят с ним метку — осторожная сторона.
 */
export function hamstringOffered(actor, { armed, net, targetProne, roundAvailable }) {
  if (!armed || targetProne || !roundAvailable) return false;
  if (!((Number(net) || 0) > 0)) return false;
  return hasMeleeTalent(actor, "hamstring");
}

// ── Упорство ────────────────────────────────────────────────────────────────

/** Метка Хода: рукопашная атака этого персонажа нанесла непоглощённый урон (turn-flags.mjs гасит с началом Хода). */
export const MELEE_DAMAGE_DEALT_FLAG = "meleeDamageDealtThisTurn";
/**
 * Метка Хода: id карточки атаки, ПО КОТОРОЙ урон уже применён к цели (при любом исходе — даже если
 * всё поглощено). Нужна подтверждению Упорства (решение владельца 26.10.2026): попала, а урон ещё не
 * применён — повтор спрашивает «повторять?». Ставит combat/damage.mjs через combat/tenacity.mjs.
 */
export const MELEE_DAMAGE_APPLIED_FLAG = "meleeDamageAppliedMsg";
/** Приёмы с несколькими попаданиями — не «одиночная» атака (Быстрая/Молниеносная). */
export const TENACITY_MULTI_TECHNIQUES = Object.freeze(["swift", "lightning"]);

/**
 * Упорство / Tenacity (core.json, Таланты «Рукопашные»): «Когда он совершает только
 * одну одиночную рукопашную атаку в Ход, и та не наносит урона, будь то из-за
 * промаха, Избегания, поглощения, или щитов, он может тут же провести эту атаку с
 * той же базой и приемом по той же цели еще раз.»
 *
 * Шаг 1 — на карточке атаки: кнопка есть, если атака рукопашная, одиночная (не
 * Быстрая/Молниеносная и не пара Обеих Рук), единственная в Ходу (счётчик
 * attackActionsThisTurn уже учёл её самое, поэтому ≤ 1) и сама не является
 * повтором Таланта.
 *
 * @param {number} p.attacksThisTurn  значение attackActionsThisTurn после этой атаки
 */
export function tenacityOffered(actor, { isMelee, technique, dual, attacksThisTurn, tenacityChild, showOffChild = false }) {
  // Свободная атака Рисовки «не считается атакой» — повторять её Упорством нельзя (иначе обходит «только одну атаку в Ход»).
  if (!isMelee || dual || tenacityChild || showOffChild) return false;
  if (TENACITY_MULTI_TECHNIQUES.includes(technique)) return false;
  if ((Number(attacksThisTurn) || 0) > 1) return false;
  return hasMeleeTalent(actor, "tenacity");
}

/**
 * Спрашивать ли подтверждение перед повтором (решение владельца 26.10.2026): атака ПОПАЛА, а урон по
 * этой карточке ещё не применён к цели — возможно, игрок нажал Упорство раньше времени.
 */
export function tenacityNeedsConfirm({ hit, damageApplied }) {
  return !!hit && !damageApplied;
}

/**
 * Шаг 2 — в момент клика: единственная атака Хода и ни одна рукопашная атака этого
 * Хода не нанесла урона (метка ставится при применении урона, combat/damage.mjs).
 * Система узнаёт о промахе/Избегании/поглощении не одним сигналом, поэтому «не
 * нанесла урона» — отсутствие этой метки к моменту клика.
 */
export function tenacityAvailable(actor, { attacksThisTurn, damageDealt }) {
  if (damageDealt) return false;
  if ((Number(attacksThisTurn) || 0) > 1) return false;
  return hasMeleeTalent(actor, "tenacity");
}
