console.debug("SR5 Marketplace | Loading module into FoundryVTT");
import { BasketModel } from "./models/BasketItemModel.mjs";
import { BasketItemSheet } from "./sheets/BasketItemSheet.mjs";

/**
 * Function to register item types and their data models.
 */
const registerItemTypes = () => {
    console.log("SR5 Marketplace | Registering Item Types and Models...");

    // Register Basket type and its data model
    Object.assign(CONFIG.Item.dataModels, {
        basket: BasketModel,
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

    // Hook for preCreateItem to initialize default values
    Hooks.on("preCreateItem", async (item, options, userId) => {
        if (item.type === "basket") {
            console.log("Initializing default values for new basket item...");

            // Set default values for the basket item
            item.updateSource({
                description: { long: "", short: "" },
                img: "icons/svg/treasure.svg",
                marketbasket: {
                    basketQuantity: 1,
                    basketPrice: 0,
                    basketAvailability: "0",
                    basketItems: [],
                    totalCost: 0,
                    totalEssence: 0,
                    totalKarma: 0,
                    basketUuid: "",
                },
            });

            console.log("Basket item initialized with defaults, waiting for _id to assign UUID.");
        }
    });

    // Hook for createItem to set the UUID
    Hooks.on("createItem", async (item, options, userId) => {
        if (item.type === "basket") {
            console.log("Setting basketUuid for new basket item...");

            // Use the system-generated _id as the UUID
            const uuid = `item.${item.id}`;

            // Update the item with the correct UUID
            await item.update({
                "marketbasket.basketUuid": uuid,
            });

            console.log("Basket item updated with UUID:", uuid);
        }
    });

    console.log("SR5 Marketplace | Hooks registered for item creation.");
};

// Hook into Foundry initialization and readiness lifecycle
Hooks.once("init", onInit);
Hooks.once("ready", onReady);