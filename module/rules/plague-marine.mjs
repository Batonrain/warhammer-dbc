import { itemHasName } from "./predicates.mjs";
import { itemHasKey } from "./item-marker.mjs";

export const ABOMINABLE_FLAG = "abominableGuard";
export const ABOMINABLE_TEST_MOD = 30;
export const ABOMINABLE_FEAR_RATING = 1;

export const MIASMA_FLAG = "infectiousMiasma";
export const MIASMA_USED_FLAG = "infectiousMiasmaUsed";
export const MIASMA_RADIUS_M = 7;
export const MIASMA_DAMAGE = "1d10";
export const MIASMA_TURNS = "1d5+1";

export const INFECTION_DUE_FLAG = "plagueInfectionDue";
export const BLESSED_TOUCH_DAMAGE = "1d10";
export const BLESSED_WEAPON_NAME = "Благословенный Гноем";
export const MIASMA_WEAPON_NAME = "Заразные Миазмы";

export const WASTELAND_SIDE_M = 100;
export const WASTELAND_SELF_DAMAGE = 1;
export const WASTELAND_REQUEST_FLAG = "wastelandRequest";
export const WASTELAND_SECONDS = 7 * 24 * 3600;

export const SECONDS_PER_HOUR = 3600;
export const RUST_GOOD_HOURS = 7;
export const RUST_POOR_DAYS = 7;
export const RUST_FLAG = "gloriousRust";

export const ROTSMITH_FLAG = "rotsmith";
export const ROTSMITH_HOURS = 7;
export const ROTSMITH_PLAGUE_KNIFE_UUID = "Compendium.warhammer-dbc.weapons.Item.8WsGDqiEojMxFIfa";
export const ROTSMITH_BLIGHT_UUID = "Compendium.warhammer-dbc.weapons.Item.f4UQUImXaE48h9VT";

export const BILE_SPIT_PEN_DICE = "1d5";

const NS = "warhammer-dbc";

const hasAbility = (actor, key, name, type) =>
  [...(actor?.items ?? [])].some(i => i?.type === type && (itemHasName(i, name) || itemHasKey(i, key)));

export const hasAbominableReaction = actor =>
  hasAbility(actor, "ability.abominableHitReaction", "Отвратная Физиология", "trait");
export const hasInfectiousMiasma = actor =>
  hasAbility(actor, "ability.infectiousMiasma", "Infectious Miasma", "trait");
export const hasPlagueGardener = actor =>
  hasAbility(actor, "ability.plagueGardener", "Plague Gardener", "talent");
export const hasRotsmith = actor =>
  hasAbility(actor, "ability.rotsmith", "Rotsmith", "talent");
export const hasBileSpit = actor =>
  hasAbility(actor, "ability.bileSpit", "Bile Spit", "talent");
export const hasGloriousRust = actor =>
  hasAbility(actor, "ability.gloriousRust", "Glorious Rust", "talent");
export const hasBlessedWithPus = actor =>
  hasAbility(actor, "ability.blessedWithPus", "Blessed with Pus", "talent");
export const hasWalkingWasteland = actor =>
  hasAbility(actor, "ability.walkingWasteland", "Walking Wasteland", "talent");

export function isNurgleDevoted(actor) {
  return String(actor?.system?.patronGod ?? "") === "nurgle";
}

export function isBileSpitWeapon(itemOrName) {
  const name = typeof itemOrName === "string" ? itemOrName : (itemOrName?.name ?? "");
  return /кислотн[а-яё]*\s+плев|acid\s+spit|betcher/i.test(String(name));
}

export function abominableReduce(rawDamage, reduction) {
  const raw = Math.max(0, Math.floor(Number(rawDamage) || 0));
  const cut = Math.max(0, Math.floor(Number(reduction) || 0));
  const damage = Math.max(0, raw - cut);
  return { damage, reducedToZero: raw > 0 && damage === 0 };
}

export function abominableThreshold(toughness, modsTotal = 0) {
  return (Number(toughness) || 0) + ABOMINABLE_TEST_MOD + (Number(modsTotal) || 0);
}

export function abominableReductionFor(flag, attackerUuid, combatId = "") {
  if (!attackerUuid || !Array.isArray(flag)) return 0;
  const rec = flag.find(r => r?.attacker === attackerUuid && (r.combatId ?? "") === (combatId ?? ""));
  return Math.max(0, Math.floor(Number(rec?.reduce) || 0));
}

export function abominableGuardNext(flag, { attackerUuid, reduce, combatId = "", feared }) {
  const list = Array.isArray(flag) ? flag : [];
  const old = list.find(r => r?.attacker === attackerUuid);
  const rest = list.filter(r => r?.attacker !== attackerUuid);
  return [...rest, {
    attacker: attackerUuid, reduce: Math.max(0, Math.floor(Number(reduce) || 0)), combatId,
    feared: feared ?? !!old?.feared
  }];
}

export function abominableFeared(flag, attackerUuid) {
  return Array.isArray(flag) && flag.some(r => r?.attacker === attackerUuid && r.feared);
}

export function miasmaStart(turns, combatId) {
  const total = Math.max(1, Math.floor(Number(turns) || 1));
  return { combatId, total, left: total, victims: [] };
}

export function miasmaTick(state, hitUuids = []) {
  const left = Math.max(0, (Number(state?.left) || 0) - 1);
  const victims = [...new Set([...(state?.victims ?? []), ...hitUuids])];
  return { state: { ...state, left, victims }, last: left === 0 };
}

export function miasmaActive(state, combatId) {
  return !!state && state.combatId === combatId && (Number(state.left) || 0) > 0;
}

export function miasmaUsedIn(flag, combatId) {
  return !!flag && !!combatId && flag === combatId;
}

export function carrierDiseases(actor) {
  return [...(actor?.items ?? [])].filter(i => i?.type === "disease" && i.system?.active === true);
}

export function pickIndexByRoll(rollTotal, n) {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  if (!count) return -1;
  return Math.min(count, Math.max(1, Math.floor(Number(rollTotal) || 1))) - 1;
}

export function diseaseCopyData(item) {
  const data = item?.toObject ? item.toObject() : JSON.parse(JSON.stringify(item ?? {}));
  delete data._id;
  data.system = { ...(data.system ?? {}), active: false };
  const flags = { ...(data.flags ?? {}) };
  if (flags[NS]) {
    const mine = { ...flags[NS] };
    delete mine.grantedByItem;
    delete mine.equipEntryId;
    flags[NS] = mine;
  }
  data.flags = flags;
  return data;
}

export function sameDisease(actor, item) {
  const name = String(item?.name ?? "");
  return [...(actor?.items ?? [])].find(i => i?.type === "disease" && (i.name === name || itemHasName(i, name))) ?? null;
}

export function isEnemyDisposition(carrierDisposition, victimDisposition) {
  const mine = Number(carrierDisposition) || 0;
  if (!mine) return true;
  return (Number(victimDisposition) || 0) === -mine;
}

export function infectionDueAdd(flag, { combatId, carrierUuid, via }) {
  const same = flag?.combatId === combatId;
  const entries = same && Array.isArray(flag.entries) ? flag.entries : [];
  const key = String(via ?? "");
  if (!carrierUuid || entries.some(e => e.carrier === carrierUuid && e.via === key)) return { combatId, entries };
  return { combatId, entries: [...entries, { carrier: carrierUuid, via: key }] };
}

export function infectionGroups(victims) {
  const groups = new Map();
  for (const { victim, entries } of victims) {
    for (const e of entries ?? []) {
      if (!groups.has(e.carrier)) groups.set(e.carrier, []);
      groups.get(e.carrier).push({ victim, via: e.via });
    }
  }
  return groups;
}

export function rustQuality(quality, carriedSeconds) {
  const carried = Math.max(0, Number(carriedSeconds) || 0);
  const goodAfter = RUST_GOOD_HOURS * SECONDS_PER_HOUR;
  const poorAfter = RUST_POOR_DAYS * 24 * SECONDS_PER_HOUR;
  let q = String(quality || "common");
  const steps = [];
  if (q === "common" && carried >= poorAfter) { q = "poor"; steps.push("common>poor"); }
  if (q === "poor" && carried >= goodAfter) { q = "good"; steps.push("poor>good"); }
  return { quality: q, changed: steps.length > 0, steps };
}

export function rustApplies(item) {
  if (!item) return false;
  if (!["weapon", "armor", "gear", "tool", "ammo", "forcefield"].includes(item.type)) return false;
  if (item.system?.gearCategory === "mystic" || item.system?.toolCategory === "mystic") return false;
  if (item.system?.daemonWeapon?.bound) return false;
  return typeof item.system?.quality === "string";
}

export function isInfectableKnife(item) {
  if (item?.type !== "weapon") return false;
  if (/plague\s*knife|чумн[а-яё]*\s+нож/i.test(String(item.name ?? ""))) return false;
  return item.system?.meleeCategory === "Нож" || /\bknife\b|(^|\s|\/)нож(\s|$)/i.test(String(item.name ?? ""));
}

export function isSeveredHead(item) {
  if (item?.type !== "gear") return false;
  return /severed\s+head|отрублен[а-яё]*\s+голов/i.test(String(item.name ?? ""));
}

export function rotsmithResult(item) {
  if (isInfectableKnife(item)) return { kind: "plagueKnife", uuid: ROTSMITH_PLAGUE_KNIFE_UUID };
  if (isSeveredHead(item)) return { kind: "blight", uuid: ROTSMITH_BLIGHT_UUID };
  return null;
}

export function rotsmithMark(worldTime, kind) {
  return { convertAt: (Number(worldTime) || 0) + ROTSMITH_HOURS * SECONDS_PER_HOUR, kind };
}

export function rotsmithDue(mark, worldTime) {
  return !!mark && Number.isFinite(Number(mark.convertAt)) && Number(worldTime) >= Number(mark.convertAt);
}

export function wastelandRect(centreX, centreY, gridSize, gridDistance) {
  const px = ((Number(gridSize) || 100) / (Number(gridDistance) || 1)) * WASTELAND_SIDE_M;
  return { x: Math.round(Number(centreX) - px / 2), y: Math.round(Number(centreY) - px / 2), width: Math.round(px), height: Math.round(px) };
}
