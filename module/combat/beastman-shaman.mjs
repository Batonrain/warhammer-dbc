// module/combat/beastman-shaman.mjs — wdbc-xxb7
// ════════════════════════════════════════════════════════════════════════
//  Триггеры Элитного Архетипа «Шаман Зверолюдей» (DoomBC — Психокеры-Жабы,
//  стр. 102-104): 4 Таланта с god-ответвлениями (Primal Howl/Hex-Marked
//  Prey/Rite of Self-Sacrifice/Warp-Tainted Aura) + Bone-Rune Etching (текст
//  без глубокой автоматизации — крафт-экономика, не боевой триггер) + Черты
//  Ritual Bloodletting/Symbol of Power. Ветвление читает ЕДИНОЕ
//  actor.system.patronGod (constants/patronage.mjs) — не заводит
//  параллельную проверку Метки/Покровительства.
//
//  Временные бонусы «до начала следующего Хода» — НАСТОЯЩИЕ embedded
//  ActiveEffect (grantTempEffect ниже), не информационные флаги: ключи
//  system.characteristics.<x>.totalFx/.bonusFx и system.fearRating
//  подтверждены безопасными для этого (module/constants/effect-keys.mjs::
//  expectedPhase — тот же путь, что у обычной Механики Конструктора). Общая
//  для ВСЕХ участников боя очистка — clearBeastmanShamanTempEffects,
//  вызывается по границе Хода ИМЕННО ШАМАНА (книга: «до начала ЕГО
//  следующего Хода»), не получателя бонуса — module/hooks.mjs::updateCombat.
//
//  Свойства попаданий (Hallucinogenic) — переиспользуют РЕАЛЬНЫЙ движок
//  Особых Свойств Оружия (module/combat/weapon-properties.mjs::
//  buildTargetEffectButtons, тот же путь, что у обычного оружия с этим
//  свойством), а не собственную копию теста. Proven/Toxic/Corrosive
//  (Кхорн/Нургл-ответвления Hex-Marked Prey) — НЕ переиспользуемы тем же
//  способом: это статичные свойства КОНКРЕТНОГО оружия атакующего, а не
//  цели, и в движке атаки нет condition-инъекции «оружие союзника получает
//  доп. свойство против ЭТОЙ цели» (проверено по всем 22 worktree, wdbc-xxb7
//  — заведён отдельный тикет). Базовый эффект Hex-Marked Prey (+15 к атакам
//  союзников-зверолюдей по цели) — реализован по-другому: правило в
//  rules/library/beastman-shaman.mjs (тот же общий реестр, что Avatar of
//  Slaughter), не нуждается в весовых свойствах.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { isThrottleReady, markThrottleUsed, isWorldTimeCooldownReady, markWorldTimeCooldownUsed } from "../rules/cooldown.mjs";
import { tokensWithinRadius } from "../rules/aoe-target.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { applyWoundLoss } from "../rules/wounds.mjs";
import { expectedPhase } from "../constants/effect-keys.mjs";
import { WARP_GODS_MAP } from "../constants/veil.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { buildTargetEffectButtons, resolveWeaponPropsList } from "./weapon-properties.mjs";

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

// ── Временные ActiveEffect «до начала следующего Хода ШАМАНА» ──────────────
const TEMP_FLAG = "beastmanShamanTemp";
const charFxKey = (charKey, field = "total") =>
  `system.characteristics.${charKey}.${field === "bonus" ? "bonusFx" : "totalFx"}`;

/** Создаёт настоящий embedded ActiveEffect на `targetActor`, помеченный
 * uuid'ом ИСТОЧНИКА (шамана) — очищается clearBeastmanShamanTempEffects по
 * границе Хода именно этого шамана, не получателя. */
async function grantTempEffect(targetActor, sourceActor, name, rawChanges, img) {
  if (!rawChanges.length) return;
  const changes = rawChanges.map(c => ({ ...c, phase: expectedPhase(c.key), priority: 0 }));
  await targetActor.createEmbeddedDocuments("ActiveEffect", [{
    name, img: img || "icons/svg/upgrade.svg",
    system: { changes },
    flags: { "warhammer-dbc": { [TEMP_FLAG]: sourceActor.uuid } }
  }]);
}

/** Снимает со ВСЕХ комбатантов боя временные эффекты, выданные ИМЕННО этим
 * шаманом — звать, когда начинается Ход `shamanActor` (module/hooks.mjs::
 * updateCombat, тем же тактом, что clearDreadWailWeaponBuff). Безопасно
 * звать для любого актора вне зависимости от того, шаман он или нет —
 * фильтр по uuid сам ничего не найдёт и не тронет чужие эффекты. */
export async function clearBeastmanShamanTempEffects(combat, shamanActor) {
  if (!combat || !shamanActor) return;
  for (const combatant of combat.combatants ?? []) {
    const a = combatant.actor;
    if (!a) continue;
    const ids = (a.effects?.contents ?? [])
      .filter(fx => fx.getFlag?.("warhammer-dbc", TEMP_FLAG) === shamanActor.uuid)
      .map(fx => fx.id);
    if (ids.length) await a.deleteEmbeddedDocuments("ActiveEffect", ids);
  }
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

  // Персонаж — источник Fear(+1) для врагов: реальный временный эффект
  // (system.fearRating — safe final-фаза, effect-keys.mjs).
  await grantTempEffect(actor, actor, "Первобытный Вой — Fear(+1)",
    [{ key: "system.fearRating", type: "add", value: 1 }], actor.img);
  lines.push(`Персонаж получает временный Fear(+1) — врагов в радиусе: ${enemies.length}.`);

  const allyNames = [];
  for (const t of inRange) {
    if (!allies.includes(t)) continue;
    const a = t.actor;
    const changes = [];
    if (god === "khorne") {
      changes.push({ key: charFxKey("s"), type: "add", value: 10 });
      changes.push({ key: charFxKey("ws"), type: "add", value: 10 }); // замена бонуса к T
      if (!a.system?.inRage) await a.update({ "system.inRage": true });
    } else if (god === "nurgle") {
      changes.push({ key: charFxKey("t"), type: "add", value: 10 }); // бонус к S заменён на аблатив
      const roll = await new Roll("1d10").evaluate();
      const cur = Number(a.system?.wounds?.ablative) || 0;
      const max = Number(a.system?.wounds?.ablativeMax) || 0;
      const next = cur + roll.total;
      await a.update({ "system.wounds.ablative": next, "system.wounds.ablativeMax": Math.max(max, next) });
    } else if (god === "slaanesh") {
      changes.push({ key: charFxKey("ag"), type: "add", value: 10 }); // вместо S/T
      const cur = Number(a.system?.fatigue?.value) || 0;
      if (cur > 0) await a.update({ "system.fatigue.value": cur - 1 });
    } else if (god === "tzeentch") {
      changes.push({ key: charFxKey("per"), type: "add", value: 10 }); // вместо S/T
    } else {
      changes.push({ key: charFxKey("s"), type: "add", value: 10 });
      changes.push({ key: charFxKey("t"), type: "add", value: 10 });
    }
    await grantTempEffect(a, actor, `Первобытный Вой (${godLabel(god)})`, changes, actor.img);
    allyNames.push(esc(a.name));
  }
  lines.push(`Союзники (${allyNames.length}): ${allyNames.join(", ") || "никого в радиусе"} — временный эффект «Первобытный Вой» до начала следующего Хода персонажа (список см. вкладку Эффекты).`);

  const notes = [];
  if (god === "khorne") notes.push("Кхорн: +4 Dmg рукопашным атакам союзников — нет безопасного ключа эффекта для урона оружия, впишите вручную.");
  else if (god === "nurgle") notes.push("Нургл: переброс тестов сопротивления движению — не смоделирован.");
  else if (god === "slaanesh") notes.push("Слаанеш: 1 Усталость проваливших тест на Страх врагов — не смоделирована (сам тест на Страх не запускается).");
  else if (god === "tzeentch") {
    const teButtons = buildTargetEffectButtons(
      resolveWeaponPropsList([{ key: "hallucinogenic", rating: 1 }]), { hit: true }
    );
    if (teButtons) lines.push(`Враги — неизбежное попадание Hallucinogenic(1) (выберите токен цели на сцене, затем нажмите — резолвит настоящий движок Особых Свойств Оружия):${teButtons}`);
    notes.push("+20 к варп-феноменам до конца следующего хода — не смоделировано.");
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
    if (god === "nurgle") {
      const curRounds = Number(t.actor.system?.conditions?.suffocatingRounds) || 0;
      await t.actor.update({ "system.conditions.suffocating": true, "system.conditions.suffocatingRounds": Math.max(curRounds, 1) });
    }
  }
  lines.push(`Провалившие тест W−10 (${failed.length}/${enemies.length}): ${failed.map(a => esc(a.name)).join(", ") || "—"} — +1 Порча каждому${god === "nurgle" ? " + реальное Состояние «Удушье»" : ""}.`);
  lines.push(`Союзники (${allies.length}) в ауре: +20 к тестам Сопротивления, пока у персонажа нет метки — не смоделировано (нет ключа эффекта для бонуса теста).`);

  const notes = [];
  if (god === "khorne") notes.push("Кхорн: провалившие тест немедленно проходят тест на Fear (4) — не запускается автоматически (тот же уровень, что «fear» у Dread Wail).");
  else if (god === "nurgle") notes.push("Нургл: герметичная броня — попадание Corrosive(Cor.b) — не смоделировано (нужен контекст реального попадания/брони).");
  else if (god === "slaanesh") notes.push("Слаанеш: провалившие очарованы — не атакуют персонажа/стадо, пока их не атакуют первыми — не смоделировано.");
  else if (god === "tzeentch") notes.push("Тзинч: провалившие смещаются на PR метров — не смоделировано, разместите вручную.");

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
  // эPR — бросковый бонус манифестации психосилы (не хранимое/производное
  // поле актора), Tainted — свойство ближнего боя: ни для одного нет
  // безопасного ключа ActiveEffect в этой системе, остаются текстом.
  const notes = ["+2 эPR и Tainted на ближний бой до конца следующего Хода — не смоделировано (эPR не хранимое поле, Tainted оружия — свойство конкретного предмета)."];

  if (god === "khorne") {
    const dmgBonus = selfDmg.total * 2;
    lines.push(`Кхорн: бонус к Dmg +${dmgBonus} (вместо эPR) до конца следующего Хода — впишите вручную.`);
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
//  Базовый +15 союзникам-зверолюдям на атаки по цели — rules/library/
//  beastman-shaman.mjs (общий реестр правил, читает HEX_MARK_FLAG цели).
// ════════════════════════════════════════════════════════════════════════
const HEX_MARKED_PREY_NAME = "Hex-Marked Prey / Проклятая Метка";
export const HEX_MARK_FLAG = "hexMarkedPrey";

export function hexMarkedPreyAvailable(actor) {
  return hasBeastmanShamanTalent(actor, HEX_MARKED_PREY_NAME);
}

/** Соревновательный тест W+0 (шаман) vs W+10 (цель) — книжное правило
 * встречного теста (стр. 25): оба проходят степень успеха/провала против
 * своего порога, выигрывает большая степень УСПЕХА. */
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
    await targetActor.setFlag("warhammer-dbc", HEX_MARK_FLAG, { shamanUuid: actor.uuid, god });
    lines.push(`Реальное правило (rules/library/beastman-shaman.mjs): союзники-зверолюди получают +15 на атаки против «${esc(targetActor.name)}» — само сработает в тесте Атаки.`);
    if (god === "khorne") lines.push("Кхорн: атаки союзников по цели получают Proven(3); крит с R-уроном — доп. кровотечение — свойства оружия конкретного союзника, не инжектируются движком атаки (wdbc-xxb7, заведён отдельный тикет).");
    else if (god === "nurgle") lines.push("Нургл: атаки союзников по цели получают Toxic(1); выживший провал T+10 в конце боя — Гниль Нургла — тот же пробел движка, см. тикет.");
    else if (god === "slaanesh") lines.push("Слаанеш: цель не удаляется от шамана дальше 20 м, штраф −10 Dodge/Parry; урон шамана цели восстанавливает 1d3 Раны — не смоделировано.");
    else if (god === "tzeentch") lines.push("Тзинч: выбранная характеристика цели −10 на время метки; провал по ней — шаману +5 к следующей манифестации — не смоделировано.");
  }
  await chatCard(actor, "Проклятая Метка", lines);
}

/** Снимает метку со всех комбатантов закончившегося боя — «до конца боя»,
 * тем же тактом, что clearAvatarOfSlaughterMarks (hooks.mjs::deleteCombat). */
export async function clearHexMarkedPreyMarks(combat) {
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant.actor;
    if (actor?.getFlag?.("warhammer-dbc", HEX_MARK_FLAG)) {
      await actor.unsetFlag("warhammer-dbc", HEX_MARK_FLAG);
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
//  Bone-Rune Etching / Костяная Рунопись — иная по форме способность
//  (крафт-экономика рун, не боевой триггер за раунд боя): кнопка выдаёт
//  полный книжный текст базового эффекта + активной god-ветки, без попытки
//  смоделировать саму экономику рун/лимит Cor.b/траты Очка Бесчестия.
// ════════════════════════════════════════════════════════════════════════
const BONE_RUNE_ETCHING_NAME = "Bone-Rune Etching / Костяная Рунопись";
const BONE_RUNE_TEXT = {
  base: "Шаман постиг искусство заключать психическую энергию в физические руны, вырезаемые на костях, рогах или зубах. Потратив 1 час и подходящий осколок из кости достойного врага или психоактивного материала, он создаёт руну, хранящую одну психосилу, которую он знает. В бою руну можно активировать за Свободное Действие (или Реакцию, если психосила имеет тип Реагирование) — манифестация происходит автоматически с Успехами, равными бPR персонажа на момент создания. Создание требует комбинированного теста Schol.Lore (Occult)−20 и Trade (из требования)−20 и траты 1 Очка Бесчестия. Носить с собой можно не более Cor.b таких рун.",
  khorne: "Кхорн: вместо вложения психосилы руна вкладывает ненависть колдуна к нечестным методам, что есть у Кхорна. При активации персонаж создаёт на Cor.b раундов вокруг себя ауру радиусом Cor.b×3 метров, которая работает как нуль-поле божественного происхождения, не вредящее самому персонажу.",
  nurgle: "Нургл: в руну проникают силы из Сада Дедушки Нургла. Независимо от типа урона, психосила получает Toxic (2). Если психосила создаёт ауру или шаблон, все существа в нём получают одно попадание Toxic (1), если не покинули шаблон. Если руна воздействует на союзника, он получает +PR аблативных ран и столько же восстанавливает. Персонаж и его союзники иммунны к Toxic этой ауры.",
  slaanesh: "Слаанеш: руна обладает утончённой структурой, что позволяет восстановить её прямо во время боя. После использования руны персонаж может немедленно потратить Очко Бесчестия и восстановить руну.",
  tzeentch: "Тзинч: создавая руну, шаман может вписать в неё не свои познания, а случайные течения варпа. При успешном завершении работы над руной персонаж может бросить на феномен с бонусом PR×3, а если феномен становится прорывом — с бонусом PR×2. Выпавший феномен или прорыв запираются в руне, и персонаж может высвободить его на дистанции PR+W.b+Cor.b метров от себя. Бросок на феномен и/или прорыв ГМ делает скрытно от игрока."
};

export function boneRuneEtchingAvailable(actor) {
  return hasBeastmanShamanTalent(actor, BONE_RUNE_ETCHING_NAME);
}

export async function showBoneRuneEtchingText(actor) {
  const god = activeGodBranch(actor);
  const lines = [BONE_RUNE_TEXT.base];
  if (god) lines.push(`<b>${esc(godLabel(god))}:</b> ${BONE_RUNE_TEXT[god]}`);
  await chatCard(actor, "Костяная Рунопись", lines,
    ["Экономика рун (создание/лимит Cor.b/траты Очка Бесчестия) не отслеживается движком — крафт-способность, не боевой триггер."]);
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
    // Плоский бонус «ко ВСЕМ тестам» (не к характеристике) не имеет
    // безопасного ключа ActiveEffect в этой системе — информационный флаг,
    // как и было; иммунитет к Страху/Подавлению аналогично не имеет
    // отдельного Состояния (Страх/Подавление разрешаются тестом, не тегом).
    ["Бонус к тестам/иммунитет — информационная метка (нет ключа эффекта для «бонус ко всем тестам»), снимите вручную в начале следующего Хода."]);
}

// ════════════════════════════════════════════════════════════════════════
//  Symbol of Power / Символ Власти (Черта) — одноразовая перестройка на
//  выдаче: Natural Weapons → Deadly Natural Weapons, снятие Stepchildren of
//  the Gods, отдельный трейт рогов Deadly Natural Weapons (бPR, Рога).
//  Тот же безопасный приём удаления, что race-def removesTraits
//  (module/apps/races.mjs) — itemHasName по ОДНОЙ половине имени, не
//  подстрокой (иначе снесло бы «Deadly Natural Weapons» заодно).
//  Психофокус из рога/боль-за-эPR/освобождение от Aversion to Order —
//  НЕ автоматизированы: последнее опирается на механику «Lore/Trade
//  враждебны от Aversion to Order», которой в движке цены Склонностей
//  нет вовсе НИ У КОГО (проверено — только текст трейта, ни одной строчки
//  кода), так что здесь нечего «исключать».
// ════════════════════════════════════════════════════════════════════════
const SYMBOL_OF_POWER_NAME = "Symbol of Power / Символ Власти";
const DEADLY_NATURAL_WEAPONS_NAME = "Deadly Natural Weapons / Смертельное Естественное Оружие";
const NATURAL_WEAPONS_NAME = "Natural Weapons";
const STEPCHILDREN_NAME = "Stepchildren of the Gods";
const SYMBOL_GRANT_FLAG = "symbolOfPowerApplied";

export function hasSymbolOfPower(actor) {
  return hasBeastmanShamanTrait(actor, SYMBOL_OF_POWER_NAME);
}

/** Ищет запись библиотеки/пака Черты по имени — для sourceUuid/img новой
 * встраиваемой копии (тот же путь, что item-picker/homeworlds.mjs). */
async function findTraitLibraryDoc(name) {
  const pack = game.packs?.get("warhammer-dbc.traits");
  if (!pack) return null;
  const index = await pack.getIndex();
  const hit = index.find(e => itemHasName({ name: e.name }, engHalf(name)));
  return hit ? pack.getDocument(hit._id) : null;
}

/**
 * Одноразовая перестройка при получении Символа Власти — идемпотентна
 * (SYMBOL_GRANT_FLAG), безопасна повторно звать (createItem может
 * сработать больше раза на разных клиентах — тот же гейт, что у остальных
 * createItem-хуков проекта).
 */
export async function applySymbolOfPowerGrant(actor) {
  if (!actor || actor.getFlag("warhammer-dbc", SYMBOL_GRANT_FLAG)) return;
  await actor.setFlag("warhammer-dbc", SYMBOL_GRANT_FLAG, true);

  const toDelete = actor.items
    .filter(i => i.type === "trait" && (itemHasName(i, NATURAL_WEAPONS_NAME) || itemHasName(i, STEPCHILDREN_NAME)))
    .map(i => i.id);
  const hadNaturalWeapons = actor.items.some(i => i.type === "trait" && itemHasName(i, NATURAL_WEAPONS_NAME));
  if (toDelete.length) await actor.deleteEmbeddedDocuments("Item", toDelete);

  const toCreate = [];
  if (hadNaturalWeapons && !actor.items.some(i => i.type === "trait" && itemHasName(i, DEADLY_NATURAL_WEAPONS_NAME))) {
    const src = await findTraitLibraryDoc(DEADLY_NATURAL_WEAPONS_NAME);
    if (src) { const d = src.toObject(); delete d._id; toCreate.push(d); }
  }
  {
    const src = await findTraitLibraryDoc(DEADLY_NATURAL_WEAPONS_NAME);
    if (src) {
      const d = src.toObject(); delete d._id;
      d.name = "Deadly Natural Weapons / Смертельное Естественное Оружие (Рога)";
      d.system.hasRating = true;
      d.system.rating = Number(actor.system?.psyker?.rating) || 0;
      toCreate.push(d);
    }
  }
  if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);

  await chatCard(actor, "Символ Власти — получен", [
    hadNaturalWeapons ? "Natural Weapons заменён на Deadly Natural Weapons." : "Natural Weapons не найден — замена пропущена.",
    "Добавлен отдельный трейт рогов: Deadly Natural Weapons (бPR, Рога).",
    "Stepchildren of the Gods снят (если был)."
  ], [
    "Не автоматизировано: пси-фокус из рога, боль за +2 эPR, свойство Tainted на рога, освобождение от Aversion to Order/кибернетики — читайте текст Черты."
  ]);
}
