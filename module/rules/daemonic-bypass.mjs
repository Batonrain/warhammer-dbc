// module/rules/daemonic-bypass.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Обход Трейта Daemonic (X) (Sahara daemonic-force-sanctified-warp-weapon, п.3).
//
//  Книга (core.json, Трейт Daemonic (X)): «Психосилы, оружие со свойствами
//  Force, Sanctified или Warp Weapon, естественное оружие персонажей с этим
//  Трейтом, Демонические и Руническое оружие игнорируют дополнительный T.b и
//  иммунитеты от этого Трейта».
//
//  Здесь — часть про T.b: сколько Бонуса Стойкости даёт сам Трейт (X лежит в
//  ActiveEffect Черты, ключ system.characteristics.t.bonusFx) и игнорирует ли
//  его это попадание. Читает combat/damage.mjs::applyDamageToActor. Варп-Оружие
//  обходит T.b целиком само (ветка warpSoak) — здесь оно на всякий случай тоже
//  засчитано.
// ════════════════════════════════════════════════════════════════════════════


const TB_KEY = "system.characteristics.t.bonusFx";
// «Daemonic / Демонический (X)», «Daemonic (+4) / Демонический» — но не
// Daemonic Dread / Uplink / Armament (другие Черты с тем же словом в начале).
const DAEMONIC_RE = /^daemonic\s*(\([^)]*\))?\s*(\/|$)/i;
const BYPASS_PROPS = new Set(["force", "sanctified", "warpWeapon"]);

/** Черта — именно Daemonic (X). */
export const isDaemonicTrait = item => item?.type === "trait" && DAEMONIC_RE.test(String(item?.name ?? "").trim());

/** Есть ли у актора Daemonic (X). */
export const hasDaemonicTrait = actor => [...(actor?.items ?? [])].some(isDaemonicTrait);

/**
 * Прибавка к T.b от Черт Daemonic (X) актора: сумма их включённых эффектов на
 * t.bonusFx. Черта без эффекта (старая копия) — её рейтинг.
 */
export function daemonicTbBonus(actor) {
  let total = 0;
  for (const item of actor?.items ?? []) {
    if (!isDaemonicTrait(item)) continue;
    const effects = [...(item.effects ?? [])];
    const changes = effects.filter(e => !e?.disabled).flatMap(e => e?.system?.changes ?? e?.changes ?? [])
      .filter(c => c?.key === TB_KEY);
    if (changes.length) total += changes.reduce((s, c) => s + (Number(c.value) || 0), 0);
    else if (!effects.length) total += Math.max(0, Number(item.system?.rating) || 0);
  }
  return Math.max(0, total);
}

/**
 * Игнорирует ли попадание Daemonic. `weapon` — предмет-оружие атакующего
 * (может не быть), `attacker` — актор атакующего (для естественного оружия).
 */
export function bypassesDaemonic({ weapon = null, attacker = null, psychicPowerType = null,
  sanctified = false, warpSoak = false } = {}) {
  if (sanctified || warpSoak) return true;
  if (psychicPowerType != null && psychicPowerType !== "") return true;
  if (!weapon) return false;
  const props = [...(weapon.system?.weaponProps ?? []), ...(weapon.system?.daemonWeapon?.properties ?? [])];
  if (props.some(p => BYPASS_PROPS.has(typeof p === "string" ? p : p?.key))) return true;
  const dw = weapon.system?.daemonWeapon;
  if (dw?.bound || dw?.runic) return true;
  // Естественное оружие другого носителя Daemonic.
  const natural = !!weapon.getFlag?.("warhammer-dbc", "integralAttack");
  return natural && hasDaemonicTrait(attacker ?? weapon.parent);
}
