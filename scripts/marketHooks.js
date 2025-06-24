// Import required helpers
// Import necessary classes and helpers
import { inGameMarketplace } from "./apps/inGameMarketplace.mjs";
import { registerBasicHelpers } from "./lib/helpers.js";
import ItemDataServices from './services/ItemDataServices.mjs';
import { MarketplaceSettingsApp } from "./apps/MarketplaceSettingsApp.mjs";
import { PurchaseService } from "./services/purchaseService.mjs";


/**
 * Draws the notification badge on the scene control button.
 * This function is called by the 'renderSceneControls' hook.
 * @param {JQuery} html The jQuery object for the scene controls container.
 */
function drawBadge(html) {
    // This guard clause prevents errors if the hook fires at an unexpected time.
    if (!html || !html.length || !game.user.isGM) return;

    // Get the latest count directly from the service every time the controls are rendered.
    const pendingCount = PurchaseService.getPendingRequestCount();
    
    const controlButton = html.find('[data-tool="sr5-marketplace"]');
    if (!controlButton.length) return;

    let badge = controlButton.find(".notification-badge");
    if (!badge.length) {
        badge = $('<span class="notification-badge"></span>');
        controlButton.append(badge);
    }

    if (pendingCount > 0) {
        badge.text(pendingCount).show();
    } else {
        badge.hide();
    }
}

// --- HOOKS SECTION ---

// Register helpers and templates
const initializeTemplates = () => {
    console.log("SR5 Marketplace | Registering templates and helpers...");
    registerBasicHelpers();

    loadTemplates([
        "modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shop.html",
        "modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/orderReview.html",
        "modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/marketplaceUserActor.html",
        "modules/sr5-marketplace/templates/item/libraryItem.html",
        "modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shoppingCart.html",
        "modules/sr5-marketplace/templates/apps/marketplace-settings/marketplace-settings.html",
        "modules/sr5-marketplace/templates/apps/marketplace-settings/partials/settings-card.html"
    ]);
};

// Initialize module settings
const initializeSettings = () => {
    console.log("SR5 Marketplace | Initializing settings...");

    game.settings.register("sr5-marketplace", "resetItemLoad", {
        name: game.i18n.localize("SR5.Marketplace.Settings.ResetItemLoad.name"),
        hint: game.i18n.localize("SR5.Marketplace.Settings.ResetItemLoad.hint"),
        scope: "world",
        config: false,
        // This setting is not meant to be user-configurable in the UI for now
        // but can be toggled programmatically or via console
        type: Boolean,
        default: false,
        restricted: true,
        onChange: (value) => {
            console.log(`Reset Item Load setting changed: ${value}`);
            window.location.reload();
        },
    });

    game.settings.register("sr5-marketplace", "approvalWorkflow", {
        name: game.i18n.localize("SR5.Marketplace.Settings.ApprovalWorkflow.name"),
        hint: game.i18n.localize("SR5.Marketplace.Settings.ApprovalWorkflow.hint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
        restricted: true,
    });

    game.settings.register("sr5-marketplace", "karmaCostForSpell", {
        name: game.i18n.localize("SR5.Marketplace.Settings.KarmaSpell.name"),
        hint: game.i18n.localize("SR5.Marketplace.Settings.KarmaSpell.hint"),
        scope: "world",
        config: true,
        type: Number,
        default: 5,
        restricted: true,
    });

    game.settings.register("sr5-marketplace", "karmaCostForComplexForm", {
        name: game.i18n.localize("SR5.Marketplace.Settings.KarmaComplexForm.name"),
        hint: game.i18n.localize("SR5.Marketplace.Settings.KarmaComplexForm.hint"),
        scope: "world",
        config: true,
        type: Number,
        default: 5,
        restricted: true,
    });
    game.settings.register("sr5-marketplace", "itemTypeBehaviors", {
        name: game.i18n.localize("SR5.Marketplace.Settings.ItemTypeBehaviors.name"),
        scope: "world",
        config: false, // Hidden from the default menu
        type: Object,
        default: {}
    });
    game.settings.register("sr5-marketplace", "openSettingsMenu", {
        name: game.i18n.localize("SR5.Marketplace.Settings.Menu.name"),
        hint: game.i18n.localize("SR5.Marketplace.Settings.Menu.hint"),
        scope: "world",
        config: true, // This makes the setting appear in the menu
        restricted: true,
        type: Object, // Use a simple type
        default: {
        "armor": "single",
        "ammo": "stack",
        "action": "unique",
        "adept_power": "unique",
        "complex_form": "unique",
        "critter_power": "unique",
        "cyberware": "unique",
        "echo": "unique",
        "modification": "stack",
        "quality": "unique",
        "spell": "unique",
        "sprite_power": "unique"
    }  
    });
};

/**
 * This hook injects our custom button into the settings menu using standard JavaScript.
 */
Hooks.on("renderSettingsConfig", (app, html, data) => {
    // 'html' is a standard HTMLElement.
    const settingInput = html.querySelector(`[name="sr5-marketplace.openSettingsMenu"]`);
    if (!settingInput) return;

    const settingGroup = settingInput.closest(".form-group");
    if (!settingGroup) return;

    const formFields = settingGroup.querySelector(".form-fields");
    if (!formFields) return;

    // Hide the placeholder's original input element.
    settingInput.style.display = "none";
    
    // --- Button Injection ---
    const buttonClass = "sr5-marketplace-settings-button";
    if (!formFields.querySelector(`.${buttonClass}`)) {
        const button = document.createElement("button");
        button.type = "button";
        button.classList.add(buttonClass);
        button.innerHTML = `<i class="fas fa-cogs"></i> ${game.i18n.localize("SR5.Marketplace.Settings.Menu.buttonLabel")}`;
        
        button.addEventListener("click", () => {
            new MarketplaceSettingsApp().render(true);
        });

        formFields.appendChild(button);
    }

    // --- CORRECTED Tag Display Logic ---

    // Remove any existing summary to prevent it from duplicating on re-render.
    const existingSummary = settingGroup.parentElement.querySelector('.behavior-summary');
    if (existingSummary) existingSummary.remove();

    // 1. Get ALL types from the indexed item data, just like the settings app does.
    const allItems = game.sr5marketplace.itemData.getItems();
    const allTypes = [...new Set(allItems.map(item => item.type))].sort();

    // 2. Get the saved behaviors.
    const behaviors = game.settings.get("sr5-marketplace", "itemTypeBehaviors");

    if (allTypes.length > 0) {
        const summaryContainer = document.createElement("div");
        summaryContainer.classList.add("behavior-summary");
        
        // 3. Loop through the COMPLETE list of all types.
        for (const type of allTypes) {
            // Filter out internal types that we don't want to show.
            if (["base"].includes(type)) continue;

            const behavior = behaviors[type] || 'single'; // Default to 'single'
            
            const tag = document.createElement("span");
            tag.classList.add("behavior-tag", behavior);
            tag.textContent = type; // The CSS will handle capitalizing.
            switch (behavior) {
                case "unique":
                    tag.title = game.i18n.localize("SR5.Marketplace.Settings.CategoryUnique");
                    break;
                case "stack":
                    tag.title = game.i18n.localize("SR5.Marketplace.Settings.StackingItems");
                    break;
                case "single":
                    tag.title = game.i18n.localize("SR5.Marketplace.Settings.SingleItems");
                    break;
            }
            summaryContainer.appendChild(tag);
        }
        
        // Place the summary container after the entire form group for correct layout.
        settingGroup.after(summaryContainer);
    }
});

// Initialize the module on startup
Hooks.once("init", () => {
    console.log("SR5 Marketplace | Initializing module...");
    initializeTemplates();
    initializeSettings();
    game.sr5marketplace = { itemData: new ItemDataServices() };

    Hooks.on("updateUser", (user, changes) => {
        // This now correctly checks for changes to the 'basket' flag.
        if (game.user.isGM && foundry.utils.hasProperty(changes, "flags.sr5-marketplace.basket")) {
            // A relevant flag changed, so just ask the UI to redraw the controls.
            setTimeout(() => {
                if (ui.controls) ui.controls.render(true);
            }, 250);
        }
    });
});

/**
 * A hook that runs when the game is fully ready and all data is loaded.
 * This is the perfect place to run our one-time item indexing.
 */
Hooks.on("ready", async () => {
    console.log("SR5 Marketplace | Module is ready!");
    await game.sr5marketplace.itemData.initialize();

    if (game.user.isGM) {
        game.socket.on("module.sr5-marketplace", () => {
            // A real-time event was received. Trigger a re-draw after a short delay.
            setTimeout(() => {
                if (ui.controls) ui.controls.render(true);
            }, 250);
        });
        // On first load, render the controls to set the initial badge state.
        setTimeout(() => { if (ui.controls) ui.controls.render(true); }, 1000);
    }
});

// Add a control button for opening the Marketplace
Hooks.on("getSceneControlButtons", (controls) => {
  const tokenControls = controls["tokens"];
  if (!tokenControls) return;
  if (tokenControls.tools["sr5-marketplace"]) return;

  tokenControls.tools["sr5-marketplace"] = {
    name: "sr5-marketplace",
    title: game.i18n.localize("SR5.Marketplace.Title"),
    icon: "fas fa-shopping-cart",
    visible: true,
    toggle: true,
    active: Object.values(ui.windows).some(app => app.id === "inGameMarketplace"),
    onChange: (toggled) => {
      const app = Object.values(ui.windows).find(app => app.id === "inGameMarketplace");
      if (toggled) {
        if (!app) new inGameMarketplace().render(true);
      } else {
        if (app) app.close();
      }
    }
  };
});
Hooks.on("renderSceneControls", (app, html) => {
    drawBadge(html);
});

Hooks.on("preCreateItem", async (item, data, options, userId) => {
    if (item.type === "sr5-marketplace.basket") {
        console.log("SR5 Marketplace | Ensuring BasketModel is applied...");

        // Assign an ID if missing (before Foundry processes it)
        if (!data._id) {
            data._id = foundry.utils.randomID();
            console.warn(`SR5 Marketplace | Assigned new ID: ${data._id}`);
        }

        // Apply default values from the model
        const defaultData = {
            description: { long: "Default long description", short: "Default short description" },
            marketbasket: { 
                basketQuantity: 1, 
                basketPrice: 0, 
                basketAvailability: "0", 
                basketItems: [] 
            },
            totalCost: 0,
            totalEssence: 0,
            totalKarma: 0
        };

        // Merge default data into the new item
        foundry.utils.mergeObject(data, { system: defaultData }, { overwrite: false });

        console.log("SR5 Marketplace | Default BasketModel schema applied.");
    }
});