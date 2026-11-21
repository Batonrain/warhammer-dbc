// module/rules/resource-pools.mjs
// ════════════════════════════════════════════════════════════════════════
//  ПУЛЫ РЕСУРСОВ ЭЛИТНЫХ АРХЕТИПОВ — ядро без Foundry.
//
//  Книга (корбук, «Элитные архетипы») трижды даёт один и тот же вид ресурса
//  у Пактов с демоном: Жажда Вампира, Очки Вдохновения Когитора, Очки Мести
//  Ревенанта. У всех трёх: есть максимум, растущий по Стадиям Пакта; есть
//  траты на способности; есть пополнение (кнопкой, в начале боя/сцены).
//  Раньше это жило текстом Черты: число держали в голове.
//
//  Пул описывается ДАННЫМИ — записью Конструктора kind:"resourcePool" на
//  Черте/Таланте. Записи с одним ключом складываются: Черта архетипа задаёт
//  пул (имя, базовый максимум, лимит траты в Раунд), а каждая Стадия Пакта
//  кладёт свою запись с тем же ключом и прибавкой («+3 к максимуму Жажды»).
//  Ничего не применяется при выдаче — это ЖИВОЙ запрос, как terrainIgnore:
//  пока Талант у актора, его прибавка считается; уйдёт — перестанет.
//
//  Поля записи (все строки — формулы Механики, rules/mech-formula.mjs):
//    resPoolKey        ключ пула ("thirst", "inspiration", "vengeance")
//    resPoolLabel      подпись на листе (берётся первая непустая)
//    resPoolMax        прибавка к максимуму; "∞" — пул без потолка
//                      (Отец Крови: «максимума нет», решение Сергея 21.11.2026)
//    resPoolRefill     когда пул сам наполняется до максимума:
//                      "" | "battle" | "scene" | "battleOrScene" | "session"
//    resPoolRoundCap   прибавка к лимиту траты за Раунд (0 у всех — без лимита)
//    resPoolGainLabel  подпись кнопки пополнения на листе (Испить кровь…)
//    resPoolGainAmount прибавка к тому, сколько даёт эта кнопка
//    resPoolAsInfamy   пул можно тратить как Очки Бесчестия
//    resPoolAsInfamyCap  прибавка к лимиту «как Бесчестие» за Раунд
//    resPoolAsInfamyCor  при такой трате Порча считается не выше N ("" — как есть)
//    resPoolAsInfamyNote ограничение текстом (для игрока; код его не проверяет)
//    resPoolBoostChars   Характеристики, тест которых можно поднять на +10 за 1 очко
//    resPoolFailChars    Характеристики, провал теста которых можно заменить
//                        Успехом с 1 Успехом за 1 очко
//    resPoolFailSkills   то же, но уже: ключи Навыков ("medicae") и особый
//                        тест "regeneration" — тест T Трейта Regeneration
//                        (Культивация Мейстера, Sahara 586-fe9d)
//
//  Хранение: текущее значение — system.resourcePools.<ключ> (число), счётчик
//  траты в этом Раунде — flags.warhammer-dbc.resourcePoolRound.<ключ> =
//  { combat:"<id боя>:<Раунд>", spent, asInfamy }. Вне боя Раундов нет — и
//  лимита нет, тот же принцип, что у экономики действий.
// ════════════════════════════════════════════════════════════════════════

import { mechFormulaTotalSafe, mechRollData } from "./mech-formula.mjs";

export const RESOURCE_POOL_KIND = "resourcePool";
/** Префикс цены в пуле ресурса у capabilityCostPool: "res:thirst". */
export const RESOURCE_COST_PREFIX = "res:";
export const RESOURCE_ROUND_FLAG = "resourcePoolRound";

const NS = "warhammer-dbc";

/**
 * Пулы книги — подписи для мест, где актора нет (выпадающий список цены в
 * Конструкторе, подпись в карточке). Сам пул всё равно задаёт запись на Черте.
 * `genitive` — «2 Очка <genitive>», `word` — «потратил 1 <word>».
 */
export const KNOWN_RESOURCE_POOLS = {
  // warpWoundsPerPoint — урон варп-оружия идёт в этот пул, пункт за N Ран
  // (Черта Жажда: «каждый пункт как 5 Ран», Sahara 583-5-t-10). Число книги
  // о самом ресурсе, а не о Стадии, — поэтому здесь, а не полем записи:
  // снимки Черты на акторах живых миров его не несут и миграция не нужна.
  thirst:      { label: "Жажда",            genitive: "Жажды",      unit: "Жажды", warpWoundsPerPoint: 5 },
  inspiration: { label: "Очки Вдохновения", genitive: "Вдохновения" },
  // asInfamyAttackOnly — «как трата Очка Бесчестия на атаку» (Мстительный Дух,
  // Sahara 583-d28a): из карточки не-атакующего теста пул не предлагается.
  vengeance:   { label: "Очки Мести",       genitive: "Мести", asInfamyAttackOnly: true }
};

export const RESOURCE_REFILL_UNITS = {
  "":            "вручную",
  battle:        "в начале боя",
  scene:         "с новой сценой",
  battleOrScene: "в начале боя и с новой сценой",
  session:       "в конце сессии"
};

/** Какие единицы пополнения срабатывают на событие ("battle" | "scene" | "session"). */
export function refillMatches(unit, event) {
  if (!unit) return false;
  if (unit === event) return true;
  if (unit === "battleOrScene") return event === "battle" || event === "scene";
  // Конец сессии — и конец сцены (apps/game-session.mjs::triggerSessionEnd).
  if (event === "session") return unit === "scene";
  return false;
}

/** Ключ пула из цены capabilityCostPool ("res:thirst" → "thirst"), иначе null. */
export function resourceKeyOfCost(pool) {
  const s = String(pool ?? "");
  return s.startsWith(RESOURCE_COST_PREFIX) ? s.slice(RESOURCE_COST_PREFIX.length) : null;
}

/** «1 Очко» / «2 Очка» / «5 Очков». */
export function pointsWord(n) {
  n = Math.abs(Number(n) || 0) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return "Очков";
  if (n1 === 1) return "Очко";
  if (n1 >= 2 && n1 <= 4) return "Очка";
  return "Очков";
}

/** «3 Жажды» / «1 Очко Мести» — подпись количества в пуле. */
export function resourceAmountLabel(key, amount, def = null) {
  const meta = def ?? KNOWN_RESOURCE_POOLS[key] ?? {};
  const n = Math.max(0, Number(amount) || 0);
  if (meta.unit) return `${n} ${meta.unit}`;
  return `${n} ${pointsWord(n)} ${meta.genitive || meta.label || key}`;
}

/** Все записи Механики предмета, включая вложенные подгруппы (кроме ветвей «ИЛИ»). */
function mechEntriesOf(item) {
  const out = [];
  const walk = (groups) => {
    for (const g of groups ?? []) {
      if (g?.operator === "OR") continue;
      for (const e of g?.entries ?? []) {
        if (e?.kind === "group" && e.group) walk([e.group]);
        else if (e) out.push(e);
      }
    }
  };
  const groups = item?.flags?.[NS]?.mechanics ?? item?.getFlag?.(NS, "mechanics");
  walk(Array.isArray(groups) ? groups : []);
  return out;
}

/** Значение resPoolMax «без потолка»: ∞ / inf / нет. */
export function isUnboundedPoolMax(v) {
  return /^\s*(∞|inf(inity)?|нет|без\s*потолка)\s*$/i.test(String(v ?? ""));
}

/** Подпись максимума пула для карточек и листа: число или ∞. */
export function resourcePoolMaxLabel(def) {
  return def?.unbounded ? "∞" : String(def?.max ?? 0);
}

const charList = s => String(s ?? "").split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(Boolean);

/**
 * Пулы актора: все записи kind:"resourcePool" его предметов, сложенные по
 * ключу. Пул без положительного максимума не показывается.
 * @returns {Map<string, object>}
 */
export function resourcePoolDefs(actor, { rollData = null } = {}) {
  const rd = rollData ?? mechRollData(actor);
  const num = f => mechFormulaTotalSafe(f, rd);
  const defs = new Map();
  for (const item of actor?.items ?? []) {
    for (const e of mechEntriesOf(item)) {
      if (e.kind !== RESOURCE_POOL_KIND) continue;
      const key = String(e.resPoolKey ?? "").trim();
      if (!key) continue;
      const known = KNOWN_RESOURCE_POOLS[key] ?? {};
      const d = defs.get(key) ?? {
        key, label: "", genitive: known.genitive ?? "", unit: known.unit ?? "",
        max: 0, unbounded: false, refill: "", roundCap: 0, gainLabel: "", gainAmount: 0,
        asInfamy: false, asInfamyCap: 0, asInfamyCor: null, asInfamyNote: "",
        boostChars: new Set(), failChars: new Set(), failSkills: new Set(), sources: [],
        warpWoundsPerPoint: Number(known.warpWoundsPerPoint) || 0,
        asInfamyAttackOnly: !!known.asInfamyAttackOnly
      };
      if (!d.label && e.resPoolLabel) d.label = String(e.resPoolLabel);
      if (isUnboundedPoolMax(e.resPoolMax)) d.unbounded = true;
      else d.max += num(e.resPoolMax);
      if (!d.refill && e.resPoolRefill) d.refill = String(e.resPoolRefill);
      d.roundCap += num(e.resPoolRoundCap);
      if (!d.gainLabel && e.resPoolGainLabel) d.gainLabel = String(e.resPoolGainLabel);
      d.gainAmount += num(e.resPoolGainAmount);
      if (e.resPoolAsInfamy) d.asInfamy = true;
      d.asInfamyCap += num(e.resPoolAsInfamyCap);
      if (e.resPoolAsInfamyCor !== "" && e.resPoolAsInfamyCor != null && d.asInfamyCor == null)
        d.asInfamyCor = num(e.resPoolAsInfamyCor);
      if (!d.asInfamyNote && e.resPoolAsInfamyNote) d.asInfamyNote = String(e.resPoolAsInfamyNote);
      for (const c of charList(e.resPoolBoostChars)) d.boostChars.add(c);
      for (const c of charList(e.resPoolFailChars)) d.failChars.add(c);
      for (const c of charList(e.resPoolFailSkills)) d.failSkills.add(c);
      d.sources.push(item.name);
      defs.set(key, d);
    }
  }
  for (const [key, d] of defs) {
    d.max = d.unbounded ? Infinity : Math.max(0, d.max);
    if (!d.label) d.label = KNOWN_RESOURCE_POOLS[key]?.label ?? key;
    if (!d.genitive) d.genitive = d.label;
    d.boostChars = [...d.boostChars];
    d.failChars = [...d.failChars];
    d.failSkills = [...d.failSkills];
    if (d.max <= 0) defs.delete(key);
  }
  return defs;
}

/** Определение одного пула или null. */
export function resourcePoolDef(actor, key, opts) {
  return resourcePoolDefs(actor, opts).get(key) ?? null;
}

/** Хранимое значение, без учёта максимума. */
function storedValue(actor, key) {
  return Math.max(0, Number(actor?.system?.resourcePools?.[key]) || 0);
}

/** Текущее значение пула, прижатое к максимуму. */
export function resourcePoolValue(actor, key, def = undefined) {
  const d = def === undefined ? resourcePoolDef(actor, key) : def;
  if (!d) return 0;
  return Math.min(d.max, storedValue(actor, key));
}

/** Ключ текущего Раунда боя или "" вне боя. */
export function roundKeyOf(combat) {
  if (!combat?.started || !combat?.id) return "";
  return `${combat.id}:${Number(combat.round) || 0}`;
}

/** Сколько потрачено в этом Раунде: { spent, asInfamy } (вне боя — нули). */
export function roundSpent(actor, key, roundKey) {
  if (!roundKey) return { spent: 0, asInfamy: 0 };
  const st = actor?.flags?.[NS]?.[RESOURCE_ROUND_FLAG]?.[key];
  if (!st || st.combat !== roundKey) return { spent: 0, asInfamy: 0 };
  return { spent: Math.max(0, Number(st.spent) || 0), asInfamy: Math.max(0, Number(st.asInfamy) || 0) };
}

/**
 * Можно ли потратить `amount` из пула. Гейт виден до клика: { ok, reason }.
 * `asInfamy` — трата вместо Очка Бесчестия (свой лимит за Раунд).
 * `ignoreRoundCap` — трата «вне лимита» (поддержание психосилы у Вампира).
 */
export function resourceSpendGate(actor, key, amount = 1, { asInfamy = false, roundKey = "", ignoreRoundCap = false, def } = {}) {
  const d = def === undefined ? resourcePoolDef(actor, key) : def;
  const need = Math.max(1, Number(amount) || 1);
  const label = KNOWN_RESOURCE_POOLS[key]?.label ?? key;
  if (!d) return { ok: false, reason: `Нет пула «${label}».` };
  const have = resourcePoolValue(actor, key, d);
  if (have < need)
    return { ok: false, reason: `Не хватает: нужно ${resourceAmountLabel(key, need, d)}, есть ${have}.` };
  if (asInfamy && !d.asInfamy) return { ok: false, reason: `«${d.label}» нельзя тратить как Очки Бесчестия.` };
  const used = roundSpent(actor, key, roundKey);
  if (!ignoreRoundCap && roundKey && d.roundCap > 0 && used.spent + need > d.roundCap)
    return { ok: false, reason: `Лимит ${resourceAmountLabel(key, d.roundCap, d)} за Раунд исчерпан (потрачено ${used.spent}).` };
  if (asInfamy && roundKey && d.asInfamyCap > 0 && used.asInfamy + need > d.asInfamyCap)
    return { ok: false, reason: `Как Очки Бесчестия — не больше ${d.asInfamyCap} за Раунд (потрачено ${used.asInfamy}).` };
  return { ok: true, reason: "", have, max: d.max };
}

/**
 * Обновление актора за трату: новое значение и счётчик Раунда.
 * Гейт не проверяет — сперва resourceSpendGate.
 */
export function resourceSpendUpdates(actor, key, amount = 1, { asInfamy = false, roundKey = "", def } = {}) {
  const d = def === undefined ? resourcePoolDef(actor, key) : def;
  const need = Math.max(1, Number(amount) || 1);
  const have = resourcePoolValue(actor, key, d);
  const upd = { [`system.resourcePools.${key}`]: Math.max(0, have - need) };
  if (roundKey) {
    const used = roundSpent(actor, key, roundKey);
    upd[`flags.${NS}.${RESOURCE_ROUND_FLAG}.${key}`] = {
      combat: roundKey, spent: used.spent + need, asInfamy: used.asInfamy + (asInfamy ? need : 0)
    };
  }
  return { update: upd, before: have, after: Math.max(0, have - need) };
}

/** Обновление за пополнение на `amount` (не выше максимума). */
export function resourceGainUpdates(actor, key, amount = 1, { def } = {}) {
  const d = def === undefined ? resourcePoolDef(actor, key) : def;
  if (!d) return null;
  const have = resourcePoolValue(actor, key, d);
  const after = Math.max(0, Math.min(d.max, have + (Number(amount) || 0)));
  return { update: { [`system.resourcePools.${key}`]: after }, before: have, after, max: d.max };
}

/**
 * Пополнение до максимума всех пулов, что наполняются на событие `event`
 * ("battle" | "scene" | "session"). Пусто — нечего менять.
 * @returns {{update: object, filled: {key:string, label:string, before:number, after:number}[]}}
 */
export function resourceRefillUpdates(actor, event) {
  const update = {};
  const filled = [];
  for (const d of resourcePoolDefs(actor).values()) {
    if (!refillMatches(d.refill, event)) continue;
    const before = resourcePoolValue(actor, d.key, d);
    if (d.unbounded || before >= d.max) continue;
    update[`system.resourcePools.${d.key}`] = d.max;
    filled.push({ key: d.key, label: d.label, before, after: d.max });
  }
  return { update, filled };
}

/**
 * Урон варп-оружия в пул (Жажда): каждый пункт гасит `perPoint` Ран, расход
 * округляется вверх; не хватило пула — остаток идёт дальше, в Раны.
 * @returns {{spent:number, absorbed:number, remaining:number}}
 */
export function warpPoolAbsorb(have, damage, perPoint) {
  const h = Math.max(0, Math.floor(Number(have) || 0));
  const dmg = Math.max(0, Number(damage) || 0);
  const per = Math.max(0, Number(perPoint) || 0);
  if (!h || !dmg || !per) return { spent: 0, absorbed: 0, remaining: dmg };
  const need = Math.ceil(dmg / per);
  if (need <= h) return { spent: need, absorbed: dmg, remaining: 0 };
  return { spent: h, absorbed: h * per, remaining: dmg - h * per };
}

/** Пул, в который идёт урон варп-оружия (Жажда), или null. */
export function warpSoakPoolDef(actor) {
  for (const d of resourcePoolDefs(actor).values()) if (d.warpWoundsPerPoint > 0) return d;
  return null;
}

/** Пулы, которыми можно заплатить вместо Очка Бесчестия прямо сейчас. */
export function infamyResourceOptions(actor, { roundKey = "", corThreshold = 0, test = null } = {}) {
  const out = [];
  for (const d of resourcePoolDefs(actor).values()) {
    if (!d.asInfamy) continue;
    // Пул «только на атаку» (Месть): тест карточки известен и он не атака — мимо.
    // Без теста (трата с полосы: активация Killing Strike и т.п.) — разрешено.
    if (d.asInfamyAttackOnly && test && !test.attack) continue;
    // «Считает при этом свою Cor 0-19»: способность с порогом Порчи выше —
    // этим пулом не оплачивается.
    if (d.asInfamyCor != null && Number(corThreshold) > d.asInfamyCor) continue;
    const gate = resourceSpendGate(actor, d.key, 1, { asInfamy: true, roundKey, def: d });
    if (gate.ok) out.push(d);
  }
  return out;
}

/** Пулы, которые дают «+10 за очко» тесту этой Характеристики. */
export function resourceBoostOptions(actor, charKey) {
  const c = String(charKey ?? "").toLowerCase();
  if (!c) return [];
  return [...resourcePoolDefs(actor).values()].filter(d => d.boostChars.includes(c));
}

/**
 * Пулы, которыми можно заменить провал этого теста Успехом: по Характеристике
 * (failChars), по Навыку теста (`skill`) или тесту T Регенерации
 * (`regeneration`) — failSkills.
 */
export function resourceFailSuccessOptions(actor, charKey, { skill = "", regeneration = false } = {}) {
  const c = String(charKey ?? "").toLowerCase();
  const sk = String(skill ?? "").toLowerCase();
  return [...resourcePoolDefs(actor).values()].filter(d =>
    (c && d.failChars.includes(c))
    || (sk && d.failSkills.includes(sk))
    || (regeneration && d.failSkills.includes("regeneration")));
}

/** Строки для листа: { key, label, value, max, refillLabel, gainLabel, gainAmount, note }. */
export function resourcePoolsView(actor) {
  return [...resourcePoolDefs(actor).values()].map(d => {
    const notes = [];
    if (d.refill) notes.push(`Восполняется ${RESOURCE_REFILL_UNITS[d.refill] ?? d.refill}.`);
    if (d.roundCap > 0) notes.push(`Не больше ${resourceAmountLabel(d.key, d.roundCap, d)} за Раунд.`);
    if (d.asInfamy) notes.push(`Можно тратить как Очки Бесчестия${d.asInfamyCap > 0 ? ` (до ${d.asInfamyCap} за Раунд)` : ""}${d.asInfamyCor != null ? `, Порча при этом считается не выше ${d.asInfamyCor}` : ""}${d.asInfamyNote ? `: ${d.asInfamyNote}` : ""}.`);
    if (d.boostChars.length) notes.push(`+10 к тесту (${d.boostChars.join(", ")}) за очко — меню карточки теста.`);
    if (d.failChars.length) notes.push(`Провал теста (${d.failChars.join(", ")}) → Успех за очко — кнопка в карточке.`);
    if (d.failSkills.length) notes.push(`Провал теста (${d.failSkills.map(k => k === "regeneration" ? "T Регенерации" : k).join(", ")}) → Успех за очко — кнопка в карточке.`);
    notes.push(`Источник: ${d.sources.join(", ")}.`);
    return {
      key: d.key, label: d.label, value: resourcePoolValue(actor, d.key, d),
      max: d.unbounded ? "" : d.max, maxLabel: resourcePoolMaxLabel(d), unbounded: d.unbounded,
      gainLabel: d.gainLabel, gainAmount: d.gainAmount, note: notes.join(" ")
    };
  });
}
