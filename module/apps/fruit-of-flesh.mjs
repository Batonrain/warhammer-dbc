// module/apps/fruit-of-flesh.mjs
// ════════════════════════════════════════════════════════════════════════
//  Foundry-обвязка Fruit of Flesh/Плод Плоти (wdbc-1rno) — арифметика в
//  module/rules/fruit-of-flesh.mjs, сама субмутация — module/rules/
//  submutations.mjs. Кнопки — записи kind:"script" Конструктора на самом
//  предмете (scriptThrottleUnit:"day" держит framework-гейт «раз в сутки»,
//  здесь дублировать его не нужно).
//
//  Группа A (0/4-5/7) — см. шапку rules/fruit-of-flesh.mjs про то, что
//  реализовано и что нет. Группы B/C — на очереди/оставлены честным текстом,
//  activateFruitOfFlesh() для их подписи субмутации только предупреждает.
// ════════════════════════════════════════════════════════════════════════

import { fruitKindByLabel, fruitHealWounds, fruitHealAmount, fruitMaturityRemaining,
         fruitFlameRating, fruitRadRating, fruitBlastRating } from "../rules/fruit-of-flesh.mjs";
import { tokensWithinRadius } from "../rules/aoe-target.mjs";
import { conditionRemoveFields } from "../sheets/tabs/conditions.mjs";
import { DIFFICULT_TERRAIN_TYPE } from "../regions/difficult-terrain.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { SECONDS_PER_DAY } from "../constants/imperial-calendar.mjs";

const MATURITY_FLAG    = "fruitOfFleshMaturesAt";
const CAPACITY_FLAG    = "fruitOfFleshCapacity";
const MATURITY_DAYS    = 3;
const WEAPONS_PACK      = "warhammer-dbc.weapons";
const INCENDIARY_NAME   = "Incendiary / Зажигательная";
const RAD_GRENADE_NAME  = "Rad / Рад";
const HAYWIRE_GRENADE_NAME = "Haywire Grenade / ЭМИ Граната";
const SMOKE_GRENADE_NAME   = "Smoke / Дымовая";
const STUN_GRENADE_NAME    = "Stun / Оглушающая";
const WEB_GRENADE_NAME     = "Web / Паутинная";
const STASIS_BOMB_NAME     = "Stasis Bomb / Стазис Бомба";
const FRAG_GRENADE_NAME    = "Frag / Фраг";

/** Клон предмета из компендиума weapons по точному имени — null, если не найден. */
async function cloneWeaponTemplate(name) {
  const pack = game.packs?.get(WEAPONS_PACK);
  const index = await pack?.getIndex();
  const hit = index?.find(e => e.name === name);
  const src = hit ? await pack.getDocument(hit._id) : null;
  if (!src) return null;
  const data = src.toObject();
  delete data._id;
  return data;
}

/**
 * Диалог самоотчёта одного числа — момент, который система не перехватывает
 * реактивно (непоглощённый урон/рейтинг только что состоявшегося ЭМИ или
 * Дыма). Возвращает 0, если отменено — вызывающая сторона не действует.
 */
async function promptNumberDialog({ title, fieldLabel, hint, min = 1, value = 1 }) {
  const content = `<div class="wh-attack-form">
    <div class="atk-dlg-row">
      <label>${fieldLabel}</label>
      <input type="number" id="fof-num" min="${min}" step="1" value="${value}"/>
    </div>
    <div class="sq-hint">${hint}</div>
  </div>`;
  return foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog"],
    content,
    rejectClose: false,
    buttons: [
      {
        action: "ok", label: "Втянуть", icon: "fas fa-heart", default: true,
        callback: (event, button) => Math.max(0, parseInt(button.form.querySelector("#fof-num").value) || 0)
      },
      { action: "cancel", label: "Отмена", callback: () => 0 }
    ]
  });
}

const promptUnabsorbedDamage = () => promptNumberDialog({
  title: "Плод Плоти: Плод Исцеления", fieldLabel: "Непоглощённый урон:",
  hint: "Число из уже проведённого броска — Плод Исцеления втягивает его вместо Ран."
});

const promptHaywireRadius = () => promptNumberDialog({
  title: "Плод Плоти: ЭМИ", fieldLabel: "Радиус только что подействовавшего ЭМИ-поля (м):",
  hint: "Момент попадания ЭМИ система не перехватывает реактивно — число из уже свершившегося броска."
});

const promptSmokeRadius = () => promptNumberDialog({
  title: "Плод Плоти: Дым", fieldLabel: "Радиус втягиваемого облака (м):",
  hint: "Облако подтверждено (персонаж внутри зоны Дыма) — радиус самого облака самоотчётом."
});

/** "0" Плод Исцеления — активация: самоотчёт непоглощённого урона, лечит его назад, плод созревает 3 дня. */
async function activateHealFruit(actor, item) {
  const amount = await promptUnabsorbedDamage();
  if (!amount) return;

  const newWounds = fruitHealWounds(actor.system, amount);
  await actor.update({ "system.wounds.value": newWounds });
  await item.setFlag("warhammer-dbc", CAPACITY_FLAG, amount);
  await item.setFlag("warhammer-dbc", MATURITY_FLAG, game.time.worldTime + MATURITY_DAYS * SECONDS_PER_DAY);

  await postTestCard(actor, {
    icon: rollIcon("heart", "#7fdc5f"),
    title: `Плод Плоти — ${esc(item.name)}`,
    lines: [
      `<div class="roll-threshold">Втянуто ${amount} непоглощённого урона — Раны: <b>${newWounds}</b> (+${amount}, эффект проигнорирован).</div>`,
      `<div class="roll-threshold">Плод созревает 3 дня — вместимость <b>${amount}</b> Ран.</div>`
    ]
  }, { sound: false });
}

/** "Съесть Плод" — доступно только созревшему Плоду Исцеления. */
export async function eatHealFruit(actor, item) {
  const label = item.system?.submutation?.label || "";
  if (fruitKindByLabel(label) !== "heal") {
    return ui.notifications?.warn("У этого Плода Плоти нет субмутации «Плод Исцеления» — есть нечего.");
  }
  const capacity  = Number(item.getFlag("warhammer-dbc", CAPACITY_FLAG)) || 0;
  const maturesAt = item.getFlag("warhammer-dbc", MATURITY_FLAG);
  if (!capacity || maturesAt == null) {
    return ui.notifications?.warn("Плод ещё не выращен — сначала втяните непоглощённый урон.");
  }
  const remaining = fruitMaturityRemaining(maturesAt, game.time.worldTime);
  if (remaining > 0) {
    return ui.notifications?.warn(`Плод ещё не созрел — осталось ${Math.ceil(remaining / SECONDS_PER_DAY)} суток.`);
  }

  const roll = await new Roll("2d10").evaluate();
  const heal = fruitHealAmount(roll.total, capacity);
  const newWounds = fruitHealWounds(actor.system, heal);
  await actor.update({ "system.wounds.value": newWounds });
  await item.unsetFlag("warhammer-dbc", CAPACITY_FLAG);
  await item.unsetFlag("warhammer-dbc", MATURITY_FLAG);

  await postTestCard(actor, {
    icon: rollIcon("heart", "#7fdc5f"),
    title: `Плод съеден — ${esc(item.name)}`,
    lines: [`<div class="roll-threshold">2d10 = ${roll.total}, вместимость ${capacity} → лечит <b>${heal}</b>. Раны: <b>${newWounds}</b>.</div>`]
  }, { rolls: [roll], sound: false });
}

/**
 * "1" ЭМИ — самоотчёт рейтинга (в системе Haywire — мгновенный бросок 1d10 по
 * таблице, module/combat/damage.mjs::_applyHaywire, без персистентного
 * состояния «в поле ЭМИ» — реактивный перехват тут нечем гейтить
 * автоматически, тот же честный предел, что у Плода Исцеления выше).
 * «Не действует на самого персонажа» — не отдельный код: обычный бросок
 * гранаты не задевает бросающего, если тот не в радиусе собственного взрыва.
 */
async function activateHaywireFruit(actor, item) {
  const rating = await promptHaywireRadius();
  if (!rating) return;

  const data = await cloneWeaponTemplate(HAYWIRE_GRENADE_NAME);
  if (!data) return ui.notifications?.warn(`Плод Плоти: шаблон «${HAYWIRE_GRENADE_NAME}» не найден в компендиуме оружия.`);
  data.name = `${HAYWIRE_GRENADE_NAME} (Плод Плоти)`;
  data.system.weaponProps = data.system.weaponProps.map(wp => wp.key === "haywire" ? { ...wp, rating } : wp);
  await actor.createEmbeddedDocuments("Item", [data]);

  await postTestCard(actor, {
    icon: rollIcon("bolt", "#8fd0ff"),
    title: `Плод Плоти — ${esc(item.name)}`,
    lines: [`<div class="roll-threshold">Зона ЭМИ втянута — ЭМИ-граната Haywire(${rating}) добавлена в инвентарь.</div>`]
  }, { sound: false });
}

/**
 * "2-3" Дым — персонаж должен реально стоять в зоне Дыма (свойство "smoke"
 * Трудного Ландшафта, regions/difficult-terrain.mjs — автоматическая
 * проверка, не самоотчёт); радиус облака — самоотчётом (геометрия Region-
 * фигур не читается напрямую, см. bd-комментарий находки). Облако убирается
 * целиком — регион удаляется. «Завесовая бомба» как отдельный предмет
 * компендиума не существует (проверено по всему packs-src/weapons) — граната
 * всегда обычная Дымовая, честно вместо книжной развилки «в зависимости от
 * природы дыма».
 */
async function activateSmokeFruit(actor, item, tokenDoc) {
  if (!tokenDoc?.parent) return ui.notifications?.warn("Плод Плоти: нет токена на сцене — проверить облако не с чего.");
  // Прямая читка behaviors (не через getTerrainInfoForToken.activeProps —
  // тот считает суммарный набор ВСЕХ свойств Ландшафта под токеном разом,
  // здесь нужны именно регионы Дыма, чтобы их потом удалить целиком).
  const smokeRegions = [...(tokenDoc.regions ?? [])]
    .filter(r => r.behaviors?.some(b => b.type === DIFFICULT_TERRAIN_TYPE && !b.disabled && b.system?.smoke));
  if (!smokeRegions.length) {
    return ui.notifications?.warn("Плод Плоти (Дым): персонаж не в зоне Дыма/тумана — нечего втягивать.");
  }

  const rating = await promptSmokeRadius();
  if (!rating) return;

  for (const region of smokeRegions) await region.delete();

  const data = await cloneWeaponTemplate(SMOKE_GRENADE_NAME);
  if (!data) return ui.notifications?.warn(`Плод Плоти: шаблон «${SMOKE_GRENADE_NAME}» не найден в компендиуме оружия.`);
  data.name = `${SMOKE_GRENADE_NAME} (Плод Плоти)`;
  data.system.weaponProps = data.system.weaponProps.map(wp => wp.key === "smoke" ? { ...wp, rating } : wp);
  await actor.createEmbeddedDocuments("Item", [data]);

  await postTestCard(actor, {
    icon: rollIcon("run", "#8fb0c4"),
    title: `Плод Плоти — ${esc(item.name)}`,
    lines: [
      `<div class="roll-threshold">Облако убрано целиком (${smokeRegions.length} зон снято) — Дымовая граната Smoke(${rating}) добавлена в инвентарь.</div>`
    ]
  }, { sound: false });
}

/**
 * "6" Оглушение/Беспомощность/Стазис (только slaanesh) — три РАЗНЫХ триггера,
 * каждый даёт свой фиксированный (не рейтинг-параметризуемый — книга не
 * просит X ни для одной из трёх) плод-гранату: Оглушён → Оглушающая, Беспомощен
 * → Паутинная, в Стазисе → Стазис-Бомба (module/constants/conditions.mjs,
 * новая запись). Если применимо несколько сразу — берётся первая по книжному
 * порядку (Оглушение/Беспомощность/Стазис), не все разом: находка описывает
 * ОДИН плод на срабатывание. «Не действует на Слаанешитов» — ЧЕСТНО не
 * автоматизировано: взрыв гранаты в этой системе не проходит через
 * механизм testMod-исключений (тот работает только для галочек диалога
 * теста, не для урона AoE) — ни у одной гранаты/AoE-эффекта в системе нет
 * общего примитива «не действует на покровительство X».
 */
async function activateStunFruit(actor, item) {
  const conds = actor.system?.conditions;
  const trigger = conds?.stunned ? { key: "stunned", name: STUN_GRENADE_NAME, noun: "Оглушение" }
    : conds?.helpless ? { key: "helpless", name: WEB_GRENADE_NAME, noun: "Беспомощность" }
    : conds?.stasis ? { key: "stasis", name: STASIS_BOMB_NAME, noun: "Стазис" }
    : null;
  if (!trigger) {
    return ui.notifications?.warn("Плод Плоти (Оглушение): персонаж не Оглушён, не Беспомощен и не в Стазисе — нечего втягивать.");
  }

  await actor.update(conditionRemoveFields(trigger.key));

  const data = await cloneWeaponTemplate(trigger.name);
  if (!data) return ui.notifications?.warn(`Плод Плоти: шаблон «${trigger.name}» не найден в компендиуме оружия.`);
  data.name = `${trigger.name} (Плод Плоти)`;
  await actor.createEmbeddedDocuments("Item", [data]);

  await postTestCard(actor, {
    icon: rollIcon("skull", "#ff6b6b"),
    title: `Плод Плоти — ${esc(item.name)}`,
    lines: [
      `<div class="roll-threshold">${trigger.noun} втянуто в плод — граната «${esc(trigger.name)}» добавлена в инвентарь.</div>`,
      `<div class="roll-threshold" style="opacity:.8;">Книга: «эффекты взрыва плода не действуют на персонажей с покровительством Слаанеш» — не автоматизировано, взрыв гранаты не проходит через механизм исключений по покровителю ни у одного оружия системы.</div>`
    ]
  }, { sound: false });
}

/**
 * "10" Осколки (только khorne) — рейтинг Calечащего РЕАЛЬНО хранится
 * (system.crippledWounds[].rating, module/combat/damage.mjs::_applyCrippling),
 * вопреки первоначальной (ошибочной) разведке этой находки — не архитектурный
 * пробел. Piercing считается как Crippling(3) книжной формулой (не по
 * рейтингу самого свойства — у piercing его нет, только счётчик мест
 * system.piercingWounds). Растворяет ВСЕ осколки/стрелы себе и радиусу
 * Cor.b м (не только самый мощный — «все застрявшие»), X для гранаты —
 * максимум среди всех снятых.
 */
function shardRatingsOf(actorSys) {
  const ratings = (actorSys?.crippledWounds ?? []).map(w => Number(w.rating) || 0);
  for (const v of Object.values(actorSys?.piercingWounds ?? {})) if (Number(v) > 0) ratings.push(3);
  return ratings;
}

async function activateShardFruit(actor, item, tokenDoc) {
  const corB = Number(actor.system?.characteristics?.cor?.bonus) || 0;
  const nearby = tokenDoc?.parent ? tokensWithinRadius(tokenDoc, corB, { includeSelf: false }) : [];
  const targets = [actor, ...nearby.map(t => t.actor).filter(Boolean)];

  const affected = [];
  const allRatings = [];
  for (const a of targets) {
    const ratings = shardRatingsOf(a.system);
    if (!ratings.length) continue;
    affected.push(a);
    allRatings.push(...ratings);
  }
  if (!allRatings.length) {
    return ui.notifications?.warn("Плод Плоти (Осколки): ни Калечащего, ни застрявших снарядов вокруг — нечего растворять.");
  }

  const rating = Math.max(...allRatings);
  for (const a of affected) {
    const piercingReset = Object.fromEntries(Object.keys(a.system.piercingWounds ?? {}).map(k => [`system.piercingWounds.${k}`, 0]));
    await a.update({ "system.crippledWounds": [], ...piercingReset });
  }

  const data = await cloneWeaponTemplate(FRAG_GRENADE_NAME);
  if (!data) return ui.notifications?.warn(`Плод Плоти: шаблон «${FRAG_GRENADE_NAME}» не найден в компендиуме оружия.`);
  data.name = `${FRAG_GRENADE_NAME} (Плод Плоти)`;
  data.system.weaponProps.push({ key: "tainted" }, { key: "crippling", rating });
  await actor.createEmbeddedDocuments("Item", [data]);

  await postTestCard(actor, {
    icon: rollIcon("blood", "#8b1a1a"),
    title: `Плод Плоти — ${esc(item.name)}`,
    lines: [
      `<div class="roll-threshold">Осколки/стрелы растворены: ${affected.map(a => esc(a.name)).join(", ")}.</div>`,
      `<div class="roll-threshold">Фраг-граната Tainted + Crippling(${rating}) добавлена в инвентарь.</div>`
    ]
  }, { sound: false });
}

/**
 * "9" Заточение Силы (только tzeentch) — половина книги, не архитектурно
 * блокированная (Одержимость/«Демонхост» — bd wdbc-q267, отдельная боевая
 * подсистема; «радиус поддержания» как общее понятие — bd wdbc-efyl,
 * подключить эту ветку туда, когда будет готово). Провал встречного теста
 * на W — самоотчёт-выбор игрока (не архитектурная дыра: тот же приём, что
 * Priest of Bloodshed/Плод Исцеления). Цель психосилы ищется тем же
 * cross-actor приёмом, что уже даёт rules/psychic-sustain-target.mjs
 * (isSustained && sustainedTargetUuid === actor.uuid). Замок хранится
 * ФЛАГОМ НА САМОЙ ПСИХОСИЛЕ (fruitOfFleshLockUuid → uuid Плода) — снятие
 * поддержания блокируется в module/sheets/tabs/psychic.mjs::.psy-sustain-cb,
 * ТЕМ ЖЕ местом, что уже блокирует Саркофаг Дредноута (строка выше).
 * Разблокировка — по УНИЧТОЖЕНИЮ плода (проверка "резолвится ли uuid" в
 * момент попытки развеять, не отдельный хук на удаление): удалённый предмет
 * не резолвится, и блок сам перестаёт срабатывать.
 */
async function activateSpellLockFruit(actor, item) {
  const power = (game.actors ?? []).flatMap(a => a.items?.contents ?? a.items ?? [])
    .find(it => it.type === "psychicPower" && it.system?.isSustained && it.system?.sustainedTargetUuid === actor.uuid);
  if (!power) {
    return ui.notifications?.warn("Плод Плоти (Заточение Силы): не найдено ни одной психосилы, поддерживаемой именно на этого персонажа — привяжите цель через таргетинг Foundry при касте.");
  }

  await power.setFlag("warhammer-dbc", "fruitOfFleshLockUuid", item.uuid);

  await postTestCard(actor, {
    icon: rollIcon("warp", "#ffe14d"),
    title: `Плод Плоти — ${esc(item.name)}`,
    lines: [
      `<div class="roll-threshold">Психосила «${esc(power.name)}» ${esc(power.actor?.name || "")} заточена в плоде — псайкер не может развеять её, пока плод не уничтожен.</div>`,
      `<div class="roll-threshold" style="opacity:.8;">«...или покинет радиус поддержания» — не автоматизировано (bd wdbc-efyl: в системе нет общего понятия «радиус поддержания» ни у одной психосилы).</div>`
    ]
  }, { sound: false });
}

/** "4-5" Пламя — тушит Горение себе и радиусу Cor.b м, создаёт Зажигательную гранату с Flame = максимум потушенного. */
async function activateFlameFruit(actor, item, tokenDoc) {
  const conds = actor.system?.conditions;
  if (!conds?.burning) return ui.notifications?.warn("Плод Плоти (Пламя): персонаж не Горит — нечего тушить.");

  // Себя тушит всегда; радиус — только если есть токен на сцене (нет
  // геометрии — не повод отказывать в тушении СЕБЯ, только соседей не найти).
  const corB = Number(actor.system?.characteristics?.cor?.bonus) || 0;
  const nearby = tokenDoc?.parent ? tokensWithinRadius(tokenDoc, corB, { includeSelf: false }) : [];
  const affected = [{ actor, damage: Number(conds.burningSourceDamage) || 0 }];
  for (const t of nearby) {
    const otherConds = t.actor?.system?.conditions;
    if (otherConds?.burning) affected.push({ actor: t.actor, damage: Number(otherConds.burningSourceDamage) || 0 });
  }

  const rating = fruitFlameRating(affected.map(a => a.damage));
  for (const { actor: a } of affected) await a.update(conditionRemoveFields("burning"));

  const data = await cloneWeaponTemplate(INCENDIARY_NAME);
  if (!data) return ui.notifications?.warn(`Плод Плоти: шаблон «${INCENDIARY_NAME}» не найден в компендиуме оружия.`);
  data.name = `${INCENDIARY_NAME} (Плод Плоти)`;
  for (const wp of data.system.weaponProps) if (wp.key === "flame") wp.rating = rating;
  await actor.createEmbeddedDocuments("Item", [data]);

  await postTestCard(actor, {
    icon: rollIcon("fire", "#ff8a3a"),
    title: `Плод Плоти — ${esc(item.name)}`,
    lines: [
      `<div class="roll-threshold">Погашено Горение: ${affected.map(a => esc(a.actor.name)).join(", ")}.</div>`,
      `<div class="roll-threshold">Зажигательная граната Flame(${rating}) добавлена в инвентарь.</div>`
    ]
  }, { sound: false });
}

/** "7" Яд и Радиация — снимает Отравление/Радиацию себе и радиусу, создаёт гранату Blast+Rad(+Toxic). */
async function activateToxicRadFruit(actor, item, tokenDoc) {
  const conds = actor.system?.conditions;
  if (!conds?.poisoned && !conds?.radiation) {
    return ui.notifications?.warn("Плод Плоти (Яд/Радиация): нет ни Отравления, ни Радиации — нечего втягивать.");
  }
  const corB = Number(actor.system?.characteristics?.cor?.bonus) || 0;
  const nearby = tokenDoc?.parent ? tokensWithinRadius(tokenDoc, corB, { includeSelf: false }) : [];
  const targets = [actor, ...nearby.map(t => t.actor).filter(Boolean)];

  let totalDose = 0, anyPoison = false;
  const names = [];
  for (const a of targets) {
    const c = a.system?.conditions;
    if (!c?.poisoned && !c?.radiation) continue;
    if (c.poisoned) anyPoison = true;
    if (c.radiation) totalDose += Number(c.radiationLevel) || 0;
    names.push(a.name);
    const update = {};
    if (c.poisoned) Object.assign(update, conditionRemoveFields("poisoned"));
    if (c.radiation) Object.assign(update, conditionRemoveFields("radiation"), { "system.conditions.radiationLevel": 0 });
    await a.update(update);
  }

  const radRating   = fruitRadRating(totalDose);
  const blastRating = Math.max(1, fruitBlastRating(corB));

  const data = await cloneWeaponTemplate(RAD_GRENADE_NAME);
  if (!data) return ui.notifications?.warn(`Плод Плоти: шаблон «${RAD_GRENADE_NAME}» не найден в компендиуме оружия.`);
  data.name = `${RAD_GRENADE_NAME} (Плод Плоти)`;
  data.system.weaponProps = data.system.weaponProps.map(wp => wp.key === "blast" ? { ...wp, rating: blastRating } : wp);
  if (radRating > 0) data.system.weaponProps = data.system.weaponProps.map(wp => wp.key === "rad" ? { ...wp, rating: radRating } : wp);
  if (anyPoison) data.system.weaponProps.push({ key: "toxic", rating: 1 });
  await actor.createEmbeddedDocuments("Item", [data]);

  await postTestCard(actor, {
    icon: rollIcon("warp", "#ffe14d"),
    title: `Плод Плоти — ${esc(item.name)}`,
    lines: [
      `<div class="roll-threshold">Снято с: ${names.map(esc).join(", ")}.</div>`,
      `<div class="roll-threshold">Граната Blast(${blastRating})${radRating ? ` Rad(${radRating})` : ""}${anyPoison ? " Toxic(1)" : ""} добавлена в инвентарь. Rad-рейтинг в этой системе не масштабирует эффект (нет testPerRating у "rad" — то же ограничение у штатной гранаты Rad компендиума), число только описательное.</div>`
    ]
  }, { sound: false });
}

/** Кнопка «Активировать» — диспетчер по выпавшей субмутации (item.system.submutation.label). */
/** Диалог выбора одного из до-трёх результатов «Тройной Плод» — какой активировать сейчас. */
async function promptMultiChoice(multi) {
  const opts = multi.map(e => `<option value="${esc(e.label)}">${esc(e.name)}</option>`).join("");
  const content = `<div class="wh-attack-form">
    <div class="atk-dlg-row">
      <label>Активировать:</label>
      <select id="fof-multi"><option value="">— выбрать —</option>${opts}</select>
    </div>
    <div class="sq-hint">Тройной Плод — три независимых результата, каждый применяется по отдельности.</div>
  </div>`;
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Плод Плоти: Тройной Плод" },
    classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog"],
    content,
    rejectClose: false,
    buttons: [
      {
        action: "ok", label: "Активировать", icon: "fas fa-heart", default: true,
        callback: (event, button) => {
          const label = String(button.form.querySelector("#fof-multi").value || "");
          return multi.find(e => e.label === label) || null;
        }
      },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
}

/** Диспетчер по конкретной подписи субмутации — общий для обычной строки и для выбора внутри Тройного Плода. */
async function dispatchByLabel(actor, item, label, tokenDoc) {
  const kind = fruitKindByLabel(label);
  if (kind === "heal") return activateHealFruit(actor, item);
  if (kind === "haywire") return activateHaywireFruit(actor, item);
  if (kind === "smoke") return activateSmokeFruit(actor, item, tokenDoc);
  if (kind === "stun") return activateStunFruit(actor, item);
  if (kind === "psychicLock") return activateSpellLockFruit(actor, item);
  if (kind === "shard") return activateShardFruit(actor, item, tokenDoc);
  if (kind === "flame") return activateFlameFruit(actor, item, tokenDoc);
  if (kind === "toxicRad") return activateToxicRadFruit(actor, item, tokenDoc);
  return ui.notifications?.warn(label
    ? `Плод Плоти: субмутация «${label}» пока не подключена кодом (wdbc-1rno, в разработке).`
    : "Плод Плоти: субмутация ещё не брошена — сначала бросьте субмутацию на предмете.");
}

/**
 * Кнопка «Активировать» — диспетчер по выпавшей субмутации. "11" Тройной
 * Плод (module/rules/submutations.mjs::multiRollResults, wdbc-1rno) хранит
 * до трёх доп. результатов в item.system.submutation.multi — игрок выбирает,
 * какой из них применить именно сейчас (каждый — по отдельности, книга не
 * даёт «применить все три одним кликом»); общий суточный лимит уже даёт
 * framework (ОДНА кнопка kind:"script" на весь предмет), досочинять не нужно.
 */
export async function activateFruitOfFlesh(actor, item, token) {
  if (!actor) return;
  // token — Token-плейсабл (Actor#getActiveTokens(false) в item-script.mjs),
  // радиус-хелперы (tokensWithinRadius/getTerrainInfoForToken) читают
  // TokenDocument — та же развилка, что уже явно делает код-запись Purity
  // of Battle (`token?.document ?? token`).
  const tokenDoc = token?.document ?? token;
  const multi = item.system?.submutation?.multi;
  if (Array.isArray(multi) && multi.length) {
    const chosen = await promptMultiChoice(multi);
    if (!chosen) return;
    return dispatchByLabel(actor, item, chosen.label, tokenDoc);
  }
  const label = item.system?.submutation?.label || "";
  return dispatchByLabel(actor, item, label, tokenDoc);
}
