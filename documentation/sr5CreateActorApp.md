# Create Actor App Reference

[← Back to Main Overview](./main.md)

`SR5CreateActorApp` is a custom actor creation application that overrides standard Foundry VTT Actor creation screens. 

* When selecting `sr5-marketplace.shop`, it transforms into an interactive initialization dashboard for creating and seeding shop inventories.
* When configuring standard NPC actor types (characters, grunts), it provides template-based generation with dynamic corporate flavoring and professional rating level scaling.

The class is accessible via:
* `game.sr5marketplace.SR5CreateActorApp` (The `SR5CreateActorApp` class)

---

## 1. NPC Actor Creation & Scaling (v14.003.0+)

### Corporate Flavoring
GMs can select a corporate affiliation to contextualize the generated NPC. Corporate flavors dynamically filter and prioritize corporate gear, specific item sets, and spell paradigms for magical builds.

Supported Corporate Flavors:
* `ares` - Ares Macrotechnology
* `aztechnology` - Aztechnology
* `evo` - Evo Corporation
* `horizon` - Horizon Group
* `mct` - Mitsuhama Computer Technologies (MCT)
* `neonet` - NeoNET
* `renraku` - Renraku Computer Systems
* `saeder-krupp` - Saeder-Krupp Heavy Industries
* `shiawase` - Shiawase Corporation
* `wuxing` - Wuxing Incorporated

### Professional Rating Levels & Cyberware Scaling
The NPC generator scales character attributes, skills, equipment quality, and cyberware/bioware grades based on the selected **Professional Level** (Levels 1 to 6):

| Professional Level | Target Archetype / Threat Level | Cyberware Grade | Essence Multiplier | Nuyen Cost Multiplier |
| :--- | :--- | :--- | :--- | :--- |
| **Level 1** | Regular Security | `standard` | 1.0x | 1.0x |
| **Level 2** | Semi-Pro Security | `standard` | 1.0x | 1.0x |
| **Level 3** | Average Runner / Elite Security | `alpha` | 0.8x | 1.2x |
| **Level 4** | Veteran Runner / High-Threat Sec | `alpha` | 0.8x | 1.2x |
| **Level 5** | Prime Runner / Special Forces | `beta` | 0.7x | 1.5x |
| **Level 6** | Legendary Runner / Military Grade | `delta` | 0.5x | 2.5x |

Cyberware, bioware, spells (matched by school/paradigm), armors, weapons, commlinks, and decks are automatically selected and modified using structured Chummer mapping definitions (`chummer-corp-mapping.enc.mjs`) and NPC templates (`NPCTemplate.enc.mjs`).

---

## 2. Dialog Configuration

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

## 3. Shop Seeding & Creation Mechanics

When creating a `sr5-marketplace.shop` actor:
1. Creates the underlying Shop Actor document.
2. Clones the selected Matrix Host item (if any) directly into the actor's embedded items.
3. Loops through all selected item UUIDs, calculates their base values (cost and availability) asynchronously from the cached database, applies the specified `shopMarkup` (e.g. `20%`), and populates the actor's `system.shop.inventory` map.
4. Links the selected employee actor UUIDs.
5. Resolves the promise to alert Foundry's database controllers.

---

## 4. Code Examples

### Example 1: Launching Custom Actor Creation Dialog
You can launch the custom creation app programmatically from a macro:

```javascript
const appClass = game.sr5marketplace.SR5CreateActorApp;

const newActor = await new Promise((resolve) => {
    new appClass({
        resolve,
        folder: null
    }).render(true);
});

if (newActor) {
    ui.notifications.info(`Successfully created actor "${newActor.name}"!`);
} else {
    ui.notifications.warn("Actor creation cancelled.");
}
```
