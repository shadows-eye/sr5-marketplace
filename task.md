Here is the structured task list to implement the approved plan:

- [x] [Code Agent] Locate and inspect the `_getItemsFromFolder` helper function and identify the hardcoded notification messages inside the drop handler (files: `sheets/ShopActorSheet.mjs`)
- [x] [Code Agent] Refactor `_getItemsFromFolder(folder)` to support World Folders by converting `f.contents` safely using `Array.from(f.contents)` or equivalent collection iterators to bypass the `.length` limitation (files: `sheets/ShopActorSheet.mjs`)
- [x] [Code Agent] Extend `_getItemsFromFolder(folder)` to support Compendium Folders by querying the pack index (`pack.getIndex`), filtering for the matching folder ID, and instantiating the full documents using `pack.getDocument(id)` (files: `sheets/ShopActorSheet.mjs`)
- [x] [Localisation Agent] Extract hardcoded drop handler notification messages, define descriptive localization keys, and add the translations for both supported languages (files: `languages/en.json`, `languages/de.json`)
- [x] [Code Agent] Replace the hardcoded notification messages in the drop handler with proper localization calls using `game.i18n` (files: `sheets/ShopActorSheet.mjs`)