// module/apps/herd-spirits-summon.mjs — wdbc-xxb7
// ════════════════════════════════════════════════════════════════════════
//  Ритуал «Summon Herd Spirits / Призыв Духов Стада» (Шаман Зверолюдей,
//  DoomBC — Психокеры-Жабы, стр. 104): «за каждые 3 успеха можно вызвать
//  1 Минотавра, за 5 успехов — Тролля, а за 8 успехов — Великана... Один
//  шаман может провести лишь три таких ритуала — при проведении четвёртого
//  он должен отозвать предков одного из других ритуалов обратно в варп».
//
//  Распределение успехов по существам — выбор ГМа (книга «можно вызвать»,
//  не жёсткая формула), поэтому диалог, а не авто-максимизация. Спавн самого
//  Актора/Токена переиспользует spawnDemonOnScene (module/apps/demon-summon.mjs)
//  как есть — это уже общая «найти в Бестиарии по имени и разместить на
//  сцене» функция, специфики демонов в ней нет.
//
//  Бестиарий этой системы пока НЕ содержит статблоков Минотавра/Тролля/
//  Великана (стр. 104 отсылает «Для шаблонов смотрите Бестиарий» — это
//  отдельный пробел контента, не берётся с потолка здесь). spawnDemonOnScene
//  честно вернёт ok:false с причиной «не найден» — так же, как для любого
//  ещё не заведённого демона; сообщение уходит ГМу в чат.
// ════════════════════════════════════════════════════════════════════════

import { spawnDemonOnScene } from "./demon-summon.mjs";
import { WARP_GODS_MAP } from "../constants/veil.mjs";
import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

export const HERD_SPIRITS_RITUAL_NAME = "Summon Herd Spirits / Призыв Духов Стада";
export const MAX_HERD_BATCHES = 3;

/** Книжная таблица «успехи → существо» (стр. 104), от дорогого к дешёвому —
 * порядок только для отображения в диалоге, распределение решает ГМ. */
export const HERD_CREATURES = [
  { key: "giant",    cost: 8, name: "Giant / Великан" },
  { key: "troll",    cost: 5, name: "Troll / Тролль" },
  { key: "minotaur", cost: 3, name: "Minotaur / Минотавр" }
];
const HERD_CREATURE_MAP = Object.fromEntries(HERD_CREATURES.map(c => [c.key, c]));

/** Совпадает ли Ритуал (по имени) с «Призывом Духов Стада» — единственный
 * ритуал архетипа с этой бюджетной механикой, остальные Ритуалы бьются как
 * обычно (демон/Inf, см. module/apps/ritual-cast.mjs). */
export function isHerdSpiritsRitual(item) {
  return (item?.name || "") === HERD_SPIRITS_RITUAL_NAME;
}

/**
 * Кандидаты имени для поиска в Бестиарии — сперва вариант субрасы по Метке
 * бога (книга: «если у персонажа есть метка какого-либо бога, он может
 * вызвать существо с соответствующей субрасой»), затем обычное имя. Точных
 * названий субрас книга не даёт — если такая запись когда-нибудь появится в
 * Бестиарии под этим именем, она подхватится сама; сейчас, скорее всего,
 * найдётся только базовое имя (или не найдётся вовсе, см. шапку файла).
 */
export function herdCreatureNameCandidates(kind, patronGod) {
  const creature = HERD_CREATURE_MAP[kind];
  if (!creature) return [];
  const godLabel = patronGod && patronGod !== "undivided" ? WARP_GODS_MAP[patronGod]?.label : null;
  const names = [];
  if (godLabel) {
    const [en, ru] = creature.name.split(" / ");
    names.push(`${en} (${godLabel}) / ${ru} (${godLabel})`);
  }
  names.push(creature.name);
  return names;
}

/** Стоимость набора {minotaur,troll,giant} в успехах. */
export function herdAllocationCost(counts) {
  return HERD_CREATURES.reduce((sum, c) => sum + (Number(counts[c.key]) || 0) * c.cost, 0);
}

/** Активные партии («ритуала») духов стада на акторе — макс. 3 (см. шапку). */
export function getHerdSpiritsBatches(actor) {
  const arr = actor?.flags?.["warhammer-dbc"]?.herdSpiritsBatches;
  return Array.isArray(arr) ? arr : [];
}

async function setHerdSpiritsBatches(actor, batches) {
  await actor.setFlag("warhammer-dbc", "herdSpiritsBatches", batches);
}

/** Отзывает партию обратно в варп: удаляет Акторов (и их токены, если ещё на
 * сцене) и убирает запись из флага. Тихо пропускает уже удалённых вручную —
 * ГМ мог убрать токен/актора сам, отзыв всё равно должен снять запись. */
export async function recallHerdSpiritsBatch(actor, batchId) {
  const batches = getHerdSpiritsBatches(actor);
  const batch = batches.find(b => b.id === batchId);
  if (!batch) return { ok: false, reason: "Партия духов не найдена — уже отозвана?" };

  for (const creature of batch.creatures) {
    const doc = await fromUuid(creature.actorUuid).catch(() => null);
    if (doc) await doc.delete().catch(() => {});
  }
  await setHerdSpiritsBatches(actor, batches.filter(b => b.id !== batchId));
  return { ok: true, recalled: batch };
}

/** Добавляет новую партию (после спавна) — вызывающий код сам гарантирует,
 * что мест меньше MAX_HERD_BATCHES (см. showHerdSpiritsAllocationDialog). */
export async function addHerdSpiritsBatch(actor, creatures) {
  const batches = getHerdSpiritsBatches(actor);
  const batch = { id: foundry.utils.randomID(), createdAt: Date.now(), creatures };
  await setHerdSpiritsBatches(actor, [...batches, batch]);
  return batch;
}

function batchLabel(batch) {
  const names = batch.creatures.map(c => c.actorName || HERD_CREATURE_MAP[c.key]?.name || c.key);
  return `${new Date(batch.createdAt).toLocaleString()} — ${names.join(", ") || "(пусто)"}`;
}

/** Спавнит по счётчику каждого вида существ; возвращает {creatures, warnings}
 * — creatures готовы для addHerdSpiritsBatch, warnings — тексты «не найден»
 * для сводки в чат (частичный успех — не откат, книжный дух призыва: то, что
 * получилось создать, остаётся). */
async function spawnHerdAllocation(counts, patronGod, ritualistUuid) {
  const creatures = [];
  const warnings = [];
  for (const c of HERD_CREATURES) {
    const n = Math.max(0, Number(counts[c.key]) || 0);
    for (let i = 0; i < n; i++) {
      const candidates = herdCreatureNameCandidates(c.key, patronGod);
      let res = { ok: false };
      for (const name of candidates) {
        res = await spawnDemonOnScene(name, ritualistUuid);
        if (res.ok) break;
      }
      if (res.ok) creatures.push({ key: c.key, actorUuid: res.actorUuid || "", actorName: res.actorName });
      else warnings.push(`${c.name}: ${res.reason || "не удалось создать"}`);
    }
  }
  return { creatures, warnings };
}

/** Диалог распределения успехов на существ — GM-only (Бестиарий скрыт от
 * игрока, тот же принцип, что у демона в demon-summon.mjs). Открывается
 * кнопкой в карточке успешного проведения (см. ritual-cast.mjs/hooks.mjs). */
export async function showHerdSpiritsAllocationDialog(actor, successes, { ritualistUuid = "" } = {}) {
  if (!game.user?.isGM) {
    ui.notifications?.warn("Распределение Духов Стада — действие Мастера (Бестиарий скрыт от игроков).");
    return;
  }
  const batches = getHerdSpiritsBatches(actor);
  const atCap = batches.length >= MAX_HERD_BATCHES;

  const recallOptions = batches.map(b =>
    `<option value="${b.id}">${esc(batchLabel(b))}</option>`).join("");
  const recallBlock = batches.length ? `
    <div class="wv-rit-row">
      <label class="wv-rit-lbl" title="Один шаман держит не больше ${MAX_HERD_BATCHES} проведённых ритуалов Призыва Духов Стада разом">
        Отозвать существующую партию${atCap ? " (обязательно — лимит исчерпан)" : ""}
      </label>
      <select id="herd-recall">
        ${atCap ? "" : `<option value="">— не отзывать —</option>`}
        ${recallOptions}
      </select>
    </div>` : "";

  const rows = HERD_CREATURES.map(c => `
    <div class="wv-rit-row">
      <label class="wv-rit-lbl">${esc(c.name)} (${c.cost} усп.)</label>
      <input type="number" class="wv-rit-xs herd-count" data-key="${c.key}" data-cost="${c.cost}" value="0" min="0"/>
    </div>`).join("");

  const content = `
    <div class="wh-veil-app">
      <div class="wv-block">
        <div class="wv-block-title">Духи Стада — доступно успехов: ${successes}</div>
        ${rows}
        <div class="wv-rit-row"><span id="herd-remaining">Остаток: ${successes}</span></div>
      </div>
      ${recallBlock}
    </div>`;

  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: "Призыв Духов Стада — распределение" },
    classes: ["warhammer-dbc", "wh-holo"],
    content,
    rejectClose: false,
    buttons: [
      {
        action: "confirm", icon: "fas fa-hand-sparkles", label: "Призвать", default: true,
        callback: (event, button) => {
          const form = button.form;
          const counts = {};
          form.querySelectorAll(".herd-count").forEach(inp => {
            counts[inp.dataset.key] = Math.max(0, parseInt(inp.value) || 0);
          });
          const recallId = form.querySelector("#herd-recall")?.value || "";
          return { counts, recallId };
        }
      },
      { action: "cancel", label: "Отмена", callback: () => null }
    ],
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form") || dialog.element;
      const remainingEl = form.querySelector("#herd-remaining");
      const update = () => {
        const counts = {};
        form.querySelectorAll(".herd-count").forEach(inp => { counts[inp.dataset.key] = parseInt(inp.value) || 0; });
        const spent = herdAllocationCost(counts);
        remainingEl.textContent = `Остаток: ${successes - spent}${spent > successes ? " — превышен бюджет!" : ""}`;
      };
      form.addEventListener("input", update);
    }
  });
  if (!choice) return;

  const { counts, recallId } = choice;
  const spent = herdAllocationCost(counts);
  if (spent > successes) {
    ui.notifications?.error(`Призыв Духов Стада: потрачено ${spent} успехов из ${successes} доступных — отменено.`);
    return;
  }
  if (atCap && !recallId) {
    ui.notifications?.error("Призыв Духов Стада: лимит в 3 партии исчерпан — нужно выбрать, кого отозвать.");
    return;
  }
  if (recallId) await recallHerdSpiritsBatch(actor, recallId);

  if (!spent) return; // отозвали, но новых не призвали — законный исход книги не требует.

  const { creatures, warnings } = await spawnHerdAllocation(counts, actor.system?.patronGod || "", ritualistUuid);
  if (creatures.length) await addHerdSpiritsBatch(actor, creatures);

  const summary = creatures.length
    ? `Призваны: ${creatures.map(c => esc(c.actorName)).join(", ")}.`
    : "Никого не удалось призвать.";
  // Итог призыва, а не тест: сам бросок ритуала прошёл раньше и в своей
  // карточке. Публикация общая, разметка осталась своей — у корня нужен класс
  // `wh-ritual-card` (styles/ui/veil.css), а testCardHtml своего класса на
  // корне пока не принимает (см. отчёт по wdbc-kuun).
  await postTestCard(actor, `<div class="wh-roll-result wh-ritual-card">
      <div class="roll-header">Духи Стада — результат</div>
      <div class="roll-threshold">${summary}</div>
      ${warnings.length ? `<div class="roll-threshold" style="opacity:0.85;">${warnings.map(esc).join("<br>")}</div>` : ""}
    </div>`, { sound: false });
}
