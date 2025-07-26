console.debug("SR5 Marketplace | Loading module into FoundryVTT");
import { BasketModel } from "./models/basketModel.mjs";
import { BasketItemSheet } from "./sheets/BasketItemSheet.mjs";
import { defineShopActorSheetClass } from './sheets/ShopActorSheet.mjs';
import { shopSchema, shopActorMethods } from './scripts/actors/shopActor.mjs';

// --- Placeholders ---
class ShopActorData extends foundry.abstract.TypeDataModel {}
class ShopActor extends Actor {}

/**
 * Hook for Phase 1: Registration of placeholders.
 */
Hooks.once("init", () => {
    console.log("SR5 Marketplace | Phase 1: Initializing Module...");
    const actorType = "sr5-marketplace.shop";

    CONFIG.Actor.dataModels[actorType] = ShopActorData;
    CONFIG.Actor.documentClass[actorType] = ShopActor;
    CONFIG.Item.dataModels["sr5-marketplace.basket"] = BasketModel;
    
    const ShopActorSheet = defineShopActorSheetClass();
    Actors.registerSheet("sr5-marketplace", ShopActorSheet, {
        types: [actorType],
        makeDefault: true,
        label: "SR5.Marketplace.Shop.SheetName"
    });
    Items.registerSheet("sr5-marketplace", BasketItemSheet, {
        types: ["sr5-marketplace.basket"],
        makeDefault: true,
        label: "SR5.Marketplace.Basket.SheetName"
    });
});

/**
 * Hook for Phase 2: Finalize classes by re-wiring their inheritance.
 */
Hooks.once("ready", () => {
    console.log("SR5 Marketplace | Phase 2: Finalizing ShopActor Classes...");

    // --- THE FIX: Use the correct key "character" ---
    const RealBaseDataModel = CONFIG.Actor.dataModels.character;
    const RealBaseActor = CONFIG.Actor.documentClass; // This is the _SR5Actor class

    if (!RealBaseDataModel || !RealBaseActor) {
        console.error("SR5 Marketplace | SR5 base classes not found. Cannot finalize ShopActor.");
        return;
    }

    // Re-wire the prototype chain.
    Object.setPrototypeOf(ShopActorData.prototype, RealBaseDataModel.prototype);
    Object.setPrototypeOf(ShopActor.prototype, RealBaseActor.prototype);

    // Redefine the schema on our now-correctly-extended data model.
    ShopActorData.defineSchema = function() {
        const parentSchema = RealBaseDataModel.defineSchema();
        return {
            ...parentSchema,
            shop: new foundry.data.fields.SchemaField(shopSchema)
        };
    };
    
    // Add our custom methods to the ShopActor's prototype.
    Object.assign(ShopActor.prototype, shopActorMethods);

    console.log("SR5 Marketplace | ShopActor successfully extended from SR5 system.");
});