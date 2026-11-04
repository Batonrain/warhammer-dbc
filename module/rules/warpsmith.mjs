
import { itemHasName } from "./predicates.mjs";
import { itemHasKey } from "./item-marker.mjs";
import { findGroupEntry } from "../constants/skill-specializations.mjs";
import { esc } from "../helpers/utils.mjs";

export const BROKEN_FLAG = "brokenDaemon";
export const SIGIL_FLAG = "dominionSigil";
export const CELL_FLAG = "cellOfShame";
export const WHIP_FLAG = "empyreanWhip";
export const RUN_DOWN_FLAG = "runDownMark";
export const RUN_DOWN_THROTTLE = "warpsmith-run-down";
export const REGEN_CARRY_FLAG = "warpforgedRegenCarry";
export const FORGE_LOG_FLAG = "forgeOfOneLog";

export const CAGE_TEST_MOD = -10;
export const CAGE_SECONDS_PER_HOUR = 3600;

export const CELL_TEST_MOD = -20;
export const CELL_TURNS = 5;
export const CELL_WP_LOSS = 10;
export const CELL_INF_LOSS = 15;

export const WHIP_LORE_MOD = -20;
export const WHIP_COMMAND_MOD = -10;

export const FORGE_MAX_RARITY = 3;

export const RUN_DOWN_BONUS = 30;
export const RUN_DOWN_STRUCTURE = "3d10";
export const RUN_DOWN_HELPLESS = "1d5";
export const RUN_DOWN_WP_LOSS = "1d5";
export const RUN_DOWN_STRUCTURE_MAX = 30;
export const RUN_DOWN_HELPLESS_MAX = 5;
export const RUN_DOWN_WP_MAX = 5;
export const RUN_DOWN_CHAR_KEYS = ["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel", "inf"];

export const REGEN_BASE_MINUTES = 20;

const hasAbility = (actor, key, name, type) =>
  [...(actor?.items ?? [])].some(i => i?.type === type && (itemHasName(i, name) || itemHasKey(i, key)));

export const hasIronCage = actor => hasAbility(actor, "ability.ironCage", "Iron Cage", "trait");
export const hasWarpforgedPlate = actor => hasAbility(actor, "ability.warpforgedPlate", "Warpforged Plate", "trait");
export const hasSigilOfDominion = actor => hasAbility(actor, "ability.sigilOfDominion", "Sigil of Dominion", "talent");
export const hasCellOfShame = actor => hasAbility(actor, "ability.cellOfShame", "Cell of Shame", "talent");
export const hasEmpyreanWhip = actor => hasAbility(actor, "ability.empyreanWhip", "Empyrean Whip", "talent");
export const hasForgeOfOne = actor => hasAbility(actor, "ability.forgeOfOne", "Forge of One", "talent");
export const hasRunDown = actor => hasAbility(actor, "ability.runDown", "Run Down", "talent");

export const hasWarpsmithAbility = actor => hasIronCage(actor) || hasSigilOfDominion(actor) || hasCellOfShame(actor)
  || hasEmpyreanWhip(actor) || hasForgeOfOne(actor) || hasRunDown(actor);

const num = v => Number(v) || 0;
const charTotal = (actor, key) => num(actor?.system?.characteristics?.[key]?.total);
const charBonus = (actor, key) => num(actor?.system?.characteristics?.[key]?.bonus);

export function techUseTotal(actor) {
  const skill = actor?.system?.skills?.techUse;
  return skill && skill.total != null ? num(skill.total) : charTotal(actor, "int");
}

export function daemonLoreTotal(actor) {
  const entry = findGroupEntry(actor, "forbiddenLore", "Daemons");
  return !entry || entry.total == null ? null : num(entry.total);
}

export function commandOnIntTotal(actor) {
  const skill = actor?.system?.skills?.command;
  const fel = charTotal(actor, "fel");
  const base = skill && skill.total != null ? num(skill.total) : fel;
  return base + charTotal(actor, "int") - fel;
}

export const cageThreshold = (actor, modsTotal = 0) => techUseTotal(actor) + CAGE_TEST_MOD + num(modsTotal);

export function cellThreshold(actor, modsTotal = 0) {
  const lore = daemonLoreTotal(actor);
  return lore == null ? null : lore + CELL_TEST_MOD + num(modsTotal);
}

export function whipThreshold(actor, modsTotal = 0) {
  const lore = daemonLoreTotal(actor);
  if (lore == null) return null;
  return Math.min(lore + WHIP_LORE_MOD, commandOnIntTotal(actor) + WHIP_COMMAND_MOD) + num(modsTotal);
}

export const resistThreshold = (target, modsTotal = 0) => charTotal(target, "wp") + num(modsTotal);

export const cageRange = actor => Math.max(0, charBonus(actor, "int"));

export const cageHours = target => Math.max(1, charBonus(target, "wp"));

export const brokenOf = target => {
  const flag = target?.getFlag?.("warhammer-dbc", BROKEN_FLAG) ?? target?.flags?.["warhammer-dbc"]?.[BROKEN_FLAG];
  return flag && typeof flag === "object" ? flag : null;
};

export const isCaged = target => brokenOf(target)?.state === "caged";
export const isBroken = target => brokenOf(target)?.state === "broken";

export function cageFlag(smith, target, now, smithUuids = null) {
  const since = num(now);
  const ids = [...new Set([smith?.uuid, ...(smithUuids ?? [])].filter(Boolean))];
  return {
    smithUuid: smith?.uuid ?? "", smithUuids: ids, smithName: smith?.name ?? "", state: "caged",
    since, until: since + cageHours(target) * CAGE_SECONDS_PER_HOUR, freeWill: false
  };
}

export function cageMatured(flag, worldTime) {
  return !!flag && flag.state === "caged" && num(worldTime) >= num(flag.until);
}

export const brokenFlagMatured = flag => ({ ...flag, state: "broken" });

const defaultUuidsOf = actor => new Set(actor?.uuid ? [actor.uuid] : []);

export function holdsSigilFor(actor, target, uuidsOf = defaultUuidsOf) {
  const wanted = uuidsOf(target);
  for (const item of actor?.items ?? []) {
    const sigil = item?.getFlag?.("warhammer-dbc", SIGIL_FLAG) ?? item?.flags?.["warhammer-dbc"]?.[SIGIL_FLAG];
    if (sigil?.demonUuid && wanted.has(sigil.demonUuid)) return true;
  }
  return false;
}

export function flagSmithIs(flag, actor, uuidsOf = defaultUuidsOf) {
  if (!flag) return false;
  const ids = uuidsOf(actor);
  if (flag.smithUuid && ids.has(flag.smithUuid)) return true;
  return (flag.smithUuids ?? []).some(u => ids.has(u));
}

export function isBrokenFor(target, actor, uuidsOf = defaultUuidsOf) {
  const flag = brokenOf(target);
  if (!flag || flag.state !== "broken") return false;
  if (flagSmithIs(flag, actor, uuidsOf)) return true;
  return holdsSigilFor(actor, target, uuidsOf);
}

export function isBrokenBySmith(target, actor, uuidsOf = defaultUuidsOf) {
  const flag = brokenOf(target);
  return !!flag && flag.state === "broken" && flagSmithIs(flag, actor, uuidsOf);
}

export function findBrokenDominionTarget(actor, demonName, candidates = [], uuidsOf = defaultUuidsOf) {
  return [...candidates].find(c => c && isBrokenFor(c, actor, uuidsOf) && demonNameMatches(c.name, demonName)) ?? null;
}

export function brokenAutoFail(opponent, actor, charKey, uuidsOf = defaultUuidsOf) {
  return charKey === "wp" && isBrokenFor(opponent, actor, uuidsOf);
}

const norm = s => String(s ?? "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
const nameParts = s => norm(s).split("/").map(p => p.trim()).filter(Boolean);

export function demonNameMatches(actorName, ritualDemonName) {
  const a = nameParts(actorName);
  const b = nameParts(ritualDemonName);
  if (!a.length || !b.length) return false;
  return a.some(x => b.some(y => x === y || x.includes(y) || y.includes(x)));
}

export function sigilItemData(smith, target) {
  const demon = target?.name ?? "демон";
  return {
    name: `Печать Владычества: ${demon}`,
    type: "gear",
    img: "systems/warhammer-dbc/assets/item-icons/gear.svg",
    system: {
      description: `<p>Железная печать с образом ${esc(smith?.name ?? "Варп-Кузнеца")}, связанная с духом Сломленного демона «${esc(demon)}». `
        + "Тот, кто держит печать, получает против этого демона те же преимущества, что и сам Кузнец: демон автоматически проваливает "
        + "встречные тесты W, а Демоническое Владычество проходит без броска.</p>",
      weight: 0.5, quantity: 1
    },
    flags: { "warhammer-dbc": { [SIGIL_FLAG]: { demonUuid: target?.uuid ?? "", demonName: demon, smithUuid: smith?.uuid ?? "" } } }
  };
}

export const CELL_DEVICE_TYPES = ["weapon", "gear", "forcefield", "tool", "armor"];

export const isCellDevice = item => !!(item?.getFlag?.("warhammer-dbc", CELL_FLAG) ?? item?.flags?.["warhammer-dbc"]?.[CELL_FLAG]);

export function cellFlag(smith, target, deviceName = "") {
  return { demonUuid: target?.uuid ?? "", demonName: target?.name ?? "", smithUuid: smith?.uuid ?? "", deviceName: String(deviceName ?? "") };
}

export const cellBrokenFree = flag => ({ ...flag, state: "broken", freeWill: true });

export function regenIntervalSeconds(actor) {
  return Math.max(1, REGEN_BASE_MINUTES - charBonus(actor, "t")) * 60;
}

export function regenPlan({ elapsed, carry = 0, interval, missing }) {
  if (!(interval > 0) || !(missing > 0)) return { heal: 0, carry: 0 };
  const total = Math.max(0, num(elapsed)) + Math.max(0, num(carry));
  const ticks = Math.floor(total / interval);
  const heal = Math.min(ticks, missing);
  if (heal >= missing) return { heal, carry: 0 };
  return { heal, carry: total - ticks * interval };
}

export function runDownChanges() {
  return RUN_DOWN_CHAR_KEYS.map(k => ({ key: `system.characteristics.${k}.totalFx`, type: "add", value: RUN_DOWN_BONUS }));
}

export const runDownMarkOf = target =>
  target?.getFlag?.("warhammer-dbc", RUN_DOWN_FLAG) ?? target?.flags?.["warhammer-dbc"]?.[RUN_DOWN_FLAG] ?? null;

export const clampRoll = (value, max) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
};
