// module/combat/gm-relay.mjs
// ════════════════════════════════════════════════════════════════════════
//  ЗАПИСЬ В ЧУЖОГО АКТОРА-ЦЕЛЬ ЧЕРЕЗ ГМа (Sahara riding-the-momentum, п. 2).
//
//  Захват, Повал, Жокей, Удушение, Вдохновить Гнев пишут в актора-ЦЕЛЬ с
//  клиента инициатора. Игрок почти никогда не «владеет» NPC, на которого
//  действует, — запись падала на проверке прав Foundry, причём УЖЕ ПОСЛЕ
//  записи на самого игрока: он оказывался в Захвате, а противник — нет.
//
//  Тот же приём, что relayItemUpdate (helpers/utils.mjs) и updateOrRelay
//  (combat/command-state.mjs): владелец/ГМ пишет сам, иначе правка уходит
//  активному ГМу системным сокетом. Сокет открыт ЛЮБОМУ клиенту, поэтому ГМ
//  принимает не произвольную правку, а узкий список (checkTargetWrite):
//    • update — только Состояния «Борьба»/«Ничком» и флаги Захвата/Жокея;
//    • addFatigue — Усталость хватки Удушения (1…20);
//    • inspireHatred — по сокету идёт только цель Ненависти, предмет собирает сам
//      ГМ из шаблона компендиума; нужен Талант Inspire Wrath у инициатора.
//    • apDebt — Подрезать Сухожилья на 5+ Успехов: цель теряет полудействие в свой следующий Ход
//      (долг ОД, тот же флаг, что у Пожирателя Времени); полезной нагрузки нет, нужен Талант Hamstring
//      у инициатора.
//    • dreadWailFear — Страх 2 до конца боя от звуковой волны Грозного Вопля: клиент
//      присылает только «вид», эффект и срок собирает ГМ (timed-effects.mjs); нужна
//      Черта Dread Wail у инициатора.
//    • applyDamage — урон приёма (Заломить, Укус, Хруст, Повалить на 5+): ГМ сам
//      гоняет applyDamageToActor, клиент присылает только узкий список полей урона;
//      источник «grapple» требует партнёра по Борьбе, «contact» — рукопашный урон
//      с потолком (Sahara npc-applydamagetoactor).
//    • grantCognition / grantEnergy — Облачная Когниция (до 2 ⚙) и Мотивное
//      Причастие (до 3 ⚡), пачка J (Sahara 3-2501): клиент присылает только число,
//      ГМ сам пересчитывает по данным цели (свободное место, потолок ½I.b за Раунд,
//      Апокрифа цели); нужен соответствующий Талант у инициатора, а для ⚙ — цель,
//      подключённая к Ноосфере. Расстояние и согласие цели ведёт стол. Записи по одной
//      цели идут по очереди (SERIAL_KINDS), чтобы две одновременные передачи складывались.
//    • singForMeDamage / singForMeBoon / wallPush — Шумовой Десантник (Sahara 1-54b9): «Спой Мне!»
//      (2d10 непоглощаемого R урона жертве; +1 Очко Бесчестия и снятие Усталости палачу и наблюдателям —
//      поклонникам Слаанеш) и Стена Диссонанса (отброс токена цели; дальность ограничена Cor.b×3 м
//      инициатора, сверяет ГМ). Нужен соответствующий Талант у инициатора.
//    • harbingerMark / litanyBlessing / layOnHands / martyrSummon — Тёмный Апостол (Sahara 1-54b9): метка обращения
//      или Правоверного, Литания Хаоса подчинённому, Порча и мутация по Возложению Рук, демон на месте Мученика.
//      Нужен соответствующий Талант или Черта у инициатора; предметы, Порчу и демона собирает сам ГМ.
//    • saviorSwap — Спаситель Туманов (Мастер Казней, Sahara 1-54b9): токен союзника встаёт на прежнее место
//      инициатора (обмен местами). Нужен Талант Mist Savior у инициатора; ГМ сверяет, что инициатор уже стоит на месте
//      союзника и что цель переноса не дальше предела (P.b или Полудвижение инициатора).
//  Просящий обязан владеть актором-инициатором (ГМ сверяет сам).
//
//  Порядок у вызывающего: сперва запись в цель (writeToTarget вернул false —
//  записать некому, инициатора не трогаем), потом запись в себя. Так отказ не
//  оставляет игрока в Захвате в одиночку.
// ════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "../rules/flags.mjs";
import { hasInspireWrath, inspiredHatredData, HATRED_PACK_ID } from "../rules/inspire-wrath.mjs";
import { hasAbility } from "../rules/ability-by-key.mjs";
import {
  hasHarbingerOfHeresy, hasLitanyOfChaos, hasLayOnHands, hasMartyr, litanyOptions, isSubordinateOf, isFaithfulOf,
  LAY_ON_HANDS_USAGE
} from "../rules/dark-apostle.mjs";
import { isThrottleReady } from "../rules/cooldown.mjs";
import { hasMistSavior } from "../rules/master-of-executions.mjs";
import {
  hasIronCage, hasCellOfShame, hasEmpyreanWhip, hasRunDown, brokenOf, flagSmithIs, isBrokenBySmith, runDownMarkOf, clampRoll,
  RUN_DOWN_STRUCTURE_MAX, RUN_DOWN_HELPLESS_MAX, RUN_DOWN_WP_MAX
} from "../rules/warpsmith.mjs";
import { mutationCatalog } from "../constants/mutations.mjs";
import { hasMeleeTalent } from "../rules/melee-talents.mjs";
import { DEVOURER_OF_TIME_AP_DEBT_FLAG } from "./devourer-of-time.mjs";
import { hasCloudCognition, hasMotiveEucharist, hasApocryphaCoil, planCloudCognition, planMotiveEucharist,
         cloudCognitionCap, receivedNow, receivedFlagValue, CLOUD_COGNITION_MAX, MOTIVE_EUCHARIST_MAX, CLOUD_COGNITION_RECEIVED_FLAG }
  from "../rules/technomystic-resources.mjs";

/** Какие поля урона приёма разрешено присылать по сокету и их типы (applyDamage). */
export const RELAY_DAMAGE_FIELDS = Object.freeze({
  rawDamage: "number", penetration: "number", damageType: "string", damageSubtype: "string", hitLocation: "string",
  melee: "boolean", ignoreArmour: "boolean", primitive: "boolean",
  attackerName: "string", attackerUuid: "string", weaponName: "string"
});
/** Потолки: Заломить/Укус/Хруст/Повалить дают десятки единиц, не сотни. */
export const RELAY_DAMAGE_MAX = 80;
export const RELAY_PEN_MAX = 30;
/** Потолок урона источника «contact» (Повалить на 5+ — 1d5+S.b). */
export const RELAY_CONTACT_DAMAGE_MAX = 25;
const RELAY_DAMAGE_TYPES = ["energy", "impact", "rending", "blast", "chemical"];
const RELAY_DAMAGE_SOURCES = ["grapple", "contact"];

const NS = "warhammer-dbc";

/** Действие сокета (warhammer-dbc.mjs). */
export const TARGET_WRITE_ACTION = "targetActorWrite";

/** Флаги Захвата/Жокея, которые разрешено писать в цель (имена — grapple.mjs, jockey.mjs; сверяет тест). */
export const RELAY_TARGET_FLAGS = Object.freeze([
  "grapplePartnerUuid", "grappleRole", "grappleHands", "grappleHeldHands", "grappleTail",
  "grappleSqueezePending", "grappleSqueezeActive", "pinDownHold", "vastGrappleSize",
  "jockeyMountedBy", "jockeyRiding", "leapUpDenied", "bladeBindingBy", "bladeBindingWeapon", "bladeBindingOwner"
]);
/** Состояния, которые можно наложить/снять на цель из этих приёмов. */
export const RELAY_TARGET_CONDITIONS = Object.freeze(["grappling", "prone"]);
/** Верхняя граница Усталости за одну запись: Удушение даёт единицы, не десятки. */
export const RELAY_FATIGUE_MAX = 20;

const FLAG_PREFIX = `flags.${NS}.`;
const COND_PREFIX = "system.conditions.";

/**
 * Допустима ли запись. Чистая функция: контекст (владеет ли просящий
 * инициатором, есть ли у того Талант) приходит снаружи.
 *
 * @param {{kind:string}} op
 * @param {{initiatorOwned?:boolean, initiator?:object}} ctx
 * @returns {{ok:boolean, reason?:string}}
 */
export function checkTargetWrite(op, ctx = {}) {
  if (!op || typeof op !== "object") return { ok: false, reason: "нет операции" };
  if (!ctx.initiatorOwned) return { ok: false, reason: "просящий не владеет инициатором" };

  if (op.kind === "update") {
    const data = op.data;
    if (!data || typeof data !== "object" || !Object.keys(data).length) return { ok: false, reason: "пустая правка" };
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith(COND_PREFIX)) {
        const name = key.slice(COND_PREFIX.length);
        if (!RELAY_TARGET_CONDITIONS.includes(name) || typeof value !== "boolean") {
          return { ok: false, reason: `Состояние вне списка: ${key}` };
        }
        continue;
      }
      if (key.startsWith(FLAG_PREFIX)) {
        const rest = key.slice(FLAG_PREFIX.length);
        const removal = rest.startsWith("-=");
        const name = removal ? rest.slice(2) : rest;
        if (!RELAY_TARGET_FLAGS.includes(name)) return { ok: false, reason: `флаг вне списка: ${key}` };
        if (removal ? value !== null : !["string", "number", "boolean"].includes(typeof value)) {
          return { ok: false, reason: `недопустимое значение: ${key}` };
        }
        continue;
      }
      return { ok: false, reason: `путь вне списка: ${key}` };
    }
    return { ok: true };
  }

  if (op.kind === "addFatigue") {
    const n = Number(op.amount);
    if (!Number.isInteger(n) || n < 1 || n > RELAY_FATIGUE_MAX) return { ok: false, reason: "Усталость вне 1…20" };
    return { ok: true };
  }

  // Вдохновить Гнев: по сокету идёт ТОЛЬКО цель Ненависти, а сам предмет ГМ собирает из шаблона
  // компендиума (performTargetWrite) — клиент не может подложить в «Hatred» свои эффекты и Механику.
  if (op.kind === "inspireHatred") {
    if (!hasInspireWrath(ctx.initiator)) return { ok: false, reason: "у инициатора нет Inspire Wrath" };
    if (!validHatredTarget(op.target)) return { ok: false, reason: "недопустимая цель Ненависти" };
    return { ok: true };
  }

  // Подрезать Сухожилья (5+ Успехов): +1 ОД долга цели; число и флаг зашиты ниже, клиент не задаёт ничего.
  if (op.kind === "apDebt") {
    if (Object.keys(op).some(k => k !== "kind")) return { ok: false, reason: "apDebt: лишние поля" };
    if (!hasMeleeTalent(ctx.initiator, "hamstring")) return { ok: false, reason: "у инициатора нет Hamstring" };
    return { ok: true };
  }

  // Грозный Вопль, ветка «Страх 2 до конца боя»: полезной нагрузки нет вовсе — рейтинг, срок
  // и ключ изменения зашиты в timed-effects.mjs::dreadWailFearEffectData, клиент их задать не может.
  if (op.kind === "dreadWailFear") {
    if (Object.keys(op).some(k => k !== "kind")) return { ok: false, reason: "dreadWailFear: лишние поля" };
    if (!hasAbility(ctx.initiator, "ability.dreadWail", "Dread Wail", "trait")) return { ok: false, reason: "у инициатора нет Dread Wail" };
    return { ok: true };
  }

  // Спой Мне! (Шумовой Десантник): урон — одно целое 2…20 (2d10), награда — без полезной нагрузки и только палачу
  // или поклоннику Слаанеш; Стена Диссонанса: токен и точка, дальность сверяет ГМ при исполнении.
  if (op.kind === "singForMeDamage") {
    if (Object.keys(op).some(k => k !== "kind" && k !== "amount")) return { ok: false, reason: "singForMeDamage: лишние поля" };
    if (!Number.isInteger(op.amount) || op.amount < 2 || op.amount > 20) return { ok: false, reason: "singForMeDamage: урон вне 2…20" };
    if (!hasAbility(ctx.initiator, "ability.singForMe", "Sing For Me!", "talent")) return { ok: false, reason: "у инициатора нет Sing For Me" };
    return { ok: true };
  }
  if (op.kind === "singForMeBoon") {
    if (Object.keys(op).some(k => k !== "kind")) return { ok: false, reason: "singForMeBoon: лишние поля" };
    if (!hasAbility(ctx.initiator, "ability.singForMe", "Sing For Me!", "talent")) return { ok: false, reason: "у инициатора нет Sing For Me" };
    const self = ctx.target && ctx.initiator && ctx.target.uuid === ctx.initiator.uuid;
    if (!self && !hasRuleFlag(ctx.target, "dreadWail.immune")) return { ok: false, reason: "получатель не поклонник Слаанеш" };
    return { ok: true };
  }
  if (op.kind === "wallPush") {
    if (Object.keys(op).some(k => !["kind", "tokenUuid", "x", "y"].includes(k))) return { ok: false, reason: "wallPush: лишние поля" };
    if (typeof op.tokenUuid !== "string" || op.tokenUuid.length > 200) return { ok: false, reason: "wallPush: нет токена" };
    if (!Number.isFinite(op.x) || !Number.isFinite(op.y)) return { ok: false, reason: "wallPush: точка вне числа" };
    if (!hasAbility(ctx.initiator, "ability.wallOfDiscord", "Wall of Discord", "talent")) return { ok: false, reason: "у инициатора нет Wall of Discord" };
    return { ok: true };
  }

  if (op.kind === "warpsmith") {
    const allowed = { cage: ["action"], cageRelease: ["action"], cell: ["action", "deviceName"], cellFree: ["action"], whip: ["action"],
      runDown: ["action"], runDownPay: ["action", "structure", "helpless", "wp"] }[op.action];
    if (!allowed) return { ok: false, reason: `warpsmith: действие вне списка: ${op.action}` };
    if (Object.keys(op).some(k => k !== "kind" && !allowed.includes(k))) return { ok: false, reason: "warpsmith: лишние поля" };
    const me = ctx.initiator;
    const same = flag => flagSmithIs(flag, me, a => new Set([a?.uuid].filter(Boolean)));
    const mine = target => isBrokenBySmith(target, me, a => new Set([a?.uuid].filter(Boolean)));
    if (op.action === "cage") return hasIronCage(me) ? { ok: true } : { ok: false, reason: "у инициатора нет Iron Cage" };
    if (op.action === "cageRelease") {
      if (!hasIronCage(me)) return { ok: false, reason: "у инициатора нет Iron Cage" };
      const flag = brokenOf(ctx.target);
      return flag?.state === "caged" && same(flag) ? { ok: true } : { ok: false, reason: "цель не заарканена инициатором" };
    }
    if (op.action === "cell") {
      if (!hasCellOfShame(me)) return { ok: false, reason: "у инициатора нет Cell of Shame" };
      if (op.deviceName !== undefined && (typeof op.deviceName !== "string" || op.deviceName.length > 200)) return { ok: false, reason: "cell: имя устройства" };
      return mine(ctx.target) && !brokenOf(ctx.target)?.cell ? { ok: true } : { ok: false, reason: "цель не Сломлена инициатором или уже в ячейке" };
    }
    if (op.action === "cellFree") {
      if (!hasCellOfShame(me)) return { ok: false, reason: "у инициатора нет Cell of Shame" };
      return brokenOf(ctx.target)?.cell ? { ok: true } : { ok: false, reason: "цель не в ячейке" };
    }
    if (op.action === "whip") {
      if (!hasEmpyreanWhip(me)) return { ok: false, reason: "у инициатора нет Empyrean Whip" };
      return mine(ctx.target) ? { ok: true } : { ok: false, reason: "цель не Сломлена инициатором" };
    }
    if (op.action === "runDown") {
      if (!hasRunDown(me)) return { ok: false, reason: "у инициатора нет Run Down" };
      return mine(ctx.target) ? { ok: true } : { ok: false, reason: "цель не Сломлена инициатором" };
    }
    if (!hasRunDown(me)) return { ok: false, reason: "у инициатора нет Run Down" };
    const mark = runDownMarkOf(ctx.target);
    if (!mark || !same({ smithUuid: mark.smithUuid, smithUuids: mark.smithUuids })) return { ok: false, reason: "цель не загнана инициатором" };
    if (clampRoll(op.structure, RUN_DOWN_STRUCTURE_MAX) == null || clampRoll(op.helpless, RUN_DOWN_HELPLESS_MAX) == null
      || clampRoll(op.wp, RUN_DOWN_WP_MAX) == null) return { ok: false, reason: "runDownPay: число вне потолка" };
    return { ok: true };
  }
  if (op.kind === "saviorSwap") {
    if (Object.keys(op).some(k => !["kind", "tokenUuid", "x", "y"].includes(k))) return { ok: false, reason: "saviorSwap: лишние поля" };
    if (typeof op.tokenUuid !== "string" || op.tokenUuid.length > 200) return { ok: false, reason: "saviorSwap: нет токена" };
    if (!Number.isFinite(op.x) || !Number.isFinite(op.y)) return { ok: false, reason: "saviorSwap: точка вне числа" };
    if (!hasMistSavior(ctx.initiator)) return { ok: false, reason: "у инициатора нет Mist Savior" };
    return { ok: true };
  }

  // Тёмный Апостол (Sahara 1-54b9): метка обращения/Правоверного, Литания, Возложение Рук, Мученик.
  // Полезная нагрузка — узкая: имя Бога, имя мутации из таблицы, число Порчи, имя демона; предметы и Порчу собирает ГМ сам.
  if (op.kind === "harbingerMark") {
    if (Object.keys(op).some(k => k !== "kind" && k !== "mark")) return { ok: false, reason: "harbingerMark: лишние поля" };
    if (op.mark !== "convert" && op.mark !== "faithful") return { ok: false, reason: "harbingerMark: метка вне списка" };
    if (!hasHarbingerOfHeresy(ctx.initiator)) return { ok: false, reason: "у инициатора нет Harbinger of Heresy" };
    return { ok: true };
  }
  if (op.kind === "litanyBlessing") {
    if (Object.keys(op).some(k => k !== "kind" && k !== "god")) return { ok: false, reason: "litanyBlessing: лишние поля" };
    if (!hasLitanyOfChaos(ctx.initiator)) return { ok: false, reason: "у инициатора нет Litany of Chaos" };
    if (!litanyOptions(ctx.initiator).some(g => g.key === op.god)) return { ok: false, reason: "литания этого Бога недоступна инициатору" };
    if (!isSubordinateOf(ctx.initiator, ctx.target, ctx.allActors ?? [])) return { ok: false, reason: "цель не под Командным Присутствием инициатора" };
    return { ok: true };
  }
  if (op.kind === "layOnHands") {
    if (Object.keys(op).some(k => !["kind", "corruption", "mutation"].includes(k))) return { ok: false, reason: "layOnHands: лишние поля" };
    if (!hasLayOnHands(ctx.initiator)) return { ok: false, reason: "у инициатора нет Lay On Hands" };
    if (!Number.isInteger(op.corruption) || op.corruption < 1 || op.corruption > 100) return { ok: false, reason: "layOnHands: Порча вне 1…100" };
    if (op.corruption > (Number(ctx.initiator?.system?.corruption?.value) || 0)) return { ok: false, reason: "layOnHands: Порча выше Cor инициатора" };
    if (typeof op.mutation !== "string" || !mutationCatalog().common.some(m => m.name === op.mutation)) return { ok: false, reason: "layOnHands: мутации нет в общей таблице" };
    if (!isThrottleReady(ctx.target, LAY_ON_HANDS_USAGE, "month")) return { ok: false, reason: "layOnHands: цель уже благословлена в этом месяце" };
    return { ok: true };
  }
  if (op.kind === "martyrSummon") {
    if (Object.keys(op).some(k => k !== "kind" && k !== "name")) return { ok: false, reason: "martyrSummon: лишние поля" };
    if (typeof op.name !== "string" || !op.name.trim() || op.name.length > 200) return { ok: false, reason: "martyrSummon: нет имени демона" };
    if (!hasMartyr(ctx.initiator)) return { ok: false, reason: "у инициатора нет Martyr" };
    if (!isFaithfulOf(ctx.target, ctx.initiator)) return { ok: false, reason: "цель не Правоверный инициатора" };
    return { ok: true };
  }

  // Облачная Когниция / Мотивное Причастие: полезная нагрузка — одно целое число; сколько реально
  // дойдёт (место у цели, потолок Раунда, Апокрифа), ГМ пересчитывает по данным цели в performTargetWrite.
  if (op.kind === "grantCognition" || op.kind === "grantEnergy") {
    if (Object.keys(op).some(k => k !== "kind" && k !== "amount")) return { ok: false, reason: `${op.kind}: лишние поля` };
    const cognition = op.kind === "grantCognition";
    const max = cognition ? CLOUD_COGNITION_MAX : MOTIVE_EUCHARIST_MAX;
    if (!Number.isInteger(op.amount) || op.amount < 1 || op.amount > max) return { ok: false, reason: `${op.kind}: число вне 1…${max}` };
    if (!(cognition ? hasCloudCognition(ctx.initiator) : hasMotiveEucharist(ctx.initiator))) {
      return { ok: false, reason: `у инициатора нет ${cognition ? "Cloud Cognition" : "Motive Eucharist"}` };
    }
    if (cognition && !ctx.target?.system?.noosphereConnected) return { ok: false, reason: "цель не подключена к Ноосфере" };
    // «Если он подключен к Ноосфере»: тумблер передающего ГМ сверяет сам. Запас ⚙/⚡ передающего и метку
    // «раз в Ход» ГМ не сверяет: к моменту обработки запроса клиент уже мог списать свой запас, и сверка
    // отвергала бы честную передачу — степень доверия та же, что у addFatigue/apDebt.
    if (cognition && !ctx.initiator?.system?.noosphereConnected) return { ok: false, reason: "инициатор не подключён к Ноосфере" };
    return { ok: true };
  }

  // Урон приёма по чужой цели: клиент присылает только поля урона, считает и применяет ГМ.
  if (op.kind === "applyDamage") {
    if (!RELAY_DAMAGE_SOURCES.includes(op.source)) return { ok: false, reason: "неизвестный источник урона" };
    if (op.source === "grapple" && !ctx.partners) return { ok: false, reason: "цель не в Борьбе с инициатором" };
    const d = op.damage;
    if (!d || typeof d !== "object" || Array.isArray(d)) return { ok: false, reason: "нет урона" };
    for (const [k, v] of Object.entries(d)) {
      const type = RELAY_DAMAGE_FIELDS[k];
      if (!type || typeof v !== type) return { ok: false, reason: `поле урона вне списка: ${k}` };
      if (type === "string" && v.length > 200) return { ok: false, reason: `слишком длинная строка: ${k}` };
    }
    if (!Number.isFinite(d.rawDamage) || d.rawDamage < 0 || d.rawDamage > RELAY_DAMAGE_MAX) return { ok: false, reason: "урон вне 0…80" };
    if (d.penetration !== undefined && (!Number.isFinite(d.penetration) || d.penetration < 0 || d.penetration > RELAY_PEN_MAX)) {
      return { ok: false, reason: "проникновение вне 0…30" };
    }
    if (d.damageType !== undefined && !RELAY_DAMAGE_TYPES.includes(d.damageType)) return { ok: false, reason: "тип урона вне списка" };
    if (d.melee !== true) return { ok: false, reason: "по сокету идёт только рукопашный урон приёмов" };
    // Урон без Борьбы (Повалить на 5+: 1d5+S.b, Primitive, Pen 0) — потолок ниже, броню не игнорирует.
    if (op.source === "contact") {
      if (d.ignoreArmour) return { ok: false, reason: "«contact»: броню игнорировать нельзя" };
      if (d.rawDamage > RELAY_CONTACT_DAMAGE_MAX) return { ok: false, reason: `«contact»: урон выше ${RELAY_CONTACT_DAMAGE_MAX}` };
      if (d.penetration) return { ok: false, reason: "«contact»: проникновения нет" };
    }
    if (ctx.initiator?.uuid && d.attackerUuid !== ctx.initiator.uuid) return { ok: false, reason: "атакующий не совпадает с инициатором" };
    return { ok: true };
  }

  return { ok: false, reason: `неизвестный вид: ${op.kind}` };
}

/** Виды цели, которые выбирает игрок (apps/target-choice.mjs::TARGET_CHOICE_KINDS) и поля записи цели. */
const HATRED_TARGET_KINDS = ["faction", "race", "feature", "patron", "all"];
const HATRED_TARGET_FIELDS = ["kind", "ref", "value", "name", "img"];

/** Цель Ненависти — плоский объект известных строковых полей разумной длины. */
export function validHatredTarget(t) {
  if (!t || typeof t !== "object" || Array.isArray(t)) return false;
  if (!HATRED_TARGET_KINDS.includes(t.kind)) return false;
  return Object.entries(t).every(([k, v]) => HATRED_TARGET_FIELDS.includes(k) && typeof v === "string" && v.length <= 200);
}

/** Шаблон Hatred из компендиума (описание и значок); недоступен — null, предмет будет минимальным. */
export async function hatredTemplate() {
  try {
    const doc = await globalThis.fromUuid?.(`Compendium.${NS}.talents.Item.${HATRED_PACK_ID}`);
    return doc?.toObject?.() ?? null;
  } catch { return null; }
}

/**
 * «Прочитать значение цели и записать прибавленное» — виды записи, которые на ГМ-клиенте
 * нельзя гонять вперемешку: обе передачи прочтут одно и то же старое число и вторая
 * затрёт первую (wdbc-ekrk2). Листовых вызовов вглубь (writeToTarget) у этих видов нет,
 * поэтому очередь не может запереться сама на себе.
 */
const SERIAL_KINDS = new Set(["apDebt", "grantCognition", "grantEnergy"]);
const WRITE_CHAINS = new Map();

/** Записи по одной цели идут друг за другом; отказ одной не глушит следующие. */
function serialWrite(target, task) {
  const key = target.uuid ?? target.id;
  const run = (WRITE_CHAINS.get(key) ?? Promise.resolve()).then(task);
  const tail = run.catch(() => {});
  WRITE_CHAINS.set(key, tail);
  tail.then(() => { if (WRITE_CHAINS.get(key) === tail) WRITE_CHAINS.delete(key); });
  return run;
}

/** Исполнить запись на клиенте, у которого есть право (ГМ или владелец цели). */
export function performTargetWrite(target, op, initiator = null) {
  return SERIAL_KINDS.has(op?.kind)
    ? serialWrite(target, () => _performTargetWrite(target, op, initiator))
    : _performTargetWrite(target, op, initiator);
}

async function _performTargetWrite(target, op, initiator) {
  if (op.kind === "update") return target.update(op.data);
  if (op.kind === "addFatigue") {
    const { addFatigue } = await import("../sheets/tabs/conditions.mjs");
    return addFatigue(target, Number(op.amount));
  }
  if (op.kind === "apDebt") {
    const debt = Number(target.getFlag?.(NS, DEVOURER_OF_TIME_AP_DEBT_FLAG)) || 0;
    return target.setFlag(NS, DEVOURER_OF_TIME_AP_DEBT_FLAG, debt + 1);
  }
  if (op.kind === "applyDamage") {
    const { applyDamageToActor } = await import("./damage.mjs");
    return applyDamageToActor(target, op.damage);
  }
  if (op.kind === "grantCognition") {
    // Потолок ½I.b за Раунд считается только в бою: вне боя Раунда нет (как «раз в Ход» у Разгона).
    const { isEncounterActive } = await import("./action-economy.mjs");
    const inCombat = isEncounterActive();
    const flagNow = target.getFlag?.(NS, CLOUD_COGNITION_RECEIVED_FLAG);
    const received = inCombat ? receivedNow(flagNow, game.combat?.id) : 0;
    const plan = planCloudCognition({ amount: op.amount, giverCognition: op.amount, receiver: target.system?.cognition,
      received, cap: cloudCognitionCap(target) });
    if (!plan.ok) return null;
    return target.update({
      "system.cognition.value": (Number(target.system.cognition.value) || 0) + plan.moved,
      ...(inCombat ? { [`${FLAG_PREFIX}${CLOUD_COGNITION_RECEIVED_FLAG}`]: receivedFlagValue(flagNow, game.combat?.id, plan.moved) } : {})
    });
  }
  if (op.kind === "grantEnergy") {
    const en = target.system?.energy;
    const ap = target.system?.apocryphaEnergy;
    const plan = planMotiveEucharist({ amount: op.amount, giverEnergy: op.amount, receiver: {
      main: { value: en?.value, max: en?.maxTotal ?? en?.max },
      apoc: hasApocryphaCoil(target) && (Number(ap?.max) || 0) > 0 ? { value: ap.value, max: ap.max } : null
    } });
    if (!plan.ok) return null;
    return target.update({
      "system.energy.value": (Number(en.value) || 0) + plan.toMain,
      ...(plan.toApoc ? { "system.apocryphaEnergy.value": (Number(ap.value) || 0) + plan.toApoc } : {})
    });
  }
  if (op.kind === "singForMeDamage" || op.kind === "singForMeBoon" || op.kind === "wallPush") {
    const { performNoiseMarineWrite } = await import("./noise-marine.mjs");
    return performNoiseMarineWrite(target, op, initiator);
  }
  if (op.kind === "harbingerMark" || op.kind === "litanyBlessing" || op.kind === "layOnHands" || op.kind === "martyrSummon") {
    const { performDarkApostleWrite } = await import("./dark-apostle.mjs");
    return performDarkApostleWrite(target, op, initiator);
  }
  if (op.kind === "warpsmith") {
    const { performWarpsmithWrite } = await import("./warpsmith.mjs");
    return performWarpsmithWrite(target, op, initiator);
  }
  if (op.kind === "saviorSwap") {
    const { performSaviorSwapWrite } = await import("./master-of-executions.mjs");
    return performSaviorSwapWrite(target, op, initiator);
  }
  if (op.kind === "dreadWailFear") {
    const { grantDreadWailFear } = await import("./timed-effects.mjs");
    return grantDreadWailFear(target, initiator);
  }
  if (op.kind === "inspireHatred") {
    const item = inspiredHatredData(op.target, { uuid: initiator?.uuid ?? "", name: initiator?.name ?? "" }, await hatredTemplate());
    return target.createEmbeddedDocuments("Item", [item]);
  }
  return null;
}

/**
 * Нанести урон приёма актору-цели: своя/ГМ — применяет сам, чужая — просит активного ГМа.
 * @param {Actor} target
 * @param {object} damage    damageData для applyDamageToActor (только поля RELAY_DAMAGE_FIELDS)
 * @param {Actor} initiator  кто бьёт
 * @param {"grapple"|"contact"} [source]  «grapple» — цель обязана быть партнёром инициатора по Борьбе
 * @returns {Promise<boolean>} false — применить некому (нет ГМ в игре)
 */
export function dealDamageToTarget(target, damage, initiator, source = "contact") {
  return writeToTarget(target, { kind: "applyDamage", source, damage }, initiator);
}

/**
 * Записать в актора-цель. Свой/ГМ — пишет сам, иначе просит активного ГМа.
 *
 * @param {Actor} target     цель записи
 * @param {object} op        { kind:"update", data } | { kind:"addFatigue", amount } | { kind:"inspireHatred", target }
 * @param {Actor} initiator  кто действует (владельца сверяет ГМ)
 * @returns {Promise<boolean>} false — записать некому (нет ГМ в игре): вызывающий прерывает приём
 */
export async function writeToTarget(target, op, initiator) {
  if (!target || !op) return false;
  // У живого документа isOwner — всегда булево; «=== false» (а не falsy) лишь
  // оставляет прежний путь голым подставным акторам без этого поля в тестах.
  if (game.user?.isGM || target.isOwner !== false) {
    await performTargetWrite(target, op, initiator);
    return true;
  }
  if (!game.users?.activeGM) {
    ui.notifications?.warn(`⚠️ ${target.name} не ваш, а Мастера нет в игре — записать на него действие некому.`);
    return false;
  }
  game.socket?.emit("system.warhammer-dbc", {
    action: TARGET_WRITE_ACTION, userId: game.user.id,
    initiatorUuid: initiator?.uuid ?? "", targetUuid: target.uuid, op
  });
  return true;
}

/** Сокет (ГМ): применить запись, присланную игроком. Сверяет всё, что нельзя доверять клиенту. */
export async function applyTargetWriteRelay(data, requester) {
  const initiator = data?.initiatorUuid ? await fromUuid(data.initiatorUuid).catch(() => null) : null;
  const target = data?.targetUuid ? await fromUuid(data.targetUuid).catch(() => null) : null;
  const targetActor = target?.actor ?? target;
  if (!initiator || !targetActor || typeof targetActor.update !== "function") return false;
  const initiatorOwned = !!requester?.isGM || !!initiator.testUserPermission?.(requester, "OWNER");
  // Борьба: цель — партнёр инициатора (флаг на любом из двух), нужно для урона источника «grapple».
  const partners = initiator.getFlag?.(NS, "grapplePartnerUuid") === targetActor.uuid
    || targetActor.getFlag?.(NS, "grapplePartnerUuid") === initiator.uuid;
  const verdict = checkTargetWrite(data?.op, { initiatorOwned, initiator, partners, target: targetActor, allActors: [...(game.actors ?? [])] });
  if (!verdict.ok) {
    console.warn(`Warhammer DBC | ${TARGET_WRITE_ACTION} отклонён: ${verdict.reason}`, data?.op);
    return false;
  }
  await performTargetWrite(targetActor, data.op, initiator);
  return true;
}
