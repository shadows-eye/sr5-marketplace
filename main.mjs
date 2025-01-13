console.debug("SR5 Marketplace | Loading module into FoundryVTT");

import { BasketModel } from "./scripts/item/model/BasketModel.mjs";
import { BasketItem } from "./scripts/item/model/Basket.mjs";
import { BasketItemSheet } from "./scripts/sheets/BasketItemSheet.mjs";

/**
 * Register module sub-types and sheets for them.
 */
const onInit = () => {
    console.debug("SR5 Marketplace | Initializing module...");

    // Register BasketModel for the "basket" item type
    Object.assign(CONFIG.Item.dataModels, {
        basket: BasketModel,
    });

    // Register the Basket item class
    Object.assign(CONFIG.Item.typeClasses, {
        basket: BasketItem,
    });

    // Register a custom sheet for Basket items
    DocumentSheetConfig.registerSheet(Item, "sr5-marketplace", BasketItemSheet, {
        types: ["basket"],
        makeDefault: true,
    });

    console.debug("SR5 Marketplace | BasketModel and BasketItem registered successfully.");
};

/**
 * Actions to perform when the module is ready.
 */
const onReady = async () => {
    console.debug("SR5 Marketplace | Module is ready!");

    // Use game.system.documentTypes.Item to ensure the basket type is added to the allowed types
    const itemTypes = game.system.documentTypes?.Item || {};
    if (!itemTypes.basket) {
        itemTypes.basket = {}; // Add basket type to allowed types
        console.debug("SR5 Marketplace | Added 'basket' to allowed item types.");
    }
};

/**
 * Hooks initialization
 */
Hooks.on("init", onInit);
Hooks.on("ready", onReady);
