// module/rules/social.mjs
//
// Что на листе считается «социальным». Вкладка СОЦИУМ собирает в одном месте
// всё, чем персонаж действует на других: сами Навыки, Таланты и Черты, и —
// главное — предметы и эффекты, которые эти Навыки правят.
//
// Отбор идёт по СЛЕДУ в данных, а не по списку «социальных» предметов: правило
// живёт в эффекте, и любой предмет, что двигает Обаяние, Общительность,
// Лояльность или Сплочённость, попадает сюда сам, без ручной пометки.

import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../constants/skills.mjs";

/** Ключи Навыков со второй склонностью «Социальные». */
export const SOCIAL_SKILL_KEYS = Object.entries(SKILLS_DEF)
  .filter(([, def]) => def.apt2 === "social").map(([key]) => key);

/** Группы Навыков со второй склонностью «Социальные» (сейчас таких нет). */
export const SOCIAL_GROUP_KEYS = Object.entries(GROUP_SKILLS_DEF)
  .filter(([, def]) => def.apt2 === "social").map(([key]) => key);

/** Характеристика социальных тестов: Общительность. */
const SOCIAL_CHAR = "fel";

/**
 * Ключи полей, правка которых считается социальной. Кроме самих Навыков это
 * Общительность (от неё они и считаются), Лояльность миньона и Сплочённость
 * отряда — обе меряют, насколько за персонажем идут.
 */
export function isSocialKey(key = "") {
  const k = String(key);
  if (SOCIAL_SKILL_KEYS.some(s => k.includes(`skills.${s}`))) return true;
  if (SOCIAL_GROUP_KEYS.some(s => k.includes(`groupSkills.${s}`))) return true;
  if (k.includes(`characteristics.${SOCIAL_CHAR}`)) return true;
  return /loyalty|cohesion/i.test(k);
}

/** Человеческая подпись правки: «Обаяние +10», «Общительность +5». */
export function socialChangeLabel(key = "", value = "") {
  const k = String(key);
  const skill = SOCIAL_SKILL_KEYS.find(s => k.includes(`skills.${s}`));
  const name = skill ? SKILLS_DEF[skill].label
    : k.includes(`characteristics.${SOCIAL_CHAR}`) ? "Общительность"
    : /loyalty/i.test(k) ? "Лояльность"
    : /cohesion/i.test(k) ? "Сплочённость"
    : k;
  const v = String(value ?? "").trim();
  return v && !v.startsWith("-") && !v.startsWith("−") ? `${name} +${v}` : `${name} ${v}`.trim();
}

/**
 * Социальные модификаторы одного источника. На вход — плоское описание
 * предмета или эффекта, на выход — подписи того, чем он влияет; пустой список
 * значит «к социальному отношения не имеет».
 *
 * @param {object} src
 * @param {{key:string,value:any}[]} [src.changes]     правки ActiveEffect
 * @param {{stat:string,value:number}[]} [src.charBonuses] надбавки характеристик предмета
 */
export function socialEffectsOf(src = {}) {
  const out = [];
  for (const ch of src.changes ?? []) {
    if (isSocialKey(ch?.key)) out.push(socialChangeLabel(ch.key, ch.value));
  }
  for (const cb of src.charBonuses ?? []) {
    if (cb?.stat === SOCIAL_CHAR && Number(cb.value))
      out.push(socialChangeLabel(`characteristics.${SOCIAL_CHAR}`, cb.value));
  }
  return out;
}

/** Влияет ли источник на социальное вообще. */
export function isSocialSource(src = {}) {
  return socialEffectsOf(src).length > 0;
}

// ── Отбор по тексту ──────────────────────────────────────────────────────────
// У Талантов, Черт и Мутаций правило почти всегда описано словами, а не
// эффектом: «+10 к Командованию против своей банды» живёт в тексте `benefit`.
// Машинного следа у такого нет, поэтому социальность видна только по упоминанию
// самих Навыков и понятий — и по-русски, и по-английски, как в книге.

/** Слово целиком: «Fel» не должен ловиться внутри «Felling». */
const term = (...words) => new RegExp(`(^|[^\\p{L}])(${words.join("|")})([^\\p{L}]|$)`, "iu");

const SOCIAL_TERMS = [
  { label: "Обаяние",       re: term("Обаяни\\p{L}*", "Charm") },
  { label: "Командование",  re: term("Командовани\\p{L}*", "Command", "Commands") },
  { label: "Обман",         re: term("Обман\\p{L}*", "Deceive") },
  { label: "Запугивание",   re: term("Запугивани\\p{L}*", "Intimidate") },
  { label: "Дознание",      re: term("Дознани\\p{L}*", "Inquiry") },
  { label: "Допрос",        re: term("Допрос\\p{L}*", "Interrogate") },
  { label: "Коммерция",     re: term("Коммерци\\p{L}*", "Commerce") },
  { label: "Общительность", re: term("Общительност\\p{L}*", "Fellowship", "Fel", "F\\.b") },
  { label: "Лояльность",    re: term("Лояльност\\p{L}*", "Loyalty") },
  { label: "Сплочённость",  re: term("Сплочённост\\p{L}*", "Сплоченност\\p{L}*", "Слаженност\\p{L}*", "Cohesion") }
];

/** Что из социального упоминает текст. Пустой список — не про социальное. */
export function socialMentions(text = "") {
  const src = String(text ?? "");
  if (!src.trim()) return [];
  return SOCIAL_TERMS.filter(t => t.re.test(src)).map(t => t.label);
}

/**
 * Социальность Таланта, Черты или Мутации: сперва машинный след (он точнее),
 * иначе — упоминания в тексте правила.
 *
 * @returns {string[]} чем зацепило; пусто — на вкладке СОЦИУМ ему не место
 */
export function socialReasons(src = {}, text = "") {
  const byEffects = socialEffectsOf(src);
  return byEffects.length ? byEffects : socialMentions(text);
}
