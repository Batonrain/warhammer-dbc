// module/apps/twin-spirit.mjs
// ════════════════════════════════════════════════════════════════════════
//  Лист демона Двойного Духа — Foundry-обвязка (чистая часть —
//  rules/twin-spirit.mjs). Создание листа из Бестиария, сверка того, что
//  Проявление выдаёт хосту (щит Ауры Хаоса, Черты Текучего/Наслоения, Локус
//  Симбиоза), и кнопки Талантов, которым нужен демон: Интроспекция, Ментор,
//  Общее Колдовство, Восходя Вместе / Высший Одержимый.
//
//  Бестиарий скрыт от игрока (ownership.PLAYER:"NONE"), поэтому лист создаёт
//  активный ГМ — напрямую или сокет-релеем (action:"createTwinDemon",
//  обработчик — warhammer-dbc.mjs), тот же приём, что summonDemon.
// ════════════════════════════════════════════════════════════════════════

import { findBestiaryActor } from "./demon-summon.mjs";
import { twinSpiritMeta } from "../constants/possession.mjs";
import {
  TWIN_HOST_FLAG, TWIN_BESTIARY_NAMES, twinDemonOf, twinDemonStats,
  AURA_OF_CHAOS_FLAG, auraOfChaosRating,
  INTROSPECTION_TURN_FLAG, introspectionThresholds, introspectionBonus,
  SHARED_SORCERY_FLAG, sharedSorceryAvailable, sharedSorceryMark, demonPowers,
  MENTOR_GRANT_FLAG, MENTOR_SKILLS_FLAG, MENTOR_LIMIT, mentorChoices, mentorSkillRestore,
  demonAscensionUpdate, greaterPossessedInf,
  MANIFEST_GRANT_FLAG, manifestTraitDiff,
  demonLoci, locusRadius, symbioteLocusActive
} from "../rules/twin-spirit.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import { isCapabilityAvailable, markCapabilityUsed } from "../rules/cooldown.mjs";
import { resolveOpposed } from "../rules/test-kind.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { SKILL_RANKS } from "../constants/characteristics.mjs";
import { SKILLS_DEF } from "../constants/skills.mjs";
import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { payActions } from "../combat/cult-common.mjs";

const NS = "warhammer-dbc";
const TRAITS_PACK = "warhammer-dbc.traits";
const FORCEFIELD_IMG = "systems/warhammer-dbc/assets/item-icons/forcefield.svg";
const ICON = "⛧";
const hasTalent = (actor, name) => [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, name));

// ── Лист демона ───────────────────────────────────────────────────────────

/**
 * Создать Актора-демона Двойного Духа (копия из Бестиария) и связать с
 * хостом. Только ГМ. Владение — как у хоста: демона отыгрывает тот же стол.
 * @returns {Promise<{ok:boolean, reason?:string, demonUuid?:string}>}
 */
export async function createTwinDemonSheet(host) {
  if (!host) return { ok: false, reason: "Хост не найден." };
  const existing = twinDemonOf(host);
  if (existing) return { ok: true, demonUuid: existing.uuid };
  const p = host.system?.possession ?? {};
  const key = p.demon || "katart";
  const meta = twinSpiritMeta(key);
  const src = await findBestiaryActor(TWIN_BESTIARY_NAMES[key] ?? meta.label);
  if (!src) return { ok: false, reason: `«${meta.label}» не найден в Бестиарии — лист демона не создан.` };
  const data = src.toObject();
  delete data._id;
  data.folder = null;
  const name = String(p.demonName ?? "").trim();
  data.name = name ? `${name} (${meta.label})` : `${meta.label} — демон ${host.name}`;
  data.ownership = foundry.utils.deepClone(host.ownership ?? { default: 0 });
  data.flags = foundry.utils.mergeObject(data.flags ?? {}, { [NS]: { [TWIN_HOST_FLAG]: host.uuid } });
  const demon = await Actor.create(data);
  if (!demon) return { ok: false, reason: "Не удалось создать Актора демона." };
  const upd = { "system.possession.demonUuid": demon.uuid };
  // Пул Ран духа демона на вкладке хоста (Общая Боль, урон Варпа) — если он
  // ещё пуст, заполняется Ранами из статблока демона.
  if (!(Number(p.demonWounds?.max) > 0)) {
    const w = Number(demon.system?.wounds?.max) || 0;
    upd["system.possession.demonWounds.max"] = w;
    upd["system.possession.demonWounds.value"] = w;
  }
  await host.update(upd);
  return { ok: true, demonUuid: demon.uuid };
}

/** Кнопка «Создать лист демона»: ГМ — напрямую, игрок — сокет-релей. */
export async function requestTwinDemonSheet(host) {
  if (game.user?.isGM) {
    const res = await createTwinDemonSheet(host);
    if (!res.ok) ui.notifications?.warn(res.reason);
    else (await fromUuid(res.demonUuid).catch(() => null))?.sheet?.render(true);
    return res;
  }
  if (!game.users?.activeGM) {
    ui.notifications?.warn("Нет активного Мастера — лист демона создаст ГМ.");
    return { ok: false };
  }
  game.socket?.emit("system.warhammer-dbc", { action: "createTwinDemon", userId: game.user?.id, hostUuid: host.uuid });
  ui.notifications?.info("Запрос отправлен Мастеру — лист демона появится через мгновение.");
  return { ok: true, pending: true };
}

export function openTwinDemonSheet(host) {
  const demon = twinDemonOf(host);
  if (!demon) return ui.notifications?.warn("Лист демона не найден — создайте его заново.");
  demon.sheet?.render(true);
}

// ── Сверка того, что даёт Проявление ──────────────────────────────────────

async function traitSourceData(demon, entry) {
  // Сначала лист демона: Особые Черты (Мост Между Мирами, Жажда Крови…) лежат
  // там под своими именами и в общем паке Черт их нет.
  const own = [...(demon?.items ?? [])].find(i => i?.type === "trait" && itemHasName(i, entry.name));
  let data = own ? own.toObject() : null;
  if (!data) {
    const pack = game.packs?.get(TRAITS_PACK);
    const index = pack ? await pack.getIndex() : null;
    const hit = index?.find(e => itemHasName({ name: e.name }, entry.name));
    const doc = hit ? await pack.getDocument(hit._id) : null;
    data = doc ? doc.toObject() : null;
  }
  if (!data) return null;
  delete data._id;
  if (entry.rating != null) {
    data.system = { ...(data.system ?? {}), hasRating: true, rating: entry.rating };
    if (entry.rating2 != null) Object.assign(data.system, { hasRating2: true, rating2: entry.rating2 });
  }
  data.flags = foundry.utils.mergeObject(data.flags ?? {}, { [NS]: { [MANIFEST_GRANT_FLAG]: { gift: entry.gift, name: entry.name } } });
  return data;
}

/** Черты Даров-форм (Текучий, Наслоение) — выдать/снять по Проявлению. */
export async function syncManifestTraits(host) {
  const { remove, create } = manifestTraitDiff(host);
  if (remove.length) await host.deleteEmbeddedDocuments("Item", remove);
  if (!create.length) return;
  const demon = twinDemonOf(host);
  const docs = [], missing = [];
  for (const entry of create) {
    const d = await traitSourceData(demon, entry);
    if (d) docs.push(d); else missing.push(`${entry.name} (${entry.gift})`);
  }
  if (docs.length) await host.createEmbeddedDocuments("Item", docs);
  if (missing.length) ui.notifications?.warn(`${host.name}: не найдены Черты — ${missing.join(", ")}. Учтите вручную.`);
}

/** Щит Ауры Хаоса: сквозной чародейский 1-W демона, не перегружается. */
export function auraOfChaosShieldData(rating) {
  return {
    name: "Aura of Chaos / Аура Хаоса", type: "forcefield", img: FORCEFIELD_IMG,
    system: {
      shieldNature: "warp", shieldType: "penetrating",
      ratingMin: 1, ratingMax: rating, overloadThreshold: 0, currentRating: rating,
      isSpecialRating: false, equipped: true, status: "active", quality: "common", availability: 0, weight: 0
    },
    flags: { [NS]: { [AURA_OF_CHAOS_FLAG]: true } }
  };
}

export async function syncAuraOfChaos(host) {
  const rating = auraOfChaosRating(host, twinDemonOf(host));
  const have = [...host.items].filter(i => i.type === "forcefield" && i.getFlag?.(NS, AURA_OF_CHAOS_FLAG));
  const keep = rating > 0 ? have.find(i => Number(i.system?.ratingMax) === rating) : null;
  const remove = have.filter(i => i !== keep).map(i => i.id);
  if (remove.length) await host.deleteEmbeddedDocuments("Item", remove);
  if (rating > 0 && !keep) await host.createEmbeddedDocuments("Item", [auraOfChaosShieldData(rating)]);
}

/**
 * Локус Симбиоза: Дар-предмет несёт ауру (regions/auras.mjs) радиусом ½W
 * демона, выдающую Локусы с листа демона дружественным Одержимым в
 * Проявлении (requireManifested). Без Проявления/Высшего/Локусов — флаг снят.
 */
export async function syncSymbioteLocus(host) {
  const gift = [...host.items].find(i => i.type === "talent" && itemHasName(i, "Locus of the Symbiote"));
  if (!gift) return;
  const demon = twinDemonOf(host);
  const loci = demonLoci(demon);
  const want = symbioteLocusActive(host) && loci.length
    ? { radius: locusRadius(demon), affects: "allies", includesSelf: true, requireManifested: true,
        grant: loci.map(l => ({ uuid: l.uuid, rating: null })) }
    : null;
  const cur = gift.getFlag(NS, "aura") ?? null;
  if (JSON.stringify(cur) === JSON.stringify(want)) return;
  if (want) await gift.setFlag(NS, "aura", want);
  else if (cur) await gift.unsetFlag(NS, "aura");
}

/** Всё, что зависит от Проявления и листа демона: щит, Черты, Локус; выход — снять Ментора и Интроспекцию. */
export async function syncTwinSpirit(host) {
  if (!host?.isOwner) return;
  await syncAuraOfChaos(host);
  await syncManifestTraits(host);
  await syncSymbioteLocus(host);
  if (!host.system?.possession?.manifested) {
    await clearMentor(host);
    if (host.getFlag(NS, "introspectionGift")) await host.unsetFlag(NS, "introspectionGift");
  }
}

// ── Интроспекция ──────────────────────────────────────────────────────────

/**
 * «Раз в Ход за полудействие … Charm+0 vs W+0 или Logic+0 vs W+0 против
 * своего демона (по выбору ГМа) … убедить его проявить один дополнительный
 * Дар». Победа — +1 к числу активных Даров до повторной активации Таланта
 * или выхода из Проявления.
 */
export async function rollIntrospection(host) {
  const demon = twinDemonOf(host);
  if (!demon) return ui.notifications?.warn("Интроспекция: сначала создайте лист демона.");
  if (!host.system?.possession?.manifested) return ui.notifications?.warn("Интроспекция: демон должен быть проявлен.");
  if (!isCapabilityAvailable(host, INTROSPECTION_TURN_FLAG, "turn")) return ui.notifications?.warn("Интроспекция уже была в этом Ходу.");
  const skill = await foundry.applications.api.DialogV2.wait({
    window: { title: "Интроспекция" },
    content: `<p>Тест против W демона (${twinDemonStats(demon).wp}). Навык выбирает ГМ — по характеру и настроению демона.</p>`,
    buttons: [{ action: "charm", label: "Charm" }, { action: "logic", label: "Logic" }],
    rejectClose: false
  }).catch(() => null);
  if (!skill) return;
  if (!await payActions(host, 1, { what: "Интроспекция" })) return;
  await markCapabilityUsed(host, INTROSPECTION_TURN_FLAG, "turn");
  const t = introspectionThresholds(host, demon, skill);
  const [rh, rd] = [await new Roll("1d100").evaluate(), await new Roll("1d100").evaluate()];
  const mine = { ...testOutcome(rh.total, t.host), threshold: t.host };
  const theirs = { ...testOutcome(rd.total, t.demon), threshold: t.demon };
  const res = resolveOpposed(mine, theirs);
  const win = res.winner === "mine";
  if (win) await host.setFlag(NS, "introspectionGift", true);
  const bonus = introspectionBonus(host);
  await postTestCard(host, {
    icon: ICON, title: `Интроспекция — ${esc(host.name)}`,
    lines: [
      `<div class="roll-threshold">${skill === "logic" ? "Logic" : "Charm"}: <b>${rh.total}</b> против <b>${t.host}</b>${bonus ? ` (в т.ч. +${bonus} Forbidden Lore (Daemons))` : ""} — ${mine.success ? "Успех" : "Провал"} (${mine.deg})</div>`,
      `<div class="roll-threshold">W демона: <b>${rd.total}</b> против <b>${t.demon}</b> — ${theirs.success ? "Успех" : "Провал"} (${theirs.deg})</div>`
    ],
    outcome: win
      ? `<span class="roll-success">Демон уговорён: +1 активный Дар до повторной Интроспекции или выхода из Проявления.</span>`
      : `<span class="roll-failure">Демон не уступил.</span>`
  }, { rolls: [rh, rd] });
}

// ── Ментор ────────────────────────────────────────────────────────────────

export async function clearMentor(host) {
  const ids = [...host.items].filter(i => i.getFlag?.(NS, MENTOR_GRANT_FLAG)).map(i => i.id);
  if (ids.length) await host.deleteEmbeddedDocuments("Item", ids);
  const granted = host.getFlag(NS, MENTOR_SKILLS_FLAG);
  if (granted?.length) {
    const upd = mentorSkillRestore(host, granted);
    upd[`flags.${NS}.-=${MENTOR_SKILLS_FLAG}`] = null;
    await host.update(upd);
  }
}

/**
 * Дар «Ментор»: до 3 Навыков/Талантов демона хосту, пока демон проявлен.
 * Повторная активация — новый набор (прежний снимается).
 */
export async function chooseMentor(host) {
  const demon = twinDemonOf(host);
  if (!demon) return ui.notifications?.warn("Ментор: сначала создайте лист демона.");
  if (!host.system?.possession?.manifested) return ui.notifications?.warn("Ментор: демон должен быть проявлен.");
  await clearMentor(host);
  const { talents, skills } = mentorChoices(host, demon);
  if (!talents.length && !skills.length) return ui.notifications?.info("Ментор: демону нечему научить хоста.");
  const rankLabel = r => SKILL_RANKS[r]?.label ?? r;
  const rows = [
    ...skills.map(s => `<label class="atk-dlg-row"><input type="checkbox" name="s:${esc(s.key)}"/> Навык ${esc(SKILLS_DEF[s.key]?.label ?? s.key)}: ${esc(rankLabel(s.hostRank))} → <b>${esc(rankLabel(s.rank))}</b></label>`),
    ...talents.map(t => `<label class="atk-dlg-row"><input type="checkbox" name="t:${esc(t.id)}"/> Талант ${esc(t.name)}</label>`)
  ].join("");
  const picked = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Ментор" },
    content: `<p>Выберите до ${MENTOR_LIMIT} — демон позволяет хосту пользоваться ими, пока проявлен.</p>${rows}`,
    ok: { label: "Принять", callback: (ev, b) => [...b.form.querySelectorAll("input[type=checkbox]:checked")].map(i => i.name) },
    rejectClose: false
  }).catch(() => null);
  if (!picked?.length) return;
  const chosen = picked.slice(0, MENTOR_LIMIT);
  const docs = [], skillUpd = {}, granted = [], names = [];
  for (const c of chosen) {
    const [kind, id] = [c.slice(0, 1), c.slice(2)];
    if (kind === "t") {
      const it = demon.items.get(id);
      if (!it) continue;
      const d = it.toObject();
      delete d._id;
      d.flags = foundry.utils.mergeObject(d.flags ?? {}, { [NS]: { [MENTOR_GRANT_FLAG]: true } });
      docs.push(d);
      names.push(it.name);
    } else {
      const s = skills.find(x => x.key === id);
      if (!s) continue;
      skillUpd[`system.skills.${id}.rank`] = s.rank;
      granted.push({ key: id, rank: s.rank, prevRank: s.hostRank });
      names.push(`${SKILLS_DEF[id]?.label ?? id} (${rankLabel(s.rank)})`);
    }
  }
  if (docs.length) await host.createEmbeddedDocuments("Item", docs);
  if (granted.length) await host.update({ ...skillUpd, [`flags.${NS}.${MENTOR_SKILLS_FLAG}`]: granted });
  await postTestCard(host, {
    icon: ICON, title: `Ментор — ${esc(host.name)}`,
    lines: [`<div class="roll-threshold">Демон делится умениями до конца Проявления: <b>${names.map(esc).join(", ")}</b>.</div>`]
  }, { sound: false });
}

// ── Общее Колдовство ──────────────────────────────────────────────────────

/**
 * «Тот из пары, кто не контролирует тело, может раз в Раунд манифестировать
 * психосилу … полудействие — не может 1 Раунд, полное — 3 Раунда». Силы — с
 * листа демона, психотест — от его пси-профиля (обычное окно манифестации,
 * актор — демон). Действия хоста не тратятся: это ход второй души.
 */
export async function castSharedSorcery(host) {
  const demon = twinDemonOf(host);
  if (!demon) return ui.notifications?.warn("Общее Колдовство: сначала создайте лист демона.");
  const powers = demonPowers(demon);
  if (!powers.length) return ui.notifications?.warn("Общее Колдовство: у демона на листе нет психосил.");
  const round = game.combat?.started ? game.combat.round : null;
  if (!sharedSorceryAvailable(host.getFlag(NS, SHARED_SORCERY_FLAG), round)) {
    return ui.notifications?.warn("Общее Колдовство: вторая душа ещё не готова (раз в Раунд; после полу-/полного действия — простой 1/3 Раунда).");
  }
  const id = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Общее Колдовство" },
    content: `<div class="atk-dlg-row"><label>Психосила демона</label><select name="p" class="pm-input">${
      powers.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></div>`,
    ok: { label: "Манифестировать", callback: (ev, b) => b.form.elements.p.value },
    rejectClose: false
  }).catch(() => null);
  const power = id ? demon.items.get(id) : null;
  if (!power) return;
  if (round != null) await host.setFlag(NS, SHARED_SORCERY_FLAG, sharedSorceryMark(power.system?.action, round));
  const { showManifestDialog } = await import("../sheets/tabs/psychic.mjs");
  showManifestDialog(demon, power);
}

// ── Восходя Вместе / Высший Одержимый ─────────────────────────────────────

export async function ascendTwinDemon(host, kind) {
  const demon = twinDemonOf(host);
  if (!demon) return ui.notifications?.warn("Сначала создайте лист демона.");
  const talent = kind === "greater" ? "Greater Possessed" : "Rising Together";
  if (!hasTalent(host, talent)) return ui.notifications?.warn(`Нет Таланта ${talent}.`);
  const upd = demonAscensionUpdate(kind, host, demon);
  if (!(game.user?.isGM || demon.isOwner)) return ui.notifications?.warn("Лист демона правит ГМ.");
  await demon.update(upd);
  if (kind === "greater" && !host.system?.possession?.greaterPossessed) await host.update({ "system.possession.greaterPossessed": true });
  const lines = kind === "greater"
    ? [`Демон возвышается в Герольда: Inf = ½ Inf Одержимого = <b>${greaterPossessedInf(host.system?.characteristics?.inf?.total)}</b>.`,
       "Фавор герольда — 75 xp за 1 Inf (вместо 150); его Очки Бесчестия — из Inf.b, а не 3 от Общего Пути. Локусы герольда изнутри Одержимого не действуют (кроме Дара «Локус Симбиоза»)."]
    : ["Демон становится Возвышенным. Вариации возвышения выбирает игрок — впишите их на лист демона."];
  await postTestCard(host, {
    icon: ICON, title: `${kind === "greater" ? "Высший Одержимый" : "Восходя Вместе"} — ${esc(host.name)}`,
    lines: lines.map(l => `<div class="roll-threshold">${l}</div>`)
  }, { sound: false });
}
