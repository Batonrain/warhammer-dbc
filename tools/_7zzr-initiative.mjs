// tools/_7zzr-initiative.mjs
//
// Одноразовая правка паков под wdbc-7zzr/wdbc-s2tp: подключить к Инициативе
// четыре Таланта корбука (стр. 62) и две расовые Черты Аэльдари.
//
//   node tools/_7zzr-initiative.mjs
//
// Записи Конструктора кладутся минимальной формой ({id, kind, group,
// capabilityKey, label}) — так уже лежит Unarmed_Warrior, движок дочитывает
// остальные поля умолчаниями blankEntry.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const id16 = () => Array.from({ length: 16 },
  () => ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)]).join("");

const PLAN = [
  {
    file: "packs-src/talents/Общие/Combat_Formation___Боевое_Построение_ISxUYkVfUQPpRDRh.json",
    capability: "combat.initiativeChar.int",
    label: "Инициатива по I.b вместо A.b",
    notes: "МЕХАНИЗИРОВАНО (wdbc-7zzr): +1 к Инициативе — embedded ActiveEffect на "
         + "system.initiative (был и раньше). «Использует I.b вместо A.b» — запись "
         + "Конструктора kind:\"capability\", capabilityKey:\"combat.initiativeChar.int\"; "
         + "module/rules/initiative.mjs::initiativeCharKey берёт ЛУЧШУЮ из разрешённых "
         + "характеристик, потому что книга говорит «может использовать». "
         + "НЕ механизировано: раздача +1 и подмены соратникам, «с которыми он поделился "
         + "планами» — это не свойство носителя, а разовое решение за столом; ближайший "
         + "механизм (kind:\"aura\") раздаёт по радиусу, а не по списку тех, кому "
         + "рассказали, и врал бы книге."
  },
  {
    file: "packs-src/talents/Общие/Combat_Sense___Чувство_Боя_TXknauIyLtEeIHr2.json",
    capability: "combat.initiativeChar.per",
    label: "Инициатива по P.b вместо A.b",
    notes: "МЕХАНИЗИРОВАНО (wdbc-7zzr): запись Конструктора kind:\"capability\", "
         + "capabilityKey:\"combat.initiativeChar.per\" — module/rules/initiative.mjs::"
         + "initiativeCharKey подставляет P.b вместо A.b, если он больше (книга говорит "
         + "«может использовать», игрок в этом выборе всегда взял бы большее)."
  },
  {
    file: "packs-src/talents/Общие/Fastest_Hand___Самая_Быстрая_Рука_gzn2fta3Mxt6NYkf.json",
    capability: "combat.fastestHand",
    label: "+WS.b/BS.b к Инициативе при ножах/пистолетах",
    notes: "МЕХАНИЗИРОВАНО (wdbc-7zzr): запись Конструктора kind:\"capability\", "
         + "capabilityKey:\"combat.fastestHand\" — module/rules/initiative.mjs::"
         + "fastestHandBonus смотрит, что реально занимает руки (rules/hands.mjs::"
         + "handHeldItems), и даёт большее из WS.b (нож, meleeCategory:\"Нож\") и BS.b "
         + "(пистолет, weaponClass:\"pistol\"). Любое другое оружие в руках отменяет "
         + "надбавку. Книжная оговорка «очередность хода пересчитывается с начала "
         + "следующего Раунда» относится к порядку в трекере, а не к числу на листе — "
         + "число меняется сразу, как и сказано в книге."
  },
  {
    file: "packs-src/talents/Общие/Lightning_Reflexes___Молниеносные_Рефлек_D5cYACbielvSDp49.json",
    capability: "combat.initiativeExtraRoll",
    label: "+1 бросок Инициативы",
    notes: "МЕХАНИЗИРОВАНО (wdbc-7zzr): запись Конструктора kind:\"capability\", "
         + "capabilityKey:\"combat.initiativeExtraRoll\" — module/rules/initiative.mjs::"
         + "initiativeRolls прибавляет один бросок к базовому, "
         + "module/documents/combatant.mjs подменяет кубик формулы на «kh1». Броски "
         + "складываются: у эльдара (три броска) с этим Талантом их четыре — ровно как "
         + "сказано в Книге Аэльдари."
  },
  {
    file: "packs-src/traits/Трейты_рас/Eldarten___Эльдарское_Тело_cc15Wix1kcpUv7gc.json",
    capability: "combat.initiativeAdvantage",
    label: "Инициатива: три броска, лучший",
    benefitFix: ["инициатива — 3 броска, лучший, +4 к Инициативе",
                 "инициатива — 3 броска, лучший"],
    notes: "МЕХАНИЗИРОВАНО ЧАСТИЧНО (wdbc-s2tp): доп. Реакция — embedded ActiveEffect "
         + "на system.reactions.max (была и раньше); «три броска, лучший» — запись "
         + "Конструктора kind:\"capability\", capabilityKey:\"combat.initiativeAdvantage\". "
         + "Обещанное строкой «+4 к Инициативе» УБРАНО как ошибка пака, а не потеряно: "
         + "в Книге Аэльдари («У всех эльдар имеется дополнительная Реакция. Эльдар "
         + "бросает на инициативу три раза…») никакого +4 нет; +4 есть у Серых Людей, "
         + "оттуда и затесалось копипастой."
  },
  {
    file: "packs-src/traits/Трейты_рас/Druchiiten___Друкхарийское_Тело_ZLATFu69yTzv3tIr.json",
    capability: "combat.initiativeAdvantage",
    label: "Инициатива: три броска, лучший",
    benefitFix: ["+4 к Инициативе (3 броска, лучший)", "инициатива — 3 броска, лучший"],
    notes: "МЕХАНИЗИРОВАНО ЧАСТИЧНО (wdbc-s2tp, та же правка, что у Эльдарского Тела): "
         + "«три броска, лучший» — запись Конструктора kind:\"capability\", "
         + "capabilityKey:\"combat.initiativeAdvantage\". «+4 к Инициативе» убрано: в "
         + "Книге Аэльдари у Друкхари сказано ровно то же, что у эльдар («Друкхари "
         + "бросает на инициативу три раза и выбирает наилучший результат. Если у "
         + "друкхари есть Lightning Reflexes – он бросает не три, а четыре раза»), про "
         + "+4 там нет ни слова."
  }
];

for (const step of PLAN) {
  const abs = path.join(ROOT, step.file);
  const doc = JSON.parse(fs.readFileSync(abs, "utf8"));

  const ns = (doc.flags ??= {})["warhammer-dbc"] ??= {};
  const mechanics = ns.mechanics ??= [];
  const already = mechanics.some(g => (g.entries ?? [])
    .some(e => e.kind === "capability" && e.capabilityKey === step.capability));
  if (!already) {
    mechanics.push({
      id: id16(), operator: "AND",
      entries: [{ id: id16(), kind: "capability", group: null,
                  capabilityKey: step.capability, label: step.label }]
    });
  }

  doc.system ??= {};
  doc.system.notes = step.notes;
  if (step.benefitFix) {
    const [from, to] = step.benefitFix;
    if (!doc.system.benefit?.includes(from)) throw new Error(`нет строки «${from}» в ${step.file}`);
    doc.system.benefit = doc.system.benefit.replace(from, to);
  }

  fs.writeFileSync(abs, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  console.log(`${already ? "уже было" : "добавлено"}: ${step.capability} — ${step.file}`);
}
