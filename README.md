# Warhammer DBC

Система для Foundry VTT по Warhammer 40k в редакции DBC (Doom Black Crusade). Объединяет материал Rogue Trader, Dark Heresy и смежных линеек.

## Установка

В Foundry VTT: **Game Systems → Install System → Manifest URL**, вставьте ссылку:

```
https://github.com/Batonrain/warhammer-dbc/releases/latest/download/system.json
```

Ссылка постоянная: она всегда ведёт на последний выпущенный релиз. Обновления Foundry подхватит сам.

## Совместимость

Foundry VTT версии 13. Более ранние версии не поддерживаются.

## Состав

| Путь | Что внутри |
| --- | --- |
| `warhammer-dbc.mjs` | точка входа системы |
| `module/` | листы, боевая логика, документы, миграции, хуки |
| `templates/` | Handlebars-шаблоны |
| `styles/` | CSS |
| `lang/` | локализация |
| `packs/` | скомпилированные компендиумы (LevelDB) |
| `packs-src/books/` | JSON-исходники книжных компендиумов |
| `assets/` | иконки, изображения тарот-карт, схемы тела |

PDF правил в репозиторий не входят.

## Разработка

```bash
git clone https://github.com/Batonrain/warhammer-dbc.git
```

Дальше нужна символическая ссылка из папки данных Foundry на клон репозитория.

Windows (PowerShell от администратора):

```powershell
New-Item -ItemType SymbolicLink `
  -Path "$env:LOCALAPPDATA\FoundryVTT\Data\systems\warhammer-dbc" `
  -Target "C:\путь\к\warhammer-dbc"
```

Linux / macOS:

```bash
ln -s /путь/к/warhammer-dbc ~/.local/share/FoundryVTT/Data/systems/warhammer-dbc
```

После этого Foundry увидит систему, и правки в коде применятся после перезагрузки мира.

### Компендиумы

Папки в `packs/` содержат базы LevelDB. Git сравнивает их как двоичные файлы, поэтому слить два параллельных изменения одного компендиума нельзя. Договоритесь заранее, кто в текущий момент правит какой пак, либо вносите правки в отдельных PR, не пересекающихся по файлам.

Файлы `LOCK`, `LOG` и `LOG.old` создаёт сама Foundry при запуске. Они в `.gitignore` и коммитить их не нужно.

### Вклад в проект

1. Сделайте форк и ветку от `main`.
2. Проверьте изменения в живой Foundry перед отправкой.
3. Откройте pull request с описанием, что и зачем меняется.

## Релизы

Релиз собирается GitHub Actions по тегу:

```bash
git tag v0.1.1
git push origin v0.1.1
```

Workflow подставляет версию из тега в `system.json`, пакует систему в `system.zip` и публикует оба файла в GitHub Release. Manifest URL при этом не меняется.

Версия в теге и есть версия системы. Поле `version` в `system.json` перезаписывается при сборке, править его вручную не требуется.

## Лицензия

Код системы распространяется по [MIT](LICENSE).

Warhammer 40,000 и связанные наименования, символика и изображения принадлежат Games Workshop Limited. Проект создан фанатами, не аффилирован с Games Workshop и не одобрен ею.
