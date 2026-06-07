# Item Data Services Reference

[← Back to Main Overview](file:///home/shadow/Documents/GitHub/sr5-marketplace/documentation/main.md)

`ItemDataServices` handles compiling, caching, filtering, and structuring all available Items across the World and active Compendiums. To ensure high performance, it processes indexing asynchronously in the background and caches categorized outputs.

The API is accessible via:
* `game.sr5marketplace.api.itemData` (Instance of `ItemDataServices`)
* `game.sr5marketplace.itemData` (Backward compatibility namespace)

---

## Properties & Constants

### Category and Icon Mappings
* **`ITEM_CATEGORIES`**: (Static Object) Defines the nested taxonomy (category → subcategory → sub-subcategory) for shop layout categorization.
* **`ITEM_TYPE_ICONS`**: (Static Object) Maps specific item types (e.g. `armor`, `bioware`) and weapon categories (e.g. `smg`, `blades`) to their customized thumbnail paths.

---

## Method Details

### `buildIndex()`
Builds a global index cache containing all items from the current world and all visible, visible-enabled Item compendiums.
* **Returns**: `Promise<Array<object>>` - Flat array of plain item objects.

### `getItems()`
Returns the flat array of cached global item objects. If the cache hasn't been built yet, this returns an empty list.
* **Returns**: `Array<object>`

### `invalidateCache()`
Clears the cached indices and categories. Useful if items are created, deleted, or edited during a session.
* **Returns**: `void`

### `fetchGlobalItems(filterType)`
Retrieves the pre-compiled, categorized item database.
* **Parameters**:
  - `filterType` (String, optional):
    - `"all"`: (Default) Returns all weapons, armor, mods, cyberware, equipment, etc.
    - `"base"`: Excludes modifications.
    - `"modifications"`: Returns only modifications.
* **Returns**: `Promise<object>` - Struct containing category groupings (e.g. `rangedWeapons`, `armor`, `cyberware`).

### `getShopItems(shopActorUuid)`
Fetches and categorizes the inventory items of a specific Shop Actor. Resolves inventory items' UUIDs and overrides default compendium items with custom shop pricing and availability parameters.
* **Parameters**:
  - `shopActorUuid` (String): UUID of the Shop Actor document.
* **Returns**: `Promise<object>` - Enriched category structures matching `fetchGlobalItems`.

### `getRepresentativeImage(itemData)`
Determines the icon image path for an item, falling back to type-specific templates if the item has no defined image.
* **Parameters**:
  - `itemData` (Object): The item plain data object.
* **Returns**: `String` - File path to the icon.

---

## Code Examples

### Example 1: Listing a Shop's Custom Inventory
Use this macro to query a shop and print out its items with their customized sell prices:

```javascript
const shopActor = game.actors.find(a => a.type === "sr5-marketplace.shop");
if (shopActor) {
    const itemDataService = game.sr5marketplace.api.itemData;
    const shopData = await itemDataService.getShopItems(shopActor.uuid);
    
    console.log(`Inventory for ${shopActor.name}:`);
    
    // The items are organized by categories
    for (const item of shopData.filteredItems.items) {
        const cost = item.system.technology?.cost ?? 0;
        console.log(`- ${item.name} | Custom Price: ${cost} ¥`);
    }
} else {
    ui.notifications.warn("No Shop Actor found.");
}
```

### Example 2: Rebuilding the Item Cache
If you programmatically create items in a compendium, run this script to invalidate the cache and trigger a rebuild:

```javascript
const itemDataService = game.sr5marketplace.api.itemData;

// Invalidate the cache
itemDataService.invalidateCache();

// Build it in the background
await itemDataService.buildIndex();
ui.notifications.info("Item index refreshed!");
```
