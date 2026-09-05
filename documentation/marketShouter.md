# MarketShouter API Reference

[← Back to Main Overview](./main.md)

The **MarketShouter** floating bar provides quick contextual access to the marketplace, shopping cart, item builder, and custom module actions from anywhere in Foundry VTT.

With version `14.004.1`, MarketShouter initializes instantly on world load during the `ready` hook. The floating bar and top-bar search controls display immediately so players and GMs can begin interacting with the interface right away while item caching completes asynchronously.

Third-party modules and custom scripts can register custom action buttons directly into the MarketShouter capsule bar.

---

## 1. Readiness Hook: `sr5marketplaceReady`

When the SR5 Marketplace module initializes its API and completes item index loading, it fires the standard hook `sr5marketplaceReady`. Third-party modules should listen for this hook to register custom MarketShouter buttons or trigger custom marketplace integrations.

```javascript
Hooks.once("sr5marketplaceReady", (api) => {
    console.log("SR5 Marketplace API is ready!", api);
    
    // Register custom shouter button
    api.registerShouterButton("my-module-action", {
        title: "My Custom Action",
        icon: "fas fa-bolt",
        order: 10,
        onClick: (event) => {
            ui.notifications.info("Custom action executed!");
        }
    });
});
```

---

## 2. API Method: `registerShouterButton`

Registers a custom button in the MarketShouter capsule bar.

### Access Paths
* `game.sr5marketplace.api.registerShouterButton(id, config)`
* `MarketplaceAPI.registerShouterButton(id, config)`

### Parameters

* **`id`** (`String`, required): Unique string identifier for your custom button.
* **`config`** (`Object`, required): Configuration object defining button appearance and behavior.
  * **`title`** (`String`): Hover tooltip text.
  * **`icon`** (`String`, optional): FontAwesome CSS classes for the icon (e.g. `"fas fa-cog"`, `"fas fa-biohazard"`).
  * **`html`** (`String`, optional): Custom raw HTML snippet to render inside the button if `icon` is omitted.
  * **`onClick`** (`Function`): Callback handler invoked when the user clicks the button. Receives the native click `Event`.
  * **`visible`** (`Boolean` | `Function`, optional): Controls button visibility. Can be a boolean or a function returning a boolean (evaluated each time MarketShouter renders). Defaults to `true`.
  * **`order`** (`Number`, optional): Sort position in the capsule bar. Lower values render further to the left. Defaults to `100`.

---

## 3. Code Examples

### Example 1: Simple Macro Registration
Run this code in a Foundry script macro or module initializer:

```javascript
game.sr5marketplace?.api?.registerShouterButton("quick-scanner", {
    title: "Matrix Scanner",
    icon: "fas fa-radar",
    order: 20,
    onClick: (event) => {
        ui.notifications.info("Scanning local Matrix hosts...");
    }
});
```

### Example 2: GM-Only Custom Button with Dynamic Visibility
Register a GM-only control button:

```javascript
Hooks.once("sr5marketplaceReady", (api) => {
    api.registerShouterButton("gm-restock", {
        title: "Emergency Restock Shop",
        icon: "fas fa-boxes-stacked",
        order: 5,
        visible: () => game.user.isGM,
        onClick: async (event) => {
            const shopActor = game.actors.find(a => a.type === "sr5-marketplace.shop");
            if (shopActor) {
                ui.notifications.info(`Restocking inventory for ${shopActor.name}...`);
            }
        }
    });
});
```
