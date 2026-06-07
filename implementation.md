I have investigated the issue where dropping a Folder (from either the World or a Compendium) onto the Shop Actor fails to populate the inventory. 

### Cause of the Issue
The drag-and-drop handler correctly receives the folder UUID, but the helper function `_getItemsFromFolder(folder)` in `sheets/ShopActorSheet.mjs` fails to retrieve the items for two different reasons depending on the folder's origin:
1. **World Folders:** The code relies on checking `f.contents.length > 0`. In modern Foundry VTT versions (V12/V13), collections/sets are used in more places, meaning `.length` evaluates to `undefined`, causing the loop to silently skip.
2. **Compendium Folders:** Compendium folders are virtual and do not automatically populate their `.contents` array with Document instances. Fetching their items requires actively querying the compendium's index and requesting the Item documents.

### The Solution Plan
I have drafted a concrete architecture plan and saved it to **`implementation.md`**. 

**Key Steps:**
1. **Rewrite `_getItemsFromFolder(folder)`:**
   - Instead of looking at `f.contents`, we will dynamically query items.
   - For **World folders**, we will filter the global `game.items` collection where `item.folder?.id === f.id`.
   - For **Compendium folders**, we will fetch the pack index (`pack.getIndex({ fields: ["folder"] })`), filter by folder ID, and load the full Item documents via `pack.getDocument(id)`.
   - Recursive sub-folder traversal will be kept intact.
2. **Puppeteer Integration Test:**
   - Under the Main Brain testing guidelines, a new browser integration script will be written (`helpers/test_shop_folder_drop.mjs`) to create temporary folders/items, spoof a Drag-and-Drop `DragEvent`, and assert that the Shop Actor's database successfully updates with the new inventory.

The plan is ready for the execution phase.