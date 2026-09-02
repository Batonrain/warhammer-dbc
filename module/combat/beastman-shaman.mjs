// module/combat/beastman-shaman.mjs — wdbc-xxb7
// ════════════════════════════════════════════════════════════════════════
//  Триггеры Элитного Архетипа «Шаман Зверолюдей» (DoomBC — Психокеры-Жабы,
//  стр. 102-104): 4 Таланта с god-ответвлениями (Primal Howl/Hex-Marked
//  Prey/Rite of Self-Sacrifice/Warp-Tainted Aura) + Черта Ritual Bloodletting.
//  Ветвление читает ЕДИНОЕ actor.system.patronGod (constants/patronage.mjs) —
//  не заводит параллельную проверку Метки/Покровительства.
//
//  Что РЕАЛЬНО применяется (пишет актору): Ярость (system.inRage), Усталость,
//  Аблативные Раны, Порча, самоурон (rules/wounds.mjs::applyWoundLoss), тест
//  W против цели/радиуса (rules/roll-outcome.mjs::testOutcome), троттлинг
//  раз-в-бой/раз-в-час (rules/cooldown.mjs). Что НЕ смоделировано (текстом в
//  карточке, тот же уровень автоматизации, что и «Рейтинг Страха до конца
//  боя» в combat/dread-wail.mjs): временные бонусы к характеристикам
//  (+10 S/+10 T и т.п. — в системе нет инфраструктуры временных бонусов,
//  живущих до начала следующего Хода, ни у одной способности проекта),
//  свойства попаданий (Hallucinogenic/Proven/Toxic на конкретные атаки),
//  шаблоны AoE поверх произвольной геометрии, Костяная Рунопись (иная по
//  форме способность — экономика крафта рун, не боевой триггер) и часть
//  Symbol of Power (замена Natural Weapons/освобождение от Aversion to
//  Order — правки чужих подсистем, оставлены за рамками этой сессии).
//
//  Бонусы «до начала следующего Хода» (Ярость/Аблативные Раны) НЕ имеют
//  своего хука очистки — тот же компромисс, что у Dread Wail: очистка
//  ручная (ГМ/игрок), а не автоматическая по границе Раунда.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { isThrottleReady, markThrottleUsed, isWorldTimeCooldownReady, markWorldTimeCooldownUsed } from "../rules/cooldown.mjs";
import { tokensWithinRadius } from "../rules/aoe-target.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { applyWoundLoss } from "../rules/wounds.mjs";
import { WARP_GODS_MAP } from "../constants/veil.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const GOD_KEYS = ["khorne", "nurgle", "slaanesh", "tzeentch"];
const ICON = "#c9a24b";

// itemHasName (rules/predicates.mjs) сравнивает ОДНУ половину билингвального
// имени за раз — здесь константы хранят полное "Eng / Рус" имя (для карточек
// в чат), поэтому для самой проверки владения берём английскую половину.
const engHalf = name => String(name ?? "").split(" / ")[0];

export function hasBeastmanShamanTalent(actor, name) {
  return !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, engHalf(name)));
}
export function hasBeastmanShamanTrait(actor, name) {
  return !!actor?.items?.some(i => i.type === "trait" && itemHasName(i, engHalf(name)));
}

/** Действующая god-ветка по Покровительству актора — "" (базовая) для
 * "undivided"/пусто/неизвестного значения. */
export function activeGodBranch(actor) {
  const g = actor?.system?.patronGod || "";
  return GOD_KEYS.includes(g) ? g : "";
}
function godLabel(god) { return god ? (WARP_GODS_MAP[god]?.label || god) : "Неделимый"; }

async function chatCard(actor, title, lines, notes = []) {
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("bolt", ICON)}${esc(title)} — ${esc(actor.name)}</div>
      ${lines.map(l => `<div class="roll-threshold">${l}</div>`).join("")}
      ${notes.length ? `<div class="roll-threshold" style="opacity:0.8;font-size:0.85em;">${notes.map(esc).join("<br>")}</div>` : ""}
    </div>`
  }, game.settings.get("core", "rollMode")));
}

// ════════════════════════════════════════════════════════════════════════
//  Primal Howl / Первобытный Вой — Полное Действие раз в бой, радиус Cor.b×10 м
// ════════════════════════════════════════════════════════════════════════
const PRIMAL_HOWL_NAME = "Primal Howl / Первобытный Вой";
const PRIMAL_HOWL_FLAG = "primalHowl";

export function primalHowlAvailable(actor) {
  return hasBeastmanShamanTalent(actor, PRIMAL_HOWL_NAME) && isThrottleReady(actor, PRIMAL_HOWL_FLAG, "battle");
}

export async function applyPrimalHowl(actor, casterToken) {
  await markThrottleUsed(actor, PRIMAL_HOWL_FLAG, "battle");
  const corBonus = Number(actor.system?.corruptionBonus) || 0;
  const radius = corBonus * 10;
  const god = activeGodBranch(actor);
  const inRange = casterToken ? tokensWithinRadius(casterToken, radius) : [];
  const allies = inRange.filter(t => t.disposition === casterToken.disposition && t.actor);
  const enemies = inRange.filter(t => t.disposition !== casterToken.disposition && t.actor);

  const lines = [`Радиус ${radius} м · Покровитель: <b>${esc(godLabel(god))}</b>`];
  const notes = [`Враги (${enemies.length}) считают персонажа источником Fear (+1) — отметьте вручную.`];

  if (god === "khorne") {
    let entered = 0;
    for (const t of allies) {
      if (!t.actor.system?.inRage) { await t.actor.update({ "system.inRage": true }); entered++; }
    }
    lines.push(`Кхорн: рукопашный урон союзников +4 (не смоделировано); ${entered} союзник(ов) вошли в Ярость.`);
    notes.push("WS-бонус вместо T и +4 Dmg рукопашным атакам — впишите вручную до начала следующего Хода.");
  } else if (god === "nurgle") {
    const gained = [];
    for (const t of allies) {
      const roll = await new Roll("1d10").evaluate();
      const cur = Number(t.actor.system?.wounds?.ablative) || 0;
      const max = Number(t.actor.system?.wounds?.ablativeMax) || 0;
      const next = cur + roll.total;
      await t.actor.update({ "system.wounds.ablative": next, "system.wounds.ablativeMax": Math.max(max, next) });
      gained.push(`${esc(t.actor.name)} +${roll.total}`);
    }
    lines.push(`Нургл: +1d10 Аблативных Ран союзникам — ${gained.join(", ") || "никого в радиусе"}.`);
    notes.push("Переброс проваленных тестов сопротивления движению — не смоделирован, разрешайте вручную.");
  } else if (god === "slaanesh") {
    const eased = [];
    for (const t of allies) {
      const cur = Number(t.actor.system?.fatigue?.value) || 0;
      if (cur > 0) { await t.actor.update({ "system.fatigue.value": cur - 1 }); eased.push(esc(t.actor.name)); }
    }
    lines.push(`Слаанеш: −1 Усталость союзникам — ${eased.join(", ") || "никому не требовалось"}.`);
    notes.push("+10 A союзникам и +1 Усталость проваливших Страх врагов — не смоделировано.");
  } else if (god === "tzeentch") {
    lines.push("Тзинч: +10 P союзникам, Hallucinogenic(1) врагам, +20 варп-феноменам до конца следующего хода — не смоделировано.");
  } else {
    lines.push("Базовый эффект: союзники +10 S/+10 T до начала следующего Хода — не смоделировано, впишите вручную.");
  }

  await chatCard(actor, "Первобытный Вой", lines, notes);
}

// ════════════════════════════════════════════════════════════════════════
//  Warp-Tainted Aura / Аура Скверны — Полудействие раз в час, радиус 20 м
// ════════════════════════════════════════════════════════════════════════
const WARP_AURA_NAME = "Warp-Tainted Aura / Аура Скверны";
const WARP_AURA_FLAG = "warpTaintedAura";
const HOUR_SECONDS = 3600;

export function warpTaintedAuraAvailable(actor) {
  return hasBeastmanShamanTalent(actor, WARP_AURA_NAME)
    && isWorldTimeCooldownReady(actor, WARP_AURA_FLAG, HOUR_SECONDS);
}

export async function applyWarpTaintedAura(actor, casterToken) {
  await markWorldTimeCooldownUsed(actor, WARP_AURA_FLAG);
  const god = activeGodBranch(actor);
  const radius = 20;
  const inRange = casterToken ? tokensWithinRadius(casterToken, radius) : [];
  const enemies = inRange.filter(t => t.disposition !== casterToken.disposition && t.actor);
  const allies = inRange.filter(t => t.disposition === casterToken.disposition && t.actor);

  const lines = [`Радиус ${radius} м · Покровитель: <b>${esc(godLabel(god))}</b>`];
  const failed = [];
  for (const t of enemies) {
    const threshold = (Number(t.actor.system?.characteristics?.wp?.total) || 0) - 10;
    const roll = await new Roll("1d100").evaluate();
    const { success } = testOutcome(roll.total, threshold);
    if (success) continue;
    failed.push(t.actor);
    const curCor = Number(t.actor.system?.corruption?.value) || 0;
    await t.actor.update({ "system.corruption.value": curCor + 1 });
  }
  lines.push(`Провалившие тест W−10 (${failed.length}/${enemies.length}): ${failed.map(a => esc(a.name)).join(", ") || "—"} — +1 Порча каждому.`);
  lines.push(`Союзники (${allies.length}) в ауре: +20 к тестам Сопротивления, пока у персонажа нет метки — не смоделировано.`);

  const notes = [];
  if (god === "khorne") { lines.push("Кхорн: провалившие тест немедленно проходят тест на Fear (4) — не смоделировано."); }
  else if (god === "nurgle") { lines.push("Нургл: провалившие Задыхаются (−30 на Удушение); герметичная броня — попадание Corrosive(Cor.b) — не смоделировано."); }
  else if (god === "slaanesh") { lines.push("Слаанеш: провалившие очарованы — не атакуют персонажа/стадо, пока их не атакуют первыми — не смоделировано."); }
  else if (god === "tzeentch") { lines.push("Тзинч: провалившие смещаются на PR метров — не смоделировано, разместите вручную."); }

  await chatCard(actor, "Аура Скверны", lines, notes);
}

// ════════════════════════════════════════════════════════════════════════
//  Rite of Self-Sacrifice / Ритуал Самопожертвования — Полудействие
// ════════════════════════════════════════════════════════════════════════
const SELF_SACRIFICE_NAME = "Rite of Self-Sacrifice / Ритуал Самопожертвования";

export function riteOfSelfSacrificeAvailable(actor) {
  return hasBeastmanShamanTalent(actor, SELF_SACRIFICE_NAME);
}

export async function applyRiteOfSelfSacrifice(actor) {
  const god = activeGodBranch(actor);
  const selfDmg = await new Roll("1d5+1").evaluate();
  const lines = [`Покровитель: <b>${esc(godLabel(god))}</b>`, `Самоурон в руку: <b>${selfDmg.total}</b> (непоглощаемый)`];
  const notes = ["Tainted на ближний бой до конца следующего Хода — не смоделировано, впишите вручную."];

  if (god === "khorne") {
    const dmgBonus = selfDmg.total * 2;
    lines.push(`Кхорн: бонус к Dmg +${dmgBonus} (вместо эPR) до конца следующего Хода.`);
    await applyWoundLoss(actor, selfDmg.total);
  } else if (god === "nurgle") {
    await applyWoundLoss(actor, selfDmg.total);
    const bPR = Number(actor.system?.psyker?.rating) || 0;
    lines.push(`Нургл: эPR-бонус −1, но восстанавливает бPR (${bPR}) Ран в начале следующего хода — впишите вручную; шаблон 1d10+T.b Toxic(1) на себе — не смоделирован.`);
  } else if (god === "slaanesh") {
    await applyWoundLoss(actor, selfDmg.total);
    lines.push("Слаанеш: эPR-бонус −1, но +10 A, +2 Реакции, атака за Реакцию (−15) — не смоделировано.");
  } else if (god === "tzeentch") {
    await applyWoundLoss(actor, selfDmg.total);
    lines.push("Тзинч: дополнительно +20 к манифестации следующей психосилы — не смоделировано.");
  } else {
    await applyWoundLoss(actor, selfDmg.total);
    lines.push("Базовый эффект: +2 эPR до конца следующего Хода — не смоделировано, впишите вручную.");
  }

  await chatCard(actor, "Ритуал Самопожертвования", lines, notes);
}

// ════════════════════════════════════════════════════════════════════════
//  Hex-Marked Prey / Проклятая Метка — Полудействие, Соревновательный тест
// ════════════════════════════════════════════════════════════════════════
const HEX_MARKED_PREY_NAME = "Hex-Marked Prey / Проклятая Метка";
export const HEX_MARK_FLAG = "hexMarkedPrey";

export function hexMarkedPreyAvailable(actor) {
  return hasBeastmanShamanTalent(actor, HEX_MARKED_PREY_NAME);
}

/** Соревновательный тест W+0 (шаман) vs W+10 (цель) — книжное правило
 * встречного теста (стр. 25): оба проходят степень успеха/провала против
 * своего порога, выигрывает большая степень УСПЕХА; провал против провала
 * или явный успех против явного провала решается тем же сравнением степеней
 * (testOutcome даёт положительную «степень» для обоих исходов отдельно —
 * успех считается лучше любого провала). */
export async function applyHexMarkedPrey(actor, targetActor) {
  if (!targetActor) { ui.notifications?.warn("Наведите таргет (T) на видимого противника."); return; }
  const shamanRoll = await new Roll("1d100").evaluate();
  const targetRoll = await new Roll("1d100").evaluate();
  const shamanThreshold = Number(actor.system?.characteristics?.wp?.total) || 0;
  const targetThreshold = (Number(targetActor.system?.characteristics?.wp?.total) || 0) + 10;
  const shamanOutcome = testOutcome(shamanRoll.total, shamanThreshold);
  const targetOutcome = testOutcome(targetRoll.total, targetThreshold);
  const rank = o => (o.success ? 1000 : 0) + o.deg;
  const success = shamanOutcome.success && rank(shamanOutcome) >= rank(targetOutcome);

  const god = activeGodBranch(actor);
  const lines = [
    `Шаман W: ${shamanRoll.total} vs ${shamanThreshold} · Цель W+10: ${targetRoll.total} vs ${targetThreshold}`,
    success ? `<b>Успех</b> — «${esc(targetActor.name)}» получает Метку Проклятого до конца боя.` : `<b>Провал</b> — метка не наложена.`
  ];
  if (success) {
    await actor.setFlag("warhammer-dbc", HEX_MARK_FLAG, { targetUuid: targetActor.uuid, targetName: targetActor.name, god });
    lines.push(`Союзники-зверолюди получают +15 на атаки против «${esc(targetActor.name)}».`);
    if (god === "khorne") lines.push("Кхорн: атаки союзников по цели получают Proven(3); крит с R-уроном — доп. кровотечение.");
    else if (god === "nurgle") lines.push("Нургл: атаки союзников по цели получают Toxic(1); выживший провал T+10 в конце боя — Гниль Нургла.");
    else if (god === "slaanesh") lines.push("Слаанеш: цель не удаляется от шамана дальше 20 м, штраф −10 Dodge/Parry; урон шамана цели восстанавливает 1d3 Раны.");
    else if (god === "tzeentch") lines.push("Тзинч: выбранная характеристика цели −10 на время метки; провал по ней — шаману +5 к следующей манифестации.");
  }
  await chatCard(actor, "Проклятая Метка", lines, ["Ветвление применяется вручную к конкретным атакам/попаданиям — не смоделировано в движке атаки."]);
}

// ════════════════════════════════════════════════════════════════════════
//  Ritual Bloodletting / Ритуал Кровопускания (Черта) — Свободное Действие
//  после убийства (доверяется игроку/ГМ, «на глаз» — как и остальные
//  Реакция-на-убийство способности проекта, см. capabilities.mjs «Мёртвое
//  Могущество» Иннари).
// ════════════════════════════════════════════════════════════════════════
const RITUAL_BLOODLETTING_NAME = "Ritual Bloodletting / Ритуал Кровопускания";

export function ritualBloodlettingAvailable(actor) {
  return hasBeastmanShamanTrait(actor, RITUAL_BLOODLETTING_NAME);
}

export async function applyRitualBloodletting(actor, casterToken, { importantKill = false } = {}) {
  const fBonus = Number(actor.system?.characteristics?.fel?.bonus) || 0;
  const radius = fBonus;
  const bonus = importantKill ? 10 : 5;
  const inRange = casterToken ? tokensWithinRadius(casterToken, radius, { includeSelf: true }) : [];
  const allies = inRange.filter(t => t.disposition === casterToken?.disposition && t.actor);

  const lines = [
    `Радиус F.b (${radius} м) — ${allies.length} зверолюд(ей)-союзник(ов) в зоне.`,
    `+${bonus} ко всем тестам и иммунитет к Страху/Подавлению до начала следующего Хода${importantKill ? " (жертва была особо важной — бонус удвоен)" : ""}.`
  ];
  await actor.setFlag("warhammer-dbc", "ritualBloodletting", { bonus, active: true });
  await chatCard(actor, "Ритуал Кровопускания", lines,
    ["Бонус к тестам/иммунитет — информационная метка (не смоделирован в производных тестах), снимите вручную в начале следующего Хода."]);
}
