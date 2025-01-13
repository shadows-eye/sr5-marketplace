// Import required classes and helpers
import { BasketModel } from "./models/BasketModel.mjs";
import { BasketItemSheet } from "./sheets/BasketItemSheet.mjs";
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

// Register the Basket item type and model
const registerItemTypeAndModel = () => {
    console.log("SR5 Marketplace | Registering Basket item type and model...");

    // Register Basket item type and model in the system's documentTypes
    if (!game.system.documentTypes.Item) game.system.documentTypes.Item = {};
    game.system.documentTypes.Item["basket"] = {};

    // Ensure the typeClasses and dataModels objects exist
    CONFIG.Item.typeClasses = CONFIG.Item.typeClasses || {};
    CONFIG.Item.dataModels = CONFIG.Item.dataModels || {};

    // Register Basket item type and model
    CONFIG.Item.typeClasses.basket = BasketItem;
    CONFIG.Item.dataModels.basket = BasketModel;

    // Register custom sheet for Basket item type
    DocumentSheetConfig.registerSheet(
        Item,
        "sr5-marketplace",
        class extends ItemSheet {
            static get defaultOptions() {
                return foundry.utils.mergeObject(super.defaultOptions, {
                    template: "modules/sr5-marketplace/templates/item/basketItem.hbs",
                    classes: ["sr5-marketplace", "sheet", "item"],
                });
            }

            getData(options) {
                return super.getData(options);
            }
        },
        { types: ["basket"], makeDefault: true }
    );

    console.log("Basket type and model registered successfully.");
};

// Initialize the module on startup
Hooks.once("init", () => {
  console.log("SR5 Marketplace | Initializing module...");

  // Register Item type and model
  Object.assign(CONFIG.Item.dataModels, {
    basket: BasketModel,
  });

  // Register Item sheet
  DocumentSheetConfig.registerSheet(Item, "sr5-marketplace", BasketItemSheet, {
    types: ["basket"],
    makeDefault: true,
  });

  // Load templates and helpers
  registerBasicHelpers();
  loadTemplates([
    "modules/sr5-marketplace/templates/shop.hbs",
    "modules/sr5-marketplace/templates/orderReview.hbs",
    "modules/sr5-marketplace/templates/libraryItem.hbs",
    "modules/sr5-marketplace/templates/basket.hbs",
  ]);

  console.log("SR5 Marketplace | Initialization complete.");
});

/**
 * Perform actions when the module is ready.
 */
Hooks.once("ready", () => {
  console.log("SR5 Marketplace | Module is ready!");

    // Log the current item types for debugging
    console.log("Current allowed item types:", Object.keys(game.system.documentTypes?.Item || {}));
});

/**
 * Add a Marketplace button to scene controls.
 */
Hooks.on("getSceneControlButtons", (controls) => {
  const mainControl = controls.find((c) => c.name === "token");
  if (mainControl) {
    mainControl.tools.push({
      name: "sr5-marketplace",
      title: "Open Marketplace",
      icon: "fas fa-shopping-cart",
      onClick: () => {
        console.log("SR5 Marketplace | Opening Marketplace...");
        new PurchaseScreenAppV2().render(true);
      },
      button: true,
    });
  }
});

// Add Basket type to the item creation dropdown
Hooks.on("renderItemDirectory", (app, html, data) => {
  const createButton = html.find(".create-item");
  if (!createButton.length) return;

    // Add 'basket' type to the dropdown
    const dropdown = createButton.next("select");
    dropdown.append('<option value="basket">Basket</option>');
    console.log("Added 'basket' to item creation dropdown.");
});
