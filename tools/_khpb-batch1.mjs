// tools/_khpb-batch1.mjs — wdbc-khpb, первая партия: боеприпасы с чистым
// текстовым обещанием в system.special, переносим в properties[]/condMods[]
// (механизм уже рабочий — module/combat/attack-weapon.mjs::mergeExtraProps,
// тот же реестр WEAPON_PROPERTIES, что у оружия). Образец — уже существующие
// "Трассер"/"Токс"/"Шип" в этом же паке.
//
// Отобраны только записи, где ВЕСЬ текст (или его основная часть) ложится на
// готовые ключи свойств без выдумывания новой механики. Где в тексте есть
// доп. условие сверх известных ключей (напр. «против живых Toxic 0»,
// «урон в WS и A», РоФ-зависимые бонусы) — условие остаётся в notes как не
// смоделированное, тем же приёмом, что и в wdbc-pmdu/wdbc-j1nc.
import fs from "node:fs";

const patches = [
  {
    file: "Специальные___Автопушка/Трассер__автопушка__be836trtk2TM6u9E.json",
    props: [], condMods: [{ label: "Повторный выстрел по той же цели", atk: 5, dmg: 0, wp: [], note: "" }]
  },
  {
    // найдено ниже по фактическому пути
    match: "Трассер (болт)",
    props: [], condMods: [{ label: "Повторный выстрел по той же цели", atk: 5, dmg: 0, wp: [], note: "" }]
  },
  { match: "Укреплённая батарея", props: [{ key: "reliable", rating: 0, rating2: 0 }] },
  { match: "Стабилизированное",   props: [{ key: "reliable", rating: 0, rating2: 0 }] },
  { match: "Освящённый прометий", props: [{ key: "sanctified", rating: 0, rating2: 0 }] },
  { match: "Псиболт",
    props: [{ key: "sanctified", rating: 0, rating2: 0 }, { key: "unreliable", rating: 0, rating2: 0 }],
    notes: "Не смоделирован доп. урон +½ Cor.b цели (окр. вверх) — нет точки входа для урона, зависящего от Порчи ЦЕЛИ." },
  { match: "Праведник",
    props: [{ key: "sanctified", rating: 0, rating2: 0 }],
    notes: "Не смоделирован доп. урон +½ Cor.b цели (окр. вверх) — нет точки входа для урона, зависящего от Порчи ЦЕЛИ." },
  { match: "Базовые Ядокристаллы", props: [{ key: "toxic", rating: 2, rating2: 0 }] },
  { match: "Сверхтоксичные",       props: [{ key: "toxic", rating: 4, rating2: 0 }] },
  { match: "Демонобой",
    props: [{ key: "toxic", rating: 2, rating2: 0 }],
    notes: "Не смоделировано: против живых целей рейтинг Toxic должен быть 0 (сейчас применяется 2 всегда); игнор Daemonic/Stuff of Nightmares — не только числовой рейтинг." },
  { match: "Парализаторы",
    props: [{ key: "toxic", rating: 2, rating2: 0 }],
    notes: "Не смоделировано: урон от этого Toxic идёт в WS и A персонажа, а не как обычные Раны." },
  { match: "Резонирующие",
    props: [{ key: "blast", rating: 1, rating2: 0 }, { key: "toxic", rating: 1, rating2: 0 }],
    notes: "Не смоделирован штраф −2×Скорострельность на Избегание цели." },
  { match: "Гибельный удар",
    props: [{ key: "felling", rating: 4, rating2: 0 }, { key: "razorSharp", rating: 0, rating2: 0 }, { key: "unreliable", rating: 0, rating2: 0 }] },
  { match: "Землетрясение",
    props: [{ key: "concussive", rating: 2, rating2: 0 }],
    notes: "Не смоделирована area-часть: все стоящие на земле в радиусе 3 м проходят тест A−20 или сбиты с ног — нужна AoE-геометрия (см. wdbc-wlwf)." }
];

const root = "packs-src/ammunition";
function findFile(dir, matchName) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { const r = findFile(p, matchName); if (r) return r; }
    else if (entry.name.endsWith(".json") && !entry.name.startsWith("_Folder")) {
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      if (j.name === matchName) return p;
    }
  }
  return null;
}

for (const p of patches) {
  const file = p.file ? `${root}/${p.file}` : findFile(root, p.match);
  if (!file) { console.error("NOT FOUND:", p.match); continue; }
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  doc.system.properties = p.props;
  if (p.condMods) doc.system.condMods = p.condMods;
  if (p.notes) doc.system.notes = p.notes;
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
  console.log("OK:", doc.name);
}
