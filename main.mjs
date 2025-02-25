console.debug("SR5 Marketplace | Loading module into FoundryVTT");
import { BasketModel } from "./models/basketModel.mjs";
import { BasketItemSheet } from "./sheets/BasketItemSheet.mjs";

/**
 * Function to register item types and their data models.
 */
const registerItemTypes = () => {
    console.log("SR5 Marketplace | Registering Item Types and Models...");

    // Ensure CONFIG.Item.documentClasses is defined
    if (!CONFIG.Item.documentClasses) CONFIG.Item.documentClasses = {};

    // Register Basket type as a document class
    CONFIG.Item.documentClasses["sr5-marketplace.basket"] = class extends CONFIG.Item.documentClass {};

    console.log("SR5 Marketplace | Registered Document Class for sr5-marketplace.basket");

    // Ensure CONFIG.Item.dataModels is defined
    if (!CONFIG.Item.dataModels) CONFIG.Item.dataModels = {};

    // Register BasketModel as the DataModel for this Item Type
    CONFIG.Item.dataModels["sr5-marketplace.basket"] = BasketModel;

    console.log("SR5 Marketplace | Registered Data Model for sr5-marketplace.basket.");
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