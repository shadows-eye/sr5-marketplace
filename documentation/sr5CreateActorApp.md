# Create Actor App Reference

[← Back to Main Overview](./main.md)

`SR5CreateActorApp` is a custom actor creation application that overrides standard Foundry VTT Actor creation screens. When configuring standard actor types (characters, grunts), it behaves like a normal dialog. When selecting `sr5-marketplace.shop`, it transforms into an interactive, full-screen initialization dashboard.

This dashboard allows GMs to:
* Configure shop-specific details (markup rates, action radii, descriptions).
* Assign employees and link Matrix Hosts.
* Batch seed shop inventories from Compendiums and World templates.

The class is accessible via:
* `game.sr5marketplace.SR5CreateActorApp` (The `SR5CreateActorApp` class)

---

## Dialog Configuration

### Constructor Options
```javascript
const app = new game.sr5marketplace.SR5CreateActorApp({
    resolve: (actor) => { console.log("Created Actor:", actor); },
    folder: "FolderId123" // ID of parent folder in sidebar (optional)
});
app.render(true);
```

* **`resolve`**: (Function) The promise resolver callback. Yields the created `Actor` document, or `null` if the dialog was cancelled.
* **`folder`**: (String, optional) Folder ID to put the newly created Actor into.

---

## Seeding & Creation Mechanics

When the GM clicks **Create**, the application executes a series of setup routines inside `_onCreate()`:
1. Creates the underlying Shop Actor document.
2. Clones the selected Matrix Host item (if any) directly into the actor's embedded items.
3. Loops through all selected item UUIDs, calculates their base values (cost and availability) asynchronously from the cached database, applies the specified `shopMarkup` (e.g. `20%`), and populates the actor's `system.shop.inventory` map.
4. Links the selected employee actor Uuids.
5. Resolves the promise to alert Foundry's database controllers.

---

## Code Examples

### Example: Custom Creation Dialog Triggers
You can launch the custom creation app programmatically from a macro, directing it to yield the shop Actor upon completion:

```javascript
const appClass = game.sr5marketplace.SR5CreateActorApp;

const newActor = await new Promise((resolve) => {
    new appClass({
        resolve,
        folder: null
    }).render(true);
});

if (newActor) {
    ui.notifications.info(`Successfully created and initialized shop "${newActor.name}"!`);
} else {
    ui.notifications.warn("Actor creation cancelled.");
}
```
