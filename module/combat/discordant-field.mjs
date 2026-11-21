// module/combat/discordant-field.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Поле Дискорданта — хвосты (корбук, Субрасы Людей — Дискордант; task-be12).
//  Решения — rules/null-zones.mjs (чистая логика), здесь — хуки и карточки:
//
//   • вход в поле (Черта-метка легла на актора): бросок 1d5+1 Ходов до
//     заклинивания механики; надетая включённая силовая броня отключается
//     («Мёртвая Зона» Haywire 7, тот же тумблер system.active, что разряд
//     батареи — rules/armour-penalty.mjs::powerArmourKilledByHaywire);
//   • выход: счётчик заклинивания сбрасывается (непрерывность прервана),
//     отключённая полем броня включается обратно;
//   • начало Хода актора в поле: счётчик −1, на нуле механическое оружие
//     Клинит (system.jammed; Расклин — combat/clear-jam.mjs);
//   • ход времени (updateWorldTime): биоорганы — тест T+0 за каждые 10 минут
//     в поле, Провалы копятся, за каждые T.b×2 — отторжение органа (эффект
//     решает ГМ: строка в карточке), убыль по 1 в час.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName, DISCORDANT_FIELD_TRAIT } from "../rules/predicates.mjs";
import {
  inDiscordantField, FIELD_JAM_FORMULA, FIELD_JAM_FLAG, FIELD_ARMOUR_OFF_FLAG, FIELD_BIO_FLAG,
  fieldJamTick, fieldJammableWeapons, hasFieldBioOrgans, fieldBioStep
} from "../rules/null-zones.mjs";
import { powerArmourKilledByHaywire } from "../rules/armour-penalty.mjs";
import { DISCORDANT_HAYWIRE_INTENSITY } from "../rules/predicates.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";
const flagOf = (actor, k) => actor?.flags?.[NS]?.[k] ?? actor?.getFlag?.(NS, k);
const isFieldMark = item => item?.type === "trait" && itemHasName(item, DISCORDANT_FIELD_TRAIT);
const ICON = () => rollIcon("bolt", "#8fd0ff");

/** Хук createItem: актор вошёл в поле. */
export async function onFieldMarkCreated(item) {
  if (!isFieldMark(item)) return;
  const actor = item.parent;
  if (!actor) return;
  const lines = [];
  const update = {};
  if (fieldJammableWeapons(actor).length) {
    const roll = await new Roll(FIELD_JAM_FORMULA).evaluate();
    update[`flags.${NS}.${FIELD_JAM_FLAG}`] = roll.total;
    lines.push(`Механика (болтеры, стаб, огнемёты, цепное…) заклинит через <b>${roll.total}</b> Ход(а) в поле.`);
  }
  const killed = powerArmourKilledByHaywire(actor, DISCORDANT_HAYWIRE_INTENSITY);
  if (killed.length) {
    await actor.updateEmbeddedDocuments("Item", killed.map(i => ({ _id: i.id, "system.active": false })));
    update[`flags.${NS}.${FIELD_ARMOUR_OFF_FLAG}`] = killed.map(i => i.id);
    lines.push(`🔌 Силовая броня отключена (${killed.map(i => esc(i.name)).join(", ")}): бонусы погасли, действуют штрафы выключенной брони. Включится сама при выходе из поля.`);
  }
  if (Object.keys(update).length) await actor.update(update);
  if (lines.length) await postTestCard(actor, {
    icon: ICON(), title: `${esc(actor.name)} — в поле Дискорданта`,
    lines: lines.map(l => `<div class="roll-threshold">${l}</div>`)
  }, { sound: false });
}

/** Хук deleteItem: актор вышел из поля. */
export async function onFieldMarkDeleted(item) {
  if (!isFieldMark(item)) return;
  const actor = item.parent;
  if (!actor || inDiscordantField(actor)) return;   // второй Дискордант ещё держит
  const update = {};
  if (flagOf(actor, FIELD_JAM_FLAG) != null) update[`flags.${NS}.-=${FIELD_JAM_FLAG}`] = null;
  const off = flagOf(actor, FIELD_ARMOUR_OFF_FLAG);
  if (Array.isArray(off)) {
    update[`flags.${NS}.-=${FIELD_ARMOUR_OFF_FLAG}`] = null;
    const back = off.map(id => actor.items.get?.(id)).filter(i => i?.system?.equipped && i.system?.active === false);
    if (back.length) await actor.updateEmbeddedDocuments("Item", back.map(i => ({ _id: i.id, "system.active": true })));
  }
  if (Object.keys(update).length) await actor.update(update);
}

/** Начало Хода: счётчик заклинивания механики. */
export async function fieldTurnStart(actor) {
  if (!actor || !inDiscordantField(actor)) return;
  const { remaining, jamNow } = fieldJamTick(flagOf(actor, FIELD_JAM_FLAG));
  if (!jamNow) {
    if (remaining != null) await actor.update({ [`flags.${NS}.${FIELD_JAM_FLAG}`]: remaining });
    return;
  }
  await actor.update({ [`flags.${NS}.-=${FIELD_JAM_FLAG}`]: null });
  const jam = fieldJammableWeapons(actor);
  if (!jam.length) return;
  await actor.updateEmbeddedDocuments("Item", jam.map(i => ({ _id: i.id, "system.jammed": true })));
  await postTestCard(actor, {
    icon: ICON(), title: `${esc(actor.name)} — механика износилась в поле Дискорданта`,
    lines: [`<div class="roll-threshold">Заклинило: ${jam.map(i => esc(i.name)).join(", ")}. Расклинить — обычным действием на листе.</div>`]
  }, { sound: false });
}

/**
 * Ход времени: биоорганы актора. Броски T+0 — пачкой, одной карточкой.
 * @param {Actor} actor
 * @param {number} now game.time.worldTime
 */
export async function fieldBioTick(actor, now) {
  if (!actor) return;
  const state = flagOf(actor, FIELD_BIO_FLAG) ?? null;
  const inField = inDiscordantField(actor) && hasFieldBioOrgans(actor);
  if (!inField && !state) return;
  const t = Number(actor.system?.characteristics?.t?.total) || 0;
  const tBonus = Number(actor.system?.characteristics?.t?.bonus) || Math.floor(t / 10);
  const rolled = [];
  const step = fieldBioStep(state, {
    now, inField, tBonus,
    rollTest: n => {
      let fails = 0;
      for (let i = 0; i < Math.min(n, 144); i++) {
        const v = Math.ceil(Math.random() * 100);
        rolled.push(v);
        if (!testOutcome(v, t).success) fails++;
      }
      return fails;
    }
  });
  if (JSON.stringify(step.state) !== JSON.stringify(state)) {
    await actor.update(step.state
      ? { [`flags.${NS}.${FIELD_BIO_FLAG}`]: step.state }
      : { [`flags.${NS}.-=${FIELD_BIO_FLAG}`]: null });
  }
  if (!step.tests) return;
  const lines = [`<div class="roll-threshold">Тестов T+0 (каждые 10 мин в поле): <b>${step.tests}</b> — броски ${rolled.join(", ")} против ${t}; Провалов <b>${step.newFails}</b>, накоплено <b>${step.state?.fails ?? 0}</b> из ${Math.max(1, tBonus * 2)}.</div>`];
  if (step.rejected) lines.push(`<div class="roll-threshold" style="color:#9a0000;font-weight:bold;">Отторгается органов: ${step.rejected} (орган Астартес / Геносемя). Эффект решает ГМ — от Усталости и потери способности до мгновенной смерти.</div>`);
  await postTestCard(actor, {
    icon: ICON(), title: `${esc(actor.name)} — биоорганы в поле Дискорданта`, lines
  }, { sound: false, whisper: game.users?.filter?.(u => u.isGM).map(u => u.id) });
}
