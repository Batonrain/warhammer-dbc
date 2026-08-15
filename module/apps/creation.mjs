// module/apps/creation.mjs
//
// Мастер создания персонажа: Раса → Субраса → Мировоззрение → Архетип, бросок
// «Генерации» и всё, что раса, архетип, субраса и культура легиона выдают на
// старте. Функции принимают актора, а не лист, поэтому проверяются без Foundry.
//
// Что осталось на листе и приходит колбэками (deps): создание Черт и стартовых
// Талантов, органы Геносемени и перекраска листа под расу — их зовут и другие
// кнопки листа («Применить расу», «Применить легион»).

import { CHARACTERISTICS }              from "../constants/characteristics.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../constants/skills.mjs";
import { RACES, SUBRACES, SUBRACE_DATA,
         RACE_GROUPS, AELDARI_RACES }   from "../constants/races.mjs";
import { buildLegionOptions, buildChapterOptions,
         buildCultureLegionOptions, resolveCultureFx } from "../constants/legions.mjs";
import { MECHANICUS_IMPLANTS, SKITARII_WAR_PLATE } from "../constants/implants.mjs";
import { disabledRaceKeys }             from "../constants/features.mjs";
import { archetypeEntries, archetypesForRace } from "./archetypes.mjs";
import { splitTopLevel, esc }           from "../helpers/utils.mjs";

// 9 основных характеристик, в которые Мастер создания кидает 2d10 (корник вахи).
// Влияние (inf) сюда не входит — оно от arch.infRoll.
const CREATION_ROLL_CHARS = ["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel"];

// Плейсхолдер невыбранной специализации группового навыка («любые N», стр. 5-21).
const WILD_SPEC = "— выбери —";
// Специализации, в названии которых ЕСТЬ запятая — их нельзя резать по запятой
// (стр. 58: «Warp, Daemons and Psykers» — одно комбинированное знание, которое
// «может использоваться вместо любого из троих и подвигается как одно»).
const COMBINED_SPECS = new Set([
  "warp, daemons and psykers",
  "варп, демоны и псайкеры"
]);

/**
 * Стартовое снаряжение архетипа/расы (стр. 5-21, корбук снаряжение с 165):
 * разбирает строку gear, разрешает выборы «A/B/C»/«A или B» диалогом (с учётом
 * скобок), затем создаёт найденные в компендиумах предметы и постит карту в чат
 * с итоговым списком (нераспознанное/«любое»/количества — выдаются вручную).
 */
export async function grantCreationGear(actor, { race, past, sub, arch, isAstartes }) {
  const raw = [arch?.gear, race?.gear, past?.gear, sub?.gear].filter(Boolean).join(", ");
  if (!raw.trim() && !isAstartes) return 0;

  // Разбивка варианта с учётом вложенности скобок (как у навыков).
  const splitChoice = (str) => {
    const out = []; let d = 0, cur = "", i = 0;
    while (i < str.length) {
      const ch = str[i];
      if (ch === "(") d++; else if (ch === ")") d--;
      if (d === 0 && (ch === "/" || ch === ";")) { out.push(cur); cur = ""; i++; continue; }
      const m = (d === 0) ? str.slice(i).match(/^\s+или\s+/) : null;
      if (m) { out.push(cur); cur = ""; i += m[0].length; continue; }
      cur += ch; i++;
    }
    if (cur.trim()) out.push(cur);
    return out.map(s => s.trim()).filter(Boolean);
  };

  const entries = raw.trim() ? splitTopLevel(raw) : [];
  const layout = [], choiceDefs = [];
  for (const e of entries) {
    const parts = splitChoice(e);
    if (parts.length > 1) { layout.push({ ci: choiceDefs.length }); choiceDefs.push(parts); }
    else layout.push({ fixed: e });
  }
  const picks = await promptGearChoices(choiceDefs);
  const resolved = layout.map(x => x.fixed != null ? x.fixed : (picks[x.ci] || ""));

  // Попытка создать распознанные предметы из компендиумов (best-effort).
  const created = [];
  try {
    const packs = ["weapons","armor","gear","ammunition","shields","tools","armour-systems"]
      .map(p => game.packs.get(`warhammer-dbc.${p}`)).filter(Boolean);
    const index = new Map();  // нормализованное имя → doc
    const norm = s => String(s||"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
    for (const pk of packs) for (const e of await pk.getIndex()) {
      for (const part of String(e.name).split("/")) { const k = norm(part); if (k && !index.has(k)) index.set(k, { pack: pk, id: e._id }); }
    }
    const findItem = (txt) => {
      // Чистим «L. », количества, «(…)», «до R», «Best.Q» — оставляем имя.
      let s = String(txt).replace(/^\s*\d+×?\s*/,"").replace(/^l\.\s*/i,"").replace(/\([^)]*\)/g,"")
        .replace(/\bдо\s*R\s*\d+\b/gi,"").replace(/\b(Best|Good|Common|Poor)\.?Q\b/gi,"").trim();
      const k = norm(s);
      if (index.has(k)) return index.get(k);
      // мягкий поиск по вхождению
      for (const [name, ref] of index) if (k.length > 4 && (name.includes(k) || k.includes(name)) && Math.abs(name.length-k.length) < 6) return ref;
      return null;
    };
    const toCreate = [];
    for (const r of resolved) {
      if (/\bлюб/i.test(r) || /модификац|доз|магазин|\bR\d\b\s*$/i.test(r)) continue; // абстрактное — вручную
      const ref = findItem(r);
      if (ref) { const doc = await ref.pack.getDocument(ref.id); if (doc) { toCreate.push(doc.toObject()); created.push(doc.name); } }
    }
    if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
  } catch (e) { console.warn("warhammer-dbc | grant gear", e); }

  // Карта в чат: итоговый список (что создано / что выдать вручную) + системы брони Астартес.
  const rows = resolved.map(r => {
    const done = created.some(c => String(r).toLowerCase().includes(c.toLowerCase().split("/")[0].trim()));
    return `<li${done ? ' style="color:#4dffa6;"' : ''}>${done ? "✓ " : "▫ "}${esc(r)}</li>`;
  }).join("");
  const astartes = isAstartes
    ? `<div style="margin-top:6px;padding-top:5px;border-top:1px solid rgba(77,255,166,.25);"><b>+ 4 базовые Системы силовой брони на выбор</b> — из компендиума «Системы силовой брони» (добавьте во вкладке «Снаряжение»).</div>`
    : "";
  ChatMessage.create({
    content: `<div class="wh-roll-result"><div class="roll-header">🎒 Стартовое снаряжение — ${esc(arch?.name || race?.label || "персонаж")}</div>
      <ul style="margin:4px 0;padding-left:16px;font-size:.9em;">${rows || "<li>—</li>"}</ul>${astartes}
      <div style="font-size:.8em;opacity:.7;margin-top:4px;">✓ — добавлено на лист. ▫ — выдать вручную (компендиумы Оружие/Броня/Снаряжение или ＋ на вкладке «Снаряжение»).</div></div>`,
    whisper: ChatMessage.getWhisperRecipients?.("GM") || [],
    speaker: { alias: actor.name }
  });
  return created.length;
}

/** Диалог выбора «на выбор» снаряжения. choiceDefs — массивы строк; возвращает выбранные[]. */
function promptGearChoices(choiceDefs) {
  if (!choiceDefs?.length) return Promise.resolve([]);
  const rows = choiceDefs.map((opts,i) =>
    `<div class="atk-dlg-row wtc-row"><label class="wtc-lbl">Снаряжение:</label><select class="wtc-sel" data-i="${i}">${opts.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join("")}</select></div>`
  ).join("");
  return new Promise(resolve => {
    new Dialog({
      title: "Выбор стартового снаряжения",
      content: `<form class="wh-talent-choices"><p class="wtc-hint">Архетип/раса даёт снаряжение на выбор — уточни:</p>${rows}</form>`,
      buttons: { ok: { label: "Применить", callback: html => {
        const res = []; html.find("select[data-i]").each((_,el)=>{ res[Number(el.dataset.i)] = el.value; }); resolve(res);
      } } },
      default: "ok", close: () => resolve(choiceDefs.map(o => o[0]))
    }, { classes:["dialog","warhammer-dbc","wh-holo","wh-talent-dialog"], width: 480 }).render(true);
  });
}

/**
 * Навыки, выдаваемые культурой легиона (стр. 489-506). Переиспользуем разбор
 * навыков создания: он уже умеет групповые навыки, специализации и «+10».
 */
export async function grantCultureSkills(actor, cultFx) {
  const list = cultFx?.grantSkills || [];
  if (!list.length) return 0;
  return await grantCreationSkills(actor, { race: { skills: list.join(", ") } });
}

/**
 * Выдаёт навыки архетипа/расы БЕСПЛАТНО (стр. 5-21): проставляет grantedRank
 * (базовый уровень без траты опыта). Выборы «или» — диалог; групповые «(любое N)»
 * — плейсхолдеры для выбора игроком. Опыт тратится только за ступени сверх выданного.
 */
export async function grantCreationSkills(actor, { race, past, sub, arch }) {
  const SK = {
    "acrobatics":"acrobatics","athletics":"athletics","awareness":"awareness","charm":"charm",
    "command":"command","commerce":"commerce","deceive":"deceive","dodge":"dodge","inquiry":"inquiry",
    "interrogate":"interrogate","intimidate":"intimidate","logic":"logic","medicae":"medicae",
    "parry":"parry","psyniscience":"psyniscience","scrutiny":"scrutiny","security":"security",
    "sleight of hand":"sleightOfHand","stealth":"stealth","survival":"survival","tech-use":"techUse","tech use":"techUse"
  };
  // Префиксы групповых навыков. В корбуке они пишутся сокращённо и вразнобой
  // («For. Lore», «Com. Lore», «Schol. Lore», «Navigate»), поэтому здесь ВСЕ
  // варианты — иначе запись молча теряется при выдаче (баг: Техножрецу не
  // доставалось For. Lore (Mechanicum)+10).
  const GRP = {
    "common lore":"commonLore",   "com. lore":"commonLore",   "com lore":"commonLore",
    "forbidden lore":"forbiddenLore","for. lore":"forbiddenLore","for lore":"forbiddenLore",
    "scholastic lore":"scholasticLore","schol. lore":"scholasticLore","schol lore":"scholasticLore",
    "linguistics":"linguistics",
    "navigation":"navigation",    "navigate":"navigation",
    "operate":"operate","trade":"trade"
  };
  // Перевод специализаций групповых навыков (лор-ориентированный).
  const SPEC_RU = {
    "imperium":"Империум","war":"Война","chaos":"Хаос","astartes":"Астартес",
    "adeptus astartes":"Астартес","adeptus mechanicus":"Механикус","mechanicus":"Механикус",
    "daemons":"Демоны","warp":"Варп","heresy":"Ересь","horus heresy":"Ересь Хоруса",
    "long war":"Долгая Война","xenos":"Ксеносы","psykers":"Псайкеры","mutants":"Мутанты",
    "heraldry":"Геральдика","tactica imperialis":"Тактика Империалис","codex astartes":"Кодекс Астартес",
    "legend":"Легенды","legends":"Легенды","numerology":"Нумерология","occult":"Оккультизм",
    "cryptology":"Криптология","judgement":"Правосудие","archeotech":"Археотех","beasts":"Звери",
    "pirates":"Пираты","high gothic":"Высокий Готик","low gothic":"Низкий Готик",
    "chaos glyphs":"Глифы Хаоса","true tongue":"Истинный Язык","battle cant":"Боевой Язык",
    "battle kant":"Боевой Язык","xenobiology":"Ксенобиология","astartes implants":"Импланты Астартес",
    "horus heresy and long war":"Ересь Хоруса и Долгая Война","followers of chaos":"Последователи Хаоса",
    "inquisition":"Инквизиция","navigators":"Навигаторы","underworld":"Преступный мир",
    "warp, daemons and psykers":"Варп, Демоны и Псайкеры","xenos occult":"Ксено-Оккультизм",
    "adeptus arbites":"Адептус Арбитес","administratum":"Администратум","archenemy":"Архивраг",
    "ecclesiarchy":"Экклезиархия","imperial creed":"Имперский Культ","imperial guard":"Имперская Гвардия",
    "imperial fleet":"Имперский Флот","intrigue":"Интрига","tech":"Технология","toil":"Труд",
    // «Mechanicus» на стр.16 — опечатка книги: в списке специализаций (стр.58)
    // есть только «Mechanicum». Сводим к одной записи, иначе у персонажа
    // появятся два разных Запретных Знания об одном и том же.
    "binary cant":"Бинарный Кант","mechanicum":"Механикум","mechanicus":"Механикум",
    "chymistry":"Химия",
    "engineer":"Инженер",
    "crime":"Преступность","sump":"Свалки","astra telepathica":"Астра Телепатика",
    "adeptus astra telepathica":"Астра Телепатика","genestealer":"Генокрад",
    "druchii":"Друкхари","lameldannar":"ЛамЭлданнар","lameldannar druchii":"ЛамЭлданнар (Друкхари)",
    "aeldari":"Аэльдари","corsair":"Корсар","eldar":"Эльдар",
    "surface":"Поверхность","aeronautica":"Авиа","voidship":"Космос","stellar":"Звёздная",
    "armourer":"Бронник","weaponsmith":"Оружейник","chymist":"Химик",
    "voidfarer":"Космоход","mason":"Каменщик","technomat":"Техномат","shipwright":"Корабел"
  };
  const specRu = raw => { const k = String(raw).toLowerCase().replace(/\s+/g," ").trim(); return SPEC_RU[k] || raw; };
  const STEP = { untrained:0, knows:1, trained:2, veteran:3, expert:4 };
  const rankOf = n => n>=30?"expert":n>=20?"veteran":n>=10?"trained":"knows";
  const norm = s => String(s||"").toLowerCase().replace(/\s+/g," ").trim();

  const raw = [race?.skills, past?.skills, sub?.skills, arch?.skills].filter(Boolean).join(", ");
  if (!raw.trim()) return 0;
  // Разбиение варианта «или»/«/» ТОЛЬКО на верхнем уровне скобок (иначе ломается
  // «Linguistics (Battle Cant/High Gothic)» — «/» внутри скобок это варианты спец.).
  const splitChoice = (str) => {
    const out = []; let d = 0, cur = "", i = 0;
    while (i < str.length) {
      const ch = str[i];
      if (ch === "(") d++;
      else if (ch === ")") d--;
      if (d === 0 && ch === "/") { out.push(cur); cur = ""; i++; continue; }
      const m = (d === 0) ? str.slice(i).match(/^\s+или\s+/) : null;
      if (m) { out.push(cur); cur = ""; i += m[0].length; continue; }
      cur += ch; i++;
    }
    if (cur.trim()) out.push(cur);
    return out.map(s => s.trim()).filter(Boolean);
  };
  // Русское имя опции навыка для диалога («Linguistics (Battle Cant) +10» → «Лингвистика (Боевой Язык) +10»).
  const skillOptRu = (opt) => {
    const m = String(opt).match(/\+\d+/); const suf = m ? " " + m[0] : "";
    let s = String(opt).replace(/\+\d+/, "").trim();
    const gm = s.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    if (gm) {
      const gk = GRP[norm(gm[1])];
      const gl = gk ? (GROUP_SKILLS_DEF[gk]?.label || gm[1].trim()) : (SK[norm(gm[1])] ? SKILLS_DEF[SK[norm(gm[1])]]?.label : gm[1].trim());
      return `${gl} (${specRu(gm[2].trim())})${suf}`;
    }
    const sk = SK[norm(s)];
    return (sk ? (SKILLS_DEF[sk]?.label || s) : s) + suf;
  };

  const entries = splitTopLevel(raw);
  const direct = [], choices = [];
  for (const e of entries) {
    const parts = splitChoice(e);
    if (parts.length > 1) { choices.push(parts.map(p => ({ value: p, label: skillOptRu(p) }))); continue; }
    // Выбор ВНУТРИ скобок: «For. Lore (Archeotech/Xenos/Warp)» — одна из трёх
    // специализаций, а не все три (стр. 20). Запятая внутри скобок при этом
    // означает «и обе»: «Trade (Armourer, Weaponsmith)».
    const im = e.match(/^(.*?)\s*\(([^)]*)\)\s*(\+\d+)?\s*$/);
    if (im && GRP[norm(im[1])] && /\s+или\s+|\//.test(im[2]) && !/люб/i.test(im[2])) {
      const head = im[1].trim(), suf = im[3] || "";
      const opts = im[2].split(/\s+или\s+|\s*\/\s*/).map(s => s.trim()).filter(Boolean)
        .map(sp => { const v = `${head} (${sp})${suf}`; return { value: v, label: skillOptRu(v) }; });
      if (opts.length > 1) { choices.push(opts); continue; }
    }
    direct.push(e);
  }
  const chosen = await promptSkillChoices(choices);
  const all = [...direct, ...chosen];

  const upd = {};
  const groupCache = {};   // key → рабочий массив записей
  const getGroup = k => (groupCache[k] ??= foundry.utils.deepClone(actor.system.groupSkills?.[k] || []));
  // Слоты «любые N» считаем за проход и сверяем с уже выданными генерацией
  // (wildSlot), иначе повторный прогон Мастера удваивает групповые навыки
  // (Человек: Common Lore ×4 → ×8). Выбранная игроком специализация занимает
  // свой слот и переживает пересчёт.
  const wildWant = {};   // gkey → сколько слотов даёт генерация
  const wildRank = {};   // gkey → лучший ранг среди источников
  const unknown  = [];   // нераспознанные записи (диагностика для ГМа)

  for (let str of all) {
    str = String(str).trim(); if (!str) continue;
    const m = str.match(/\+(\d+)/); const rank = rankOf(m ? parseInt(m[1]) : 0);
    str = str.replace(/\+\d+/,"").trim();
    const gm = str.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    if (gm) {
      const gkey = GRP[norm(gm[1])];
      if (gkey) {
        const inside = gm[2].trim();
        const arr = getGroup(gkey);
        // Смешанный случай «(War, любое 1)» (Астартес, стр. 7): конкретная
        // специализация + N свободных слотов. Раньше вся запись уходила в
        // «любое», и War терялся — поэтому части разбираем по отдельности.
        const parts   = COMBINED_SPECS.has(norm(inside))
          ? [inside] : inside.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
        const wildPs  = parts.filter(p => /люб/i.test(p));
        const namedPs = parts.filter(p => !/люб/i.test(p));
        if (wildPs.length) {
          for (const p of wildPs) {
            const cnt = parseInt((p.match(/\d+/)||["1"])[0]) || 1;
            wildWant[gkey] = (wildWant[gkey] || 0) + cnt;
            if ((STEP[rank]||0) >= (STEP[wildRank[gkey]]||0)) wildRank[gkey] = rank;
          }
          for (const raw of namedPs) {
            const ru = specRu(raw);
            let ent = arr.find(e => norm(e.specialty)===norm(ru));
            if (ent) { ent.grantedRank = rank; if ((STEP[ent.rank]||0)<STEP[rank]) ent.rank = rank; ent.cost = 0; }
            else arr.push({ specialty: ru, rank, grantedRank: rank, cost: 0 });
          }
        } else {
          // Несколько специализаций ТОЛЬКО через запятую (в названиях бывает «and»/«и»,
          // напр. «Horus Heresy and Long War» — это ОДНА специализация, стр. 58-61).
          // Исключение — комбинированные названия, где запятая ВНУТРИ имени
          // («Warp, Daemons and Psykers» — единый навык, стр. 58): их не режем.
          const specs = COMBINED_SPECS.has(norm(inside))
            ? [inside]
            : inside.split(/\s*,\s*/).map(s=>s.trim()).filter(Boolean);
          for (const raw of specs) {
            const ru = specRu(raw);
            let ent = arr.find(e => norm(e.specialty)===norm(ru));
            if (ent) { ent.grantedRank = rank; if ((STEP[ent.rank]||0)<STEP[rank]) ent.rank = rank; ent.cost = 0; }
            else arr.push({ specialty: ru, rank, grantedRank: rank, cost: 0 });
          }
        }
        continue;
      }
      // Скобки есть, но префикс не групповой навык — отметим как неизвестное,
      // если это и не обычный навык (проверка ниже).
    }
    const skey = SK[norm(str)];
    if (skey) {
      const cur = upd[`system.skills.${skey}.grantedRank`] || actor.system.skills?.[skey]?.grantedRank || "untrained";
      const better = (STEP[rank] >= (STEP[cur]||0)) ? rank : cur;
      upd[`system.skills.${skey}.grantedRank`] = better;
      const curRank = actor.system.skills?.[skey]?.rank || "untrained";
      if ((STEP[curRank]||0) < STEP[better]) upd[`system.skills.${skey}.rank`] = better;
      upd[`system.skills.${skey}.cost`] = 0;
    } else {
      // Не распознали — раньше запись просто исчезала. Теперь копим и сообщаем
      // ГМу, чтобы опечатка в данных архетипа была видна сразу.
      unknown.push(str);
    }
  }
  // Сверка слотов «любые N»: доводим их число ровно до положенного. Лишние
  // снимаем только с невыбранных плейсхолдеров — выбранное игроком остаётся.
  for (const [gk, want] of Object.entries(wildWant)) {
    const arr   = getGroup(gk);
    const rank  = wildRank[gk] || "knows";
    const slots = arr.filter(e => e?.wildSlot);
    if (slots.length > want) {
      const free = slots.filter(e => e.wild || norm(e.specialty) === norm(WILD_SPEC));
      for (const e of free.slice(0, slots.length - want)) arr.splice(arr.indexOf(e), 1);
    } else {
      for (let i = slots.length; i < want; i++)
        arr.push({ specialty: WILD_SPEC, rank, grantedRank: rank, cost: 0, wild: true, wildSlot: true });
    }
    // Ранг слотов подтягиваем до лучшего среди источников.
    for (const e of arr) if (e?.wildSlot) {
      e.grantedRank = rank;
      if ((STEP[e.rank]||0) < STEP[rank]) e.rank = rank;
      e.cost = 0;
    }
  }
  for (const [gk, arr] of Object.entries(groupCache)) upd[`system.groupSkills.${gk}`] = arr;
  if (Object.keys(upd).length) await actor.update(upd);

  // Нераспознанное больше не теряется молча — говорим ГМу, что выдать руками.
  if (unknown.length) {
    console.warn("Warhammer DBC | Не распознаны стартовые навыки:", unknown);
    ui.notifications.warn(
      `Не распознано навыков: ${unknown.length} — выдайте вручную: ${unknown.join("; ")}`,
      { permanent: true });
  }

  const nSk = Object.keys(upd).filter(k => k.endsWith(".grantedRank")).length;
  const nGr = Object.values(groupCache).reduce((s,a)=>s+a.length,0);
  return nSk + nGr;
}

/** Диалог выбора «или»-навыков. choices — массивы {value,label}; возвращает value[]. */
function promptSkillChoices(choices) {
  if (!choices?.length) return Promise.resolve([]);
  const rows = choices.map((opts,i) =>
    `<div class="atk-dlg-row wtc-row"><label class="wtc-lbl">Навык:</label><select class="wtc-sel" data-i="${i}">${opts.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("")}</select></div>`
  ).join("");
  return new Promise(resolve => {
    new Dialog({
      title: "Выбор стартовых навыков",
      content: `<form class="wh-talent-choices"><p class="wtc-hint">Архетип/раса даёт выбор — уточни:</p>${rows}</form>`,
      buttons: { ok: { label: "Применить", callback: html => {
        const res = []; html.find("select[data-i]").each((_,el)=>{ if(el.value) res.push(el.value); }); resolve(res);
      } } },
      default: "ok", close: () => resolve([])
    }, { classes:["dialog","warhammer-dbc","wh-holo","wh-talent-dialog"], width: 460 }).render(true);
  });
}

// ── Локализация навыков/специализаций для мастера (англ. данные → русский) ──
const _EN_SKILL = {
  "acrobatics":"acrobatics","athletics":"athletics","awareness":"awareness","charm":"charm",
  "command":"command","commerce":"commerce","deceive":"deceive","dodge":"dodge","inquiry":"inquiry",
  "interrogate":"interrogate","intimidate":"intimidate","logic":"logic","medicae":"medicae",
  "parry":"parry","psyniscience":"psyniscience","scrutiny":"scrutiny","security":"security",
  "sleight of hand":"sleightOfHand","stealth":"stealth","survival":"survival","tech-use":"techUse","tech use":"techUse"
};
const _EN_GROUP = {
  "common lore":"commonLore","forbidden lore":"forbiddenLore","scholastic lore":"scholasticLore",
  "schol. lore":"scholasticLore","linguistics":"linguistics","navigation":"navigation",
  "navigate":"navigation","operate":"operate","trade":"trade"
};
const _SPEC_RU = {
  // Чувства
  "sight":"Зрение","hearing":"Слух","smell":"Обоняние","taste":"Вкус","touch":"Осязание","all":"Все",
  // Типы оружия
  "bolt":"Болтерное","flame":"Зажигательное","grav":"Гравитонное","las":"Лазерное","launcher":"Пусковое",
  "melta":"Мельта","plasma":"Плазма","power":"Силовое","shock":"Шоковое","chain":"Цепное","bow":"Лук",
  "solid projectile":"Твердотельное","primary":"Основное","primitive":"Примитивное","exotic":"Экзотическое",
  "flechette":"Флешетты","needle":"Игольное","galvanic":"Гальваническое","rad":"Радиационное",
  // Сопротивления
  "cold":"Холод","blindness":"Слепота","deafness":"Глухота","disease":"Болезни","fear":"Страх",
  "heat":"Жар","poison":"Яды","poisons":"Яды","psychic powers":"Психосилы","stun":"Оглушение","radiation":"Радиация",
  // Знания/языки
  "imperium":"Империум","war":"Война","chaos":"Хаос","astartes":"Астартес","adeptus astartes":"Астартес",
  "adeptus mechanicus":"Механикус","mechanicus":"Механикус","daemons":"Демоны","warp":"Варп","heresy":"Ересь",
  "horus heresy and long war":"Ересь Хоруса и Долгая Война","xenos":"Ксеносы","psykers":"Псайкеры","mutants":"Мутанты",
  "heraldry":"Геральдика","codex astartes":"Кодекс Астартес","legend":"Легенды","legends":"Легенды",
  "numerology":"Нумерология","occult":"Оккультизм","beasts":"Звери","pirates":"Пираты",
  "high gothic":"Высокий Готик","low gothic":"Низкий Готик","battle cant":"Боевой Язык","battle kant":"Боевой Язык",
  "druchii":"Друкхари","lameldannar":"ЛамЭлданнар","lameldannar druchii":"ЛамЭлданнар (Друкхари)",
  "aeldari":"Аэльдари","corsair":"Корсар","eldar":"Эльдар","chaos glyphs":"Глифы Хаоса","true tongue":"Истинный Язык",
  "inquisition":"Инквизиция","navigators":"Навигаторы","xenobiology":"Ксенобиология","tactica imperialis":"Тактика Империалис"
};
const _norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

/** Русское имя специализации таланта/навыка («Cold» → «Холод»). */
export function ruSpec(x) { return _SPEC_RU[_norm(x)] || String(x).trim(); }

// Один элемент строки навыков → русский («Common Lore (Druchii) +10» → «Общие Знания (Друкхари) +10»).
function ruSkillEntry(str) {
  let s = String(str).trim();
  const rk = (s.match(/\+(\d+)/) || [])[1]; const suf = rk ? ` +${rk}` : "";
  s = s.replace(/\+\d+/, "").trim();
  const gm = s.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (gm) {
    const base = _norm(gm[1]); const inside = gm[2].trim();
    const gk = _EN_GROUP[base]; const sk = _EN_SKILL[base];
    const lbl = gk ? GROUP_SKILLS_DEF[gk]?.label : (sk ? SKILLS_DEF[sk]?.label : gm[1].trim());
    if (/люб/i.test(inside)) return `${lbl} (${inside})${suf}`;
    const specs = inside.split(/\s*,\s*/).map(x => ruSpec(x)).join(", ");
    return `${lbl} (${specs})${suf}`;
  }
  const sk = _EN_SKILL[_norm(s)];
  return (sk ? SKILLS_DEF[sk]?.label : s) + suf;
}

// Полная строка навыков (через запятую, с учётом «или»/скобок) → русский.
function ruSkillString(str) {
  if (!str) return "";
  // Разбиваем по запятым верхнего уровня (скобки не трогаем).
  const out = []; let d = 0, cur = "";
  for (const ch of String(str)) { if (ch === "(") d++; else if (ch === ")") d--; if (ch === "," && d === 0) { out.push(cur); cur = ""; } else cur += ch; }
  if (cur.trim()) out.push(cur);
  return out.map(e => {
    const parts = e.split(/\s+или\s+/);
    return parts.map(p => ruSkillEntry(p)).join(" или ");
  }).join(", ");
}

/** Резолвит объекты расы/архетипа/субрасы/«Прошлого» по выбранным ключам мастера. */
export function resolveCreation({ raceKey, subraceKey, archKey, ynnariPast, harlequinPast }) {
  const race = RACES[raceKey];
  const arch = archetypeEntries()[archKey];
  const sub  = SUBRACE_DATA[subraceKey];
  const pastKey = raceKey === "ynnari" ? ynnariPast
                : raceKey === "harlequin" ? harlequinPast : "";
  const past = (pastKey && RACES[pastKey]) ? RACES[pastKey] : null;
  return { race, arch, sub, past, pastKey };
}

/** Плоская база характеристик до броска: раса (+ Прошлое) + архетип + субраса. */
export function creationCharSum({ race, past, arch, sub }) {
  const sum = {};
  for (const [k, v] of Object.entries(race?.chars    || {})) sum[k] = (sum[k] || 0) + v;
  for (const [k, v] of Object.entries(past?.chars    || {})) sum[k] = (sum[k] || 0) + v;
  for (const [k, v] of Object.entries(arch?.charBonus || {})) sum[k] = (sum[k] || 0) + v;
  for (const [k, v] of Object.entries(sub?.charMods   || {})) sum[k] = (sum[k] || 0) + v;
  return sum;
}

/** Число бонусных бросков расы (по выбранным ключам мастера). */
function creationBonusRolls(raceKey) {
  return Number(RACES[raceKey]?.bonusRolls) || 0;
}

/** Один комплект метода «Генерация»: 9 (+бонус) бросков 2d10, берём 9 старших. */
export function rollCharSet(bonusRolls = 0) {
  const d = () => 1 + Math.floor(Math.random() * 10);
  const r2 = () => d() + d();
  const vals = Array.from({ length: 9 + bonusRolls }, r2).sort((a, b) => b - a).slice(0, 9);
  return { vals, sum: vals.reduce((s, v) => s + v, 0) };
}

/** Бросает формулу стартовых Ран вида "15+1d5". */
async function rollWoundsFormula(formula) {
  if (!formula) return 0;
  try { return (await new Roll(String(formula)).evaluate()).total; }
  catch(e) { console.warn("wounds formula:", formula, e); return 0; }
}

/** Выдаёт базовые импланты Механикум (пропуская уже имеющиеся). */
async function grantMechanicusImplants(actor) {
  const existing = new Set(actor.items.filter(i => i.type === "implant").map(i => i.name));
  const toAdd = MECHANICUS_IMPLANTS.filter(d => !existing.has(d.name)).map(d => foundry.utils.deepClone(d));
  if (toAdd.length) await actor.createEmbeddedDocuments("Item", toAdd);
  return toAdd.length;
}

/** Выдаёт Скитарию Боевые Латы Скитарии (броня + дефлектор) вместо имплантов Механикум. */
async function grantSkitariiWarPlate(actor) {
  const existing = new Set(actor.items.filter(i => i.type === "implant").map(i => i.name));
  if (existing.has(SKITARII_WAR_PLATE.name)) return 0;
  await actor.createEmbeddedDocuments("Item", [foundry.utils.deepClone(SKITARII_WAR_PLATE)]);
  return 1;
}

/**
 * Применяет выбор мастера: характеристики только в пустые поля, Черты/импланты —
 * недостающие. Безопасно при повторном запуске.
 *
 * deps — то, что осталось на листе: createTraits, applyStartingTalents,
 * applyTheme.
 */
export async function applyCreation(actor,
  { raceKey, subraceKey, alignment, archKey, ynnariPast, harlequinPast, charRolls = null, geneSeed = null },
  { createTraits, applyStartingTalents, applyTheme }) {
  const { race, arch, sub, past, pastKey } =
    resolveCreation({ raceKey, subraceKey, archKey, ynnariPast, harlequinPast });
  const chars = actor.system.characteristics;

  const updates = {
    "system.race":      raceKey,
    "system.subrace":   subraceKey || "",
    "system.alignment": alignment || "loyalist",
    "system.archetype": archKey || "",
    "system.ynnariPast":    raceKey === "ynnari"    ? (ynnariPast || "")    : "",
    "system.harlequinPast": raceKey === "harlequin" ? (harlequinPast || "") : ""
  };
  // Астартес: сохраняем легион (геносемя) и отдельно культуру (стр. 489-506).
  if (geneSeed) {
    updates["system.geneSeed.legion"]         = geneSeed.legion || "";
    updates["system.geneSeed.chapter"]        = geneSeed.chapter || "";
    updates["system.geneSeed.cultureLegion"]  = geneSeed.cultureLegion || "";
    updates["system.geneSeed.cultureChapter"] = geneSeed.cultureChapter || "";
  }
  if (arch?.isPsyker)     updates["system.isPsyker"]     = true;
  if (arch?.isTechpriest) updates["system.isTechpriest"] = true;
  if (arch?.psykerClass)  updates["system.psyker.class"] = arch.psykerClass;
  // Азуриане — псайкеры (трейт Psyker, «Древнее Мастерство»); то же для Иннари/Арлекина с Прошлым Азуриан
  if (raceKey === "azuriane" || pastKey === "azuriane") updates["system.isPsyker"] = true;

  // Характеристики (только в пустые поля): база = раса (+ Прошлое) + бонус
  // архетипа + бонус субрасы, ПЛЮС бросок 2d10 в каждую из 9 основных х-к
  // (корник вахи). Влияние (inf) 2d10 не кидается — оно от arch.infRoll ниже.
  const sum = creationCharSum({ race, past, arch, sub });
  for (const [k, v] of Object.entries(sum)) {
    if ((chars[k]?.base || 0) === 0) {
      const roll = (charRolls && CREATION_ROLL_CHARS.includes(k)) ? (charRolls[k] || 0) : 0;
      updates[`system.characteristics.${k}.base`] = v + roll;
    }
  }

  // Раны (только если ещё не заданы)
  const w = await rollWoundsFormula(arch?.wounds);
  if (w && (actor.system.wounds?.max || 0) === 0) {
    updates["system.wounds.max"]   = w;
    updates["system.wounds.value"] = w;
  }

  // Влияние (Inf) по броску архетипа — только в пустое поле
  if (arch?.infRoll && (chars.inf?.base || 0) === 0) {
    const infv = await rollWoundsFormula(arch.infRoll);
    if (infv) updates["system.characteristics.inf.base"] = infv;
  }

  await actor.update(updates);

  // Черты: расовые (+ Прошлого для Иннари) + субрасовые + архетипный
  let traits = 0;
  traits += await createTraits(race?.traits, race?.label || raceKey);
  if (past?.traits) traits += await createTraits(past.traits, past.label || pastKey);
  if (sub?.traits) traits += await createTraits(sub.traits, sub.label || subraceKey);
  if (arch?.trait) traits += await createTraits([arch.trait], `Архетип: ${arch.name}`);

  // Импланты Механикум / Боевые Латы Скитарии
  let implants = 0;
  if (arch?.grantsImplants) implants = await grantMechanicusImplants(actor);
  else if (arch?.grantsWarPlate) implants = await grantSkitariiWarPlate(actor);

  // Стартовые таланты: раса + Прошлое + субраса + архетип (выборы — через диалог)
  // Культура легиона выдаёт свои Таланты (стр. 489-506). Культура может быть
  // от ДРУГОГО легиона, чем геносемя, — берём именно её.
  const cultFx = geneSeed
    ? resolveCultureFx(geneSeed.cultureLegion || geneSeed.legion,
                       geneSeed.cultureChapter || geneSeed.chapter)
    : null;
  const talRaw = [].concat(
    race?.talents || [],
    past?.talents || [],
    sub?.talents  || [],
    arch?.talents ? [arch.talents] : [],
    cultFx?.grantTalents || []
  );
  const srcLabel = `${race?.label || raceKey}${arch ? ` / ${arch.name}` : ""}`;
  const talents = await applyStartingTalents(talRaw, srcLabel);

  // Навыки архетипа/расы — выдаём БЕСПЛАТНО (grantedRank), опыт не тратится (стр. 5-21).
  const grantedSkills = await grantCreationSkills(actor, { race, past, sub, arch });
  // Навыки от культуры легиона — тоже бесплатным рангом.
  const cultSkills = await grantCultureSkills(actor, cultFx);

  // Снаряжение архетипа/расы — ВРЕМЕННО ОТКЛЮЧЕНО (grantCreationGear оставлена
  // для будущих доработок: нужен словарь EN→компендиум для надёжности).
  // const gearN = await grantCreationGear(actor, { race, past, sub, arch, isAstartes: raceKey === "astartes" });

  await actor.setFlag("warhammer-dbc", "setupDone", true);
  applyTheme();

  ui.notifications.info(`🧙 Создание: ${race?.label}${arch ? ` / ${arch.name}` : ""} — Черт ${traits}, Талантов ${talents}, Навыков ${grantedSkills + cultSkills} (бесплатно)${implants ? `, имплантов ${implants}` : ""}. Снаряжение — вручную.`);
}

/** Подсказка под селектами: что даёт выбранная раса/архетип. */
function updateWizardNote(html) {
  const race = RACES[html.find("#wiz-race").val()];
  const arch = archetypeEntries()[html.find("#wiz-arch").val()];
  const parts = [];
  if (race?.skills) parts.push(`<b>Навыки расы:</b> ${ruSkillString(race.skills)}`);
  if (arch) {
    if (Object.keys(arch.charBonus || {}).length)
      parts.push(`<b>Бонус архетипа:</b> ${Object.entries(arch.charBonus).map(([k, v]) => `${k.toUpperCase()} ${v >= 0 ? "+" : ""}${v}`).join(", ")}`);
    if (arch.charChoice)   parts.push(`<b>Выбор:</b> ${arch.charChoice}`);
    if (arch.infRoll)      parts.push(`<b>Влияние:</b> ${arch.infRoll}`);
    if (arch.requiredPath) parts.push(`<b>Требуемый Путь:</b> ${arch.requiredPath}`);
    if (arch.wounds)       parts.push(`<b>Раны:</b> ${arch.wounds}`);
    if (arch.trait) parts.push(`<b>Трейт:</b> ${esc(arch.trait.name)}`);
  }
  html.find("#wiz-note").html(parts.join("<br/>"));
}

/**
 * Мастер создания персонажа: Раса → Субраса → Мировоззрение → Архетип.
 * Применяет всё разом (характеристики только в пустые поля, Черты/импланты —
 * недостающие). Безопасно при повторном запуске.
 */
export function showCreationWizard(actor, deps) {
  const curRace = actor.system.race || "human";
  // Метод «Генерация»: два независимых набора (каждый можно перебросить). Игрок
  // выбирает набор, затем раскидывает его значения по х-кам (drag&drop / клики).
  //   sets      — [{vals:[9], sum}, {vals:[9], sum}]
  //   activeSet — индекс выбранного набора (0/1)
  //   assign    — { charKey: индекс значения в активном наборе }
  //   armed     — «взятое кликом» значение (индекс) для клик-раскидки
  const _bonus = creationBonusRolls(curRace);
  let sets      = [rollCharSet(_bonus), rollCharSet(_bonus)];
  let activeSet = 0;
  let assign    = {};
  let armed     = null;

  // Итоговые значения распределения: { charKey: значение активного набора }.
  const charValues = () => {
    const vals = sets[activeSet]?.vals || [];
    const out = {};
    for (const k of CREATION_ROLL_CHARS) {
      const vi = assign[k];
      out[k] = (vi != null) ? (vals[vi] ?? 0) : 0;
    }
    return out;
  };

  // Расы выключенных подсистем («Книга Эльдар» и т.п.) прячем из Мастера —
  // та же логика, что и у шапки листа (context.raceGroups).
  const offRacesWiz = disabledRaceKeys();
  const raceOpts = RACE_GROUPS.map(g => {
    const opts = g.races.filter(k => RACES[k] && (k === curRace || !offRacesWiz.includes(k)))
      .map(k => `<option value="${k}" ${k === curRace ? "selected" : ""}>${RACES[k].label}</option>`).join("");
    return opts ? `<optgroup label="${g.label}">${opts}</optgroup>` : "";
  }).join("");
  const ynnariPastOpts = `<option value="">— не выбрано —</option>` + (RACES.ynnari.pastRaces || [])
    .map(k => `<option value="${k}" ${k === actor.system.ynnariPast ? "selected" : ""}>${RACES[k]?.label || k}</option>`).join("");
  const harlequinPastOpts = `<option value="">— не выбрано —</option>` + (RACES.harlequin.pastRaces || [])
    .map(k => `<option value="${k}" ${k === actor.system.harlequinPast ? "selected" : ""}>${RACES[k]?.label || k}</option>`).join("");

  const content = `
    <form class="wh-wizard-form" style="padding:6px;">
      <div class="atk-dlg-header"><span class="atk-weapon-name">🧙 Создание персонажа</span></div>
      <div class="atk-dlg-row"><label>Раса:</label><select id="wiz-race">${raceOpts}</select></div>
      <div class="atk-dlg-row wiz-ynnari-row" style="display:none;"><label>Прошлое:</label><select id="wiz-ynnari-past">${ynnariPastOpts}</select></div>
      <div class="atk-dlg-row wiz-harlequin-row" style="display:none;"><label>Прошлое:</label><select id="wiz-harlequin-past">${harlequinPastOpts}</select></div>
      <div class="atk-dlg-row"><label>Субраса:</label><select id="wiz-subrace"></select></div>
      <div class="atk-dlg-row wiz-align-row"><label>Мировоззрение:</label>
        <select id="wiz-align">
          <option value="loyalist">Лоялист</option>
          <option value="renegade">Ренегат</option>
          <option value="heretic">Хаосит</option>
        </select>
      </div>
      <div class="atk-dlg-row"><label>Архетип:</label><select id="wiz-arch"></select></div>
      <div id="wiz-note" class="atk-range-info" style="font-size:0.84em;"></div>
      <div id="wiz-legion" class="wiz-legion" style="display:none;">
        <div class="wiz-gen-lbl">Легион Астартес (геносемя и культура выбираются отдельно):</div>
        <div class="atk-dlg-row"><label>Легион (геносемя):</label><select id="wiz-legion-sel">${buildLegionOptions("")}</select></div>
        <div class="atk-dlg-row"><label>Орден / Банда:</label><select id="wiz-chapter-sel"></select></div>
        <div class="atk-dlg-row"><label title="Геносемя сохраняешь, а культуру можно перенять у другого легиона (напр. Повелитель Ночи в Чёрном Легионе).">Культура (легион):</label><select id="wiz-cult-sel">${buildCultureLegionOptions("")}</select></div>
        <div class="atk-dlg-row" id="wiz-cult-chapter-row" style="display:none;"><label>Культура (орден):</label><select id="wiz-cult-chapter-sel"></select></div>
      </div>
      <div class="wiz-gen">
        <div class="wiz-gen-lbl">1. Выбери набор бросков (можно перебросить):</div>
        <div id="wiz-sets" class="wiz-sets"></div>
        <div class="wiz-gen-lbl">2. Раскидай значения по характеристикам — перетащи или кликни значение, затем характеристику:
          <button type="button" id="wiz-auto" class="wiz-mini-btn" title="Разложить по убыванию">↕ по порядку</button>
          <button type="button" id="wiz-clear" class="wiz-mini-btn" title="Снять все значения">✕ сброс</button>
        </div>
        <div id="wiz-chips" class="wiz-chips"></div>
        <div id="wiz-slots" class="wiz-slots"></div>
      </div>
      <div class="roll-threshold" style="font-size:0.8em;color:#5a4a30;">
        Итог = база расы/архетипа + раскиданное значение. Заполняются только пустые поля; повторный запуск безопасен.
      </div>
    </form>`;

  const dlg = new Dialog({
    title: "Мастер создания персонажа",
    content,
    buttons: {
      apply: {
        icon: '<i class="fas fa-user-plus"></i>', label: "Создать",
        callback: async html => {
          const isAstartes = html.find("#wiz-race").val() === "astartes";
          await applyCreation(actor, {
            raceKey:    html.find("#wiz-race").val(),
            subraceKey: html.find("#wiz-subrace").val(),
            alignment:  html.find("#wiz-align").val(),
            archKey:    html.find("#wiz-arch").val(),
            ynnariPast: html.find("#wiz-ynnari-past").val(),
            harlequinPast: html.find("#wiz-harlequin-past").val(),
            charRolls:  charValues(),
            geneSeed: isAstartes ? {
              legion:         html.find("#wiz-legion-sel").val() || "",
              chapter:        html.find("#wiz-chapter-sel").val() || "",
              cultureLegion:  html.find("#wiz-cult-sel").val() || "",
              cultureChapter: html.find("#wiz-cult-chapter-sel").val() || ""
            } : null
          }, deps);
        }
      },
      cancel: { label: "Отмена" }
    },
    default: "apply",
    render: html => {
      const rebuild = () => {
        const rk    = html.find("#wiz-race").val();
        const race  = RACES[rk];
        const subOpts = ['<option value="">— нет —</option>']
          .concat((race?.subraces || []).map(sk => `<option value="${sk}">${SUBRACES[sk] || sk}</option>`));
        html.find("#wiz-subrace").html(subOpts.join(""));
        // Архетипы: Астартес/Азуриане/Друкхари/Арлекины — свои; Человек — обычные.
        // Прочие (сплайсы, гарпии, наги, скваты и т.п.) — человеческие архетипы.
        // Исключения: Аэльдари (используют Пути) и Сслиты — архетипа не выбирают.
        // (фильтрация вынесена в archetypesForRace — тот же приём, что читает и шапка листа)
        const archEntries = archetypesForRace(rk);
        // Группировка по полю group (если есть)
        const grouped = {};
        for (const [k, a] of archEntries) (grouped[a.group || ""] ??= []).push([k, a]);
        const archOpts = archEntries.length
          ? Object.entries(grouped).map(([g, list]) => {
              const opts = list.map(([k, a]) => `<option value="${k}">${esc(a.name)}</option>`).join("");
              return g ? `<optgroup label="${g}">${opts}</optgroup>` : opts;
            }).join("")
          : '<option value="">— нет (Аэльдари используют Пути; Сслиты — без архетипа) —</option>';
        html.find("#wiz-arch").html(archOpts);
        html.find(".wiz-ynnari-row").toggle(rk === "ynnari");
        html.find(".wiz-harlequin-row").toggle(rk === "harlequin");
        // Аэльдари используют Пути, а не Мировоззрение — скрываем выбор.
        html.find(".wiz-align-row").toggle(!AELDARI_RACES.includes(rk));
        // Легион+культура — только для Астартес.
        html.find("#wiz-legion").toggle(rk === "astartes");
        if (rk === "astartes") refreshLegion();
        // Число бонусных бросков зависит от расы — перекатываем оба набора и
        // сбрасываем раскладку.
        const bonus = creationBonusRolls(rk);
        sets = [rollCharSet(bonus), rollCharSet(bonus)];
        activeSet = 0;
        assign = {};
        armed = null;
        updateWizardNote(html);
        renderGen();
      };

      // Астартес: заполнить зависимые селекты (Орден по легиону, Культура-орден по культуре-легиону).
      const refreshLegion = () => {
        const lg = html.find("#wiz-legion-sel").val();
        html.find("#wiz-chapter-sel").html(buildChapterOptions(lg, ""));
        const cl = html.find("#wiz-cult-sel").val();
        html.find("#wiz-cult-chapter-row").toggle(!!cl);
        if (cl) html.find("#wiz-cult-chapter-sel").html(buildChapterOptions(cl, ""));
      };

      // Присвоить значение (индекс vi активного набора) характеристике k.
      // Если это значение уже занято другой х-кой — освобождаем её (без дублей).
      const assignTo = (k, vi) => {
        if (vi == null || Number.isNaN(vi)) return;
        for (const c of CREATION_ROLL_CHARS) if (c !== k && assign[c] === vi) delete assign[c];
        assign[k] = vi;
        armed = null;
      };

      // Полный рендер блока Генерации: наборы + пул фишек + слоты х-к.
      const renderGen = () => {
        const { race, arch, sub, past } = resolveCreation({
          raceKey:       html.find("#wiz-race").val(),
          subraceKey:    html.find("#wiz-subrace").val(),
          archKey:       html.find("#wiz-arch").val(),
          ynnariPast:    html.find("#wiz-ynnari-past").val(),
          harlequinPast: html.find("#wiz-harlequin-past").val()
        });
        const sum  = creationCharSum({ race, past, arch, sub });
        const vals = sets[activeSet]?.vals || [];

        // 1) Наборы
        html.find("#wiz-sets").html(sets.map((s, si) => `
          <div class="wiz-set ${si === activeSet ? "active" : ""}" data-set="${si}" title="Выбрать набор ${si + 1}">
            <div class="wiz-set-head"><span class="wiz-set-name">Набор ${si + 1}</span>
              <span class="wiz-set-sum">Σ ${s.sum}</span>
              <a class="wiz-set-reroll" data-set="${si}" title="Перебросить набор ${si + 1}">↻</a>
            </div>
            <div class="wiz-set-vals">${s.vals.map(v => `<span>${v}</span>`).join("")}</div>
          </div>`).join(""));

        // 2) Пул фишек (незанятые значения активного набора)
        const used = new Set(Object.values(assign).filter(v => v != null));
        const poolVis = vals.map((_, i) => i).filter(i => !used.has(i));
        html.find("#wiz-chips").html(
          poolVis.length
            ? poolVis.map(vi => `<span class="wiz-chip ${vi === armed ? "armed" : ""}" draggable="true" data-vi="${vi}">${vals[vi]}</span>`).join("")
            : `<span class="wiz-chips-empty">все значения разложены</span>`
        );

        // 3) Слоты характеристик
        html.find("#wiz-slots").html(CREATION_ROLL_CHARS.map(k => {
          const base = sum[k] || 0;
          const vi   = assign[k];
          const has  = vi != null;
          const val  = has ? (vals[vi] ?? 0) : 0;
          return `<div class="wiz-slot ${has ? "filled" : "empty"}" data-char="${k}" title="${CHARACTERISTICS[k].label}: база ${base}${has ? ` + ${val}` : ""}">
            <span class="ws-abbr">${CHARACTERISTICS[k].abbr}</span>
            <span class="ws-chip" ${has ? `draggable="true" data-vi="${vi}"` : ""}>${has ? val : "—"}</span>
            <span class="ws-total">${base + val}</span>
            <span class="ws-base">база ${base}</span>
          </div>`;
        }).join(""));

        // Кол-во разложенных — для подсветки готовности.
        const done = CREATION_ROLL_CHARS.filter(k => assign[k] != null).length;
        html.find(".wiz-gen").toggleClass("incomplete", done < CREATION_ROLL_CHARS.length);

        wireGen();
      };

      // Навешиваем обработчики (drag&drop + клики) после каждого рендера.
      const wireGen = () => {
        // Выбор набора
        html.find(".wiz-set").off("click").on("click", ev => {
          if ($(ev.target).closest(".wiz-set-reroll").length) return;   // не по кнопке переброса
          const si = Number(ev.currentTarget.dataset.set);
          if (si === activeSet) return;
          activeSet = si;
          assign = {};                                                  // новый набор — новые значения
          armed = null;
          renderGen();
        });
        // Переброс набора
        html.find(".wiz-set-reroll").off("click").on("click", ev => {
          ev.preventDefault(); ev.stopPropagation();
          const si = Number(ev.currentTarget.dataset.set);
          const bonus = creationBonusRolls(html.find("#wiz-race").val());
          sets[si] = rollCharSet(bonus);
          if (si === activeSet) { assign = {}; armed = null; }
          renderGen();
        });
        // Клик по фишке — «взять/отпустить» для клик-раскладки
        html.find(".wiz-chip").off("click").on("click", ev => {
          const vi = Number(ev.currentTarget.dataset.vi);
          armed = (armed === vi) ? null : vi;
          renderGen();
        });
        // Клик по слоту — положить взятое значение / снять текущее (в пул)
        html.find(".wiz-slot").off("click").on("click", ev => {
          const k = ev.currentTarget.dataset.char;
          if (armed != null) { assignTo(k, armed); renderGen(); return; }
          if (assign[k] != null) { delete assign[k]; renderGen(); }      // снять
        });
        // Drag&drop
        html.find(".wiz-chip[draggable], .ws-chip[draggable]").off("dragstart").on("dragstart", ev => {
          ev.originalEvent.dataTransfer.setData("text/plain", String(ev.currentTarget.dataset.vi));
          ev.originalEvent.dataTransfer.effectAllowed = "move";
        });
        html.find(".wiz-slot").off("dragover").on("dragover", ev => { ev.preventDefault(); });
        html.find(".wiz-slot").off("drop").on("drop", ev => {
          ev.preventDefault();
          const vi = Number(ev.originalEvent.dataTransfer.getData("text/plain"));
          assignTo(ev.currentTarget.dataset.char, vi);
          renderGen();
        });
        // Сброс фишки обратно в пул — дроп на область фишек
        html.find("#wiz-chips").off("dragover").on("dragover", ev => ev.preventDefault());
        html.find("#wiz-chips").off("drop").on("drop", ev => {
          ev.preventDefault();
          const vi = Number(ev.originalEvent.dataTransfer.getData("text/plain"));
          const k = CREATION_ROLL_CHARS.find(c => assign[c] === vi);
          if (k) { delete assign[k]; renderGen(); }
        });
      };

      html.find("#wiz-race").on("change", rebuild);
      html.find("#wiz-subrace, #wiz-arch, #wiz-ynnari-past, #wiz-harlequin-past").on("change", () => {
        updateWizardNote(html); renderGen();
      });
      // Астартес: зависимые селекты легиона/культуры.
      html.find("#wiz-legion-sel, #wiz-cult-sel").on("change", refreshLegion);
      // «По порядку» — разложить значения по убыванию (WS←макс … FEL←мин).
      html.find("#wiz-auto").on("click", ev => {
        ev.preventDefault();
        assign = {};
        CREATION_ROLL_CHARS.forEach((k, i) => { assign[k] = i; });
        armed = null;
        renderGen();
      });
      html.find("#wiz-clear").on("click", ev => {
        ev.preventDefault();
        assign = {}; armed = null; renderGen();
      });
      rebuild();
    }
  }, { classes: ["dialog", "wh-attack-dialog", "warhammer-dbc", "wh-holo"], width: 460 });
  dlg.render(true);
}
