// module/rules/talent-moves.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ДВИЖЕНИЕ ПО ТАЛАНТУ — данные (Sahara task-bbe1, решение владельца 27.10.2026).
//
//  Таланты и Черты, дающие Движение вне обычных кнопок меню Движения, у которых
//  своей механики в коде нет: лимит пути (rules/movement-path.mjs) такое
//  перетаскивание блокировал, потому что бюджет Хода пишут только объявленные
//  Движения. Общий пункт меню «Движение по Таланту» (combat/talent-move.mjs)
//  читает ЭТУ таблицу: что за Движение, какая дистанция, сколько стоит, как часто
//  можно. Цифры — по тексту Таланта (packs-src), не в коде кнопок.
//
//  Виды Движения (`mode`):
//   walk     — пеший сдвиг: система пишет дистанцию в бюджет пути (grantMoveAllowance);
//   teleport — перенос токена в точку (combat/token-teleport.mjs): путь не меряется,
//              стены учитываются.
//  Дистанция (`distance`): { of } — поле system.movement (halfMove/move/charge/run);
//  { pb } — P.b метров; { unlimited } — телепорт без потолка.
//  Множители Черт (Почитатели Танца, Акробатическое Мастерство, Разящее Представление) здесь
//  НЕ живут: дистанции считает лист (rules/speed-multipliers.mjs → rules/character/movement.mjs),
//  поэтому обычные кнопки Движения уже дают книжный бюджет.
//  Цена (`cost`): ap — ОД, reactions — Реакции, trophy — Очки Трофеев (пул system.trophyPoints,
//  rules/trophy-points.mjs). Очки Бесчестия/Боли списываются игроком руками (в `note`).
//
//  Чего здесь НЕТ (текст не про Движение по Ходу владельца / нет карты): Момент Танца,
//  Пропустить, Затопот (Реакция или принуждение чужого токена — лимит на чужом Ходу
//  не действует, двигает ГМ), Со Скоростью Мысли (перелёт по звёздной системе — не
//  тактическая карта), Разрыватель Завесы (уход в Варп, не перемещение), Психический
//  Рывок и Скорость Феникса (баффы SPD/ОД, не Движение).
//
//  Чистый модуль: ни одного обращения к Foundry, кроме чтения предметов актора.
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "./flags.mjs";
import { moveDegreeFromPath } from "./movement-path.mjs";

/** Виды Движения по Таланту. */
export const TALENT_MOVE_MODES = Object.freeze(["walk", "teleport"]);

/**
 * @typedef {object} TalentMove
 * @property {string} id
 * @property {string} label
 * @property {"walk"|"teleport"} mode
 * @property {object} distance
 * @property {{ap?:number, reactions?:number, trophy?:number}} [cost]
 * @property {{unit:"round"|"battle"}} [limit]   раз в Раунд / раз за бой
 * @property {number} [onlyRound]                только в этом Раунде боя
 * @property {boolean} [noFreeAttack]            не провоцирует Свободную Атаку (флаг Выхода из Боя)
 * @property {boolean} [requiresNotMoved]        только если персонаж не двигался (flags.movedThisTurn); ГМ обходит
 * @property {string} condition                  условие из текста (подтверждает игрок)
 * @property {string} [note]                     что остаётся делать руками
 */

/**
 * Таблица Талантов/Черт с Движением. `match` — альтернативы по имени предмета (любая половина
 * «English / Русское»); по ним же носителя опознаёт tools/capability-reachability.mjs.
 */
export const TALENT_MOVES = Object.freeze([
  {
    id: "danceOfCarnage", label: "Танец Рассечения", match: /Dance of Carnage|Танец Рассечения/i, itemTypes: ["talent"],
    capabilityKey: "exodite.warDancer.danceOfCarnage",
    moves: [{
      id: "carnage", label: "Рывок после 5+ Успехов", mode: "walk",
      distance: { of: "halfMove" }, cost: {},
      condition: "Рукопашная атака удалась с 5+ Успехами (стр. Танцора Войны).",
      note: "Вошли в контакт с противником — атака по нему свободным действием со штрафом −30 (вручную)."
    }]
  },
  {
    id: "mercenaryOfTheMatter", label: "Наёмник Дела", match: /Mercenary of the Matter|Наёмник Дела/i, itemTypes: ["trait"],
    capabilityKey: "trait.elitnyeArhetipy.inkub.mercenaryOfTheMatter",
    moves: [{
      id: "firstRoundFullMove", label: "Бесплатное Полное Движение", mode: "walk",
      distance: { of: "move" }, cost: {}, limit: { unit: "battle" }, onlyRound: 1,
      condition: "Первый Раунд боя."
    }]
  },
  {
    id: "speedOfTheFaolchu", label: "Скорость Сокола", match: /Speed of the Faolchú|Скорость Сокола/i, itemTypes: ["talent"],
    capabilityKey: "movement.outOfCombatSpdBonus",
    moves: [
      {
        id: "reactionHalf", label: "Полудвижение за Реакцию", mode: "walk",
        distance: { of: "halfMove" }, cost: { reactions: 1 }, noFreeAttack: true, requiresNotMoved: true,
        condition: "Персонаж не двигался с начала своего последнего Хода (система сверяет флаг «двигался»); не активирует сам Талант."
      },
      {
        id: "reactionFull", label: "Полное Движение за 2 Реакции", mode: "walk",
        distance: { of: "move" }, cost: { reactions: 2 }, noFreeAttack: true, requiresNotMoved: true,
        condition: "Персонаж не двигался с начала своего последнего Хода (система сверяет флаг «двигался»); не активирует сам Талант."
      }
    ]
  },
  {
    id: "mistLeap", label: "Туманный Прыжок", match: /Mist Leap|Туманный Прыжок/i, itemTypes: ["talent"],
    capabilityKey: "elite.elitnyeArhetipy.masterKazney.mistLeap",
    moves: [{
      id: "leap", label: "Прыжок-телепорт к добыче (считается Натиском)", mode: "teleport",
      distance: { unlimited: true }, cost: { ap: 2, trophy: 1 },
      condition: "Достойная трофея добыча в пределах Unnatural Senses; нужен Трейт Mistwalker.",
      note: "Очко Трофеев списывается автоматически; встаньте в базовый контакт с добычей; для атаки объявите Базу «Натиск»."
    }]
  },
  {
    id: "mistwalker", label: "Туманоходец", match: /Mistwalker|Туманоходец/i, itemTypes: ["trait"],
    capabilityKey: "trait.elitnyeArhetipy.masterKazney.mistwalker",
    moves: [{
      id: "mist", label: "Облако тумана (телепорт на P.b м)", mode: "teleport",
      distance: { pb: 1 }, cost: {}, limit: { unit: "round" },
      condition: "Не в терминаторском доспехе и не в экзо-костюме; не дальше ближайшего достойного трофея противника, чем начали.",
      note: "Выход из Захвата и снятие пут — вручную."
    }]
  }
]);

/** Какие Движения по Таланту есть у актора (по имени предмета или по ключу Возможности). */
export function talentMoveDefsFor(actor) {
  return TALENT_MOVES.filter(def =>
    (actor?.items ?? []).some(i => def.itemTypes.includes(i?.type) && def.match.test(String(i.name ?? "")))
    || (!!def.capabilityKey && hasRuleFlag(actor, def.capabilityKey)));
}

/**
 * Сколько метров даёт это Движение сейчас.
 * @param {TalentMove} move
 * @param {{movement?:object, pb?:number}} ctx
 * @returns {{ok:boolean, meters:number|null, unlimited?:boolean, reason?:string}}
 */
export function resolveTalentMoveMeters(move, ctx = {}) {
  const d = move?.distance ?? {};
  const mv = ctx.movement ?? {};
  if (d.unlimited) return { ok: true, meters: null, unlimited: true };
  if (d.of) {
    const m = Number(mv[d.of]);
    return Number.isFinite(m) && m > 0 ? { ok: true, meters: m } : { ok: false, meters: 0, reason: "Дистанция Движения на листе неизвестна." };
  }
  if (d.pb) {
    const m = (Number(ctx.pb) || 0) * Number(d.pb);
    return m > 0 ? { ok: true, meters: m } : { ok: false, meters: 0, reason: "Бонус Восприятия (P.b) неизвестен." };
  }
  return { ok: false, meters: 0, reason: "Дистанция не задана." };
}

/**
 * Можно ли начать это Движение: Раунд, Реакции, ОД (то, что видно без Foundry).
 * @param {TalentMove} move
 * @param {{round?:number, inCombat?:boolean, reactions?:number, ap?:number, trophy?:number, limitReady?:boolean,
 *   moved?:boolean, isGM?:boolean}} ctx  moved — флаг «двигался» (movedThisTurn); isGM — ГМ обходит условие
 * @returns {{ok:boolean, reason?:string}}
 */
export function talentMoveGate(move, ctx = {}) {
  if (move.onlyRound && ctx.inCombat && Number(ctx.round) !== move.onlyRound) {
    return { ok: false, reason: `Только в ${move.onlyRound}-м Раунде боя (сейчас ${ctx.round}-й).` };
  }
  if (move.limit && ctx.limitReady === false) {
    return { ok: false, reason: move.limit.unit === "battle" ? "Уже использовано в этом бою." : "Уже использовано в этом Раунде." };
  }
  // «Если не двигался»: флаг movedThisTurn живёт с первого движения до начала следующего Хода
  // владельца (turn-flags.mjs) — то же измерение, что у Импульсного оружия. ГМ условие обходит.
  if (move.requiresNotMoved && ctx.moved && !ctx.isGM) {
    return { ok: false, reason: "Двигался с начала своего последнего Хода (флаг «двигался» стоит) — условие Таланта не выполнено." };
  }
  const reactions = move.cost?.reactions ?? 0;
  if (reactions && ctx.inCombat && (Number(ctx.reactions) || 0) < reactions) {
    return { ok: false, reason: `Нужно Реакций: ${reactions}, есть ${Number(ctx.reactions) || 0}.` };
  }
  const ap = move.cost?.ap ?? 0;
  if (ap && ctx.inCombat && (Number(ctx.ap) || 0) < ap) {
    return { ok: false, reason: `Нужно ОД: ${ap}, есть ${Number(ctx.ap) || 0}.` };
  }
  // Очки Трофеев — не экономика Хода: нужны и вне боя.
  const trophy = move.cost?.trophy ?? 0;
  if (trophy && (Number(ctx.trophy) || 0) < trophy) {
    return { ok: false, reason: `Нужно Очков Трофеев: ${trophy}, есть ${Number(ctx.trophy) || 0}.` };
  }
  return { ok: true };
}

/** «2 ОД», «1 Реакция», «2 Реакции», «бесплатно». */
export function talentMoveCostLabel(move) {
  const parts = [];
  const ap = move.cost?.ap ?? 0;
  const r = move.cost?.reactions ?? 0;
  if (ap) parts.push(`${ap} ОД`);
  if (r) parts.push(r === 1 ? "1 Реакция" : `${r} Реакции`);
  const t = move.cost?.trophy ?? 0;
  if (t) parts.push(t === 1 ? "1 Очко Трофеев" : `${t} Очка Трофеев`);
  return parts.length ? parts.join(" + ") : "бесплатно";
}

/** Категория Хода для Выстрела Навскидку по дистанции этого Движения. */
export function talentMoveDegree(meters, halfMove) {
  return moveDegreeFromPath(meters, halfMove);
}

/** Ключ флага «раз в Раунд/бой» для Движения по Таланту. */
export const talentMoveLimitKey = (defId, moveId) => `talentMove.${defId}.${moveId}`;
