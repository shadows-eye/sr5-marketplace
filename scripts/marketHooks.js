// Import required helpers
// Import necessary classes and helpers
import { inGameMarketplace } from "./apps/inGameMarketplace.mjs";
import { registerBasicHelpers } from "./lib/helpers.js";
import ItemDataServices from './services/ItemDataServices.mjs';
import { MarketplaceSettingsApp } from "./apps/MarketplaceSettingsApp.mjs";
// Register helpers and templates
const initializeTemplates = () => {
    console.log("SR5 Marketplace | Registering templates and helpers...");
    registerBasicHelpers();

    loadTemplates([
        "modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shop.html",
        "modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/orderReview.html",
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
        name: "Item Type Purchase Behaviors",
        scope: "world",
        config: false, // Hidden from the default menu
        type: Object,
        default: {}
    });
    game.settings.register("sr5-marketplace", "openSettingsMenu", {
        name: "SR5.Marketplace.Settings.Menu.name",
        hint: "SR5.Marketplace.Settings.Menu.hint",
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
    // Note: 'html' is a standard HTMLElement, not a jQuery object.

    // Find our placeholder setting's input element using querySelector
    const settingInput = html.querySelector(`[name="sr5-marketplace.openSettingsMenu"]`);
    
    if (settingInput) {
        const settingGroup = settingInput.closest(".form-group");
        if (!settingGroup) return;

        // Hide the original text input field
        settingInput.style.display = "none";

        // Create our new button programmatically
        const button = document.createElement("button");
        button.type = "button";
        button.innerHTML = `<i class="fas fa-cogs"></i> ${game.i18n.localize("SR5.Marketplace.Settings.Menu.buttonLabel")}`;
        
        // Find the element to append the button to
        const formFields = settingGroup.querySelector(".form-fields");
        if (formFields) {
            // Check if our button already exists to prevent duplicates on re-render
            if (!formFields.querySelector("button")) {
                formFields.appendChild(button);
            }
        }

        // Add a click listener to our new button
        button.addEventListener("click", () => {
            new MarketplaceSettingsApp().render(true);
        });
    }
});

// Initialize the module on startup
Hooks.once("init", () => {
    console.log("SR5 Marketplace | Initializing module...");
    initializeTemplates();
    initializeSettings();
    game.sr5marketplace = {
        itemData: new ItemDataServices() // Initialize the item data service
    };
});

/**
 * A hook that runs when the game is fully ready and all data is loaded.
 * This is the perfect place to run our one-time item indexing.
 */
Hooks.on("ready", async () => {
    console.log("SR5 Marketplace | Module is ready!");

    // This will show the progress bar on first load.
    await game.sr5marketplace.itemData.initialize();

    // The logic from your previous 'ready' hook is preserved here.
    // If you are no longer using a 'basket' Item type, this can be removed.
    console.log("BasketModel Schema:", CONFIG.Item.dataModels?.basket?.defineSchema());
    const itemTypes = game.system.documentTypes?.Item || {};
    console.log("Current allowed item types:", Object.keys(itemTypes));

    if (!itemTypes.basket) {
        itemTypes.basket = {};
        console.log("Added 'basket' to the allowed item types.");
    }
    console.log("Updated allowed item types:", Object.keys(itemTypes));
});

// Add a control button for opening the Marketplace
Hooks.on("getSceneControlButtons", (controls) => {
  const tokenControls = controls["tokens"];
  if (!tokenControls) return;

  // Prevent overwriting existing tool
  if (tokenControls.tools["sr5-marketplace"]) return;

  tokenControls.tools["sr5-marketplace"] = {
    name: "sr5-marketplace",
    title: "Open Marketplace",
    icon: "fas fa-shopping-cart",
    visible: true,
    toggle: true,
    onChange: () => {
      try {
        new inGameMarketplace().render(true);
      } catch (e) {
        console.error("Failed to render inGameMarketplace:", e);
      }
    }
  };
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