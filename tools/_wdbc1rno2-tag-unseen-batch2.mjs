// tools/_wdbc1rno2-tag-unseen-batch2.mjs
//
// wdbc-1rno.2: второй проход тегирования weaponProps.unseen — 17 психосил +
// 5 техночудес, каждое подтверждено разведкой индивидуально (строка «Тип:»/
// вступительная классификация system.effect дословно содержит «Незримое»).
// У психосил weaponProps уже существует как ключ (пуст/с другими записями)
// — просто пушим; у техночудес ключа нет вовсе в JSON — вставляем текстом
// на каноническую позицию схемы (после "penetration", перед "effect"), тем
// же приёмом, что первый батч (Voltagheist Retribution и т.п.).
//
// Запускать из корня репозитория: node tools/_wdbc1rno2-tag-unseen-batch2.mjs

import { readFileSync, writeFileSync } from "node:fs";

const PSYCHIC_POWERS_WITH_KEY = [
  "packs-src/psychic-powers/ФУНДАМЕНТАЛЬНЫЕ_ДИСЦИПЛИНЫ/ТЕЛЕКИНЕЗ/Сокрушение/Eye_of_the_Storm___Глаз_Шторма_58aYFChd9xVNTvfp.json",
  "packs-src/psychic-powers/ФУНДАМЕНТАЛЬНЫЕ_ДИСЦИПЛИНЫ/ТЕЛЕКИНЕЗ/Сокрушение/Force_Storm___Силовой_Шторм_hdxybnMQdvFdfjhZ.json",
  "packs-src/psychic-powers/ФУНДАМЕНТАЛЬНЫЕ_ДИСЦИПЛИНЫ/ТЕЛЕКИНЕЗ/Гравимантия/Gravity_Field___Гравитационное_Поле_d2pXG76awBbUuEmV.json",
  "packs-src/psychic-powers/ФУНДАМЕНТАЛЬНЫЕ_ДИСЦИПЛИНЫ/ТЕЛЕПАТИЯ/Ментальное_оружие/Banshee_Howl___Вопль_Баньши_o5N1LtVBzTR5tbE7.json",
  "packs-src/psychic-powers/ФУНДАМЕНТАЛЬНЫЕ_ДИСЦИПЛИНЫ/ТЕЛЕПАТИЯ/Ментальное_оружие/Mind_Sliver___Осколок_Разума_4PuRl0LpZWWEYbqB.json",
  "packs-src/psychic-powers/ФУНДАМЕНТАЛЬНЫЕ_ДИСЦИПЛИНЫ/БИОМАНТИЯ/Витамантия/Life_Leech___Вытягивание_Жизни_v3u3BOe61qXC7H7n.json",
  "packs-src/psychic-powers/БОЖЕСТВЕННЫЕ_ДИСЦИПЛИНЫ/Нургл/Corpse_Burst___Трупный_Взрыв_dvOyChhZj1F1cATj.json",
  "packs-src/psychic-powers/РЕДКИЕ_ДИСЦИПЛИНЫ/Хрономантия/Stasis___Стазис_RaMHHYEXuIMJWhEb.json",
  "packs-src/psychic-powers/РЕДКИЕ_ДИСЦИПЛИНЫ/Хрономантия/Chronosphere___Хроносфера_qZR6vQ5MfsLGL5WX.json",
  "packs-src/psychic-powers/РЕДКИЕ_ДИСЦИПЛИНЫ/Криомантия/Cocytus___Коцит_s8aGbatYJaDJbDZ2.json",
  "packs-src/psychic-powers/РЕДКИЕ_ДИСЦИПЛИНЫ/Геомантия/Demolition___Снос_1VLyxLzfqztHGPjo.json",
  "packs-src/psychic-powers/РЕДКИЕ_ДИСЦИПЛИНЫ/Фульминация/Electrodrain___Электропоглощение_HzOaWjfAy7Mo9UsU.json",
  "packs-src/psychic-powers/РЕДКИЕ_ДИСЦИПЛИНЫ/Умбрамантия/Darkness_Within___Внутренняя_Тьма_KO9kttBXdSrggVJn.json",
  "packs-src/psychic-powers/РЕДКИЕ_ДИСЦИПЛИНЫ/Умбрамантия/Abyss___Бездна_jD1WHFdEghwthCEC.json",
  "packs-src/psychic-powers/РЕДКИЕ_ДИСЦИПЛИНЫ/Магия_Крови/Exanguinate___Обескровливание_4U1LCnxJ0uGNlruP.json",
  "packs-src/psychic-powers/ПСИХОСИЛЫ/КОЛДОВСТВО/Амальгамы/Loom_Aflame___Веретено_в_Огне_VtbuzgTOHOzOOZha.json",
  "packs-src/psychic-powers/ПСИХОСИЛЫ/КОЛДОВСТВО/Амальгамы/Phantom_Flame___Фантомное_Пламя_ifdNMb0wU0FJ3bjJ.json"
];

const TECH_POWERS_WITHOUT_KEY = [
  "packs-src/tech-powers/ТЕХНОЧУДЕСА/МОТИВОТЕУРГИЯ/Феррик/Ferric_Commandment___Феррическая_Заповед_kvdlk1ciw8pPMrDE.json",
  "packs-src/tech-powers/ТЕХНОЧУДЕСА/МОТИВОТЕУРГИЯ/Феррик/Ferric_Summon___Феррический_Призыв_Onn60nmJaudW3NtF.json",
  "packs-src/tech-powers/ТЕХНОЧУДЕСА/МОТИВОТЕУРГИЯ/Феррик/Ferric_Sanctuary___Феррическое_Святилище_rM9gnn1k1fBihktc.json",
  "packs-src/tech-powers/ТЕХНОЧУДЕСА/МОТИВОТЕУРГИЯ/Феррик/Ferric_Exousia___Феррическая_Эксусия_bsBXzsAtZToWkvX9.json",
  "packs-src/tech-powers/ТЕХНОЧУДЕСА/КИБЕРТЕУРГИЯ/Киберпсалмы/Psalm_of_the_Death_s_Breath___Псалом_Дых_reSvqICRJXE5LeCH.json"
];

let count = 0;

for (const f of PSYCHIC_POWERS_WITH_KEY) {
  const raw = readFileSync(f, "utf8");
  const doc = JSON.parse(raw);
  if (!Array.isArray(doc.system.weaponProps)) throw new Error(`нет weaponProps: ${f}`);
  if (doc.system.weaponProps.some(p => p.key === "unseen")) { console.log("уже есть:", f); continue; }
  doc.system.weaponProps.push({ key: "unseen" });
  const canon = JSON.stringify(doc, null, 2) + "\n";
  writeFileSync(f, canon, "utf8");
  count++;
  console.log("протегировано:", f);
}

for (const f of TECH_POWERS_WITHOUT_KEY) {
  const raw = readFileSync(f, "utf8");
  if (raw.includes('"weaponProps"')) { console.log("уже есть (текстом):", f); continue; }
  const marker = /"penetration": (0|10),\n/;
  if (!marker.test(raw)) throw new Error(`не нашёл маркер penetration: ${f}`);
  const patched = raw.replace(marker, (m) => `${m}    "weaponProps": [\n      {\n        "key": "unseen"\n      }\n    ],\n`);
  // Проверка канонического round-trip ПОСЛЕ патча.
  const doc = JSON.parse(patched);
  const canon = JSON.stringify(doc, null, 2) + "\n";
  if (canon !== patched) throw new Error(`round-trip разошёлся после патча: ${f}`);
  writeFileSync(f, patched, "utf8");
  count++;
  console.log("протегировано:", f);
}

console.log(`\n${count} / ${PSYCHIC_POWERS_WITH_KEY.length + TECH_POWERS_WITHOUT_KEY.length} файлов протегировано.`);
