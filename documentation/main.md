# SR5 Marketplace API Overview

Welcome to the **SR5 Marketplace** developer and macro documentation. This module exposes its core capabilities, services, and UI applications to custom JavaScript macros, other modules, and the browser console.

All public APIs are anchored under the global namespace:
* `game.sr5marketplace` (Primary namespace)
* `game.sr5marketplace.api` (Standard API interface for programmatic access)

---

## API Modules Directory

Click on any of the sections below to access their specific documentation page, including detailed method listings and code examples:

| API Namespace Path | Class/Service | Description | Documentation |
| :--- | :--- | :--- | :--- |
| `game.sr5marketplace.inGameMarketplace` | `inGameMarketplace` | The main shop UI application (ApplicationV2) for showing/rendering the shop and GM review screen. | [inGameMarketplace.md](./inGameMarketplace.md) |
| `game.sr5marketplace.api.itemBuilder` | `ItemBuilderAPI` | Operations for configuring base items, resetting state, and opening the Item Builder UI. | [itemBuilder.md](./itemBuilder.md) |
| `game.sr5marketplace.api.system` | `SR5SystemAPI` | Live cached configs and localized translations bridged directly from the `shadowrun5e` system. | [system.md](./system.md) |
| `game.sr5marketplace.itemData` | `ItemDataServices` | Direct access to global and shop-specific item databases, index builders, and category filters. | [itemData.md](./itemData.md) |
| `game.sr5marketplace.PurchaseService` | `PurchaseService` | Backend operations managing shopping carts submissions, reviews, GM approvals, and rejections. | [purchase.md](./purchase.md) |
| `game.sr5marketplace.BasketService` | `BasketService` | Active shopping cart operations (get/save basket, add items, set contact, clear cart). | [basket.md](./basket.md) |
| `game.sr5marketplace.SR5CreateActorApp` | `SR5CreateActorApp` | Custom Actor Creation application that overrides default Foundry Actor dialogs for Shop initialization. | [sr5CreateActorApp.md](./sr5CreateActorApp.md) |
| `game.sr5marketplace.api.AppDialogBuilder` | `AppDialogBuilder` | Router and context builder that constructs structured test UI parameters (availability/opposed rolls). | [appDialogBuilder.md](./appDialogBuilder.md) |

---

## Quick Start Example

You can check if the API is loaded and render the marketplace window directly from a script macro using:

```javascript
// Ensure the module is active and initialized
if (game.sr5marketplace?.inGameMarketplace) {
    // Open the marketplace for the active actor, showing global compendium items
    const MarketplaceApp = game.sr5marketplace.inGameMarketplace;
    const activeApp = new MarketplaceApp({});
    activeApp.render(true);
} else {
    ui.notifications.error("SR5 Marketplace is not loaded.");
}
```

Or you can programmatically render the UI pre-configured for a specific shop:

```javascript
// Open the marketplace showing a specific shop's inventory
const shopActor = game.actors.find(a => a.type === "sr5-marketplace.shop");
if (shopActor) {
    new game.sr5marketplace.inGameMarketplace({ shopActorUuid: shopActor.uuid }).render(true);
}
```
