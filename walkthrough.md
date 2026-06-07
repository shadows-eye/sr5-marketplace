### Walkthrough of Changes

1. **Improved Folder Item Resolution (`sheets/ShopActorSheet.mjs`)**:
   - Refactored `_getItemsFromFolder(folder)` to safely traverse both World folders and Compendium folders.
   - Used `Array.from()` or `Object.values()` to handle `f.contents` safely across different collection implementations.
   - Added logic for Compendium folders to fetch full Item documents via `pack.getDocument(id)` using indices mapped by the folder ID.

2. **Localization of Drop Handler Notifications**:
   - Replaced raw string notification warning and info messages inside the drop handler in `sheets/ShopActorSheet.mjs` with `game.i18n.localize` and `game.i18n.format` calls.

3. **Translation Key Injection**:
   - Added the corresponding localizations for keys `Errors.DropItemFolderOnly`, `Errors.NoValidItemsInFolder`, `Shop.FolderItemsAdded`, and `Shop.AllFolderItemsAlreadyInInventory` inside `languages/en.json` and `languages/de.json`.