console.debug("SR5 Marketplace | Loading module into FoundryVTT");
import { BasketModel } from "./models/basketModel.mjs";
import { BasketItemSheet } from "./sheets/BasketItemSheet.mjs";

/**
 * Function to register item types and their data models.
 */
const registerItemTypes = () => {
    console.log("SR5 Marketplace | Registering Item Types and Models...");

    // Register Basket type and its data model
    Object.assign(CONFIG.Item.dataModels, {
        "sr5-marketplace.basket": BasketModel,
    });

    console.log("SR5 Marketplace | Registered Data Models:", CONFIG.Item.dataModels);
};

/**
 * Function to register item sheets.
 */
const registerSheets = () => {
    console.log("SR5 Marketplace | Registering Item Sheets...");

    // Register the custom sheet for the Basket item type
    DocumentSheetConfig.registerSheet(Item, "sr5-marketplace", BasketItemSheet, {
        types: ["sr5-marketplace.basket"],
        makeDefault: true,
    });

    console.log("SR5 Marketplace | Item Sheets Registered.");
};

/**
 * Hook into initialization to set up item types, models, and sheets.
 */
const onInit = () => {
    console.log("SR5 Marketplace | Initializing Module...");
    registerItemTypes();
    registerSheets();
    console.log("SR5 Marketplace | Item Sheets Registered.")
};

/**
 * Hook into readiness to ensure hooks for item creation.
 */
const onReady = async () => {
    console.log("SR5 Marketplace | Module is ready!");

};

// Hook into Foundry initialization and readiness lifecycle
Hooks.once("init", onInit);
Hooks.once("ready", onReady);