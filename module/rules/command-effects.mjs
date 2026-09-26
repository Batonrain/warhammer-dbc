// module/rules/command-effects.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ЧТО КОМАНДЫ ДАЮТ БРОСКУ ПОДЧИНЁННОГО — источник правил «command»
//  (DoomBC Core, глава «Командование», wdbc-x1nz.2).
//
//  Раньше Команды жили только карточкой в чате: «+6 на все тесты» игрок
//  прибавлял сам. Теперь каждый бросок подчинённого спрашивает у своих
//  командиров, что сейчас отдано, и получает это автоматическим модификатором
//  (auto:true — в диалогах блок «Состояние (учтено в Пороге)», в бросках без
//  диалога прибавляется само):
//
//   - Короткая Команда: Воодушевление +Успехи×1 на все тесты, Общая +Успехи×3
//     на выбранный Командиром вид тестов, Личная +Успехи×5 получателю,
//     Укрепление Морали +Успехи×5 на тесты Морали. Несколько Коротких Команд
//     (от разных командиров, от Брифинга) не складываются — берётся наибольшая.
//   - Присутствие «Воля Командира»: тест Морали идёт от W Командира, если она
//     выше своей (разница — модификатором).
//   - Детальная: «Храбрость» — переброс проваленных тестов Морали,
//     «Прикрытие» — +вложенные Успехи×3 к Избеганию.
//
//  Короткие Команды «действуют только на тесты, тратящие не более полного
//  действия, не применимы к тестам на социальные взаимодействия (кроме тестов
//  Морали), психотесты, тесты Техночудес и встречные тесты, проводимые
//  подсознательно (яды, Оглушение, психосилы, Техночудеса, Одержимость)».
//  Голый тест T или W в этой системе — всегда такое сопротивление (яд,
//  болезнь, Гангрена, психосилы), поэтому он исключается целиком; тест Морали
//  — тоже по W, но книга его прямо разрешает.
//
//  Здесь только чистая часть: узлы командования (что отдано) приходят
//  снаружи. Поиск узлов по живому миру — combat/command-state.mjs, он же
//  регистрирует источник (тот же приём, что у Адъютанта: регистрация из
//  sources.mjs замкнула бы круг импортов через hasRuleFlag).
// ════════════════════════════════════════════════════════════════════════════

import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../constants/skills.mjs";
import { commandReachFor } from "./command.mjs";

const EVASION_SKILLS = new Set(["dodge", "parry"]);
const SOCIAL = key => SKILLS_DEF[key]?.apt2 === "social";

/**
 * Виды тестов для Общей Команды («атаки, избегания, внимательность, трудный
 * ландшафт, и т.п.») — выбираются Командиром при отдаче и хранятся в
 * shortCommand.testKind.
 */
export const GENERAL_COMMAND_KINDS = [
  { key: "attack",  label: "Атаки" },
  { key: "evasion", label: "Избегания (Уклонение, Парирование)" },
  { key: "morale",  label: "Тесты Морали" },
  { key: "terrain", label: "Трудный ландшафт" },
  ...Object.entries(SKILLS_DEF)
    .filter(([k]) => !SOCIAL(k) && !EVASION_SKILLS.has(k))
    .map(([k, d]) => ({ key: `skill:${k}`, label: d.label })),
  ...Object.entries(GROUP_SKILLS_DEF ?? {})
    .map(([k, d]) => ({ key: `skill:${k}`, label: d.label }))
];

export function generalKindLabel(key) {
  return GENERAL_COMMAND_KINDS.find(k => k.key === key)?.label || "";
}

/** Тест Морали подчинённого (не сам бросок Запугивания/Допроса атакующего). */
export function isMoraleCtx(ctx = {}) {
  if (ctx.morale !== true) return false;
  return !(ctx.skill === "intimidate" || ctx.skill === "interrogate");
}

export function isEvasionCtx(ctx = {}) {
  return EVASION_SKILLS.has(String(ctx.skill ?? "")) || ctx.evasion === true;
}

/** Подпадает ли тест под Короткие Команды вообще (см. шапку). */
export function shortCommandEligible(ctx = {}) {
  if (ctx.asRecipient || ctx.extended) return false;
  if (["power", "instability", "vsExorcism", "initiative"].includes(ctx.kind)) return false;
  if (ctx.poisonTest || ctx.psychicThreat) return false;
  if (isMoraleCtx(ctx)) return true;
  if (ctx.kind === "attack") return true;
  if (ctx.skill || ctx.group) return !SOCIAL(ctx.skill);
  const ch = String(ctx.char ?? "").toLowerCase();
  return !!ch && ch !== "t" && ch !== "wp";
}

/** Подходит ли тест под выбранный вид Общей Команды. */
export function matchesGeneralKind(kind, ctx = {}) {
  if (!kind) return false;
  if (kind === "attack")  return ctx.kind === "attack";
  if (kind === "evasion") return isEvasionCtx(ctx);
  if (kind === "morale")  return isMoraleCtx(ctx);
  if (kind === "terrain") return ctx.terrain === true;
  if (kind.startsWith("skill:")) {
    const want = kind.slice(6).toLowerCase();
    return String(ctx.skill ?? ctx.group ?? "").toLowerCase() === want;
  }
  return false;
}

/**
 * Бонус одной Короткой Команды этому броску (0 — не действует).
 * @param {object} short {active,key,successes,testKind,recipientUuid}
 * @param {Set<string>} [ids] все uuid бойца (мировой актор и актор токена —
 *   получателя Личной Команды выбирают из списка, а бросок идёт от токена)
 */
export function shortCommandBonus(short, actor, ctx, ids = new Set([actor?.uuid])) {
  if (!short?.active) return 0;
  const sux = Number(short.successes) || 0;
  if (sux <= 0 || !shortCommandEligible(ctx)) return 0;
  switch (short.key) {
    case "inspire":  return sux;
    case "general":  return matchesGeneralKind(short.testKind, ctx) ? sux * 3 : 0;
    case "personal": return short.recipientUuid && ids.has(short.recipientUuid) ? sux * 5 : 0;
    case "morale":   return isMoraleCtx(ctx) ? sux * 5 : 0;
    default:         return 0;
  }
}

const SHORT_LABEL = { inspire: "Воодушевление", general: "Общая Команда",
                      personal: "Личная Команда", morale: "Укрепление Морали" };

/**
 * Узел командования — всё отданное одним источником (Отряд, командир сброда).
 * @typedef {object} CommandNode
 * @property {string} label       «Отряд «Копьё»» / имя командира
 * @property {{active:boolean, benefit:string}} presence
 * @property {?number} presenceWp W того, чья Воля даётся эффектом 3
 * @property {object} short       shortCommand
 * @property {object} detail      detailCommand (+coverSuccesses)
 * @property {boolean} [moraleLost] метка записи Отряда
 * @property {boolean} [overCapacity] сверх F.b×2 подчинённых командира
 */

/**
 * Правила, которые Команды дают этому броску актора.
 *
 * @param {object} actor подчинённый
 * @param {CommandNode[]} nodes
 * @param {object} ctx контекст броска (resolveTest)
 * @param {{commandLost?: boolean, identityUuids?: Set<string>}} [opts] commandLost —
 *   провалил тест Морали (флаг на самом акторе, см. combat/command-state.mjs);
 *   identityUuids — все uuid бойца для Личной Команды (actorIdentityUuids)
 */
export function commandRulesFor(actor, nodes, ctx = {}, { commandLost = false, identityUuids } = {}) {
  if (!actor || !nodes?.length) return [];
  // Несколько командиров — не больше ½ P.b (окр.▼), хотя бы один: берутся
  // сильнейшие по Успехам Короткой Команды («у кого больше Успехов»).
  const perB = actor.system?.characteristics?.per?.bonus;
  const cap = perB == null ? nodes.length : Math.max(1, Math.floor(Number(perB) / 2));
  const live = nodes.filter(n => !n.overCapacity)
    .sort((a, b) => (Number(b.short?.successes) || 0) - (Number(a.short?.successes) || 0))
    .slice(0, cap);

  let bestShort = null, bestWill = null, bestCover = null, bravery = null;
  const ownWp = Number(actor.system?.characteristics?.wp?.total) || 0;

  for (const node of live) {
    const reach = commandReachFor(actor.type, node.presence?.benefit || "", actor,
      { moraleLost: !!node.moraleLost || commandLost });
    // Проваливший Мораль (не Оглох/не без сознания, не Орда) слышит только
    // «Укрепление Морали» и «Храбрость».
    const moraleOnly = reach.moraleLost && !reach.blockedBy && actor.type !== "horde";

    if (reach.commands || (moraleOnly && node.short?.key === "morale")) {
      const v = shortCommandBonus(node.short, actor, ctx, identityUuids);
      if (v > 0 && (!bestShort || v > bestShort.value))
        bestShort = { value: v, label: `${SHORT_LABEL[node.short.key] || "Короткая Команда"} (${node.label})` };
    }

    if (reach.presenceApplies && node.presence?.active && node.presence.benefit === "morale"
        && isMoraleCtx(ctx) && node.presenceWp != null) {
      const diff = Number(node.presenceWp) - ownWp;
      if (diff > 0 && (!bestWill || diff > bestWill.value))
        bestWill = { value: diff, label: `Воля Командира W ${node.presenceWp} (${node.label})` };
    }

    const picks = node.detail?.active && Array.isArray(node.detail.picks) ? node.detail.picks : [];
    if (picks.includes("bravery") && (reach.commands || moraleOnly) && isMoraleCtx(ctx))
      bravery ??= { label: `Храбрость (${node.label})` };
    if (picks.includes("cover") && reach.commands && isEvasionCtx(ctx)) {
      const v = (Number(node.detail.coverSuccesses) || 3) * 3;
      if (!bestCover || v > bestCover.value) bestCover = { value: v, label: `Прикрытие (${node.label})` };
    }
  }

  const rules = [];
  const bonus = (id, b) => rules.push({ id, label: b.label, when: {},
    effects: [{ kind: "rollBonus", target: "all", value: b.value, auto: true, label: b.label }] });
  if (bestShort) bonus("command.short", bestShort);
  if (bestWill)  bonus("command.presenceWill", bestWill);
  if (bestCover) bonus("command.cover", bestCover);
  if (bravery) rules.push({ id: "command.bravery", label: bravery.label, when: {},
    effects: [{ kind: "rollMode", target: "all", mode: "keepBest", rolls: 2, label: bravery.label }] });
  return rules;
}

/**
 * Сколько Успехов Детальной Команды уже потрачено. «Прикрытие (3+ Успеха)»
 * стоит столько, сколько в него вложено (coverSuccesses, не меньше 3).
 */
export function detailSpentOf(detail, costs) {
  const picks = Array.isArray(detail?.picks) ? detail.picks : [];
  return picks.reduce((sum, key) => {
    if (key === "cover") return sum + Math.max(3, Number(detail.coverSuccesses) || 0);
    return sum + (costs.find(c => c.key === key)?.cost || 0);
  }, 0);
}

/**
 * Действует ли на актора конкретный эффект Детальной Команды (volley,
 * assault, cover…) — или Присутствие с этим преимуществом (presence:<key>).
 * Проваливший Мораль из Детальной слышит только «Храбрость».
 * @returns {?object} узел, давший эффект, или null
 */
export function commandEffectNode(actor, nodes, key, { commandLost = false } = {}) {
  for (const node of nodes ?? []) {
    if (node.overCapacity) continue;
    const benefit = key.startsWith("presence:") ? key.slice(9) : (node.presence?.benefit || "");
    const reach = commandReachFor(actor?.type, benefit, actor, { moraleLost: !!node.moraleLost || commandLost });
    if (key.startsWith("presence:")) {
      if (node.presence?.active && node.presence.benefit === benefit && reach.presenceApplies) return node;
      continue;
    }
    const picks = node.detail?.active && Array.isArray(node.detail.picks) ? node.detail.picks : [];
    if (!picks.includes(key)) continue;
    const moraleOnly = reach.moraleLost && !reach.blockedBy && actor?.type !== "horde";
    if (reach.commands || (key === "bravery" && moraleOnly)) return node;
  }
  return null;
}

/** Бонус Синхронного Натиска: +10 за каждого соратника в базовом контакте. */
export function syncAssaultBonus(alliesInContact) {
  return 10 * Math.max(0, Number(alliesInContact) || 0);
}

/**
 * Залповый Огонь: модификатор теста Подавления цели по числу стрелявших
 * подчинённых — +20 от трёх, −5 за каждые следующие три; меньше трёх — null.
 */
export function volleySuppressionMod(shooters) {
  const n = Number(shooters) || 0;
  if (n < 3) return null;
  return 20 - 5 * (Math.floor(n / 3) - 1);
}

/**
 * Дрессировка: лимит Успехов = 2 + продвижения Awareness и Survival выше +0
 * (+10 → 1, +20 → 2, +30 → 3). rankBonus — бонус Ранга навыка (−20…+30).
 */
export function trainingSuccessCap(awarenessRankBonus, survivalRankBonus) {
  const steps = b => Math.max(0, Math.floor((Number(b) || 0) / 10));
  return 2 + steps(awarenessRankBonus) + steps(survivalRankBonus);
}

/** Действует ли на актора «Храбрость» (для Паники от Горения и т.п.). */
export function braveryActive(actor, nodes, { commandLost = false } = {}) {
  return commandRulesFor(actor, nodes, { kind: "skill", char: "wp", morale: true }, { commandLost })
    .some(r => r.id === "command.bravery");
}

/** Действует ли на актора «Укрепление Морали» (сброс Подавления/Шока в начале и конце Хода). */
export function moraleCommandActive(actor, nodes, { commandLost = false } = {}) {
  return (nodes ?? []).some(node => {
    if (node.overCapacity || !node.short?.active || node.short.key !== "morale") return false;
    if (!(Number(node.short.successes) > 0)) return false;
    const reach = commandReachFor(actor?.type, "", actor, { moraleLost: !!node.moraleLost || commandLost });
    return reach.commands || (reach.moraleLost && !reach.blockedBy && actor?.type !== "horde");
  });
}
