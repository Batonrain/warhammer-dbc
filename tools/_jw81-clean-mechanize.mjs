// tools/_jw81-clean-mechanize.mjs — wdbc-jw81: 3 записи psychic-powers с чистым
// однозначным self-бонусом, найденные при полном ручном прочтении всех 599
// записей psychic-powers+tech-powers. Используют НОВУЮ область testMod
// modValueMode:"charBonus"/modCharBonus:"pr" (module/rules/resolve-test.mjs —
// значение = actor.system.psyker.currentRating × multiplier), построенную в
// этом же проходе для класса «+PR»/«+N×PR», который покрывает почти каждую
// запись пака, но почти всегда в сочетании с иными условиями/множественными
// целями, что и не даёт общий выход выше единичных случаев.
import fs from "node:fs";

const patches = [
  { file: "packs-src/psychic-powers/РЕДКИЕ_ДИСЦИПЛИНЫ/Хрономантия/Inner_Clock___Внутренние_Часы_IUmsxWrrV5blCyfn.json",
    entries: [{ id: "e1", kind: "testMod", modScope: "char", rerollChar: "ws", modValueMode: "charBonus", modCharBonus: "pr", modCharBonusMultiplier: 2, label: "Внутренние Часы" }],
    notes: "Применена только «+2×PR на все тесты WS». «Всегда знает время/дату» и авто-засечка искажений времени — не тестовый модификатор, не смоделированы." },
  { file: "packs-src/psychic-powers/ФУНДАМЕНТАЛЬНЫЕ_ДИСЦИПЛИНЫ/БИОМАНТИЯ/Метаморфозы/Sharpened_Senses___Усиленные_Чувства_ubqOCU2nVYsmH5LZ.json",
    entries: [{ id: "e1", kind: "testMod", modScope: "char", rerollChar: "per", modValueMode: "charBonus", modCharBonus: "pr", modCharBonusMultiplier: 5, label: "Усиленные Чувства" }],
    notes: "Применена только «+5×PR на тесты P». Unnatural Senses (PR×2) и опциональное усиление одного чувства (Dark Sight/Sonar Sense/и т.д.) не смоделированы — выбор одного из пяти вариантов, вне testMod." },
  { file: "packs-src/psychic-powers/ФУНДАМЕНТАЛЬНЫЕ_ДИСЦИПЛИНЫ/ТЕЛЕКИНЕЗ/Тонкость/Telekine_Mantle___Телекинетическая_Манти_gQDwXa8JrvPZ3SRi.json",
    entries: [
      { id: "e1", kind: "testMod", modScope: "char", rerollChar: "ws", modValueMode: "charBonus", modCharBonus: "pr", modCharBonusMultiplier: 3, label: "Телекинетическая Мантия" },
      { id: "e2", kind: "testMod", modScope: "char", rerollChar: "s", modValueMode: "charBonus", modCharBonus: "pr", modCharBonusMultiplier: 3, label: "Телекинетическая Мантия" }
    ],
    notes: "Применены «+3×PR к WS» и «+3×PR к S». «+3×PR к A» не смоделирован — Атаки не входят в 9 характеристик (нет char-scope testMod для derived-поля Attacks)." }
];

for (const p of patches) {
  const doc = JSON.parse(fs.readFileSync(p.file, "utf8"));
  doc.flags ??= {}; doc.flags["warhammer-dbc"] ??= {};
  doc.flags["warhammer-dbc"].mechanics = [{ id: "g", operator: "AND", entries: p.entries }];
  doc.system.notes = p.notes;
  fs.writeFileSync(p.file, JSON.stringify(doc, null, 2) + "\n");
  console.log("OK:", doc.name);
}
