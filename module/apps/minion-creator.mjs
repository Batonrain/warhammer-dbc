// module/apps/minion-creator.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Генератор Миньона (корбук стр. 111-113) — окно, собирающее слугу по шагам
//  книги, и рядом Обозреватель компендиумов, откуда в шаги перетаскивают
//  Таланты, Трейты и снаряжение.
//
//  Порядок как в книге: слот → Характеристики → Навыки → Таланты → Трейты →
//  Снаряжение. Каждый шаг знает свой бюджет и показывает остаток; перерасход
//  подсвечивается и попадает в сводку, но «Готово» не запирает: книга оставляет
//  ГМу право разрешить исключение.
//
//  Счёт целиком живёт в rules/minion-build.mjs — здесь только окно, дроп и
//  запись готового актора. Поэтому таблицы книги проверяются тестами без
//  Foundry, а это окно остаётся тонким.
// ════════════════════════════════════════════════════════════════════════════

import { MINION_GROUPS, MINION_TIERS, MINION_TIER_ORDER, MINION_SWAP,
         tierBudget } from "../constants/minions.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../constants/skills.mjs";
import { specOptions } from "../constants/skill-specializations.mjs";
import {
  minionSlots, slotUsage, charLimits, charIssues, charPointsLeft, rollHumanChars,
  skillPointsLeft, talentPointsLeft, traitPointsLeft,
  minionWounds, hordeMagnitude, minionInfamy, minionCorruption, minionLoyalty,
  availableTraits, traitAvailability, mandatoryTraits, traitEntry, skillRankFor
} from "../rules/minion-build.mjs";
import { openCompendiumBrowser } from "./compendium-browser.mjs";
import { minionsOfActor } from "../sheets/tabs/minions-panel.mjs";
import { esc } from "../helpers/utils.mjs";

/** Порядок Характеристик как на листе; Бесчестие и Порча раскидке не подлежат. */
const CHAR_KEYS = Object.keys(CHARACTERISTICS).filter(k => !["inf", "cor"].includes(k));

/** Пустое состояние сборки. */
function blankState(group, tier, talentId) {
  return {
    group, tier, talentId,
    chars: Object.fromEntries(CHAR_KEYS.map(k => [k, 0])),
    rolls: [],                                  // броски Человека, ещё не разложенные
    charAssign: {},                             // key характеристики → индекс броска в rolls
    armedVi: null,                              // взведённый (кликнутый) бросок, ждёт своей Характеристики
    skills: [],                                 // { key, upgraded }
    talents: [], traits: [], gear: [],          // { uuid, name, img, cost, tier, rarity }
    convert: { talentsToSkills: 0, traitsToTalents: 0, gearToTraits: 0 }
  };
}

// ── Выбор слота ─────────────────────────────────────────────────────────────

/**
 * Какой Талант отыгрываем. Свободен один — берём его молча; несколько — даём
 * выбрать: у Хозяина бывают куплены и «Орда», и «Низший» сразу (стр. 111).
 */
function pickSlot(freeSlots) {
  if (freeSlots.length === 1) return Promise.resolve(freeSlots[0]);

  const rows = freeSlots.map((s, i) =>
    `<option value="${i}">${esc(s.label || "Миньон не выбран")}</option>`).join("");

  return new Promise(resolve => {
    new Dialog({
      title: "Какого Миньона создаём",
      content: `
        <form class="wh-minion-slot">
          <p class="dyn-hint">Свободных Талантов «Миньон Хаоса»: ${freeSlots.length}.
             Выберите, по какому создаётся слуга — от этого зависят бюджеты и Редкость снаряжения.</p>
          <div class="atk-dlg-row">
            <label>Талант:</label>
            <select id="minion-slot-pick" class="pm-input pm-wide">${rows}</select>
          </div>
        </form>`,
      buttons: {
        ok: { label: "Дальше", callback: html => resolve(freeSlots[Number(html.find("#minion-slot-pick").val()) || 0]) },
        cancel: { label: "Отмена", callback: () => resolve(null) }
      },
      default: "ok",
      close: () => resolve(null)
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo"], width: 420 }).render(true);
  });
}

/**
 * Слот без выбранной пары: Талант куплен перетаскиванием, группу и силу тогда
 * не спрашивали. Спросим сейчас — без них считать нечего.
 */
function askGroupAndTier() {
  const groups = Object.entries(MINION_GROUPS)
    .map(([key, def]) => `<option value="${key}">${esc(def.label)}</option>`).join("");
  const tiers = MINION_TIER_ORDER
    .map(key => `<option value="${key}">${esc(MINION_TIERS[key].label)}</option>`).join("");

  return new Promise(resolve => {
    new Dialog({
      title: "Группа и сила Миньона",
      content: `
        <form class="wh-minion-slot">
          <p class="dyn-hint">У этого Таланта группа и сила не выбраны — укажите их сейчас.</p>
          <div class="atk-dlg-row"><label>Группа:</label><select id="mg" class="pm-input pm-wide">${groups}</select></div>
          <div class="atk-dlg-row"><label>Сила:</label><select id="mt" class="pm-input pm-wide">${tiers}</select></div>
        </form>`,
      buttons: {
        ok: { label: "Дальше", callback: html => resolve({
          group: String(html.find("#mg").val() || ""), tier: String(html.find("#mt").val() || "")
        }) },
        cancel: { label: "Отмена", callback: () => resolve(null) }
      },
      default: "ok",
      close: () => resolve(null)
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo"], width: 420 }).render(true);
  });
}

// ── Разметка шагов ──────────────────────────────────────────────────────────

const badge = (left, extra = "") =>
  `<span class="mc-badge ${left < 0 ? "over" : (left === 0 ? "exact" : "")}">${left}${extra}</span>`;

function charsStepHtml(state) {
  const budget = tierBudget(state.tier);
  const { cap, max, min } = charLimits(state.group, state.tier);
  const left = charPointsLeft(state.chars, state.group, state.tier);
  const issues = charIssues(state.chars, state.group, state.tier);
  const isHuman = state.group === "human";

  // У Человека поле Характеристики — не просто ввод: это слот, куда кликом
  // кладётся один из выпавших бросков (см. .mc-chip/.mc-char-slot в bind()).
  // Ручной ввод остаётся рядом — им же делают "раскидку +5/-5" после распределения.
  const assign = state.charAssign || {};
  const usedVis = new Set(Object.values(assign));

  const rows = CHAR_KEYS.map(key => {
    const clearBtn = isHuman && key in assign
      ? `<button type="button" class="mc-del mc-char-clear" data-key="${key}" title="Вернуть бросок в пул">✕</button>`
      : "";
    return `
    <label class="mc-char${isHuman ? " mc-char-slot" : ""}" data-key="${key}">
      <span>${esc(CHARACTERISTICS[key].label || key.toUpperCase())}</span>
      <span class="mc-char-input-row">
        <input type="number" class="mc-char-input" data-key="${key}" value="${state.chars[key] || 0}" min="0"/>
        ${clearBtn}
      </span>
    </label>`;
  }).join("");

  const chipsHtml = isHuman && state.rolls.length
    ? `<div class="mc-chips">${state.rolls.map((r, vi) => usedVis.has(vi) ? "" :
        `<button type="button" class="mc-chip${state.armedVi === vi ? " armed" : ""}" data-vi="${vi}">${r}</button>`
      ).join("")}</div>
       <div class="mc-hint">Нажмите на выпавшее число, затем — на Характеристику, чтобы поставить его на место.</div>`
    : "";

  const humanHead = isHuman
    ? `<div class="mc-line">
         Человек Характеристики не покупает, а бросает: ${budget.chars.roll.base}+2d10 ×
         ${budget.chars.roll.count}${budget.chars.roll.drop ? `, отбрасывая ${budget.chars.roll.drop} наименьших` : ""}.
         <button type="button" class="mc-btn" id="mc-roll">🎲 Бросить</button>
       </div>
       ${chipsHtml}`
    : `<div class="mc-line">Очков: <b>${budget.chars.points}</b>, осталось ${badge(left)} · в одну не больше ${cap}</div>`;

  const limits = [
    ...Object.entries(max).map(([k, v]) => `${k.toUpperCase()} не выше ${v}`),
    ...Object.entries(min).map(([k, v]) => `${k.toUpperCase()} не ниже ${v}`)
  ].join(", ");

  return `
    <section class="mc-step">
      <h3>1. Характеристики</h3>
      ${humanHead}
      ${limits ? `<div class="mc-hint">${esc(MINION_GROUPS[state.group]?.label || "")}: ${esc(limits)}.</div>` : ""}
      <div class="mc-chars">${rows}</div>
      <div class="mc-hint">После раскидки можно поднять одну на ${MINION_SWAP.step} за счёт другой — до ${MINION_SWAP.limit} раз.</div>
      ${issues.length ? `<div class="mc-issues">${issues.map(esc).join("<br/>")}</div>` : ""}
    </section>`;
}

/** Подпись Навыка в списке слуги: групповой — вместе со специализацией. */
function skillLabel(entry) {
  if (entry.scope === "group") {
    const group = GROUP_SKILLS_DEF[entry.key]?.label || entry.key;
    return entry.spec ? `${group} (${entry.spec})` : group;
  }
  return SKILLS_DEF[entry.key]?.label || entry.key;
}

function skillsStepHtml(state) {
  const spec = tierBudget(state.tier).skills;
  const res = skillPointsLeft(state.skills, state.tier, state.convert.talentsToSkills);

  // Навыки двух родов, как везде в системе: обычные и групповые. Групповой без
  // специализации не берётся — «Запретные знания» вообще не Навык, Навык это
  // «Запретные знания (Демоны)», — поэтому рядом с ним стоит своё поле.
  // Выбранное отмечаем в самой разметке: шаг перерисовывается целиком, и без
  // `selected` селект возвращался к первому Навыку — «Добавить» клало не то,
  // что выбрали.
  const picked = String(state.skillPick || `plain:${Object.keys(SKILLS_DEF)[0]}`);
  const opt = (value, label) =>
    `<option value="${value}"${value === picked ? " selected" : ""}>${esc(label)}</option>`;

  const plain = Object.entries(SKILLS_DEF)
    .map(([key, def]) => opt(`plain:${key}`, def.label)).join("");
  const groups = Object.entries(GROUP_SKILLS_DEF)
    .map(([key, def]) => opt(`group:${key}`, def.label)).join("");

  const [pickedScope, pickedKey] = picked.split(":");
  const specs = pickedScope === "group" ? specOptions(pickedKey) : [];
  const specHtml = pickedScope === "group"
    ? `<select id="mc-skill-spec" class="pm-input">
         ${specs.map(s => `<option value="${esc(s.ru || s.label)}">${esc(s.display)}</option>`).join("")}
         <option value="">— своя —</option>
       </select>
       <input type="text" id="mc-skill-spec-custom" class="pm-input" placeholder="Своя специализация"/>`
    : "";

  const rows = state.skills.map((s, i) => `
    <div class="mc-row">
      <span class="mc-row-name">${esc(skillLabel(s))} +${s.upgraded ? spec.upTo : spec.at}</span>
      <label class="mc-up"><input type="checkbox" class="mc-skill-up" data-index="${i}" ${s.upgraded ? "checked" : ""}/>
        до +${spec.upTo} (${spec.upCost})</label>
      <button type="button" class="mc-del" data-kind="skills" data-index="${i}" title="Убрать">✕</button>
    </div>`).join("") || `<div class="mc-hint">Навыков пока нет.</div>`;

  return `
    <section class="mc-step">
      <h3>2. Навыки</h3>
      <div class="mc-line">Очков: <b>${spec.points}</b>${state.convert.talentsToSkills ? ` + ${state.convert.talentsToSkills} с Талантов` : ""},
        осталось ${badge(res.left)} · берётся сразу на +${spec.at}, подъём до +${spec.upTo} стоит ${spec.upCost}
        (подъёмов ${res.ups} из ${res.upLimit})</div>
      <div class="mc-add">
        <select id="mc-skill-sel" class="pm-input">
          <optgroup label="Навыки">${plain}</optgroup>
          <optgroup label="Групповые навыки">${groups}</optgroup>
        </select>
        ${specHtml}
        <button type="button" class="mc-btn" id="mc-skill-add">Добавить</button>
      </div>
      <div class="mc-rows">${rows}</div>
      ${res.ups > res.upLimit ? `<div class="mc-issues">Подъёмов больше, чем даёт уровень: ${res.ups} из ${res.upLimit}.</div>` : ""}
    </section>`;
}

function dropStepHtml(state, kind, title, num) {
  const spec = tierBudget(state.tier);
  const list = state[kind];
  const rows = list.map((it, i) => `
    <div class="mc-row${it.warn ? " mc-row-warn" : ""}"${it.warn ? ` title="${esc(it.warn)}"` : ""}>
      <img class="mc-row-img" src="${esc(it.img || "icons/svg/item-bag.svg")}" alt=""/>
      <span class="mc-row-name">${esc(it.name)}${it.rating ? ` <span class="mc-row-meta">Рейтинг ${esc(String(it.rating))}</span>` : ""}</span>
      ${kind === "gear"
        ? `<span class="mc-row-meta">R${it.rarity ?? "?"}</span>`
        : `<label class="mc-cost">цена <input type="number" class="mc-cost-input" data-kind="${kind}" data-index="${i}" value="${it.cost ?? 1}"/></label>`}
      <button type="button" class="mc-del" data-kind="${kind}" data-index="${i}" title="Убрать">✕</button>
    </div>`).join("") || `<div class="mc-hint">Пусто — перетащите сюда из Обозревателя компендиумов.</div>`;

  let head = "";
  if (kind === "talents") {
    const res = talentPointsLeft(list, state.tier,
      { toSkills: state.convert.talentsToSkills, fromTraits: state.convert.traitsToTalents });
    head = `<div class="mc-line">Очков: <b>${spec.talents.points}</b>, осталось ${badge(res.left)}
        ${res.maxTier ? `· не выше ${res.maxTier} уровня` : "· без потолка уровня"}</div>
      ${res.overTier.length ? `<div class="mc-issues">Выше потолка уровня: ${esc(res.overTier.join(", "))}.</div>` : ""}
      <div class="mc-line mc-convert">
        <label>Талантов → Навыки: <input type="number" class="mc-conv" data-key="talentsToSkills" value="${state.convert.talentsToSkills}" min="0"/></label>
        <span class="mc-hint">Обмен идёт только в эту сторону.</span>
      </div>`;
  } else if (kind === "traits") {
    const left = traitPointsLeft(list, state.tier,
      { toTalents: state.convert.traitsToTalents, fromGear: state.convert.gearToTraits });
    // Таблица книги (стр. 112) сама говорит, что этой паре доступно и почём —
    // список выбирается отсюда, а не набирается перетаскиванием вслепую.
    const options = availableTraits(state.group, state.tier).map(t => `
      <option value="${esc(t.name)}">${esc(t.name)} — ${t.cost} оч.${t.rating ? `, Рейтинг ${esc(String(t.rating))}` : ""}${t.complex ? " (комплексный)" : ""}${t.mandatory ? " (обязателен)" : ""}</option>`).join("");
    const missing = mandatoryTraits(state.group)
      .filter(name => !list.some(it => String(it.name).includes(name)));

    head = `<div class="mc-line">Очков: <b>${spec.traits.points}</b>, осталось ${badge(left)}
        · рейтинг выше базового — за очко</div>
      <div class="mc-add">
        <select id="mc-trait-sel" class="pm-input">${options}</select>
        <button type="button" class="mc-btn" id="mc-trait-add">Добавить</button>
      </div>
      ${missing.length ? `<div class="mc-issues">Обязателен для этой группы: ${esc(missing.join(", "))}.</div>` : ""}
      <div class="mc-line mc-convert">
        <label>Трейтов → Таланты: <input type="number" class="mc-conv" data-key="traitsToTalents" value="${state.convert.traitsToTalents}" min="0"/></label>
        ${["beast", "daemon"].includes(state.group)
          ? `<label>За отданное снаряжение: <input type="number" class="mc-conv" data-key="gearToTraits" value="${state.convert.gearToTraits}" min="0"/></label>`
          : ""}
      </div>`;
  } else {
    const g = spec.gear;
    head = `<div class="mc-line">Броня Редкости ${g.armourRarity} или ниже и ${g.items} предмет(а) Редкости ${g.itemRarity} или ниже
        · взято ${list.length}</div>
      <div class="mc-hint">Можно отказаться от одного предмета ради вещи на Редкость выше или трёх улучшений не выше Редкости 2.</div>`;
  }

  return `
    <section class="mc-step">
      <h3>${num}. ${esc(title)}</h3>
      ${head}
      <div class="mc-drop" data-kind="${kind}">${rows}</div>
    </section>`;
}

function creatorHtml(state, master) {
  const groupDef = MINION_GROUPS[state.group];
  const tierDef  = MINION_TIERS[state.tier];
  const woundsOrMagnitude = tierDef?.isHorde
    ? `Магнитуда <b>${hordeMagnitude(master)}</b> (Ран у Орды нет)`
    : `Раны <b>${minionWounds({ toughness: state.chars.t, tier: state.tier })}</b>`;

  return `
    <form class="wh-minion-creator">
      <div class="mc-head">
        <div><b>${esc(groupDef?.label || "?")}</b> · ${esc(tierDef?.label || "?")} ·
             Хозяин: ${esc(master?.name || "?")}</div>
        <div class="mc-derived">
          ${woundsOrMagnitude} ·
          Лояльность <b>${minionLoyalty(master, state.group)}</b> (${esc(groupDef?.masterChar?.toUpperCase() || "")}) ·
          Бесчестие <b>${minionInfamy(master, state.tier)}</b> ·
          Порча <b>${minionCorruption(state.group)}</b>
        </div>
        <button type="button" class="mc-btn" id="mc-browser">📚 Обозреватель компендиумов</button>
      </div>
      ${charsStepHtml(state)}
      ${skillsStepHtml(state)}
      ${dropStepHtml(state, "talents", "Таланты", 3)}
      ${dropStepHtml(state, "traits", "Трейты", 4)}
      ${dropStepHtml(state, "gear", "Снаряжение", 5)}
    </form>`;
}

// ── Окно ────────────────────────────────────────────────────────────────────

/**
 * Трейт компендиума по имени из таблицы книги. Имена там двуязычные («Bite /
 * Укус (X)»), а ключ таблицы — английская часть, поэтому ищем вхождение.
 */
async function findTraitInPack(name) {
  const pack = game.packs?.get("warhammer-dbc.traits");
  if (!pack) return null;
  // Совпадения по вхождению мало: «Daemonic» находит «Daemonic Armament»
  // первым. Поэтому имя документа разбираем той же таблицей и сверяем ключи —
  // у «Daemonic Armament» ключ свой, и коротким именем он больше не ловится.
  const entry = [...pack.index].find(i => traitEntry(i.name)?.key === name)
             ?? [...pack.index].find(i => String(i.name).startsWith(`${name} /`));
  return entry ? pack.getDocument(entry._id).catch(() => null) : null;
}

/** Что за предмет уронили в шаг: имя, картинка, цена/Редкость и уровень. */
async function resolveDrop(uuid) {
  const doc = await fromUuid(uuid).catch(() => null);
  if (!doc) return null;
  return {
    uuid, name: doc.name, img: doc.img,
    docType: doc.type,
    tier: Number(doc.system?.tier) || 0,
    rarity: Number(doc.system?.rarity) || 0,
    cost: 1
  };
}

/** Какие типы предметов принимает шаг. */
const DROP_TYPES = {
  talents: ["talent", "psychicPower", "techPower"],
  traits:  ["trait", "mutation"],
  gear:    ["weapon", "armor", "gear", "tool", "drug", "ammo", "cybernetic", "implant", "forcefield", "shield"]
};

/**
 * Навыки слуги в поля листа. Обычные — записью на ключ, групповые — списком
 * записей со специализацией: «Запретные знания» сами по себе не Навык, Навык —
 * «Запретные знания (Демоны)».
 */
function minionSkillFields(state) {
  const skills = {};
  const groupSkills = {};

  for (const entry of state.skills) {
    const rank = skillRankFor(state.tier, entry.upgraded);
    if (entry.scope === "group") {
      (groupSkills[entry.key] ||= []).push({ rank, specialty: entry.spec || "", cost: 0, total: 0 });
    } else {
      skills[entry.key] = { rank, total: 0 };
    }
  }

  const out = {};
  if (Object.keys(skills).length)      out.skills = skills;
  if (Object.keys(groupSkills).length) out.groupSkills = groupSkills;
  return out;
}

/** Собрать актора-Миньона по состоянию окна. */
async function createMinionActor(master, state) {
  const tierDef = MINION_TIERS[state.tier];
  const loyalty = minionLoyalty(master, state.group);

  // Пишем в `base`: `total` схема считает сама из базы, надбавок и эффектов —
  // записанное туда значение затёрлось бы первым же пересчётом листа.
  // Бесчестие в системе — Характеристика `inf`, отдельного поля у него нет.
  const chars = Object.fromEntries(CHAR_KEYS.map(k => [k, { base: Number(state.chars[k]) || 0 }]));
  chars.inf = { base: minionInfamy(master, state.tier) };

  const system = {
    minionType: state.group,
    minionTier: state.tier,
    masterUuid: master.uuid,
    slotTalentId: state.talentId || "",
    characteristics: chars,
    loyalty: { value: loyalty, max: loyalty },
    corruption: { value: minionCorruption(state.group) },
    ...minionSkillFields(state)
  };

  if (tierDef?.isHorde) {
    const magnitude = hordeMagnitude(master);
    system.magnitude = { value: magnitude, max: magnitude };
  } else {
    const wounds = minionWounds({
      toughness: state.chars.t, tier: state.tier,
      traits: state.traits.map(t => t.name)
    });
    system.wounds = { value: wounds, max: wounds };
  }

  const actor = await Actor.create({
    name: `Миньон (${MINION_GROUPS[state.group]?.label || "?"})`,
    type: "minion",
    system
  });
  if (!actor) return null;

  // Предметы шагов кладём как есть: Талант, Трейт и снаряжение работают на
  // листе слуги так же, как на любом другом.
  const docs = [];
  for (const entry of [...state.talents, ...state.traits, ...state.gear]) {
    const doc = await fromUuid(entry.uuid).catch(() => null);
    if (doc) docs.push(doc.toObject());
  }
  if (docs.length) await actor.createEmbeddedDocuments("Item", docs);

  await actor.sheet?.render(true);
  return actor;
}

/** Само окно генератора. */
function openCreator(master, state) {
  const dlg = new Dialog({
    title: `Создание Миньона: ${MINION_GROUPS[state.group]?.label || ""}, ${MINION_TIERS[state.tier]?.label || ""}`,
    content: creatorHtml(state, master),
    buttons: {
      ok: {
        label: "Готово",
        // Перерасход не запирает кнопку: книга оставляет ГМу право разрешить
        // исключение, а окно уже показало, где именно вышли за бюджет.
        callback: () => createMinionActor(master, state)
      },
      cancel: { label: "Отмена" }
    },
    default: "ok"
  }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-minion-creator-dialog"], width: 720, height: 720 });

  // Перерисовка: состояние живёт в замыкании, разметка собирается заново, и
  // обработчики вешаются на свежие узлы — так шаги не расходятся со счётчиками.
  const rebuild = () => {
    const root = dlg.element?.[0] ?? dlg.element;
    const box = root?.querySelector(".dialog-content");
    if (!box) return;
    box.innerHTML = creatorHtml(state, master);
    bind(box);
  };

  function bind(box) {
    box.querySelector("#mc-browser")?.addEventListener("click", ev => {
      ev.preventDefault();
      openCompendiumBrowser(false);
    });

    box.querySelector("#mc-roll")?.addEventListener("click", async ev => {
      ev.preventDefault();
      // Кубы бросаются асинхронно: синхронный evaluateSync на «2d10» в Foundry
      // не работает («terms that cannot be synchronously evaluated»), и
      // обработчик молча падал. Бросаем нужное число заранее, а расчёт (какие
      // результаты отбросить) остаётся синхронным и проверяемым.
      const spec = tierBudget(state.tier)?.chars?.roll;
      if (!spec) return;
      const values = [];
      for (let i = 0; i < spec.count; i++) values.push((await new Roll("2d10").evaluate()).total);
      let n = 0;
      state.rolls = rollHumanChars(state.tier, () => values[n++]);
      state.charAssign = {};
      state.armedVi = null;
      state.chars = Object.fromEntries(CHAR_KEYS.map(k => [k, 0]));
      rebuild();
    });

    // Клик по выпавшему числу — «взводим» его; повторный клик по тому же снимает взвод.
    box.querySelectorAll(".mc-chip").forEach(chip => chip.addEventListener("click", ev => {
      ev.preventDefault();
      const vi = Number(ev.currentTarget.dataset.vi);
      state.armedVi = state.armedVi === vi ? null : vi;
      rebuild();
    }));

    // Клик по Характеристике при взведённом броске — раскладка, как на Этапе 2
    // обычного персонажа. Если бросок уже стоял в другом слоте — снимаем его оттуда.
    box.querySelectorAll(".mc-char-slot").forEach(slot => slot.addEventListener("click", ev => {
      if (ev.target.closest(".mc-char-clear")) return;
      if (state.armedVi === null) return;
      ev.preventDefault();
      const key = slot.dataset.key;
      const vi = state.armedVi;
      for (const k of Object.keys(state.charAssign)) {
        if (state.charAssign[k] === vi) delete state.charAssign[k];
      }
      state.charAssign[key] = vi;
      state.chars[key] = state.rolls[vi];
      state.armedVi = null;
      rebuild();
    }));

    box.querySelectorAll(".mc-char-clear").forEach(btn => btn.addEventListener("click", ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const key = ev.currentTarget.dataset.key;
      delete state.charAssign[key];
      state.chars[key] = 0;
      rebuild();
    }));

    box.querySelectorAll(".mc-char-input").forEach(input => input.addEventListener("change", ev => {
      const key = ev.currentTarget.dataset.key;
      delete state.charAssign[key];
      state.chars[key] = Number(ev.currentTarget.value) || 0;
      rebuild();
    }));

    // Смена Навыка перерисовывает шаг: у группового рядом появляется поле
    // специализации, у обычного его быть не должно.
    box.querySelector("#mc-skill-sel")?.addEventListener("change", ev => {
      state.skillPick = String(ev.currentTarget.value || "");
      rebuild();
    });

    box.querySelector("#mc-skill-add")?.addEventListener("click", ev => {
      ev.preventDefault();
      const picked = String(box.querySelector("#mc-skill-sel")?.value || "");
      const [scope, key] = picked.split(":");
      if (!key) return;

      if (scope === "group") {
        const chosen = String(box.querySelector("#mc-skill-spec")?.value || "");
        const custom = String(box.querySelector("#mc-skill-spec-custom")?.value || "").trim();
        const spec = custom || chosen;
        if (!spec) {
          return ui.notifications?.warn("Групповой Навык берётся со специализацией — выберите её или впишите свою.");
        }
        if (state.skills.some(s => s.scope === "group" && s.key === key && s.spec === spec)) return;
        state.skills.push({ scope: "group", key, spec, upgraded: false });
      } else {
        if (state.skills.some(s => s.scope !== "group" && s.key === key)) return;
        state.skills.push({ scope: "plain", key, upgraded: false });
      }
      rebuild();
    });

    // Трейт из таблицы книги: предмет ищем в компендиуме по имени, чтобы у
    // слуги оказался настоящий Трейт с описанием и эффектами, а не строка.
    box.querySelector("#mc-trait-add")?.addEventListener("click", async ev => {
      ev.preventDefault();
      const name = String(box.querySelector("#mc-trait-sel")?.value || "");
      if (!name) return;
      const spec = traitAvailability(name, state.group, state.tier);
      const doc = await findTraitInPack(name);
      state.traits.push({
        uuid: doc?.uuid || "", name: doc?.name || name, img: doc?.img,
        cost: spec.cost ?? 1, rating: spec.rating ?? null,
        warn: doc ? "" : "Трейта нет в компендиуме — запишется только в список"
      });
      rebuild();
    });

    box.querySelectorAll(".mc-skill-up").forEach(input => input.addEventListener("change", ev => {
      const i = Number(ev.currentTarget.dataset.index);
      if (state.skills[i]) state.skills[i].upgraded = ev.currentTarget.checked;
      rebuild();
    }));

    box.querySelectorAll(".mc-cost-input").forEach(input => input.addEventListener("change", ev => {
      const { kind, index } = ev.currentTarget.dataset;
      const entry = state[kind]?.[Number(index)];
      if (entry) entry.cost = Number(ev.currentTarget.value) || 0;
      rebuild();
    }));

    box.querySelectorAll(".mc-conv").forEach(input => input.addEventListener("change", ev => {
      state.convert[ev.currentTarget.dataset.key] = Math.max(0, Number(ev.currentTarget.value) || 0);
      rebuild();
    }));

    box.querySelectorAll(".mc-del").forEach(btn => btn.addEventListener("click", ev => {
      ev.preventDefault();
      const { kind, index } = ev.currentTarget.dataset;
      state[kind]?.splice(Number(index), 1);
      rebuild();
    }));

    // Дроп из Обозревателя: тот же payload, что он кладёт наружу (type, uuid).
    box.querySelectorAll(".mc-drop").forEach(zone => {
      zone.addEventListener("dragover", ev => { ev.preventDefault(); zone.classList.add("mc-drop-over"); });
      zone.addEventListener("dragleave", () => zone.classList.remove("mc-drop-over"));
      zone.addEventListener("drop", async ev => {
        ev.preventDefault();
        zone.classList.remove("mc-drop-over");
        let data = null;
        try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { return; }
        if (!data?.uuid) return;
        const kind = zone.dataset.kind;
        const entry = await resolveDrop(data.uuid);
        if (!entry) return ui.notifications?.warn("Предмет не найден — возможно, компендиум изменился.");
        if (!DROP_TYPES[kind].includes(entry.docType)) {
          return ui.notifications?.warn(
            `Сюда идут ${kind === "talents" ? "Таланты, психосилы и Техночудеса"
              : kind === "traits" ? "Трейты и мутации" : "снаряжение"}, а перетащено: ${entry.docType}.`);
        }
        // Трейт сверяем с таблицей книги: цена и базовый Рейтинг подставляются
        // сами, а недоступный этой паре не отвергается, но помечается — решает
        // ГМ, а не окно.
        if (kind === "traits") {
          const spec = traitAvailability(entry.name, state.group, state.tier);
          entry.cost = spec.cost ?? 1;
          entry.rating = spec.rating ?? null;
          entry.warn = spec.allowed ? "" : (spec.reason || "");
          if (!spec.allowed) ui.notifications?.warn(`${entry.name}: ${spec.reason}.`);
        }
        state[kind].push(entry);
        rebuild();
      });
    });
  }

  dlg.render(true);
  // Разметка появляется после рендера — обработчики вешаем следом.
  setTimeout(() => {
    const root = dlg.element?.[0] ?? dlg.element;
    const box = root?.querySelector(".dialog-content");
    if (box) bind(box);
  }, 60);
  return dlg;
}

/**
 * Действие «+» в блоке МИНЬОНЫ: выбрать свободный Талант и открыть генератор.
 * Зовётся с листа Хозяина (Персонаж, Демон, Принц Демонов).
 */
export async function onMinionCreate(event) {
  event?.preventDefault?.();
  const actor = this.actor;
  const items = [...(actor.items ?? [])];
  const slots = minionSlots(items);
  if (!slots.length) {
    return ui.notifications?.warn("Миньон даётся Талантом «Миньон Хаоса» — купите его на вкладке «Развитие».");
  }

  const minions = minionsOfActor(actor, [...(game.actors ?? [])]);
  const { free } = slotUsage(items, minions);
  if (!free.length) {
    return ui.notifications?.info("Все купленные Таланты уже отыграны — свободных Миньонов нет.");
  }

  const slot = await pickSlot(free.map(s => ({
    ...s,
    label: s.group && s.tier
      ? `${MINION_GROUPS[s.group]?.label || s.group}, ${MINION_TIERS[s.tier]?.label || s.tier}`
      : "Миньон не выбран"
  })));
  if (!slot) return;

  let { group, tier } = slot;
  if (!group || !tier) {
    const asked = await askGroupAndTier();
    if (!asked?.group || !asked?.tier) return;
    ({ group, tier } = asked);
  }

  return openCreator(actor, blankState(group, tier, slot.talentId));
}
