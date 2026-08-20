// tools/book-source.mjs
// ════════════════════════════════════════════════════════════════════════
//  Обратная сторона tools/book-docs.mjs: документы компендиума -> исходник
//  packs-src/books/<slug>.json.
//
//  Нужна потому, что текст книг в паках правился руками: сырая выгрузка из
//  PDF идёт двумя столбцами вперемешку, и вычитанные разделы живут только в
//  компендиуме. Извлечение возвращает их в исходник, и дальше книга
//  собирается из него.
//
//  Ссылки @UUID снимаются до подписи: их расставляет сборка (linkify), и
//  сохранённая ссылка попала бы внутрь новой при следующей.
// ════════════════════════════════════════════════════════════════════════

const NS = "warhammer-dbc";

/** Текст страницы без ссылок: @UUID[...]{Подпись} -> Подпись. */
export const unlink = (html) => String(html ?? "").replace(/@UUID\[[^\]]+\]\{([^}]*)\}/g, "$1");

const bySort = (a, b) => (a.sort ?? 0) - (b.sort ?? 0);

/** Разметка разбора закладок PDF, если она у раздела была. Порядок — как в исходнике. */
function outline(page) {
  const flags = page.flags?.[NS] ?? {};
  const out = {};
  for (const key of ["pdfEnd", "level", "checked"]) {
    if (flags[key] !== undefined) out[key] = flags[key];
  }
  return out;
}

/**
 * Исходник книги по документам её компендиума.
 * @param {object} existing  прежний исходник — из него берётся описание книги
 * @param {object[]} docs    документы компендиума (JournalEntry со страницами)
 */
export function bookSource(existing, docs) {
  return {
    slug: existing.slug,
    title: existing.title,
    file: existing.file,
    pdfPages: existing.pdfPages,
    entries: [...docs].sort(bySort).map(doc => ({
      name: doc.name,
      pdfPage: doc.flags?.[NS]?.pdfPage,
      pages: [...(doc.pages ?? [])].sort(bySort).map(page => ({
        name: page.name,
        pdfPage: page.flags?.[NS]?.pdfPage,
        // Разметка разбора закладок (см. outlineFlags в tools/book-docs.mjs).
        // Ключи ставятся по одному и только если они пришли из пака: порядок
        // здесь тот же, что в исходнике, а лишний ключ со значением undefined
        // JSON.stringify выбросит — но у книг без разметки не должно появиться
        // и его, иначе круговорот покажет правку на ровном месте.
        ...outline(page),
        html: unlink(page.text?.content)
      }))
    }))
  };
}
