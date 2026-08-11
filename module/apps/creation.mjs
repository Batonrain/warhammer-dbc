// module/apps/creation.mjs
//
// Мастер создания персонажа: то, что раса, архетип, субраса и культура легиона
// выдают персонажу на старте. Здесь — выдача навыков и снаряжения; функции
// принимают актора, а не лист, поэтому проверяются без Foundry.

import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../constants/skills.mjs";
import { splitTopLevel }                from "../helpers/utils.mjs";

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
  const esc = s => String(s).replace(/</g,"&lt;");
  const rows = resolved.map(r => {
    const done = created.some(c => esc(r).toLowerCase().includes(c.toLowerCase().split("/")[0].trim()));
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
  const esc = s => String(s).replace(/"/g,"&quot;").replace(/</g,"&lt;");
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
  const esc = s => String(s).replace(/"/g,"&quot;").replace(/</g,"&lt;");
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
