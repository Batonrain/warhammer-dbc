// module/combat/rubric-sorcerer.mjs
// ════════════════════════════════════════════════════════════════════════
//  Колдун Рубрики (Sahara 1-54b9) — Foundry-обвязка поверх чистой логики
//  rules/rubric-sorcerer.mjs.
//
//   • Рубрика Аримана — rollPeril (два броска на Прорыв), rollChoiceTest
//     (тест W−30 на выбор мутации; диалог — sheets/tabs/mutations.mjs).
//   • Щит Рубрики — syncRubricShield: встроенный forcefield 1-50 без
//     перегрузки, живёт, пока на акторе есть Черта (тот же приём, что
//     combat/armor-field-shield.mjs).
//   • Повелитель Големов — startGolemCreation (диалог, тест For.Lore(Warp)−10,
//     трата комплекта брони и оружия), spawnGolem (сторона ГМ: актор-Миньон
//     из профиля «Голем Рубрики» и токен), душа считается по живым Големам.
//   • Узы Душ — bindNexus и syncNexusInitiatives (Голем в Инициативу колдуна).
//   • Психическое Эхо и Регенерация — usePsychicEcho, regenerationTurnStart,
//     rollRegeneration: Трейт Regeneration (X) в начале Хода предлагает тест
//     T+0 или пропуск действий; Эхо делает тест автоуспешным с двойным лечением.
//   • Сехмет — Терминаторская броня в startGolemCreation / buildGolemData.
//   • Возрождён во Прахе — useRebornInDust.
//   • Инфернальные Снаряды — useInfernalShells.
// ════════════════════════════════════════════════════════════════════════

import {
  REBORN_TEST_MOD, GOLEM_FLAG, GOLEM_LOYALTY, GOLEM_PROFILE_NAME, GOLEM_POSSESSION_HOURS, GOLEM_SOULS,
  SHIELD_FLAG, SHIELD_RATING, ECHO_USAGE_FLAG, ECHO_PENDING_FLAG, STUPOR_FLAG,
  INFERNAL_AMMO_NAME, INFERNAL_SHELLS_COUNT, INFERNAL_SHELLS_HOURS, SEKHMET_REGENERATION,
  hasRubricOfAhriman, hasGolemMaster, hasShieldOfRubric, hasInfernalShells, hasPsychicEcho, hasSekhmet,
  hasRebornInDust, pickMilderPeril, choiceThreshold, isGolem, golemMasterUuid, golemsOf, soulsFree, fallenGolems,
  nexusFreeGolems, nexusSlotsLeft, golemSlot, sekhmetStats, armourAblative, armourWithoutAblative,
  regenerationRating, regenerationHeal, isWounded, possessionThreshold, warpLoreTotal, isOrdinaryBolt,
  shellsBatch, golemDestroyed
} from "../rules/rubric-sorcerer.mjs";
import { getPeril } from "../constants/psyker-tables.mjs";
import { executePsychotest } from "../sheets/tabs/psychic.mjs";
import { minionCreateDataFrom } from "../apps/minion-convert.mjs";
import { findBestiaryActor } from "../apps/demon-summon.mjs";
import { slotUsage } from "../rules/minion-build.mjs";
import { currentScene } from "../constants/scene-nexus.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { rollD100WithReroll } from "../rules/test-kind-widget.mjs";
import { isCapabilityAvailable, markCapabilityUsed } from "../rules/cooldown.mjs";
import { computeWoundHealing } from "../sheets/tabs/wounds.mjs";
import { addCondition, removeCondition } from "../sheets/tabs/conditions.mjs";
import { setDeceased } from "../sheets/tabs/body.mjs";
import { spendInfamyPoint } from "./noise-marine.mjs";
import { actorHasInfamyPoint } from "../apps/infamy-points.mjs";
import { combatOfActor } from "./actor-combat.mjs";

const NS = "warhammer-dbc";
const ICON = () => rollIcon("warp", "#7f5cff");
const FORCEFIELD_IMG = "systems/warhammer-dbc/assets/item-icons/forcefield.svg";

const worldActors = () => [...(globalThis.game?.actors ?? [])];
const isDeceased = actor => !!actor?.getFlag?.(NS, "deceased");
const actorOfUuid = async uuid => {
  const doc = uuid ? await fromUuid(uuid).catch(() => null) : null;
  return doc?.actor ?? doc ?? null;
};

const confirm = (title, text, yes, no) => foundry.applications.api.DialogV2.confirm({
  window: { title }, content: `<p>${text}</p>`, yes: { label: yes }, no: { label: no }, rejectClose: false
}).then(r => !!r).catch(() => false);

// ── Рубрика Аримана ───────────────────────────────────────────────────────

/**
 * Бросок на Варп-Прорыв. У Колдуна Рубрики — два кубика, берётся меньший
 * (таблица тяжелеет к концу); остальные бросают один.
 * @param {object} actor
 * @param {Roll[]} [rolls] сюда дописываются кубики для карточки
 * @returns {Promise<{total:number, note:string}>}
 */
export async function rollPeril(actor, rolls = []) {
  const first = await new Roll("1d100").evaluate();
  rolls.push(first);
  if (!hasRubricOfAhriman(actor)) return { total: first.total, note: "" };
  const second = await new Roll("1d100").evaluate();
  rolls.push(second);
  const { keep, drop } = pickMilderPeril(first.total, second.total);
  return {
    total: keep,
    note: ` <i>(Рубрика Аримана: два броска ${first.total} и ${second.total} — взят меньший, отброшен ${drop}: ${esc(getPeril(drop).label)})</i>`
  };
}

/**
 * Тест W−30 на выбор мутации по Рубрике Аримана. Карточка уходит в чат.
 * @returns {Promise<boolean>} true — мутацию можно выбрать
 */
export async function rollChoiceTest(actor) {
  const wp = Number(actor?.system?.characteristics?.wp?.total) || 0;
  const mods = collectTestMods(actor, { kind: "skill", char: "wp" });
  const threshold = choiceThreshold(wp, mods.total);
  const { rv, rolls } = await rollD100WithReroll(null);
  const { success, deg } = testOutcome(rv, threshold);
  await postTestCard(actor, {
    icon: ICON(), title: `Рубрика Аримана — выбор мутации — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "W−30", base: wp, parts: mods.parts.map(esc), threshold, rv }),
    outcome: outcomeHtml(success, success
      ? `Успех (${deg}) — мутацию можно выбрать из всего списка`
      : "Провал — мутация остаётся по броскам")
  }, { rolls });
  return success;
}

// ── Щит Рубрики ───────────────────────────────────────────────────────────

/** Данные встроенного щита-купола 1-50: чародейский, не перегружается, активен. */
export function rubricShieldData() {
  return {
    name: "Shield of Rubric / Щит Рубрики",
    type: "forcefield",
    img: FORCEFIELD_IMG,
    system: {
      shieldNature: "warp", shieldType: "dome",
      ratingMin: 1, ratingMax: SHIELD_RATING, overloadThreshold: 0,
      currentRating: SHIELD_RATING, isSpecialRating: false,
      equipped: true, status: "active", quality: "common", availability: 0, weight: 0
    },
    flags: { [NS]: { [SHIELD_FLAG]: true } }
  };
}

/** Что сделать со щитами Рубрики: создать, если Черта есть, а щита нет; снять лишнее. */
export function rubricShieldPlan(actor) {
  const have = [...(actor?.items ?? [])].filter(i => i?.type === "forcefield" && i.getFlag?.(NS, SHIELD_FLAG));
  if (hasShieldOfRubric(actor)) return { create: have.length ? 0 : 1, remove: have.slice(1).map(i => i.id) };
  return { create: 0, remove: have.map(i => i.id) };
}

const shieldQueue = new Map();

/**
 * Приводит встроенный щит в соответствие с Чертой «Щит Рубрики». Вызовы по одному актору идут строго по очереди:
 * архетип выдаёт три Черты одним createEmbeddedDocuments, хуки createItem стреляют подряд, и без очереди каждый
 * из них видел бы «щитов нет» и создавал свой.
 */
export function syncRubricShield(actor) {
  if (!actor?.isOwner) return Promise.resolve();
  const key = actor.id ?? actor.uuid;
  const run = async () => {
    const { create, remove } = rubricShieldPlan(actor);
    if (remove.length) await actor.deleteEmbeddedDocuments("Item", remove);
    if (create) await actor.createEmbeddedDocuments("Item", [rubricShieldData()]);
  };
  const next = (shieldQueue.get(key) ?? Promise.resolve()).then(run, run);
  shieldQueue.set(key, next);
  return next.finally(() => { if (shieldQueue.get(key) === next) shieldQueue.delete(key); });
}

// ── Повелитель Големов ────────────────────────────────────────────────────

/**
 * Данные нового Голема по профилю бестиария. Чистая функция (Foundry нужен
 * только схеме Миньона): Миньон-демон среднего уровня, Лояльность 30, метка
 * flags.warhammer-dbc.rubricGolem. Сехмет подменяет силовой доспех
 * Терминаторским: +10 WS и S, аблативные Раны брони — в Раны, Regeneration 6.
 * @param {object} src  actor.toObject() профиля (items внутри)
 * @param {object} o
 * @param {string} o.masterUuid
 * @param {string} [o.slotId]  Талант-слот Миньона, который занимает Голем
 * @param {object} [o.terminatorArmour] данные Терминаторской брони (item.toObject())
 * @param {object} [o.ownership] права на лист (копия прав хозяина)
 */
export function buildGolemData(src, { masterUuid, slotId = "", terminatorArmour = null, ownership = null } = {}) {
  const data = minionCreateDataFrom({ ...src, uuid: src.uuid ?? "" });
  const system = data.system;
  system.masterUuid = masterUuid;
  system.minionType = "daemon";
  system.minionTier = "standard";
  system.slotTalentId = slotId || "";
  system.loyalty = { value: GOLEM_LOYALTY, max: GOLEM_LOYALTY };

  let items = foundry.utils.deepClone(src.items ?? []);
  if (terminatorArmour) {
    const ablative = armourAblative(terminatorArmour);
    const ch = system.characteristics ?? {};
    const stats = sekhmetStats({
      ws: ch.ws?.base, s: ch.s?.base, woundsMax: system.wounds?.max, ablative
    });
    if (ch.ws) ch.ws.base = stats.ws;
    if (ch.s) ch.s.base = stats.s;
    system.wounds = { ...system.wounds, max: stats.woundsMax, value: (Number(system.wounds?.value) || 0) + ablative };
    const suit = armourWithoutAblative(terminatorArmour);
    delete suit._id;
    suit.system = { ...suit.system, equipped: true };
    items = items.filter(i => i.type !== "armor");
    items.push(suit);
    items = items.map(i => (i.type === "trait" && /regeneration/i.test(i.name))
      ? { ...i, name: `Regeneration / Регенерация (${SEKHMET_REGENERATION})`, system: { ...i.system, rating: SEKHMET_REGENERATION } }
      : i);
  }
  data.items = items;
  data.prototypeToken = src.prototypeToken;
  data.flags = {
    ...data.flags,
    [NS]: { ...(data.flags?.[NS] ?? {}), [GOLEM_FLAG]: { masterUuid, terminator: !!terminatorArmour, nexus: false } }
  };
  if (ownership) data.ownership = ownership;
  return data;
}

/**
 * Сторона ГМ: создаёт Голема из профиля бестиария и токен рядом с хозяином.
 * @param {{masterUuid:string, slotId?:string, terminatorArmour?:object, weapons?:object[]}} plan
 */
export async function spawnGolem(plan) {
  const master = await actorOfUuid(plan.masterUuid);
  if (!master) return { ok: false, reason: "Хозяин Голема не найден." };
  const src = await findBestiaryActor(GOLEM_PROFILE_NAME);
  if (!src) return { ok: false, reason: `Профиль «${GOLEM_PROFILE_NAME}» не найден в Бестиарии — создайте Голема вручную.` };
  const masterToken = canvas?.tokens?.placeables?.find(t => t.actor?.uuid === master.uuid);
  const base = { ...src.toObject(), uuid: src.uuid };
  const data = buildGolemData(base, {
    masterUuid: master.uuid, slotId: plan.slotId, terminatorArmour: plan.terminatorArmour ?? null,
    ownership: foundry.utils.deepClone(master.ownership ?? { default: 0 })
  });
  const number = golemsOf(master, worldActors()).length + 1;
  data.name = `${src.name} №${number}`;
  data.prototypeToken = { ...(data.prototypeToken ?? {}), name: data.name, disposition: masterToken?.document?.disposition ?? master.prototypeToken?.disposition ?? 1 };
  const golem = await Actor.create(data);
  if (!golem) return { ok: false, reason: "Не удалось создать Актора Голема." };
  if (plan.weapons?.length) {
    await golem.createEmbeddedDocuments("Item", plan.weapons.map(w => {
      const copy = foundry.utils.deepClone(w);
      delete copy._id;
      copy.system = { ...copy.system, equipped: true };
      return copy;
    }));
  }
  await syncRubricShield(golem);

  const scene = currentScene();
  if (scene) {
    const grid = scene.grid?.size || 100;
    const x = masterToken ? masterToken.document.x + grid : (scene.dimensions?.width ?? 2000) / 2;
    const y = masterToken ? masterToken.document.y + grid : (scene.dimensions?.height ?? 2000) / 2;
    const tokenDoc = await golem.getTokenDocument({ x, y });
    await scene.createEmbeddedDocuments("Token", [tokenDoc.toObject()]);
  }
  return { ok: true, actorUuid: golem.uuid, actorName: golem.name };
}

/** ГМ — напрямую; иначе сокет-релей (warhammer-dbc.mjs, action:"createGolem"). */
export async function defaultSpawnGolemFn(plan) {
  if (game.user?.isGM) {
    const res = await spawnGolem(plan);
    if (!res.ok) ui.notifications?.warn(res.reason);
    return res;
  }
  if (!game.users?.activeGM) {
    ui.notifications?.warn("Нет активного Мастера — Голема нужно создать вручную.");
    return { ok: false };
  }
  game.socket?.emit("system.warhammer-dbc", { action: "createGolem", userId: game.user?.id, plan });
  return { ok: true, relayed: true };
}

const armourOptions = master => [...(master?.items ?? [])].filter(i => i?.type === "armor");
const weaponOptions = master => [...(master?.items ?? [])].filter(i => i?.type === "weapon" && !i.system?.integral && !i.system?.natural);

/** Свободные слоты Миньона колдуна: те же слоты, что считает панель СОЦИУМа. */
function freeSlotsOf(master) {
  const minions = worldActors().filter(a => a?.system?.masterUuid === master.uuid);
  return slotUsage([...(master.items ?? [])], minions, master).free;
}

/** Состояние для окна: сколько душ свободно, есть ли слот. */
export function golemStatus(master) {
  const actors = worldActors();
  return {
    isMaster: hasGolemMaster(master),
    free: soulsFree(master, actors),
    max: GOLEM_SOULS,
    slot: golemSlot(freeSlotsOf(master)),
    fallen: fallenGolems(master, actors).length,
    nexusLeft: nexusSlotsLeft(master, actors)
  };
}

/**
 * Создать Голема: диалог → тест For.Lore(Warp)−10 (девять часов обряда) →
 * трата комплекта брони и оружия → Голем и токен.
 */
export async function startGolemCreation(master) {
  if (!hasGolemMaster(master)) return null;
  const st = golemStatus(master);
  if (st.free < 1) {
    ui.notifications?.warn(`Все ${GOLEM_SOULS} душ големов привязаны к живым Големам.`);
    return null;
  }
  const armours = armourOptions(master);
  const weapons = weaponOptions(master);
  const sekhmet = hasSekhmet(master);
  const armourRows = armours.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("");
  const weaponRows = weapons.map(w => `<label style="display:block"><input type="checkbox" name="w_${esc(w.id)}"/> ${esc(w.name)}</label>`).join("");
  const content = `
    <p>Свободных душ: <b>${st.free}</b> из ${st.max}. ${st.slot ? "Свободный слот Миньона есть." : "<b>Свободного слота Миньона нет.</b>"}</p>
    <div class="atk-dlg-row"><label>Комплект брони (будет потрачен):</label>
      <select name="armour" class="pm-input"><option value="">— не тратить (ГМ решает) —</option>${armourRows}</select></div>
    ${sekhmet ? `<div class="atk-dlg-row"><label title="Сехмет: Голем в Терминаторских Доспехах — выбранная выше броня переходит Голему, +10 WS и S, Regeneration 6, аблативные Раны брони — в Раны"><input type="checkbox" name="terminator"/> Сехмет: Голем в Терминаторских Доспехах (броня из списка выше — Терминаторская)</label></div>` : ""}
    <div class="atk-dlg-row"><label>Оружие, которым вооружить Голема (уйдёт к нему):</label></div>
    <div style="max-height:140px;overflow:auto">${weaponRows || "<i>Оружия нет.</i>"}</div>
    <p class="dyn-hint">Вселение духа занимает ${GOLEM_POSSESSION_HOURS} часов и требует теста For.Lore(Warp)−10. Лояльность Голема всегда ${GOLEM_LOYALTY}.</p>`;
  const picked = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Повелитель Големов — ${master.name}` },
    content,
    ok: {
      label: "Провести вселение",
      callback: (event, button) => {
        const f = button.form.elements;
        return {
          armourId: f.armour?.value || "",
          terminator: !!f.terminator?.checked,
          weaponIds: weapons.filter(w => f[`w_${w.id}`]?.checked).map(w => w.id)
        };
      }
    },
    rejectClose: false
  }).catch(() => null);
  if (!picked) return null;
  if (picked.terminator && !picked.armourId) {
    ui.notifications?.warn("Сехмет: выберите Терминаторскую броню из списка — она перейдёт Голему.");
    return null;
  }

  if (!st.slot && !await confirm("Повелитель Големов", "Свободного слота Миньона нет. Создать Голема всё равно?", "Создать", "Отмена")) return null;

  const mods = collectTestMods(master, { kind: "skill", group: "forbiddenLore", specialty: "Warp" });
  const threshold = possessionThreshold(master, mods.total);
  if (threshold == null) {
    ui.notifications?.warn("У колдуна нет Навыка Forbidden Lore (Warp) — вселить дух нельзя.");
    return null;
  }
  const { rv, rolls } = await rollD100WithReroll(null);
  const { success, deg } = testOutcome(rv, threshold);
  const statLine = rollStatLine({ label: "For.Lore(Warp)−10", base: warpLoreTotal(master), parts: mods.parts.map(esc), threshold, rv });
  if (!success) {
    await postTestCard(master, {
      icon: ICON(), title: `Повелитель Големов — ${esc(master.name)}`, threshold: statLine,
      lines: [`<div class="roll-threshold">Обряд занял ${GOLEM_POSSESSION_HOURS} часов. Душа осталась свободной, снаряжение не потрачено.</div>`],
      outcome: outcomeHtml(false, "Вселение не удалось")
    }, { rolls });
    return null;
  }

  const armour = picked.armourId ? master.items.get(picked.armourId) : null;
  const chosenWeapons = picked.weaponIds.map(id => master.items.get(id)).filter(Boolean);
  const plan = {
    masterUuid: master.uuid, slotId: st.slot?.id ?? "",
    terminatorArmour: (picked.terminator && armour) ? armour.toObject() : null,
    weapons: chosenWeapons.map(w => w.toObject())
  };
  const spent = [...(armour ? [armour.id] : []), ...chosenWeapons.map(w => w.id)];
  const res = await defaultSpawnGolemFn(plan);
  if (res?.ok === false) {
    await postTestCard(master, {
      icon: ICON(), title: `Повелитель Големов — ${esc(master.name)}`, threshold: statLine,
      lines: [`<div class="roll-threshold">Вселение удалось, но Голема создать не вышло — снаряжение не потрачено, душа свободна. Создайте Голема вручную или повторите.</div>`],
      outcome: outcomeHtml(false, "Голем не создан")
    }, { rolls });
    return res;
  }
  if (spent.length) await master.deleteEmbeddedDocuments("Item", spent);

  const lines = [
    `<div class="roll-threshold">Обряд занял ${GOLEM_POSSESSION_HOURS} часов. Потрачено: ${armour ? esc(armour.name) : "комплект брони не отмечен"}${chosenWeapons.length ? `; оружие Голема: ${chosenWeapons.map(w => esc(w.name)).join(", ")}` : ""}.</div>`,
    `<div class="roll-threshold">Свободных душ осталось: <b>${Math.max(0, st.free - 1)}</b> из ${st.max}. Лояльность Голема ${GOLEM_LOYALTY}${plan.terminatorArmour ? "; Терминаторский Голем: +10 WS и S, Regeneration 6" : ""}.</div>`,
    res?.relayed ? `<div class="roll-threshold">Токен Голема создаёт Мастер.</div>` : ""
  ];
  await postTestCard(master, {
    icon: ICON(), title: `Повелитель Големов — ${esc(master.name)}`, threshold: statLine, lines,
    outcome: outcomeHtml(true, `Успех (${deg}) — Голем Рубрики встаёт`)
  }, { rolls });
  return res;
}

// ── Узы Душ ───────────────────────────────────────────────────────────────

/** Связать Голема Узами Душ: он действует в Инициативу колдуна и является его Псайбером. */
export async function bindNexus(master) {
  const actors = worldActors();
  if (nexusSlotsLeft(master, actors) < 1) {
    ui.notifications?.warn("Все взятые копии Таланта «Узы Душ» уже привязаны к Големам.");
    return null;
  }
  const options = nexusFreeGolems(master, actors);
  if (!options.length) {
    ui.notifications?.warn("Нет живых Големов, не связанных Узами Душ.");
    return null;
  }
  const rows = options.map(g => `<option value="${esc(g.uuid)}">${esc(g.name)}</option>`).join("");
  const uuid = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Узы Душ — ${master.name}` },
    content: `<div class="atk-dlg-row"><label>Голем:</label><select name="golem" class="pm-input">${rows}</select></div>
      <p class="dyn-hint">Каждая копия Таланта привязывается к одному Голему.</p>`,
    ok: { label: "Связать", callback: (event, button) => button.form.elements.golem.value },
    rejectClose: false
  }).catch(() => null);
  if (!uuid) return null;
  const golem = await actorOfUuid(uuid);
  if (!golem) return null;
  await golem.setFlag(NS, GOLEM_FLAG, { ...golem.getFlag(NS, GOLEM_FLAG), nexus: true });
  await postTestCard(master, {
    icon: ICON(), title: `Узы Душ — ${esc(master.name)}`,
    lines: [`<div class="roll-threshold">${esc(golem.name)} действует в Инициативу ${esc(master.name)} и служит его Псайбером (связь и манифестация через Псайбера ведутся вручную).</div>`]
  }, { sound: false });
  await syncNexusInitiatives(combatOfActor(master));
  return golem;
}

const findCombatant = (combat, actor) => {
  for (const c of combat?.combatants ?? []) {
    if (c?.actorId === actor?.id || c?.actor?.uuid === actor?.uuid) return c;
  }
  return null;
};

/** Инициатива связанных Узами Големов — сразу за хозяином (как Гончая Загонщика). */
export async function syncNexusInitiatives(combat) {
  if (!combat) return;
  for (const c of combat.combatants ?? []) {
    const actor = c?.actor;
    if (!actor || !isGolem(actor) || !actor.getFlag?.(NS, GOLEM_FLAG)?.nexus) continue;
    const master = await actorOfUuid(golemMasterUuid(actor));
    const masterC = master ? findCombatant(combat, master) : null;
    const raw = masterC?.initiative;
    if (raw === null || raw === undefined) continue;
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    const target = v - 0.01;
    if (Number(c.initiative) !== target) await c.update({ initiative: target });
  }
}

// ── Регенерация и Психическое Эхо ─────────────────────────────────────────

/** Лечение Регенерацией: Раны вверх, Критические вниз (computeWoundHealing). */
async function healByRegeneration(actor, amount) {
  const w = actor.system?.wounds ?? {};
  const max = Number(w.effectiveMax ?? w.max) || 0;
  const missing = Math.max(0, max - (Number(w.value) || 0)) + (Number(w.critical) || 0);
  const applied = Math.min(Math.max(0, amount), missing);
  if (applied > 0) await actor.update(computeWoundHealing(actor.system, applied));
  return applied;
}

/** Начало Хода: ранен и есть Regeneration (X) — карточка с тестом T+0 или пропуском действий; Эхо — автоуспех ×2. */
export async function regenerationTurnStart(actor) {
  const rating = regenerationRating(actor);
  // У Принца Демонов Regeneration — «авто-активация без тестов» (constants/demon-prince.mjs): карточки с тестом ему не нужно.
  if (!rating || actor?.type === "demonPrince" || isDeceased(actor) || !isWounded(actor)) return null;
  const echo = actor.getFlag?.(NS, ECHO_PENDING_FLAG);
  if (echo) {
    await actor.unsetFlag(NS, ECHO_PENDING_FLAG);
    const heal = regenerationHeal(rating, { echo: true });
    const applied = await healByRegeneration(actor, heal);
    await postTestCard(actor, {
      icon: ICON(), title: `Регенерация — ${esc(actor.name)}`,
      lines: [`<div class="roll-threshold">Психическое Эхо: тест Регенерации пройден автоматически, восстановлено вдвое больше Ран — <b>${applied}</b> (вместо ${rating}).</div>`],
      outcome: outcomeHtml(true, "Регенерация усилена Эхом")
    }, { sound: false });
    return { echo: true, applied };
  }
  await postTestCard(actor, {
    icon: ICON(), title: `Регенерация (${rating}) — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">В начале Хода: тест T+0 — восстановить ${rating} Ран; либо пропустить все действия этого Хода и пройти тест автоматически.</div>`],
    sections: [`<div class="roll-defense-btns">
      <button type="button" class="wh-regen-btn" data-actor-uuid="${esc(actor.uuid)}" data-auto="0">Тест T+0</button>
      <button type="button" class="wh-regen-btn" data-actor-uuid="${esc(actor.uuid)}" data-auto="1">Пропустить действия — автоматически</button></div>`]
  }, { sound: false });
  return { echo: false };
}

/** Кнопка карточки Регенерации: тест T+0 или автоуспех ценой всех действий Хода. */
export async function rollRegeneration(actor, { auto = false } = {}) {
  const rating = regenerationRating(actor);
  if (!rating || !isWounded(actor)) {
    ui.notifications?.warn(`${actor?.name ?? "Актор"}: Регенерировать нечего.`);
    return false;
  }
  if (auto) {
    if (actor.system?.actionPoints) await actor.update({ "system.actionPoints.value": 0 });
    const applied = await healByRegeneration(actor, regenerationHeal(rating));
    await postTestCard(actor, {
      icon: ICON(), title: `Регенерация — ${esc(actor.name)}`,
      lines: [`<div class="roll-threshold">Все действия этого Хода пропущены, тест пройден автоматически: восстановлено <b>${applied}</b> Ран.</div>`],
      outcome: outcomeHtml(true, "Регенерация")
    }, { sound: false });
    return true;
  }
  const t = Number(actor.system?.characteristics?.t?.total) || 0;
  const mods = collectTestMods(actor, { kind: "skill", char: "t" });
  const threshold = t + mods.total;
  const { rv, rolls } = await rollD100WithReroll(null);
  const { success, deg } = testOutcome(rv, threshold);
  const applied = success ? await healByRegeneration(actor, regenerationHeal(rating)) : 0;
  await postTestCard(actor, {
    icon: ICON(), title: `Регенерация — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "T+0", base: t, parts: mods.parts.map(esc), threshold, rv }),
    outcome: outcomeHtml(success, success ? `Успех (${deg}) — восстановлено ${applied} Ран` : "Провал — Раны не восстановились")
  }, { rolls });
  return success;
}

/** Кнопка «Психическое Эхо» для карточки успешной манифестации ("" — не положена). */
export function psychicEchoButtonHtml(actor) {
  if (!hasPsychicEcho(actor)) return "";
  if (!golemsOf(actor, worldActors()).some(g => !golemDestroyed(g))) return "";
  const used = !isCapabilityAvailable(actor, ECHO_USAGE_FLAG, "round");
  return `<div class="roll-defense-btns"><button type="button" class="wh-psychic-echo-btn" data-actor-uuid="${esc(actor.uuid)}"${used ? " disabled" : ""}
    title="Психическое Эхо — раз в Ход после успешной манифестации: один Голем автоматически пройдёт следующий тест Регенерации и восстановит вдвое больше Ран">
    ${rollIcon("warp", "#7f5cff")}Психическое Эхо: усилить Регенерацию Голема</button></div>`;
}

/** Применить Эхо: выбрать Голема, пометить его; раз в Раунд. */
export async function usePsychicEcho(caster) {
  if (!hasPsychicEcho(caster)) return false;
  if (!isCapabilityAvailable(caster, ECHO_USAGE_FLAG, "round")) {
    ui.notifications?.warn("Психическое Эхо уже применялось в этом Раунде.");
    return false;
  }
  const options = golemsOf(caster, worldActors()).filter(g => !golemDestroyed(g) && regenerationRating(g) > 0);
  if (!options.length) {
    ui.notifications?.warn("Нет живых Големов с Регенерацией.");
    return false;
  }
  const rows = options.map(g => `<option value="${esc(g.uuid)}">${esc(g.name)}</option>`).join("");
  const uuid = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Психическое Эхо — ${caster.name}` },
    content: `<div class="atk-dlg-row"><label>Голем:</label><select name="golem" class="pm-input">${rows}</select></div>`,
    ok: { label: "Усилить", callback: (event, button) => button.form.elements.golem.value },
    rejectClose: false
  }).catch(() => null);
  const golem = uuid ? await actorOfUuid(uuid) : null;
  if (!golem) return false;
  await golem.setFlag(NS, ECHO_PENDING_FLAG, true);
  await markCapabilityUsed(caster, ECHO_USAGE_FLAG, "round");
  await postTestCard(caster, {
    icon: ICON(), title: `Психическое Эхо — ${esc(caster.name)}`,
    lines: [`<div class="roll-threshold">${esc(golem.name)} автоматически пройдёт следующий тест Регенерации и восстановит вдвое больше Ран.</div>`]
  }, { sound: false });
  return true;
}

// ── Возрождён во Прахе ────────────────────────────────────────────────────

/** Начало Хода колдуна: Ступор поднятых Големов снимается («до начала следующего Хода колдуна»). */
export async function clearRebornStupor(master) {
  for (const g of golemsOf(master, worldActors())) {
    if (!g.getFlag?.(NS, STUPOR_FLAG)) continue;
    await g.unsetFlag(NS, STUPOR_FLAG);
    await removeCondition(g, "dazed");
  }
}

/** Полное действие + Очко Бесчестия + психотест W−20 в Усиленном режиме: разбитый Голем встаёт с Ранами, равными Успехам. */
export async function useRebornInDust(master) {
  if (!hasRebornInDust(master)) return false;
  const actors = worldActors();
  const fallen = fallenGolems(master, actors);
  if (!fallen.length) {
    ui.notifications?.warn("Нет разбитых Големов.");
    return false;
  }
  if (soulsFree(master, actors) < 1) {
    ui.notifications?.warn("Нет свободной души: все 8 привязаны к живым Големам.");
    return false;
  }
  const rows = fallen.map(g => `<option value="${esc(g.uuid)}">${esc(g.name)}</option>`).join("");
  const uuid = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Возрождён во Прахе — ${master.name}` },
    content: `<div class="atk-dlg-row"><label>Разбитый Голем:</label><select name="golem" class="pm-input">${rows}</select></div>
      <p class="dyn-hint">Полное действие, 1 Очко Бесчестия, психотест W−20 в Усиленном режиме (Феномен гарантирован).</p>`,
    ok: { label: "Поднять", callback: (event, button) => button.form.elements.golem.value },
    rejectClose: false
  }).catch(() => null);
  const golem = uuid ? await actorOfUuid(uuid) : null;
  if (!golem) return false;

  if (!actorHasInfamyPoint(master)) {
    ui.notifications?.warn("Нет Очка Бесчестия — Возрождён во Прахе не активирован.");
    return false;
  }

  // Настоящий психотест W−20 в Усиленном режиме: эPR, бонус +5×эPR, Феномен (гарантирован), Прорыв (Рубрика Аримана
  // даёт два кубика), Варп-Шок и списание полного действия идут тем же конвейером, что у любой манифестации.
  const psy = master.system?.psyker ?? {};
  const power = {
    id: "reborn-in-dust", uuid: "", name: "Возрождён во Прахе / Reborn in Dust", type: "psychicPower",
    img: "systems/warhammer-dbc/assets/item-icons/trait.svg",
    system: { testChar: "wp", powerType: "utility", testMod: REBORN_TEST_MOD, action: "full" },
    update: async d => d
  };
  let result = null;
  await executePsychotest(master, power, {
    mPR: Math.max(1, Number(psy.currentRating ?? psy.rating) || 1), prMod: 0, mode: "push", path: "", modifier: 0, eldar: false,
    pushChoice: 1, damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1,
    onResult: r => { result = r; }
  });
  if (!result) return false;
  await spendInfamyPoint(master, "Возрождён во Прахе");

  const lines = [];
  if (result.success) {
    await golem.update({ "system.wounds.value": result.deg, "system.wounds.critical": 0 });
    await setDeceased(golem, false);
    await addCondition(golem, "dazed");
    await golem.setFlag(NS, STUPOR_FLAG, true);
    lines.push(`<div class="roll-threshold">${esc(golem.name)} поднят с ${result.deg} Ранами и пребывает в Ступоре до начала следующего Хода колдуна.</div>`);
  }
  await postTestCard(master, {
    icon: ICON(), title: `Возрождён во Прахе — ${esc(master.name)}`,
    lines: [...lines, `<div class="roll-threshold">Потрачено: Очко Бесчестия, полное действие.</div>`],
    outcome: outcomeHtml(result.success, result.success ? `Успех (${result.deg}) — Голем восстал` : "Провал — Голем остаётся грудой доспехов")
  }, { sound: false });
  return result.success;
}

// ── Инфернальные Снаряды ──────────────────────────────────────────────────

/** Час работы: единица обычных болтов (магазин на 24) переделывается в Инферно-болты Тзинча. */
export async function useInfernalShells(actor) {
  if (!hasInfernalShells(actor)) return false;
  const stock = [...actor.items].filter(i => isOrdinaryBolt(i) && shellsBatch(i.system?.quantity) > 0);
  if (!stock.length) {
    ui.notifications?.warn(`Нет обычных болтов: нужно ${INFERNAL_SHELLS_COUNT} штук (единица боеприпаса).`);
    return false;
  }
  const pack = game.packs?.get("warhammer-dbc.ammunition");
  const index = pack ? await pack.getIndex() : [];
  const hit = [...index].find(e => String(e.name).includes(INFERNAL_AMMO_NAME));
  const template = hit ? await pack.getDocument(hit._id) : null;
  if (!template) {
    ui.notifications?.warn(`Боеприпас «${INFERNAL_AMMO_NAME}» не найден в компендиуме.`);
    return false;
  }
  const source = stock[0];
  const ok = await confirm("Инфернальные Снаряды",
    `Потратить час резьбы и переделать ${INFERNAL_SHELLS_COUNT} болтов («${esc(source.name)}») в Инферно-болты Тзинча? Нужны хотя бы минимальные инструменты для резьбы.`,
    "Переделать", "Отмена");
  if (!ok) return false;

  const take = shellsBatch(source.system.quantity);
  const existing = [...actor.items].find(i => i.type === "ammo" && i.name === template.name);
  await source.update({ "system.quantity": (Number(source.system.quantity) || 0) - take });
  if (existing) await existing.update({ "system.quantity": (Number(existing.system.quantity) || 0) + take });
  else {
    const data = template.toObject();
    delete data._id;
    data.system.quantity = take;
    await actor.createEmbeddedDocuments("Item", [data]);
  }
  await postTestCard(actor, {
    icon: ICON(), title: `Инфернальные Снаряды — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">${INFERNAL_SHELLS_HOURS} час резьбы: ${INFERNAL_SHELLS_COUNT} болтов («${esc(source.name)}») стали Инферно-болтами Тзинча.</div>`],
    outcome: outcomeHtml(true, "Инферно-болты готовы")
  }, { sound: false });
  return true;
}

export { isGolem, golemDestroyed };
