// module/combat/lord-of-exodites.mjs
// ════════════════════════════════════════════════════════════════════════
//  Lord of the Exodites / Повелитель Экзодитов (wdbc-zepq) — три из пяти
//  частей составной Черты элитного архетипа «Лесной Владыка», которые не
//  укладываются в декларативную Механику (module/rules/item-rules.mjs) или в
//  готовую ауру (module/regions/auras.mjs): групповое снятие
//  Страха/Шока/Подавления, восстановление Судьбы Отряду, и переключатель
//  бонус↔штраф ауры по исходу собственного проваленного теста Морали.
//  Аура (+30/переброс союзникам) и собственный переброс — обычная Механика
//  прямо на предметах (packs-src/aeldari-traits/.../Lord_of_the_Exodites и
//  служебный Aura_of_the_Exodite_Lord); здесь — только то, что требует кода.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { hasAbility } from "../rules/ability-by-key.mjs";
import { subordinatesOf, squadsCommandedBy } from "../rules/adjutant.mjs";
import { effectiveRace } from "../rules/race.mjs";
import { AELDARI_RACES } from "../constants/races.mjs";
import { changeInfamy, spendFromInfamyPool } from "../apps/infamy-points.mjs";
import { degreesOfSuccess } from "../constants/craft.mjs";
import { esc, _degWord } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { conditionRemoveFields } from "../sheets/tabs/conditions.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { postTestCard, thresholdLine, outcomeHtml } from "../helpers/test-card.mjs";

const DISGRACE_FLAG = "lordOfExoditesDisgraced";

/** Владеет ли актор Чертой Lord of the Exodites / Повелитель Экзодитов. */
export function hasLordOfExodites(actor) {
  return hasAbility(actor, "ability.lordOfTheExodites", "Lord of the Exodites", "trait");
}

/**
 * Эвристика умолчания для «автоуспех = Unnatural F» (часть 3): в системе
 * Unnatural-бонусы не хранятся отдельным полем — они слиты в общий
 * characteristics.fel.bonusFx через legacy ActiveEffect предмета (см.
 * charBonuses в module/apps/mechanics.mjs). Ищет у актора предмет с
 * «Unnatural» в имени, чей ActiveEffect правит именно fel.bonusFx, и
 * возвращает величину оттуда — только СТАРТОВОЕ значение поля в диалоге,
 * которое остаётся редактируемым (другие источники Unnatural F не сложатся
 * автоматически). Возвращает 0, если ничего не найдено.
 */
export function unnaturalFHint(actor) {
  for (const item of actor?.items ?? []) {
    if (!/unnatural/i.test(item.name || "")) continue;
    for (const effect of item.effects ?? []) {
      for (const change of effect.changes ?? []) {
        if (change.key === "system.characteristics.fel.bonusFx") {
          const v = Number(change.value) || 0;
          if (v) return v;
        }
      }
    }
  }
  return 0;
}

/**
 * Часть 2 — Полное действие: гарантированно (без теста) выводит выбранных
 * союзников из Страха/Шока/Подавления. «Страх» в терминах системы не
 * персистентен (разовый бросок) — из кодируемых состояний снимается только
 * Шок (conditions.shocked) и Подавление (conditions.pinned); упоминание
 * «Страха» в чат-карточке остаётся справочным для стола.
 */
export async function clearMoraleConditions(lord, targetActors) {
  const targets = (targetActors ?? []).filter(a => a && a !== lord);
  if (!targets.length) return ui.notifications?.warn("⚠️ Выберите хотя бы одного союзника.");
  for (const actor of targets) {
    await actor.update({ ...conditionRemoveFields("shocked"), ...conditionRemoveFields("pinned") });
  }
  const names = targets.map(a => esc(a.name)).join(", ");
  // Не карточка теста (wdbc-kuun): Полное действие снимает состояния
  // ГАРАНТИРОВАННО, без броска и Порога — это уведомление стола о том, кого
  // вывели, поэтому собирается по-прежнему на месте.
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: lord }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("crown","#4dffa6")}Повелитель Экзодитов — ${esc(lord.name)}</div>
      <div class="roll-threshold">Выведены из Страха/Шока/Подавления: <b>${names}</b></div>
    </div>`
  }, game.settings.get("core", "rollMode")));
}

/** Все эльдары-члены Отряда(ов), где lord — Командир, включая его самого. */
export function exoditeSquadmatesOf(lord, allActors) {
  const mates = subordinatesOf(lord, allActors).filter(a => AELDARI_RACES.includes(effectiveRace(a.system)));
  return AELDARI_RACES.includes(effectiveRace(lord.system)) ? [lord, ...mates] : mates;
}

/**
 * Часть 4 — Command(F)−10: восстанавливает 1 очко Судьбы всем эльдарам своего
 * Отряда, включая себя. «На передовой против сильнейшего противника» не
 * автоматизируется (нет данных о расстановке на поле боя) — доступно всегда,
 * уместность решает стол (тот же принцип, что бонус Подавления «если тихо»).
 */
export async function rallyExoditeSquad(actor, { mod = -10 } = {}) {
  if (!squadsCommandedBy(actor, game.actors ?? []).length) {
    return ui.notifications?.warn("⚠️ Персонаж не Командир ни одного Отряда.");
  }
  const base = Number(actor.system?.skills?.command?.total) || 0;
  // Общий сбор модификаторов (wdbc-ct65.3) — тот же, что у обычного теста
  // Командования (sheets/tabs/command.mjs).
  const ruleMods = collectTestMods(actor, { kind: "skill", skill: "command", char: "fel" });
  const threshold = base + mod + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const ok = rv <= threshold;
  const sux = ok ? degreesOfSuccess(rv, threshold) : 0;

  const healedNames = [];
  if (ok) {
    for (const mate of exoditeSquadmatesOf(actor, game.actors ?? [])) {
      const max = Number(mate.system?.fate?.max) || 0;
      if (!max) continue;
      await changeInfamy(mate, "system.fate.value", max, 1);
      healedNames.push(esc(mate.name));
    }
  }

  // Карточка — общим сборщиком (wdbc-kuun): слагаемые Порога перечисляются
  // в скобках через запятую, как в боевых карточках, а не через « · ».
  await postTestCard(actor, {
    icon: rollIcon("crown","#4dffa6"), title: "Повелитель Экзодитов — восстановление Судьбы",
    threshold: thresholdLine({
      label: "Command(F)", base,
      parts: [mod ? `${mod >= 0 ? "+" : ""}${mod}` : "", ...ruleMods.parts],
      threshold
    }),
    rv,
    outcome: ok
      ? outcomeHtml(true, `Успех — ${sux} ${_degWord(sux)}, +1 Судьбы: ${healedNames.join(", ") || "—"}`)
      : outcomeHtml(false, "Провал")
  }, { rolls: [roll] });
  return { ok, healedNames };
}

/**
 * Часть 5 — провал теста Морали владельца Черты на 2+ степени ПРИ
 * ИСПОЛЬЗОВАННОМ переброс (собственная Механика reroll на предмете самой
 * Черты, scope "morale"). Списывает 1 Судьбы обычным путём («Пламенная
 * вера» может спасти, как любую другую трату — не помечается whSkipFateSave)
 * и переключает флаг, от которого зависит бонус/штраф служебного предмета
 * ауры на союзниках.
 */
export async function applyLordOfExoditesFailPenalty(actor, { dof = 0, usedReroll = false } = {}) {
  if (!usedReroll || dof < 2 || !hasLordOfExodites(actor)) return;
  const spend = await spendFromInfamyPool(actor, 1, "system.fate.value");
  await actor.update({ "system.fate.value": spend.poolValue });
  await actor.setFlag("warhammer-dbc", DISGRACE_FLAG, true);
  await flipAuraGrants(actor, -20);
  // Не карточка теста (wdbc-kuun): броска и Порога здесь нет — это следствие
  // УЖЕ проваленного теста Морали (списанная Судьба и перевёрнутая аура),
  // сообщение-уведомление, поэтому собирается по-прежнему на месте.
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("warn","#ff6b6b")}Повелитель Экзодитов — провал с перебросом</div>
      <div class="roll-threshold">−1 Судьбы, бонус союзников (+30) обращён в штраф (−20) до восстановления милости.</div>
    </div>`
  }, game.settings.get("core", "rollMode")));
}

/** Ручной откат переключателя («Вернуть милость») — снимает флаг, возвращает +30. */
export async function restoreLordOfExoditesGrace(actor) {
  await actor.unsetFlag("warhammer-dbc", DISGRACE_FLAG);
  await flipAuraGrants(actor, 30);
}

/**
 * Точечно правит testMod служебного предмета ауры («Aura of the Exodite
 * Lord»), выданного sweepAurasOnScene всем текущим союзникам (Item.flags.
 * warhammer-dbc.auraSource === uuid этого actor'а) — с +30 на −20 и обратно,
 * не создавая второй служебный предмет и не трогая сам механизм ауры.
 */
async function flipAuraGrants(lord, value) {
  for (const actor of game.actors ?? []) {
    for (const item of actor.items ?? []) {
      if (item.flags?.["warhammer-dbc"]?.auraSource !== lord.uuid) continue;
      const mechanics = foundry.utils.deepClone(item.flags?.["warhammer-dbc"]?.mechanics ?? []);
      let changed = false;
      for (const group of mechanics) {
        for (const entry of group.entries ?? []) {
          if (entry.kind === "testMod" && entry.modScope === "morale") { entry.value = value; changed = true; }
        }
      }
      if (changed) await actor.updateEmbeddedDocuments("Item", [{ _id: item.id, "flags.warhammer-dbc.mechanics": mechanics }]);
    }
  }
}
