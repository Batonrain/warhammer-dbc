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
import { APTITUDES } from "../constants/characteristics.mjs";
import { raceDef, subraceEntries, subracesOf, isAeldariRace, raceGroupList }
  from "./race-library.mjs";
import { applyRace, applySubrace }      from "./races.mjs";
import { buildLegionOptions, buildChapterOptions,
         buildCultureLegionOptions, resolveCultureFx } from "../constants/legions.mjs";
import { MECHANICUS_IMPLANTS, SKITARII_WAR_PLATE, MECHANICUM_IMPLANTS_TRAIT } from "../constants/implants.mjs";
import { disabledRaceKeys }             from "../constants/features.mjs";
import { archetypeEntries, archetypesForRace, applyArchetype } from "./archetypes.mjs";
import { splitTopLevel, esc }           from "../helpers/utils.mjs";
import { testCardHtml }                 from "../helpers/test-card.mjs";
import { START_LEVELS, START_CAP, startLevelValues } from "../constants/start-levels.mjs";
import { startingInfamyFormula } from "../rules/starting-infamy.mjs";
import { skillGrantOutcome } from "../rules/duplicate-grants.mjs";
import { matchSpec } from "../constants/skill-specializations.mjs";
import { refundXP, skillStepsCost, skillReason } from "./duplicate-refund.mjs";
import { pickHighest } from "../rules/roll-advantage.mjs";
import { pastRaceKey } from "../rules/race.mjs";

// 9 основных характеристик, в которые Мастер создания кидает 2d10 (корник вахи).
// Влияние (inf) сюда не входит — оно от arch.infRoll.
// Экспортируется: тот же список нужен Этапу 2 нового мастера (character-wizard.mjs).
export const CREATION_ROLL_CHARS = ["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel"];

// ── Склонности (стр. 23-24) ─────────────────────────────────────────────────
// Персонаж выбирает четыре Характеристики и четыре прочих. «Общее» есть у всех
// и в выбор не входит — charAptitudeSet добавляет его сам.
// Влияние (inf) в выбор не входит: Склонности «Влияние» нет ни в книге, ни в
// APTITUDES (constants/characteristics.mjs), ни в CHAR_APTITUDES — фишка с
// таким ключом рисовалась с пустой подписью (APTITUDES.inf === undefined).
export const APT_CHAR_KEYS  = ["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel"];
export const APT_OTHER_KEYS = ["offence", "defence", "finesse", "fieldcraft",
                               "knowledge", "social", "tech", "psyker"];
export const APT_PICK = { char: 4, other: 4 };

/** Фишки выбора для одной группы Склонностей. */
const aptChips = (group) => (group === "char" ? APT_CHAR_KEYS : APT_OTHER_KEYS)
  .map(k => `<label class="apt-chip"><input type="checkbox" class="wiz-apt" data-group="${group}" value="${k}"/> ${esc(APTITUDES[k])}</label>`)
  .join("");

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
  // НЕ карточка теста (wdbc-kuun): броска и Порога нет вовсе, это шёпот ГМу
  // со списком «что уже на листе, а что выдать руками».
  // Разметка теперь общая (testCardHtml), а публикация осталась своей, и это
  // не недоделка: postTestCard безусловно прогоняет данные через
  // ChatMessage.applyRollMode, а тот в публичном режиме броска ОБНУЛЯЕТ
  // whisper (client/documents/chat-message.mjs, applyMode: `if ( mode ===
  // "public" ) whisper.length = 0;`) — шёпот ГМу стал бы виден всему столу.
  // Пока это не разведено в общем helpers/test-card.mjs, шлём напрямую.
  ChatMessage.create({
    content: testCardHtml({
      title: `🎒 Стартовое снаряжение — ${esc(arch?.name || race?.label || "персонаж")}`,
      lines: [
        `<ul style="margin:4px 0;padding-left:16px;font-size:.9em;">${rows || "<li>—</li>"}</ul>`,
        astartes,
        `<div style="font-size:.8em;opacity:.7;margin-top:4px;">✓ — добавлено на лист. ▫ — выдать вручную (компендиумы Оружие/Броня/Снаряжение или ＋ на вкладке «Снаряжение»).</div>`
      ]
    }),
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
    "adeptus astartes":"Астартес","adeptus mechanicus":"Механикус",
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
  // Навыки, доросшие до потолка на повторной выдаче: за них возвращается опыт,
  // но не раньше, чем упадёт общий actor.update — иначе правки перебьют друг друга.
  const refunds  = [];

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
            const sd = matchSpec(gkey, raw);
            let ent = arr.find(e => norm(e.specialty)===norm(ru));
            if (ent) {
              ent.grantedRank = rank; if ((STEP[ent.rank]||0)<STEP[rank]) ent.rank = rank; ent.cost = 0;
              if (!ent.specKey && sd) ent.specKey = sd.key;
              if (!ent.char && sd?.char) ent.char = sd.char;
            } else arr.push({ specialty: ru, rank, grantedRank: rank, cost: 0,
                              ...(sd ? { specKey: sd.key } : {}), ...(sd?.char ? { char: sd.char } : {}) });
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
            const sd = matchSpec(gkey, raw);
            let ent = arr.find(e => norm(e.specialty)===norm(ru));
            if (ent) {
              ent.grantedRank = rank; if ((STEP[ent.rank]||0)<STEP[rank]) ent.rank = rank; ent.cost = 0;
              if (!ent.specKey && sd) ent.specKey = sd.key;
              if (!ent.char && sd?.char) ent.char = sd.char;
            } else arr.push({ specialty: ru, rank, grantedRank: rank, cost: 0,
                              ...(sd ? { specKey: sd.key } : {}), ...(sd?.char ? { char: sd.char } : {}) });
          }
        }
        continue;
      }
      // Скобки есть, но префикс не групповой навык — отметим как неизвестное,
      // если это и не обычный навык (проверка ниже).
    }
    const skey = SK[norm(str)];
    if (skey) {
      // Тот же Навык из второго источника поднимает ступень, а на потолке
      // возвращает опыт (rules/duplicate-grants.mjs). Источников при создании
      // несколько — раса, Прошлое, субраса, Родной мир, Архетип, — и совпадения
      // среди них обычное дело.
      const cur = upd[`system.skills.${skey}.grantedRank`] || actor.system.skills?.[skey]?.grantedRank || "untrained";
      const curRank = upd[`system.skills.${skey}.rank`] || actor.system.skills?.[skey]?.rank || "untrained";
      const curGrant = upd[`system.skills.${skey}.grantedRank`] || actor.system.skills?.[skey]?.grantedRank || "untrained";
      const out = skillGrantOutcome(curRank, rank);
      // grantedRank — сколько дали источники, а не сколько куплено за опыт:
      // купленный «+30» иначе стал бы бесплатным.
      upd[`system.skills.${skey}.grantedRank`] = (STEP[rank] >= (STEP[curGrant]||0)) ? rank : curGrant;
      if ((STEP[curRank]||0) < STEP[out.rank]) upd[`system.skills.${skey}.rank`] = out.rank;
      upd[`system.skills.${skey}.cost`] = 0;
      if (out.refundSteps.length) refunds.push({ skey, steps: out.refundSteps, granted: rank, had: curRank });
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

  // Совпавшие Навыки на потолке: опыт за третью покупку — по одной строке в чат.
  for (const r of refunds) {
    await refundXP(actor, skillStepsCost(actor, r.skey, r.steps),
      skillReason(SKILLS_DEF[r.skey]?.label || r.skey, r.granted, r.had));
  }

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

/** Резолвит объекты расы/архетипа/субрасы/«Прошлого» по выбранным ключам мастера. */
export function resolveCreation({ raceKey, subraceKey, archKey, ynnariPast, harlequinPast }) {
  const race = raceDef(raceKey);
  const arch = archetypeEntries()[archKey];
  const sub  = subraceEntries()[subraceKey] || null;
  const pastKey = pastRaceKey({ race: raceKey, ynnariPast, harlequinPast });
  const past = pastKey ? raceDef(pastKey) : null;
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
export function creationBonusRolls(raceKey) {
  return Number(raceDef(raceKey)?.bonusRolls) || 0;
}

/** Один комплект метода «Генерация»: 9 (+бонус) бросков 2d10, берём 9 старших. */
export function rollCharSet(bonusRolls = 0) {
  const d = () => 1 + Math.floor(Math.random() * 10);
  const r2 = () => d() + d();
  const vals = Array.from({ length: 9 + bonusRolls }, r2).sort((a, b) => b - a).slice(0, 9);
  return { vals, sum: vals.reduce((s, v) => s + v, 0) };
}

/**
 * Бросает формулу вида «15+1d5» и кладёт бросок в чат. Стартовые Раны и
 * Бесчестие выпадают один раз на всю жизнь персонажа, и переспросить потом,
 * что там было, негде — карточка в чате показывает бросок и игроку, и столу.
 *
 * Готовое число (например, +2 при распределении Характеристик) в чат не идёт:
 * бросать нечего, а карточка «выпало 21» из ниоткуда только путала бы.
 */
export async function rollFormula(actor, formula, flavor) {
  if (formula === null || formula === undefined || formula === "") return 0;
  if (typeof formula === "number") return formula;

  try {
    const roll = await new Roll(String(formula)).evaluate();
    await roll.toMessage(
      { speaker: ChatMessage.getSpeaker({ actor }), flavor },
      { rollMode: game.settings.get("core", "rollMode") });
    return roll.total;
  } catch (e) {
    console.warn("Warhammer DBC | формула создания:", formula, e);
    return 0;
  }
}

/**
 * Как {@link rollFormula}, но «с Преимуществом»: бросает формулу N раз и
 * оставляет больший итог (module/rules/roll-advantage.mjs) — субраса вида
 * Эльданар (стр. 4, «бросает 3 раза на свой Inf и выбирает лучший»). Один
 * бросок (n≤1) ведёт себя как rollFormula. Отброшенные попытки видны в чате:
 * стол должен видеть, что было отброшено, не только итог.
 */
export async function rollFormulaAdvantage(actor, formula, n, flavor) {
  if (formula === null || formula === undefined || formula === "") return 0;
  if (typeof formula === "number") return formula;
  const rolls = Math.max(1, Number(n) || 1);
  if (rolls <= 1) return rollFormula(actor, formula, flavor);

  try {
    const evaluated = [];
    for (let i = 0; i < rolls; i++) evaluated.push(await new Roll(String(formula)).evaluate());
    const picked = pickHighest(evaluated.map(r => r.total));
    const full = `${flavor} (Преимущество ×${rolls}, отброшено: ${picked.dropped.join(", ")})`;
    await evaluated[picked.index].toMessage(
      { speaker: ChatMessage.getSpeaker({ actor }), flavor: full },
      { rollMode: game.settings.get("core", "rollMode") });
    return picked.value;
  } catch (e) {
    console.warn("Warhammer DBC | формула создания (с Преимуществом):", formula, e);
    return 0;
  }
}

/**
 * Обвязка над rollFormula/rollFormulaAdvantage для ОДНОЙ конкретной
 * характеристики: субраса может объявить `charRollAdvantage: {char, rolls}`
 * (module/data/item/subrace.mjs) — «этот бросок кидается N раз, берём
 * лучший». Без объявления или для другой характеристики — обычный одиночный
 * бросок, ничего не меняется.
 */
export async function rollFormulaForChar(actor, formula, charKey, sub, flavor) {
  const adv = sub?.charRollAdvantage;
  if (adv && adv.char === charKey && Number(adv.rolls) > 1) {
    return rollFormulaAdvantage(actor, formula, Number(adv.rolls), flavor);
  }
  return rollFormula(actor, formula, flavor);
}

/** Выдаёт базовые импланты Механикум (пропуская уже имеющиеся). */
export async function grantMechanicusImplants(actor) {
  const existing = new Set(actor.items.filter(i => i.type === "implant").map(i => i.name));
  const toAdd = MECHANICUS_IMPLANTS.filter(d => !existing.has(d.name)).map(d => foundry.utils.deepClone(d));
  if (toAdd.length) await actor.createEmbeddedDocuments("Item", toAdd);
  return toAdd.length;
}

/**
 * Выдаёт Черту-гейт «Mechanicum Implants / Импланты Механикум» — без неё
 * требование "Трейт Mechanicum Implants" у Элитных архетипов Механикус
 * (Архимагос, Секутор, Малагра и т.д., см. rules/elite-requirements.mjs)
 * никогда не проходит, хотя физические импланты уже выданы. Идемпотентно.
 */
export async function grantMechanicumImplantsTrait(actor) {
  const has = actor.items.some(i => i.type === "trait" && i.name === MECHANICUM_IMPLANTS_TRAIT.name);
  if (has) return 0;
  await actor.createEmbeddedDocuments("Item", [foundry.utils.deepClone(MECHANICUM_IMPLANTS_TRAIT)]);
  return 1;
}

/** Выдаёт Скитарию Боевые Латы Скитарии (броня + дефлектор) вместо имплантов Механикум. */
export async function grantSkitariiWarPlate(actor) {
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
  { raceKey, subraceKey, alignment, archKey, ynnariPast, harlequinPast, charRolls = null,
    geneSeed = null, startLevel = null, aptitudes = null },
  { createTraits, applyStartingTalents, applyTheme }) {
  const { race, arch, sub, past, pastKey } =
    resolveCreation({ raceKey, subraceKey, archKey, ynnariPast, harlequinPast });
  const chars = actor.system.characteristics;
  // Пустые ли поля ДО выдачи расы/субрасы — снимок нужен именно тут: applyRace
  // ниже пишет расовые chars в тот же объект (общая ссылка на
  // actor.system.characteristics), и без снимка проверка «поле ещё не
  // заполнено» перестанет отличать «было пусто» от «уже заполнено расой» —
  // итог потеряет бонус архетипа и бросок (см. тест «характеристики пишутся
  // только в пустые поля»).
  const wasEmpty = {};
  for (const k of [...CREATION_ROLL_CHARS, "inf"]) wasEmpty[k] = (chars[k]?.base || 0) === 0;

  // Склонности пишем ПЕРВЫМ делом, до всякой выдачи: по ним считается возврат
  // опыта за Навык или Талант, пришедший из второго источника, и посчитанный
  // без них он оказался бы не тем.
  if (Array.isArray(aptitudes) && aptitudes.length) {
    await actor.update({ "system.aptitudes": [...new Set(aptitudes)] });
  }

  // Раса и субраса выдаются тем же путём, что из слота листа и из дропа
  // предмета: иначе два пути выдачи разойдутся при первой же правке
  // библиотеки. Порядок строгий — характеристики Мастер перезапишет итогом
  // ПОСЛЕ этой выдачи (см. ниже): его сумма учитывает архетип, броски и
  // распределение очков, а расовые chars в ней лишь слагаемое.
  await applyRace(actor, raceKey);
  // Прошлое Иннари/Арлекина — та же выдача под своим тегом racePast: mirror:false,
  // потому что раса персонажа остаётся Иннари/Арлекином, а не переписывается на
  // бывшую расу; свой тег — чтобы Прошлое снималось отдельно от расы и повторный
  // прогон Мастера его не задваивал (тот же приём, что у applyYnnari/applyHarlequin).
  if (pastKey) await applyRace(actor, pastKey, { tag: "racePast", mirror: false });
  if (subraceKey) await applySubrace(actor, subraceKey);
  // Архетип кладётся предметом, а не строкой: его выдача живёт в Конструкторе
  // Механики, а тот отыгрывается только при получении предмета. Раньше Мастер
  // писал сюда один ключ, и всё, что Архетип даёт, разбиралось здесь же из его
  // текстовых полей — то есть ровно один раз, при создании.
  if (archKey) await applyArchetype(actor, archKey);

  const updates = {
    "system.race":      raceKey,
    "system.subrace":   subraceKey || "",
    "system.alignment": alignment || "loyalist",
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

  // Характеристики: база = раса (+ Прошлое) + бонус архетипа + бонус субрасы,
  // ПЛЮС бросок 2d10 в каждую из 9 основных х-к (корник вахи). Пишем только в
  // поля, пустые ДО выдачи расы: applyRace уже заполнил их своей частью суммы —
  // здесь она перекрывается итогом. Влияние (inf) 2d10 не кидается — оно от
  // arch.infRoll ниже.
  const sum = creationCharSum({ race, past, arch, sub });
  for (const [k, v] of Object.entries(sum)) {
    if (wasEmpty[k]) {
      const roll = (charRolls && CREATION_ROLL_CHARS.includes(k)) ? (charRolls[k] || 0) : 0;
      updates[`system.characteristics.${k}.base`] = v + roll;
    }
  }

  // Раны (только если ещё не заданы). Бросок уходит в чат: он одноразовый.
  const woundsEmpty = (actor.system.wounds?.max || 0) === 0;
  const w = woundsEmpty ? await rollFormula(actor, arch?.wounds, "Стартовые Раны") : 0;
  if (w) {
    updates["system.wounds.max"]   = w;
    updates["system.wounds.value"] = w;
  }

  // Стартовое Бесчестие (стр. 4): базовое расы плюс 1d5 при Генерации или +2
  // при распределении. Архетипы Изгоев и Мореплавателей несут свой бросок
  // Влияния — он старше общего правила и заменяет его целиком.
  if (wasEmpty.inf) {
    const infv = arch?.infRoll
      ? await rollFormulaForChar(actor, arch.infRoll, "inf", sub, `Влияние: ${arch.name}`)
      : await rollFormulaForChar(actor,
          startingInfamyFormula(sum.inf, !!charRolls), "inf", sub, "Стартовое Бесчестие");
    if (infv) updates["system.characteristics.inf.base"] = infv;
  }

  // Уровень стартовой игры (стр. 23): опыт по колонке своей расы, а бонусы к
  // Влиянию и Порче — ПОВЕРХ броска архетипа, не вместо него. Считается здесь,
  // потому что только тут известны и раса, и выпавшее Влияние.
  const start = startLevel && startLevelValues({ ...startLevel, astartes: raceKey === "astartes" });
  if (start) {
    const infBase = Number(updates["system.characteristics.inf.base"] ?? chars.inf?.base) || 0;
    const cap = v => Math.max(0, Math.min(START_CAP, Math.round(v)));
    updates["system.experience.total"]          = start.xp;
    updates["system.experience.current"]        = start.xp;
    updates["system.characteristics.inf.base"]  = cap(infBase + start.infamy);
    updates["system.corruption.value"]          =
      cap((Number(actor.system.corruption?.value) || 0) + start.corruption);
  }

  await actor.update(updates);

  // Черты: расовые, Прошлого и субрасовые уже выданы applyRace/applySubrace
  // выше (через предмет-носитель и Конструктор Механики) — здесь остался
  // только архетипный.
  let traits = 0;
  if (arch?.trait) traits += await createTraits([arch.trait], `Архетип: ${arch.name}`);

  // Импланты Механикум / Боевые Латы Скитарии
  let implants = 0;
  if (arch?.grantsImplants) {
    implants = await grantMechanicusImplants(actor);
    traits += await grantMechanicumImplantsTrait(actor);
  } else if (arch?.grantsWarPlate) implants = await grantSkitariiWarPlate(actor);

  // Стартовые таланты: раса + Прошлое + субраса + архетип (выборы — через диалог)
  // Культура легиона выдаёт свои Таланты (стр. 489-506). Культура может быть
  // от ДРУГОГО легиона, чем геносемя, — берём именно её.
  const cultFx = geneSeed
    ? resolveCultureFx(geneSeed.cultureLegion || geneSeed.legion,
                       geneSeed.cultureChapter || geneSeed.chapter)
    : null;
  // race/past/sub.talents из библиотеки — строка («Ambidextrous, Bulging
  // Biceps, ...»), а не массив имён, как раньше в константах: splitTopLevel
  // режет её по запятым верхнего уровня (скобки специализаций не трогает).
  // Иначе строка ляжет в concat одним элементом, и 9 талантов Астартес
  // превратятся в один несуществующий.
  const talRaw = [].concat(
    race?.talents ? splitTopLevel(race.talents) : [],
    past?.talents ? splitTopLevel(past.talents) : [],
    sub?.talents  ? splitTopLevel(sub.talents)  : [],
    arch?.talents ? [arch.talents] : [],
    cultFx?.grantTalents || []
  );
  const srcLabel = `${race?.label || raceKey}${arch ? ` / ${arch.name}` : ""}`;
  const talents = await applyStartingTalents(talRaw, srcLabel);

  // Навыки расы, Прошлого, субрасы и Архетипа выдаёт Конструктор Механики их
  // собственных записей — при получении предмета, выше по этой же функции.
  // Здесь остались только навыки культуры легиона: они приходят из констант
  // (legions.mjs), своего предмета у культуры нет.
  const cultSkills = await grantCultureSkills(actor, cultFx);

  // Снаряжение архетипа/расы — ВРЕМЕННО ОТКЛЮЧЕНО (grantCreationGear оставлена
  // для будущих доработок: нужен словарь EN→компендиум для надёжности).
  // const gearN = await grantCreationGear(actor, { race, past, sub, arch, isAstartes: raceKey === "astartes" });

  await actor.setFlag("warhammer-dbc", "setupDone", true);
  applyTheme();

  ui.notifications.info(`🧙 Создание: ${race?.label}${arch ? ` / ${arch.name}` : ""} — Черт ${traits}, Талантов ${talents}, Навыков ${cultSkills} от культуры (остальные выдал Конструктор)${implants ? `, имплантов ${implants}` : ""}. Снаряжение — вручную.`);
}

/** Подсказка под селектами: что даёт выбранная раса/архетип. */
function updateWizardNote(html) {
  const race = raceDef(html.find("#wiz-race").val());
  const arch = archetypeEntries()[html.find("#wiz-arch").val()];
  const parts = [];
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
/**
 * Мастер создания персонажа.
 *
 * Возвращает промис: он резолвится ПОСЛЕ применения выбора (true) или при
 * отмене (false). Ждать окончания нужно тем, кто дописывает что-то поверх —
 * например, стартовому Уровню игры (apps/character-start.mjs): его бонусы к
 * Влиянию идут ДОПОЛНИТЕЛЬНО к броску архетипа, а тот ставится здесь и только
 * в пустое поле.
 */
export function showCreationWizard(actor, deps) {
  let settle = () => {};
  const done = new Promise(resolve => { settle = resolve; });
  // Диалог закрывается СРАЗУ после вызова callback, не дожидаясь его async-
  // работы, поэтому `close` резолвил бы промис раньше, чем применён выбор, и
  // ждущая сторона дописывала бы своё поверх пустого листа.
  let applying = false;
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
  const raceOpts = raceGroupList().map(g => {
    const opts = g.races.filter(r => r.key === curRace || !offRacesWiz.includes(r.key))
      .map(r => `<option value="${r.key}" ${r.key === curRace ? "selected" : ""}>${r.label}</option>`).join("");
    return opts ? `<optgroup label="${g.label}">${opts}</optgroup>` : "";
  }).join("");
  const ynnariPastOpts = `<option value="">— не выбрано —</option>` + (raceDef("ynnari")?.pastRaces || [])
    .map(k => `<option value="${k}" ${k === actor.system.ynnariPast ? "selected" : ""}>${raceDef(k)?.label || k}</option>`).join("");
  const harlequinPastOpts = `<option value="">— не выбрано —</option>` + (raceDef("harlequin")?.pastRaces || [])
    .map(k => `<option value="${k}" ${k === actor.system.harlequinPast ? "selected" : ""}>${raceDef(k)?.label || k}</option>`).join("");

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

      <!-- Склонности (стр. 23-24) — до Уровня старта: от них зависит цена
           всего, что персонаж купит, и возврат за совпавшую выдачу Навыка или
           Таланта. Выбор обязателен: ровно четыре Характеристики и ровно
           четыре прочих; «Общее» есть у всех и в выбор не входит. -->
      <div class="wiz-gen wh-apts">
        <div class="wiz-gen-lbl">3. Склонности — ровно <b>4</b> Характеристики и <b>4</b> прочих:</div>
        <div class="cstart-hint">По ним считается цена Характеристик, Навыков и Талантов, а значит и возврат
          опыта, когда один и тот же Навык или Талант приходит из двух источников.</div>
        <div class="apt-group">
          <div class="apt-group-lbl">Характеристики <span class="apt-count" data-for="char">0 / 4</span></div>
          <div class="apt-list">${aptChips("char")}</div>
        </div>
        <div class="apt-group">
          <div class="apt-group-lbl">Прочие <span class="apt-count" data-for="other">0 / 4</span></div>
          <div class="apt-list">${aptChips("other")}</div>
        </div>
        <div class="apt-warn" id="wiz-apt-warn"></div>
      </div>

      <!-- Уровень стартовой игры (стр. 23) — последним блоком: колонка опыта
           зависит от расы, а её выбирают выше. -->
      <div class="wiz-gen wh-cstart">
        <div class="wiz-gen-lbl">4. Уровень стартовой игры (стр. 23):</div>
        <div class="cstart-hint">Опыт зависит от того, Десантник персонаж или нет — колонка подсвечивается по
          выбранной расе. Бесчестие и Порча стартового персонажа не превышают ${START_CAP}.</div>
        <table class="items-table cstart-table">
          <thead><tr>
            <th></th><th class="cstart-col-astartes">XP Десантника</th>
            <th class="cstart-col-mortal">XP прочих</th><th>Влияние</th><th>Порча</th>
          </tr></thead>
          <tbody>
            ${START_LEVELS.map((l, i) => `
              <tr>
                <td class="cstart-pick"><input type="radio" name="cstart-level" value="${l.key}" ${i === 0 ? "checked" : ""}/></td>
                <td class="cstart-xp cstart-col-astartes">${l.astartes.toLocaleString("ru")}</td>
                <td class="cstart-xp cstart-col-mortal">${l.mortal.toLocaleString("ru")}</td>
                <td class="cstart-bonus">+${l.infamy}</td>
                <td class="cstart-bonus">+${l.corruption}</td>
              </tr>`).join("")}
          </tbody>
          <tfoot><tr class="cstart-extra">
            <td>сверх того</td>
            <td colspan="2"><input type="number" id="cstart-xp" value="0" step="50" title="Дополнительный опыт"/></td>
            <td><input type="number" id="cstart-inf" value="0" title="Дополнительное Влияние"/></td>
            <td><input type="number" id="cstart-cor" value="0" title="Дополнительная Порча"/></td>
          </tr></tfoot>
        </table>
      </div>
    </form>`;

  const dlg = new Dialog({
    title: "Мастер создания персонажа",
    content,
    buttons: {
      apply: {
        icon: '<i class="fas fa-user-plus"></i>', label: "Создать",
        callback: async html => {
          applying = true;
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
            } : null,
            // Склонности: их выбирают в этом же окне, и без них цена всего
            // купленного (и возврат за совпавшую выдачу) считался бы не тем.
            aptitudes: (() => {
              const picked = [];
              html.find(".wiz-apt:checked").each((_, el) => picked.push(el.value ?? el.getAttribute?.("value")));
              return picked.filter(Boolean);
            })(),
            startLevel: {
              level:    html.find('input[name="cstart-level"]:checked').val(),
              extraXp:  parseInt(html.find("#cstart-xp").val())  || 0,
              extraInf: parseInt(html.find("#cstart-inf").val()) || 0,
              extraCor: parseInt(html.find("#cstart-cor").val()) || 0
            }
          }, deps);
          settle(true);
        }
      },
      cancel: { label: "Отмена", callback: () => settle(false) }
    },
    default: "apply",
    // Закрыли крестиком — тоже ответ: ждущая сторона не должна зависнуть. Но
    // если выбор уже применяется, ответ даст сам callback, когда закончит.
    close: () => { if (!applying) settle(false); },
    render: html => {
      // Архетипы: Астартес/Азуриане/Друкхари/Арлекины — свои; Человек — обычные.
      // Прочие (сплайсы, гарпии, наги, скваты и т.п.) — человеческие архетипы.
      // Друкхари сужает список по Субрасе (Мандрагора/Развалина/Истиннорождённый),
      // Иннари — по Прошлому (наследует список расы-предка). Экзодиты используют
      // Пути — архетипов в паке пока нет. (фильтрация — archetypesForRace, тот
      // же приём, что читает и шапка листа)
      const rebuildArch = () => {
        const rk = html.find("#wiz-race").val();
        const archEntries = archetypesForRace(rk, {
          subrace: html.find("#wiz-subrace").val() || "",
          pastRace: html.find("#wiz-ynnari-past").val() || ""
        });
        // Группировка по полю group (если есть)
        const grouped = {};
        for (const [k, a] of archEntries) (grouped[a.group || ""] ??= []).push([k, a]);
        const archOpts = archEntries.length
          ? Object.entries(grouped).map(([g, list]) => {
              const opts = list.map(([k, a]) => `<option value="${k}">${esc(a.name)}</option>`).join("");
              return g ? `<optgroup label="${g}">${opts}</optgroup>` : opts;
            }).join("")
          : '<option value="">— нет —</option>';
        html.find("#wiz-arch").html(archOpts);
      };

      const rebuild = () => {
        const rk    = html.find("#wiz-race").val();
        // Субрасы — отбором по родителю (subracesOf), а не по списку внутри расы:
        // тот же приём, что читает и шапка листа.
        const subOpts = ['<option value="">— нет —</option>']
          .concat(subracesOf(rk).map(s => `<option value="${s.key}">${s.label}</option>`));
        html.find("#wiz-subrace").html(subOpts.join(""));
        rebuildArch();
        html.find(".wiz-ynnari-row").toggle(rk === "ynnari");
        html.find(".wiz-harlequin-row").toggle(rk === "harlequin");
        // Аэльдари используют Пути, а не Мировоззрение — скрываем выбор.
        html.find(".wiz-align-row").toggle(!isAeldariRace(rk));
        // Легион+культура — только для Астартес.
        html.find("#wiz-legion").toggle(rk === "astartes");
        if (rk === "astartes") refreshLegion();
        // Уровень старта: подсвечиваем ту колонку опыта, что достанется этой
        // расе, — выбирать её отдельно не нужно.
        html.find(".wh-cstart").toggleClass("cstart-astartes", rk === "astartes");
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

      // ── Склонности: ровно 4 и 4 ──
      // Лишнюю галочку не даём поставить вовсе, вместо того чтобы ругаться
      // после: выбор из десятка фишек и так требует внимания.
      const aptState = () => {
        const picked = {};
        for (const [group, want] of Object.entries(APT_PICK)) {
          const boxes = html.find(`.wiz-apt[data-group="${group}"]`).toArray();
          const on = boxes.filter(b => b.checked).length;
          html.find(`.apt-count[data-for="${group}"]`).text(`${on} / ${want}`)
            .toggleClass("apt-count-full", on === want);
          for (const b of boxes) b.disabled = !b.checked && on >= want;
          picked[group] = on;
        }
        const ready = Object.entries(APT_PICK).every(([g, n]) => picked[g] === n);
        html.find("#wiz-apt-warn").text(ready ? "" : "Выберите Склонности — без них не посчитать ни цены, ни возвраты.");
        // «Создать» ждёт полного выбора: возврат за совпавшую выдачу считается
        // по Склонностям, и посчитанный до их выбора оказался бы не тем.
        html.closest(".app").find("button.dialog-button.apply").prop("disabled", !ready);
        return ready;
      };
      html.find(".wiz-apt").on("change", aptState);
      aptState();

      html.find("#wiz-race").on("change", rebuild);
      // Субраса и Прошлое Иннари сужают список Архетипов (Мандрагора/Развалина/
      // Истиннорождённый; «любая прошлая раса эльдар» у Иннари) — пересобрать
      // #wiz-arch до общего updateWizardNote/renderGen, иначе список отстанет.
      html.find("#wiz-subrace, #wiz-ynnari-past").on("change", () => {
        rebuildArch(); updateWizardNote(html); renderGen();
      });
      html.find("#wiz-arch, #wiz-harlequin-past").on("change", () => {
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
  return done;
}
