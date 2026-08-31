// tools/_g53k-clean-mechanize.mjs — wdbc-g53k: единственная запись Талантов
// с чистым self-only unconditional бонусом навыка, найденная при ПОЛНОМ
// ручном прочтении всех 1105 неавтоматизированных записей packs-src/talents.
import fs from "node:fs";

const patches = [
  { file: "packs-src/talents/Медик/Master_Chirurgeon___Мастер_Хирургеон_j8t62jtbix0dP8pA.json",
    entries: [{ id: "e1", kind: "testMod", modScope: "skill", skillKey: "medicae", modValueMode: "flat", value: 10, label: "Мастер-Хирургеон" }],
    notes: "Применена только «+10 на все тесты Medicae на лечение». «Пациенты восстанавливают +2 Раны от Первой Помощи и любого лечения» не смоделировано — бонус ДРУГОМУ персонажу (пациенту), не тестовый модификатор самого Хирургеона." }
];

for (const p of patches) {
  const doc = JSON.parse(fs.readFileSync(p.file, "utf8"));
  doc.flags ??= {}; doc.flags["warhammer-dbc"] ??= {};
  doc.flags["warhammer-dbc"].mechanics = [{ id: "g", operator: "AND", entries: p.entries }];
  doc.system.notes = p.notes;
  fs.writeFileSync(p.file, JSON.stringify(doc, null, 2) + "\n");
  console.log("OK:", doc.name);
}
