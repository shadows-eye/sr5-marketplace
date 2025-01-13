// Import required classes and helpers
import { BasketModel } from "./models/BasketModel.mjs";
import { BasketItemSheet } from "./sheets/BasketItemSheet.mjs";
import { registerBasicHelpers } from "./lib/helpers.js";

/**
 * Initialize the module.
 */
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

  // Add Basket to allowed item types if not present
  const itemTypes = game.system.documentTypes?.Item || {};
  if (!itemTypes.basket) {
    itemTypes.basket = {}; // Add the Basket type
    console.log("SR5 Marketplace | Added 'basket' to allowed item types.");
  }

  // Log updated item types
  console.log("SR5 Marketplace | Allowed item types:", Object.keys(itemTypes));
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

/**
 * Add Basket to the Item creation dropdown.
 */
Hooks.on("renderItemDirectory", (app, html, data) => {
  const createButton = html.find(".create-item");
  if (!createButton.length) return;

  const dropdown = createButton.next("select");
  dropdown.append('<option value="basket">Basket</option>');
  console.log("SR5 Marketplace | Added 'basket' to item creation dropdown.");
});