# Item Builder API Reference

[← Back to Main Overview](./main.md)

The Item Builder API provides controls for the custom item creator workspace, allowing developers to programmatically set base items, load modification states, and trigger UI rendering.

The API is accessible via:
* `game.sr5marketplace.api.itemBuilder` (Instance of `ItemBuilderAPI`)

---

## Method Details

### `open()`
Opens the Item Builder application window.
* **Returns**: `Promise<void>`

```javascript
await game.sr5marketplace.api.itemBuilder.open();
```

### `close(options)`
Closes the Item Builder window if it is open.
* **Parameters**:
  - `options` (Object, optional):
    - `options.clearState` (Boolean): If `true`, resets the Builder's current items and attributes state upon closing. Defaults to `false`.
* **Returns**: `Promise<void>`

```javascript
await game.sr5marketplace.api.itemBuilder.close({ clearState: true });
```

### `setBaseItem(itemUuid)`
Loads an existing Item as the base document in the Builder, extracting its name, image, type, system attributes, technology parameters, and effects, and renders the Item Builder UI.
* **Parameters**:
  - `itemUuid` (String): The UUID of the source item.
* **Returns**: `Promise<void>`

```javascript
const swordUuid = "Actor.xyz123.Item.blade098";
await game.sr5marketplace.api.itemBuilder.setBaseItem(swordUuid);
```

### `getBaseItem()`
Retrieves the plain-data representation of the base item currently loaded into the Item Builder state.
* **Returns**: `Promise<object|null>`

```javascript
const baseItem = await game.sr5marketplace.api.itemBuilder.getBaseItem();
if (baseItem) {
    console.log("Currently editing item:", baseItem.name);
}
```

### `clear()`
Resets and clears the Item Builder state, clearing all loaded base item properties, and re-renders the UI if it is open.
* **Returns**: `Promise<void>`

```javascript
await game.sr5marketplace.api.itemBuilder.clear();
```

---

## Code Examples

### Example: Setting a Base Item Programmatically
Use this macro to pick a selected item from a character and load it into the Item Builder workspace:

```javascript
const actor = canvas.tokens.controlled[0]?.actor;
const item = actor?.items.find(i => i.type === "weapon");

if (item) {
    // Set the base item and render the Item Builder
    await game.sr5marketplace.api.itemBuilder.setBaseItem(item.uuid);
    ui.notifications.info(`Loaded ${item.name} into the Item Builder!`);
} else {
    ui.notifications.warn("Please select a token containing a weapon.");
}
```
