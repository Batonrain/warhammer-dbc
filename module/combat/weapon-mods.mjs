// module/combat/weapon-mods.mjs
// ─────────────────────────────────────────────────────────────────────────────
//  Модификации оружия: привязка к оружию и агрегация эффектов.
//  Модификация — Item типа "weaponMod" с system.installedOn = id оружия.
// ─────────────────────────────────────────────────────────────────────────────

/** Все установленные на данное оружие модификации (среди предметов актора). */
export function getInstalledMods(actor, weapon) {
  if (!actor || !weapon) return [];
  return actor.items.filter(i =>
    i.type === "weaponMod" && i.system.installedOn === weapon.id
  );
}

/**
 * Сворачивает эффекты всех установленных модификаций в один объект.
 * Числовые — складываются; множители (rangeMult/clipMult) — перемножаются.
 * addProps — список {key,rating,rating2}; removeProps — массив ключей.
 *
 * Поля читаются из system.effects НАПРЯМУЮ, без проверки migratedEffect — и
 * это не пробел, а задокументированное исключение: WEAPON_MOD_EFFECT_KEYS /
 * PSYCHIC_WEAPON_BUFF_KEY в migrations/item-effects.mjs перечисляют их явно.
 * В LEGACY_ONLY_KEYS их заносить нельзя (это заблокировало бы migratedEffect
 * навсегда для любой реальной модификации — там эти поля заполнены штатно, не
 * как остаток старой миграции) — сами поля в ActiveEffect не переносятся
 * вовсе, это отдельная, самостоятельная система «эффектов оружия» (wdbc-ng6c, B4).
 */
export function getModEffects(actor, weapon) {
  const fx = {
    attackMod: 0, damageMod: 0, penMod: 0, rangeMod: 0, rangeMult: 1,
    clipMod: 0, clipMult: 1, rofSemiMod: 0, rofFullMod: 0,
    reliabilityMod: 0, balanceMod: 0, weightPct: 0,
    addProps: [], removeProps: [], names: []
  };
  for (const mod of getInstalledMods(actor, weapon)) {
    const e = mod.system.effects || {};
    fx.attackMod      += e.attackMod      || 0;
    fx.damageMod      += e.damageMod      || 0;
    fx.penMod         += e.penMod         || 0;
    fx.rangeMod       += e.rangeMod       || 0;
    fx.rangeMult      *= (e.rangeMult ?? 1) || 1;
    fx.clipMod        += e.clipMod        || 0;
    fx.clipMult       *= (e.clipMult ?? 1) || 1;
    fx.rofSemiMod     += e.rofSemiMod     || 0;
    fx.rofFullMod     += e.rofFullMod     || 0;
    fx.reliabilityMod += e.reliabilityMod || 0;
    fx.balanceMod     += e.balanceMod     || 0;
    fx.weightPct      += e.weightPct      || 0;
    for (const p of (e.addProps || [])) fx.addProps.push(p);
    for (const k of (e.removeProps || [])) fx.removeProps.push(k);
    // Построено Конструктором Механики (kind:"weaponProp", см. module/apps/mechanics.mjs) —
    // отдельные поля, чтобы не задевать addProps/removeProps ручного раздела «Даруемые
    // свойства» выше на листе модификации; здесь просто доливаются в тот же поток.
    for (const p of (e.mechAddProps || [])) fx.addProps.push(p);
    for (const k of (e.mechRemoveProps || [])) fx.removeProps.push(k);
    fx.names.push(mod.name);
  }

  // ── Усиление от поддерживаемых психосил (Force-оружие, благословения и т.п.) ──
  for (const power of actor.items) {
    if (power.type !== "psychicPower" || !power.system.isSustained) continue;
    const wb = power.system.effects?.weaponBuff;
    if (!wb || !wb.enabled) continue;
    const scope = wb.scope || "equipped";
    if (scope === "equipped" && !weapon.system.equipped) continue;
    if (scope === "force" && !(weapon.system.weaponProps || []).some(p => p.key === "force")) continue;
    fx.damageMod += Number(wb.damageMod) || 0;
    fx.penMod    += Number(wb.penMod)    || 0;
    fx.rangeMod  += Number(wb.rangeMod)  || 0;
    for (const p of (wb.addProps || [])) fx.addProps.push(p);
    fx.names.push(power.name);
  }

  // ── Усиление от Талантов (wdbc-g53k) — тот же weaponBuff, что у психосил
  // выше, но без гейта isSustained: Талант действует, просто пока он на
  // акторе (тот же рубильник, что charBonuses/armourAll/fearRating Талантов
  // в module/documents/actor.mjs). ──
  for (const talent of actor.items) {
    if (talent.type !== "talent") continue;
    const wb = talent.system.effects?.weaponBuff;
    if (!wb || !wb.enabled) continue;
    const scope = wb.scope || "equipped";
    if (scope === "equipped" && !weapon.system.equipped) continue;
    if (scope === "force" && !(weapon.system.weaponProps || []).some(p => p.key === "force")) continue;
    fx.damageMod += Number(wb.damageMod) || 0;
    fx.penMod    += Number(wb.penMod)    || 0;
    fx.rangeMod  += Number(wb.rangeMod)  || 0;
    for (const p of (wb.addProps || [])) fx.addProps.push(p);
    fx.names.push(talent.name);
  }
  return fx;
}

/**
 * Итоговый список свойств оружия с учётом модификаций:
 * собственные weaponProps + добавленные модами − убранные модами.
 * Возвращает массив {key, rating, rating2} (для resolveWeaponPropsList).
 */
export function mergeWeaponPropEntries(weapon, modFx) {
  const own = foundry.utils.deepClone(weapon?.system?.weaponProps ?? []);
  const removed = new Set(modFx?.removeProps ?? []);
  const result = own.filter(p => !removed.has(p.key));
  for (const p of (modFx?.addProps ?? [])) {
    if (removed.has(p.key)) continue;
    const existing = result.find(x => x.key === p.key);
    // ratingDelta (Конструктор: «увеличить/уменьшить рейтинг») — ОТНОСИТЕЛЬНАЯ
    // прибавка к уже посчитанному рейтингу, а не абсолютное значение (в отличие
    // от rating ниже, который берёт максимум при совпадении ключа).
    if (p.ratingDelta != null) {
      if (existing) {
        if (typeof existing.rating !== "string") existing.rating = Math.max(0, (existing.rating || 0) + p.ratingDelta);
      } else {
        result.push({ key: p.key, rating: Math.max(0, p.ratingDelta), rating2: 0 });
      }
      continue;
    }
    if (existing) {
      // Берём больший рейтинг, если свойство уже есть (строковые — формулы кубика — не максимизируем)
      existing.rating  = (typeof existing.rating === "string" || typeof p.rating === "string")
        ? (existing.rating || p.rating || 0)
        : Math.max(existing.rating  || 0, p.rating  || 0);
      // rating2 может быть формулой кубика (строка, напр. «2d10») — не вычисляем max.
      existing.rating2 = (typeof existing.rating2 === "string" || typeof p.rating2 === "string")
        ? (existing.rating2 || p.rating2 || 0)
        : Math.max(existing.rating2 || 0, p.rating2 || 0);
    } else {
      result.push({ key: p.key, rating: p.rating || 0, rating2: p.rating2 || 0 });
    }
  }
  return result;
}
