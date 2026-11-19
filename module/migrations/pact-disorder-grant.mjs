// module/migrations/pact-disorder-grant.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Неизлечимые расстройства Пактов у уже играющих (ревью #581, 19.11.2026).
//
//  ЧТО СЛУЧИЛОСЬ. Черты «Гоняющийся за Мечтой», «Несмертная Клятва»,
//  «Мстительный», «Высшая Алчность» выдают расстройство скриптом «При выдаче»
//  (scriptOnGrant), но флаг добавлен на СТАРУЮ запись script с прежним id. У
//  актора, получившего Черту раньше, этот id уже в mechanicsApplied —
//  «Обновить мир» скрипт не запустит, расстройства нет.
//
//  ЧТО ДЕЛАЕТ. Однократно: у актора с одной из 4 Черт и без расстройства её
//  Пакта (по имени) зовёт тот же grantStartingDisorder с теми же числами, что
//  скрипт записи (сверка с паком — test/migrations/pact-disorder-grant.test.mjs).
//
//  ИДЕМПОТЕНТНА: расстройство уже на листе — ничего. Несвязанный токен с
//  основой в мире видит её расстройство и не трогается.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { grantStartingDisorder } from "../sheets/tabs/disorders.mjs";
import { unlinkedTokens } from "./unlinked-tokens.mjs";

export const PACT_DISORDERS = [
  { trait: "Dream Chaser", opts: { name: "Психопатия", severity: -1, severityMin: -1, incurable: true, pactScaled: true, label: "Гоняющийся за Мечтой" } },
  { trait: "Deathless Oath", opts: { name: "Сноб", severity: 0, severityMin: 0, incurable: true, pactScaled: true, label: "Несмертная Клятва" } },
  { trait: "Vengeful One", opts: { name: "Ненависть", severity: 0, severityMin: 0, incurable: true, pactScaled: true, label: "Мстительный" } },
  { trait: "Supreme Avarice", opts: { name: "Перфекционизм", severity: -2, severityMin: -2, incurable: true, pactScaled: false, label: "Высшая Алчность" } }
];

/** Что выдать: [{item: Черта, opts}]. Чистая функция по предметам актора. */
export function pactDisorderGrants(items) {
  const list = [...(items ?? [])];
  const out = [];
  for (const p of PACT_DISORDERS) {
    const item = list.find(i => i?.type === "trait" && itemHasName(i, p.trait));
    if (!item || list.some(i => i?.type === "mentalDisorder" && i.name === p.opts.name)) continue;
    out.push({ item, opts: p.opts });
  }
  return out;
}

async function migrateOneActor(actor) {
  let n = 0;
  for (const { item, opts } of pactDisorderGrants(actor.items)) {
    if ((await grantStartingDisorder(actor, item, opts)).ok) n++;
  }
  return n;
}

export async function migratePactDisorderGrant({ tokensOnly = false } = {}) {
  if (!game.user?.isGM) { ui.notifications?.warn("Расстройства Пактов: только для ГМа."); return; }
  let fixed = 0, failed = 0;
  const guarded = async (what, fn) => {
    try { fixed += await fn(); }
    catch (e) { failed++; console.error(`Warhammer DBC | Расстройства Пактов: сбой на «${what}», пропущено:`, e); }
  };
  if (!tokensOnly) {
    for (const actor of game.actors ?? []) await guarded(actor.name, () => migrateOneActor(actor));
  }
  for (const { scene, tokenDoc, actor } of unlinkedTokens()) {
    await guarded(`${tokenDoc.name} (${scene.name})`, () => migrateOneActor(actor));
  }
  const msg = failed
    ? `Расстройства Пактов выданы: ${fixed}; ${failed} пропущено из-за ошибок — повторится при следующей загрузке мира.`
    : `Расстройства Пактов выданы: ${fixed}.`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (fixed || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { fixed, failed };
}
