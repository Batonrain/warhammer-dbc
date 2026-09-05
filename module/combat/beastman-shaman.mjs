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
//  Бонус/штраф К ТЕСТУ (не к числовому полю актора) — грант ДРУГОГО вида:
//  «бонус к тесту» не ActiveEffect-ключ (его нет в effect-keys.mjs и не может
//  быть — это не хранимое system.*-поле, а живая галочка диалога), поэтому
//  Аура Скверны (applyWarpTaintedAura, +20 союзникам к тестам Стойкости,
//  wdbc-j0ip/wdbc-elng) выдаёт временную ЧЕРТУ с записью Конструктора
//  kind:"testMod" (grantTempTestMod ниже) — тот же путь, которым kind:"aura"
//  Конструктора (module/apps/mechanics.mjs) даёт союзникам/врагам в радиусе
//  клон предмета-шаблона: клонированная запись testMod действует сама, без
//  нового ключа эффекта. TEMP_FLAG общий для обоих видов гранта (ActiveEffect
//  и Item) — clearBeastmanShamanTempEffects снимает оба разом.
//
//  Свойства попаданий (Hallucinogenic) — переиспользуют РЕАЛЬНЫЙ движок
//  Особых Свойств Оружия (module/combat/weapon-properties.mjs::
//  buildTargetEffectButtons, тот же путь, что у обычного оружия с этим
//  свойством), а не собственную копию теста.
//
//  Proven(3)/Toxic(1) (Кхорн/Нургл-ответвления Hex-Marked Prey) — раньше
//  были заведённым отдельным пробелом движка (в атаке не было пути дать
//  оружию союзника доп. Особое Свойство ИЗ-ЗА состояния цели, проверено по
//  всем 22 worktree на момент wdbc-xxb7). Закрыт wdbc-w8z4: общий эффект
//  реестра правил `grantWeaponProp` (rules/resolve-test.mjs,
//  docs/rules-format.md) — оба god-правила лежат рядом с базовым +15 в
//  rules/library/beastman-shaman.mjs, читают ту же метку через
//  hexMarkedPreyAllyBonus(actor, ctx, god). Не смоделированы (остаются
//  текстом в чат-карточке applyHexMarkedPrey ниже): доп. кровотечение на
//  крите с R-уроном (Кхорн) и Гниль Нургла в конце боя (Нургл) — это
//  разовые триггеры, не про Особые Свойства Оружия, и общего места для них
//  в движке нет.
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
import { conditionApplyFields } from "../sheets/tabs/conditions.mjs";
import { buildTargetEffectButtons, resolveWeaponPropsList } from "./weapon-properties.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";

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

/**
 * Временный БОНУС/ШТРАФ К ТЕСТУ на `targetActor` (wdbc-j0ip/wdbc-elng) — тот
 * же принцип, что grantTempEffect выше, но НЕ ActiveEffect: «бонус к тесту»
 * не хранимое system.*-поле (нет и не может быть ключа в
 * constants/effect-keys.mjs — ActiveEffect умеет только числовые поля
 * актора, а модификатор теста живёт галочкой диалога), а живой запрос
 * конвейера теста (module/rules/item-rules.mjs::ruleFromEntry, kind:"testMod").
 * Тот запрос читает flags.warhammer-dbc.mechanics С ЛЮБОГО предмета актора —
 * ровно тот же путь, которым kind:"aura" Конструктора
 * (module/apps/mechanics.mjs::syncAuraFlag/collectAuraEntries,
 * module/regions/auras.mjs::sweepAurasOnScene) выдаёт союзникам/врагам в
 * радиусе КЛОН предмета-шаблона: если у шаблона есть запись kind:"testMod",
 * клон приносит её с собой, и правило начинает действовать само — Конструктору
 * для этого не нужно ни нового вида записи, ни нового ключа эффекта, только
 * подходящий предмет-шаблон в `grant`. Здесь та же идея, только без
 * предмета-шаблона в паке (способность не выдаётся Конструктором, а
 * запускается кодом): временная Черта создаётся на лету, единственное её
 * назначение — нести одну запись testMod.
 * Помечена тем же TEMP_FLAG, что и grantTempEffect (на Item, не на эффекте) —
 * clearBeastmanShamanTempEffects снимает оба вида разом по границе Хода
 * шамана. Знак задаёт вызывающий (`value`): положительный — бонус союзнику,
 * отрицательный — штраф врагу, инфраструктура ровно одна и та же.
 */
async function grantTempTestMod(targetActor, sourceActor, { label, modScope, rerollChar, skillKey, value, img }) {
  await targetActor.createEmbeddedDocuments("Item", [{
    name: label, type: "trait", img: img || "icons/svg/upgrade.svg",
    flags: {
      "warhammer-dbc": {
        [TEMP_FLAG]: sourceActor.uuid,
        // Формат Конструктора: массив ГРУПП {id, operator, entries:[ЗАПИСЬ]},
        // не голый массив записей — mechanicsOf()/getItemMechanics() в
        // module/rules/item-rules.mjs и module/apps/mechanics.mjs ждут именно
        // эту форму, «И»-группа из одной testMod-записи здесь equivalent
        // «применить всегда».
        mechanics: [{
          id: foundry.utils.randomID(), operator: "AND",
          entries: [{
            id: foundry.utils.randomID(), kind: "testMod",
            modScope, rerollChar: rerollChar || "", skillKey: skillKey || "",
            modValueMode: "flat", value, label
          }]
        }]
      }
    }
  }]);
}

/** Снимает со ВСЕХ комбатантов боя временные эффекты, выданные ИМЕННО этим
 * шаманом — звать, когда начинается Ход `shamanActor` (module/hooks.mjs::
 * updateCombat, тем же тактом, что clearDreadWailWeaponBuff). Безопасно
 * звать для любого актора вне зависимости от того, шаман он или нет —
 * фильтр по uuid сам ничего не найдёт и не тронет чужие эффекты. Снимает ДВА
 * вида временных грантов с одним и тем же TEMP_FLAG: ActiveEffect
 * (grantTempEffect — числовые поля) и Item (grantTempTestMod — временная
 * Черта с записью testMod, бонус/штраф к тесту, wdbc-j0ip/wdbc-elng). */
export async function clearBeastmanShamanTempEffects(combat, shamanActor) {
  if (!combat || !shamanActor) return;
  for (const combatant of combat.combatants ?? []) {
    const a = combatant.actor;
    if (!a) continue;
    const fxIds = (a.effects?.contents ?? [])
      .filter(fx => fx.getFlag?.("warhammer-dbc", TEMP_FLAG) === shamanActor.uuid)
      .map(fx => fx.id);
    if (fxIds.length) await a.deleteEmbeddedDocuments("ActiveEffect", fxIds);
    const itemIds = [...(a.items ?? [])]
      .filter(it => it.getFlag?.("warhammer-dbc", TEMP_FLAG) === shamanActor.uuid)
      .map(it => it.id);
    if (itemIds.length) await a.deleteEmbeddedDocuments("Item", itemIds);
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
    // Общий сбор модификаторов (wdbc-ct65.3) — по ЦЕЛИ: сопротивляется она.
    const targetMods = collectTestMods(t.actor, { kind: "skill", char: "wp" });
    const threshold = (Number(t.actor.system?.characteristics?.wp?.total) || 0) - 10 + targetMods.total;
    const roll = await new Roll("1d100").evaluate();
    const { success } = testOutcome(roll.total, threshold);
    if (success) continue;
    failed.push(t.actor);
    const curCor = Number(t.actor.system?.corruption?.value) || 0;
    await t.actor.update({ "system.corruption.value": curCor + 1 });
    if (god === "nurgle") {
      const curRounds = Number(t.actor.system?.conditions?.suffocatingRounds) || 0;
      await t.actor.update(conditionApplyFields("suffocating", Math.max(curRounds, 1)));
    }
  }
  lines.push(`Провалившие тест W−10 (${failed.length}/${enemies.length}): ${failed.map(a => esc(a.name)).join(", ") || "—"} — +1 Порча каждому${god === "nurgle" ? " + реальное Состояние «Удушье»" : ""}.`);

  // +20 к тестам Сопротивления (T) союзникам в ауре — РЕАЛЬНЫЙ временный
  // модификатор теста (wdbc-j0ip/wdbc-elng), не текст: grantTempTestMod даёт
  // каждому союзнику временную Черту с записью kind:"testMod", которую
  // конвейер теста (module/rules/item-rules.mjs) сам превращает в галочку
  // диалога Стойкости. Снимается clearBeastmanShamanTempEffects по границе
  // Хода ШАМАНА, тем же тактом, что и остальные временные баффы этого файла.
  const allyNames = [];
  for (const t of allies) {
    await grantTempTestMod(t.actor, actor, {
      label: "Аура Скверны: Сопротивление", modScope: "char", rerollChar: "t", value: 20, img: actor.img
    });
    allyNames.push(esc(t.actor.name));
  }
  lines.push(`Союзники (${allies.length}) в ауре: реальный +20 к тестам Стойкости (Сопротивления) до начала следующего Хода персонажа — ${allyNames.join(", ") || "никого в радиусе"} (галочка появится в диалоге теста Стойкости).`);

  const notes = ["«Пока у персонажа нет метки» — условие не смоделировано: в системе нет отслеживания подобной метки ни у одного актора, бонус выдаётся безусловно."];
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
  // Общий сбор обеим сторонам (wdbc-ct65.3) — см. combat/intimidate.mjs.
  const shamanMods = collectTestMods(actor, { kind: "skill", char: "wp" });
  const targetMods = collectTestMods(targetActor, { kind: "skill", char: "wp" });
  const shamanThreshold = (Number(actor.system?.characteristics?.wp?.total) || 0) + shamanMods.total;
  const targetThreshold = (Number(targetActor.system?.characteristics?.wp?.total) || 0) + 10 + targetMods.total;
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
    // Proven(3)/Toxic(1) — тоже реальные правила (wdbc-w8z4, grantWeaponProp),
    // сами доливаются в Особые Свойства Оружия атак союзников-зверолюдей по
    // цели. В тексте остаётся только то, что по-прежнему не смоделировано.
    if (god === "khorne") lines.push("Кхорн: атаки союзников по цели автоматически получают Proven(3) — крит с R-уроном (доп. кровотечение) не смоделирован.");
    else if (god === "nurgle") lines.push("Нургл: атаки союзников по цели автоматически получают Toxic(1) — выживший провал T+10 в конце боя (Гниль Нургла) не смоделирован.");
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
