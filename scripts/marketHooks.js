// Import required helpers
// Import necessary classes and helpers
import { PurchaseScreenAppV2 } from "./app/purchase-screen-app.js";
import { registerBasicHelpers } from "./lib/helpers.js";

// Register helpers and templates
const initializeTemplates = () => {
    console.log("SR5 Marketplace | Registering templates and helpers...");
    registerBasicHelpers();

    loadTemplates([
        "modules/sr5-marketplace/templates/shop.hbs",
        "modules/sr5-marketplace/templates/orderReview.hbs",
        "modules/sr5-marketplace/templates/libraryItem.hbs",
        "modules/sr5-marketplace/templates/basket.hbs",
    ]);
};

// Initialize module settings
const initializeSettings = () => {
    console.log("SR5 Marketplace | Initializing settings...");

    game.settings.register("sr5-marketplace", "resetItemLoad", {
        name: game.i18n.localize("SR5.Marketplace.Settings.ResetItemLoad.name"),
        hint: game.i18n.localize("SR5.Marketplace.Settings.ResetItemLoad.hint"),
        scope: "world",
        config: true,
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

    game.settings.register("sr5-marketplace", "purchase-screen-app", {
        name: "Hidden Purchase Screen Settings",
        scope: "world",
        config: false,
        type: Object,
        default: {},
    });
};

// Initialize the module on startup
Hooks.once("init", () => {
    console.log("SR5 Marketplace | Initializing module...");
    initializeTemplates();
    initializeSettings();
});

// Actions to perform when the module is ready
Hooks.on("ready", () => {
    console.log("SR5 Marketplace | Module is ready!");
    // Log the data model schema
    console.log("BasketModel Schema:", CONFIG.Item.dataModels?.basket?.defineSchema());
    // Check and log the current item types
    const itemTypes = game.system.documentTypes?.Item || {};
    console.log("Current allowed item types:", Object.keys(itemTypes));

    // Safely add 'basket' if it's not already present
    if (!itemTypes.basket) {
        itemTypes.basket = {}; // Add your type with default configuration
        console.log("Added 'basket' to the allowed item types.");
    }

    // Log the updated item types
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
    toggle: false,
    onClick: () => {
      try {
        new PurchaseScreenAppV2().render(true);
      } catch (e) {
        console.error("Failed to render PurchaseScreenAppV2:", e);
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


