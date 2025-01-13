console.debug("SR5 Marketplace | Loading module into FoundryVTT");
import { BasketModel } from "./models/BasketItemModel.mjs";
import { BasketItemSheet } from "./sheets/BasketItemSheet.mjs";

// Function to register item types and their models
const registerItemTypes = () => {
    console.log("SR5 Marketplace | Registering Item Types and Models...");
    
    // Ensure the necessary CONFIG structures exist
    CONFIG.Item.typeClasses = CONFIG.Item.typeClasses || {};
    CONFIG.Item.dataModels = CONFIG.Item.dataModels || {};

    // Register Basket type and its data model
    CONFIG.Item.typeClasses.basket = BasketItemSheet;
    CONFIG.Item.dataModels.basket = BasketModel;

    console.log("SR5 Marketplace | Registered Item Types and Models:", CONFIG.Item.typeClasses, CONFIG.Item.dataModels);
};

// Function to register sheets
const registerSheets = () => {
    console.log("SR5 Marketplace | Registering Item Sheets...");

    // Register the custom sheet for the Basket item type
    DocumentSheetConfig.registerSheet(Item, "sr5-marketplace", BasketItemSheet, {
        types: ["basket"],
        makeDefault: true,
    });

    console.log("SR5 Marketplace | Item Sheets Registered.");
};

// Hook initialization and ready logic
const onInit = () => {
    console.log("SR5 Marketplace | Initializing Module...");
    registerItemTypes();
    registerSheets();
};

const onReady = async () => {
    console.log("SR5 Marketplace | Module is ready!");

    // Hook for preCreateItem
    Hooks.on("preCreateItem", async (item, options, userId) => {
        if (item.type === "basket") {
            console.log("Initializing default values for new basket item...");

            // Set default values for the basket item
            item.updateSource({
                description: { long: "", short: "" },
                img: "icons/svg/treasure.svg",
                system: {
                    basketQuantity: 1,
                    basketPrice: 0,
                    basketAvailability: "0",
                    basketItems: [],
                },
                totalCost: 0,
                totalEssence: 0,
                totalKarma: 0,
                basketUuid: "",
            });

            console.log("Basket item initialized with defaults, waiting for _id to assign UUID.");
        }
    });

    // Hook for createItem
    Hooks.on("createItem", async (item, options, userId) => {
        if (item.type === "basket") {
            console.log("Setting basketUuid for new basket item...");

            // Use the system-generated _id as the UUID
            const uuid = `item.${item.id}`;

            // Update the item with the correct UUID
            await item.update({
                "system.basketUuid": uuid,
            });

            console.log("Basket item updated with UUID:", uuid);
        }
    });

    console.log("SR5 Marketplace | Hooks registered for item creation.");
};

// Hook into Foundry initialization and readiness lifecycle
Hooks.once("init", onInit);
Hooks.once("ready", onReady);

