// module/rules/technomystic-resources.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Три Таланта Техномистика, перекладывающие ресурсы Механикум (Sahara 3-2501,
//  пачка J, решения владельца 26.10.2026):
//
//   • Катушка Апокрифа — вторая Катушка Потенции: поле на акторе
//     system.apocryphaEnergy {value,max}; её заряды нельзя тратить напрямую,
//     их только переносят между Катушками (полудействие) и заряжают через
//     Электу-Индукторы. Максимум = база основной Катушки БЕЗ бонусов Талантов
//     (книга: «Таланты и Трейты, что увеличивают максимальный заряд основной
//     Катушки, не влияют на Катушку Апокрифу»);
//   • Облачная Когниция — до 2 ⚙ согласному подключённому к Ноосфере; цель не
//     может получить так больше ½I.b (окр.▲) ⚙ в Раунд;
//   • Мотивное Причастие — до 3 ⚡ в Катушки цели в базовом контакте.
//
//  Чистый модуль без Foundry; вызывают его sheets/tabs/tech.mjs, расчёт актора
//  (rules/character/final-pools.mjs) и ГМ-релей (combat/gm-relay.mjs). Не
//  импортируется из sources.mjs. Таланты опознаются по имени (долг wdbc-iadw):
//  имя — литералом в каждом вызове itemHasName, так их находит
//  tools/capability-reachability.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

const talentsWhere = (actor, pred) =>
  [...(actor?.items ?? [])].filter(i => i?.type === "talent" && pred(i));

const isApocrypha = i => itemHasName(i, "Apocrypha Coil") || itemHasName(i, "Катушка Апокрифа");
const isCloud     = i => itemHasName(i, "Cloud Cognition") || itemHasName(i, "Облачная Когниция");
const isMotive    = i => itemHasName(i, "Motive Eucharist") || itemHasName(i, "Мотивное Причастие");

export const hasApocryphaCoil  = actor => talentsWhere(actor, isApocrypha).length > 0;
export const hasCloudCognition = actor => talentsWhere(actor, isCloud).length > 0;
export const hasMotiveEucharist = actor => talentsWhere(actor, isMotive).length > 0;

/** «Раз в Ход» — метки гаснут с началом следующего Хода (rules/turn-flags.mjs). */
export const CLOUD_COGNITION_TURN_FLAG = "cloudCognitionThisTurn";
export const MOTIVE_EUCHARIST_TURN_FLAG = "motiveEucharistThisTurn";
/** Сколько ⚙ ЦЕЛЬ уже получила Облачной Когницией в этом Раунде (от начала её Хода до начала следующего). */
export const CLOUD_COGNITION_RECEIVED_FLAG = "cloudCognitionReceived";

export const CLOUD_COGNITION_MAX = 2;
export const MOTIVE_EUCHARIST_MAX = 3;

const int0 = v => Math.max(0, Math.trunc(Number(v) || 0));

// ── Катушка Апокрифа ─────────────────────────────────────────────────────────

/**
 * Максимум Катушки Апокрифа: ручная база + заряд самого импланта «Катушка Потенции»
 * (решение владельца 27.10.2026) — но НЕ Мотивные Банки и прочие импланты, НЕ Талант
 * «Силовой Заряд» и прочие Таланты/Трейты, увеличивающие основную Катушку.
 */
export function apocryphaMax({ manualMax = 0, implantMax = 0 } = {}) {
  return Math.max(0, (Number(manualMax) || 0) + (Number(implantMax) || 0));
}

/**
 * Перенос ⚡ между Катушками без тестов («за полудействие»). Переносится не
 * больше запрошенного, не больше заряда источника и не больше свободного места
 * в приёмнике.
 *
 * @param {{direction:"toApocrypha"|"fromApocrypha", amount:number,
 *          main:{value:number,max:number}, apoc:{value:number,max:number}}} p
 *   main.max — полный максимум основной Катушки (maxTotal)
 * @returns {{ok:boolean, moved:number, main:number, apoc:number, reason?:"source"|"full"|"amount"|"direction"}}
 *   main/apoc — заряды после переноса
 */
export function planCoilTransfer({ direction, amount, main = {}, apoc = {} } = {}) {
  const mainV = int0(main.value), apocV = int0(apoc.value);
  const stay = { main: mainV, apoc: apocV, moved: 0 };
  if (direction !== "toApocrypha" && direction !== "fromApocrypha") return { ok: false, ...stay, reason: "direction" };
  const want = int0(amount);
  if (want < 1) return { ok: false, ...stay, reason: "amount" };
  const toApoc = direction === "toApocrypha";
  const from = toApoc ? mainV : apocV;
  const room = Math.max(0, toApoc ? int0(apoc.max) - apocV : int0(main.max) - mainV);
  if (from < 1) return { ok: false, ...stay, reason: "source" };
  if (room < 1) return { ok: false, ...stay, reason: "full" };
  const moved = Math.min(want, from, room);
  return {
    ok: true, moved,
    main: toApoc ? mainV - moved : mainV + moved,
    apoc: toApoc ? apocV + moved : apocV - moved
  };
}

// ── Облачная Когниция ────────────────────────────────────────────────────────

/** Потолок ⚙ в Раунд для цели: ½I.b (окр.▲) ЦЕЛИ (решение владельца 27.10.2026). */
export function cloudCognitionCap(target) {
  return Math.ceil(int0(target?.system?.characteristics?.int?.bonus) / 2);
}

/**
 * Счётчик «получено в этом Раунде» лежит флагом на цели как { combat, n } и засчитывается только в
 * том бою, где записан: гасит его начало Хода цели (rules/turn-flags.mjs), а метка конца/смены боя
 * не переживает (иначе в следующем бою передающий упирался бы в чужой потолок).
 */
export const receivedNow = (flag, combatId) =>
  flag && typeof flag === "object" && String(flag.combat ?? "") === String(combatId ?? "") ? int0(flag.n) : 0;
export const receivedFlagValue = (flag, combatId, add) =>
  ({ combat: String(combatId ?? ""), n: receivedNow(flag, combatId) + int0(add) });

/**
 * Сколько ⚙ реально перейдёт к цели. Книга: до 2 своей ⚙; цель не может
 * восстановить Талантом больше потолка в Раунд.
 *
 * @param {{amount:number, giverCognition:number, receiver:{value:number,max:number}, received:number, cap:number}} p
 * @returns {{ok:boolean, moved:number, reason?:"giver"|"full"|"cap"|"amount"}}
 */
export function planCloudCognition({ amount, giverCognition, receiver = {}, received = 0, cap = 0 } = {}) {
  const want = Math.min(int0(amount), CLOUD_COGNITION_MAX);
  if (want < 1) return { ok: false, moved: 0, reason: "amount" };
  const have = int0(giverCognition);
  if (have < 1) return { ok: false, moved: 0, reason: "giver" };
  const room = Math.max(0, int0(receiver.max) - int0(receiver.value));
  if (room < 1) return { ok: false, moved: 0, reason: "full" };
  const left = Math.max(0, int0(cap) - int0(received));
  if (left < 1) return { ok: false, moved: 0, reason: "cap" };
  return { ok: true, moved: Math.min(want, have, room, left) };
}

// ── Мотивное Причастие ───────────────────────────────────────────────────────

/**
 * Сколько ⚡ перейдёт в Катушки цели и как они распределятся: сначала основная,
 * излишек — в Катушку Апокрифа цели, если она у неё есть.
 *
 * @param {{amount:number, giverEnergy:number,
 *          receiver:{main:{value:number,max:number}, apoc:?{value:number,max:number}}}} p
 *   receiver.main.max — полный максимум основной Катушки цели (maxTotal)
 * @returns {{ok:boolean, moved:number, toMain:number, toApoc:number, reason?:"giver"|"full"|"amount"}}
 */
export function planMotiveEucharist({ amount, giverEnergy, receiver = {} } = {}) {
  const none = { moved: 0, toMain: 0, toApoc: 0 };
  const want = Math.min(int0(amount), MOTIVE_EUCHARIST_MAX);
  if (want < 1) return { ok: false, ...none, reason: "amount" };
  const have = int0(giverEnergy);
  if (have < 1) return { ok: false, ...none, reason: "giver" };
  const mainRoom = Math.max(0, int0(receiver.main?.max) - int0(receiver.main?.value));
  const apocRoom = receiver.apoc ? Math.max(0, int0(receiver.apoc.max) - int0(receiver.apoc.value)) : 0;
  if (mainRoom + apocRoom < 1) return { ok: false, ...none, reason: "full" };
  const moved = Math.min(want, have, mainRoom + apocRoom);
  const toMain = Math.min(moved, mainRoom);
  return { ok: true, moved, toMain, toApoc: moved - toMain };
}
