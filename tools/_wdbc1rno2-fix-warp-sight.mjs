// tools/_wdbc1rno2-fix-warp-sight.mjs
//
// wdbc-1rno.2: у 30 демонов Хаоса в bestiary встроенный трейт «Warp Sight»
// несёт один и тот же урезанный текст (копипаста), заменяющий настоящее
// книжное правило (core.json, «Warp Sight»): «автоматически засекает
// Незримые психические атаки» — прямой третий канал засечения для этого
// тикета, до сих пор не смоделированный из-за того, что и сам текст был
// потерян. Правит benefit/notes ровно там, где текст ТОЧНО совпадает со
// старой заглушкой — не трогает Медузу (элитный архетип)/Друкхари-Медузу/
// Дар одержимых «Warp Sight», у которых текст другой (см. bd wdbc-1rno.2
// комментарий: решено индивидуально, не бездумной заменой по имени).
//
// Запускать из корня репозитория: node tools/_wdbc1rno2-fix-warp-sight.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const OLD_BENEFIT = "Видит сквозь Завесу и души.";
const OLD_NOTES = "«Видит потоки имматериума» — сенсорная флейвор-способность без числового правила в движке.";

const NEW_BENEFIT =
  "Персонаж способен видеть течения Варпа с той же лёгкостью, как другие видят свет, и его разум защищён от безумия, " +
  "обычно вызываемого незащищённым взглядом в Эмпиреи. Он видит потоки Варпа вокруг него по обе стороны Барьера и " +
  "автоматически засекает все психосилы и прочие эффекты, вызванные энергиями Варпа, видя их как потоки света и тьмы. " +
  "Это, кроме прочего, позволяет ему автоматически засекать Незримые психические атаки. Это отдельное чувство, " +
  "независимое от обычного зрения, и только психические барьеры мешают ему, хотя чтобы разобрать потоки Варпа вдали " +
  "(если только они не огромные) ГМ может затребовать тест Awareness со штрафом от расстояния. Варп-зрение " +
  "направленное, как обычное зрение, но шлемы и доспехи не ограничивают его обзор. Персонаж всё ещё должен иметь " +
  "нужные Навыки группы Forbidden Lore, чтобы понимать значение потоков Варпа, которые он видит.";

const NEW_NOTES =
  "Автоматическое засекание Незримых психических атак — реализовано (module/rules/unseen-attack.mjs::hasWarpSight, " +
  "wdbc-1rno.2). Остальное (полный обзор течений Варпа, иммунитет к безумию от взгляда в Эмпиреи, тест Awareness на " +
  "дальние потоки) — не смоделировано, флейвор-описание восприятия.";

const files = execSync('grep -rl \'"name": "Warp Sight"\' packs-src/bestiary', { maxBuffer: 1e8 })
  .toString().trim().split("\n").filter(Boolean);

let fixed = 0;
for (const f of files) {
  const raw = readFileSync(f, "utf8");
  const doc = JSON.parse(raw);
  let changed = false;
  for (const item of doc.items ?? []) {
    if (item.name !== "Warp Sight") continue;
    if (item.system?.benefit === OLD_BENEFIT) { item.system.benefit = NEW_BENEFIT; changed = true; }
    if (item.system?.notes === OLD_NOTES) { item.system.notes = NEW_NOTES; changed = true; }
  }
  if (!changed) continue;
  const canon = JSON.stringify(doc, null, 2) + "\n";
  writeFileSync(f, canon, "utf8");
  fixed++;
  console.log("fixed:", f);
}
console.log(`\n${fixed} / ${files.length} файлов исправлено.`);
