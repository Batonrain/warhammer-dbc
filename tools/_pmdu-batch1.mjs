// tools/_pmdu-batch1.mjs — wdbc-pmdu, первая партия: 12 модов оружия с чистым
// текстовым обещанием числа, переносим в system.effects (damageMod/penMod/
// addProps/removeProps — механизм уже рабочий, module/combat/weapon-mods.mjs).
// Отобраны только БЕЗУСЛОВНЫЕ по духу правки: где есть оговорка «только на
// профилях с X» — оговорка не моделируется (эффект в движке действует на всё
// оружие разом, не по профилям), честно отмечена в notes. Пропущены Frost
// Field/Promethean Field (переключаемое состояние вкл/выкл) и Ring
// Accelerator (число зависит от режима очереди) — риск исказить баланс выше
// цены оставить текстом.
import fs from "node:fs";

const patches = [
  {
    file: "packs-src/weapon-mods/Рукопашное/Материалы/Kraken_Teeth___Зубья_Кракена_3dyIoFDOSdghY91g.json",
    fx: { damageMod: 4, penMod: 3, addProps: [{ key: "reinforced" }] },
    notes: "Оговорка не смоделирована: бонус в тексте — только на профилях со свойством Tearing, здесь применяется ко всему оружию."
  },
  {
    file: "packs-src/weapon-mods/Рукопашное/Материалы/Lathe_Steel___Латейская_Сталь_x3XXSbMQb1L737JN.json",
    fx: { damageMod: 2, penMod: 3, addProps: [{ key: "reinforced" }], removeProps: ["primitive"] },
    notes: "Оговорка не смоделирована: бонус в тексте — только на профилях лезвий, здесь применяется ко всему оружию."
  },
  {
    file: "packs-src/weapon-mods/Рукопашное/Материалы/Lathe_Teeth___Латейские_Зубья_P8UfFhMsgtykdeZY.json",
    fx: { damageMod: 2, penMod: 1, addProps: [{ key: "reinforced" }] },
    notes: "Оговорка не смоделирована: бонус в тексте — только на профилях лезвий, здесь применяется ко всему оружию."
  },
  {
    file: "packs-src/weapon-mods/Рукопашное/Материалы/Mono___Mono_mlMNE3SD4MMXY5Gd.json",
    fx: { penMod: 2, removeProps: ["primitive"] },
    notes: "Оговорка не смоделирована: бонус в тексте — только на профилях R со свойством Primitive, здесь применяется ко всему оружию."
  },
  {
    file: "packs-src/weapon-mods/Рукопашное/Материалы/Reinforced___Усиленное_DkTnhgqg2frK0zwq.json",
    fx: { damageMod: 1, removeProps: ["primitive"] },
    notes: "Оговорка не смоделирована: бонус в тексте — только на профилях I(Cr) с Primitive, кроме Посоха. «Щиты также +1 AP» — другая система (armor-mods), не эта запись."
  },
  {
    file: "packs-src/weapon-mods/Рукопашное/Материалы/Teldrite_Core___Телдритовый_Сердечник_ix8rdsZrsagnqwCq.json",
    fx: { damageMod: 4 },
    notes: "Не смоделировано: бонус в тексте — только на профилях бойков/посоха; +1 к рейтингу Concussive «если есть» (условно); «Щит — +30 на тесты S с щитом» — отдельная механика щита."
  },
  {
    file: "packs-src/weapon-mods/Рукопашное/Силовое/Storm_Field___Штормовое_Поле_lXXTP7352lFX0GfK.json",
    fx: { damageMod: 2, penMod: 2 },
    notes: "Не смоделировано: рост шанса Power Field до 100% (с 75%) и штраф «попадание в руку» при Критическом Провале."
  },
  {
    file: "packs-src/weapon-mods/Рукопашное/Цепное/Chain_of_Iron_Fangs___Цепь_Железных_Клык_kudXm6X2M2MHcVZy.json",
    fx: { damageMod: 2, penMod: 2 },
    notes: "Не смоделировано: сопутствующая модификация «Цепь» (отображает кабель к ранцу)."
  },
  {
    file: "packs-src/weapon-mods/Рукопашное/Материалы/Hardwood___Тв_рдое_Дерево_WBc2PI3RHUFdBtw6.json",
    fx: { damageMod: 1, removeProps: ["primitive"] },
    notes: "Текст ограничивает бонус профилем Посоха — здесь применяется ко всему оружию (для древковых материалов это обычно единственный профиль)."
  },
  {
    file: "packs-src/weapon-mods/Рукопашное/Клинки/Poisoned_Blade___Ядовитый_Клинок_bxXQDvcwx6dLkp1I.json",
    fx: { addProps: [{ key: "toxic", rating: 0 }] },
    notes: "Рейтинг Toxic (0) — как в самом тексте: зависит от применяемого яда, книжный плейсхолдер, не константа. Оговорка «только R-профили» не смоделирована."
  },
  {
    file: "packs-src/weapon-mods/Рукопашное/Клинки/Venom_Channel___Ядовитый_Желоб_abfz00ENbmNC4isF.json",
    fx: { addProps: [{ key: "toxic", rating: 0 }] },
    notes: "Рейтинг Toxic (0) — как в самом тексте: зависит от применяемого яда. Расходуемый контейнер на 10 зарядов и его перезарядка не смоделированы."
  },
  {
    file: "packs-src/weapon-mods/Рукопашное/Силовое/Power_Field_Stabilizer___Стабилизатор_Си_WMYhav7tjsQrAjGN.json",
    fx: { damageMod: -2 },
    notes: "Не смоделирована смена типа урона (E → R или I(Cr)) — только числовой штраф −2 Dmg, идущий с ней в комплекте по тексту."
  }
];

for (const p of patches) {
  const doc = JSON.parse(fs.readFileSync(p.file, "utf8"));
  Object.assign(doc.system.effects, p.fx);
  doc.system.notes = p.notes;
  fs.writeFileSync(p.file, JSON.stringify(doc, null, 2) + "\n");
  console.log("OK:", doc.name);
}
