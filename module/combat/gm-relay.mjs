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
//      подключённая к Ноосфере. Расстояние и согласие цели ведёт стол.
//  Просящий обязан владеть актором-инициатором (ГМ сверяет сам).
//
//  Порядок у вызывающего: сперва запись в цель (writeToTarget вернул false —
//  записать некому, инициатора не трогаем), потом запись в себя. Так отказ не
//  оставляет игрока в Захвате в одиночку.
// ════════════════════════════════════════════════════════════════════════

import { hasInspireWrath, inspiredHatredData, HATRED_PACK_ID } from "../rules/inspire-wrath.mjs";
import { hasAbility } from "../rules/ability-by-key.mjs";
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
  "grappleSqueezePending", "grappleSqueezeActive", "pinDownHold",
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

/** Исполнить запись на клиенте, у которого есть право (ГМ или владелец цели). */
export async function performTargetWrite(target, op, initiator = null) {
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
  if (op.kind === "dreadWailFear") {
    const { grantDreadWailFear } = await import("./timed-effects.mjs");
    return grantDreadWailFear(target);
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
  const verdict = checkTargetWrite(data?.op, { initiatorOwned, initiator, partners, target: targetActor });
  if (!verdict.ok) {
    console.warn(`Warhammer DBC | ${TARGET_WRITE_ACTION} отклонён: ${verdict.reason}`, data?.op);
    return false;
  }
  await performTargetWrite(targetActor, data.op, initiator);
  return true;
}
