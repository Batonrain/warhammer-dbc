// module/rules/imperative.mjs
// ═══════════════════════════════════════════════════════════════════════════
//  Императив (Х) — тип чуда Техночудес (wdbc-yu32): «При активации Императив
//  воздействует на до Х согласных целей... Эффект действует до конца
//  следующего Хода техножреца, или пока цель не получит другой Императив,
//  отменяя эффект предыдущего» (core.json, «Типы Техночудес»). Это НЕ про
//  isItemActive источника — сам techPower обычно не несёт effects вовсе
//  (Evasion/Fortress Imperative пусты, см. wdbc-yu32), это состояние ЦЕЛИ.
//
//  Устройство — тем же приёмом, что «Дух героя» (apps/armour-history-
//  trance.mjs) и Песня Стремительности (combat/song-of-swiftness.mjs):
//  embedded-предмет-носитель на акторе ЦЕЛИ, найти который можно по
//  собственному флагу. Отличия от обоих прецедентов:
//   - граница по РАУНДУ (imperativeExpireRound), а не по концу боя — снимает
//     resolveExpiredImperatives, вызываемый из hooks.mjs::updateCombat, а не
//     deleteCombat;
//   - правило замещения «один Императив на ЦЕЛЬ» (не на носителя и не per-
//     source): новый Императив снимает предыдущий целиком, независимо от
//     того, какой источник его дал.
//
//  Округление длительности: «до конца следующего Хода техножреца» хранится
//  как combat.round+1 в момент активации — та же round-грануляность, что уже
//  принята для похожих отложенных эффектов (apps/sus-an-heal.mjs::dueRound).
//  Не различает, чей именно Ход внутри раунда уже прошёл, — честный
//  компромисс того же класса, что LOS/«отвлекающая попытка Избегания» в
//  других местах проекта. Активация вне Combat не выставляет срок вовсе —
//  снимется только заменой (отследить «следующий Ход» нечем без боя, тот же
//  принцип, что liveValue в rules/cooldown.mjs). Цель ВНЕ текущего Combat
//  (не комбатант) не будет снята автоматически — тем же ограничением, что у
//  Духа героя/Песни Стремительности.
// ═══════════════════════════════════════════════════════════════════════════

const FLAG = "warhammer-dbc";

/** Активный носитель Императива на акторе, или null (ровно один на цель). */
export function activeImperative(actor) {
  return [...(actor?.items ?? [])].find(i => i.getFlag?.(FLAG, "imperativeCarrier") === true) ?? null;
}

/** Сырые данные бонусов активного Императива цели (читает combat/imperative-bonuses.mjs), или null. */
export function activeImperativeBonuses(actor) {
  return activeImperative(actor)?.getFlag(FLAG, "imperativeBonuses") ?? null;
}

/**
 * Наложить Императив на цель: снимает предыдущий Императив ЦЕЛИ (любой
 * источник — правило замещения), создаёт новый носитель. `bonuses` — сырой
 * объект для читателей, движок сам его не интерпретирует.
 */
export async function applyImperative(targetActor, { sourceItem, casterActor, label, bonuses } = {}) {
  if (!targetActor) return null;
  const prior = activeImperative(targetActor);
  if (prior) await targetActor.deleteEmbeddedDocuments("Item", [prior.id]);

  const expireRound = game.combat ? game.combat.round + 1 : null;
  const [created] = await targetActor.createEmbeddedDocuments("Item", [{
    name: `Императив: ${label}`,
    type: "trait",
    img: sourceItem?.img || "systems/warhammer-dbc/assets/item-icons/techpower.svg",
    system: { rating: "" },
    flags: {
      [FLAG]: {
        imperativeCarrier: true,
        imperativeSourceUuid: sourceItem?.uuid ?? "",
        imperativeCasterId: casterActor?.id ?? "",
        imperativeExpireRound: expireRound,
        imperativeBonuses: bonuses ?? {}
      }
    }
  }]);
  return created ?? null;
}

/**
 * Резолвер смены Раунда — звать из module/hooks.mjs на updateCombat со
 * сменившимся round. Снимает Императивы комбатантов этого боя, чей срок
 * (imperativeExpireRound) уже строго меньше текущего раунда.
 */
export async function resolveExpiredImperatives(combat) {
  if (!game.user.isGM) return;
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant.actor;
    if (!actor) continue;
    const carrier = activeImperative(actor);
    if (!carrier) continue;
    const expireRound = carrier.getFlag(FLAG, "imperativeExpireRound");
    if (expireRound !== null && expireRound !== undefined && combat.round > expireRound) {
      await actor.deleteEmbeddedDocuments("Item", [carrier.id]);
    }
  }
}
