// --- IMPORT PRE-INSTANTIATED SERVICES FROM BARREL FILE ---
import '../styles/marketplace.css';
import {
    MODULE_ID,
    SHOP_ACTOR_TYPE,
    parseAvailability,
    LocalizationService,
    registerBasicHelpers,
    migrateShopSkills
} from './lib/_module.mjs';
import { defineShopActorClass } from '../models/actor/shopActor.mjs';
import {
    actorItemServices,
    basketService,
    purchaseService,
    indexService,
    builderStateService,
    deliveryTimeService,
    diceHelperService,
    themeService,
    systemDataMapperService,
    ItemDataServices // <-- We import the class here because you need 'new ItemDataServices()' for your API
} from './services/_module.mjs';

// Re-export instances/classes as well ONLY IF you need them available globally 
// to other modules/scripts that import marketHooks directly.
export {
    actorItemServices,
    basketService,
    purchaseService,
    indexService,
    builderStateService,
    deliveryTimeService,
    diceHelperService,
    themeService,
    systemDataMapperService,
    ItemDataServices
};

import { inGameMarketplace } from "./apps/inGameMarketplace.mjs";
import { MarketplaceSettingsApp } from "./apps/MarketplaceSettingsApp.mjs";
import { MarketShouterApp } from "./apps/marketshouter.mjs";
import { registerShopRegionHooks } from "./apps/documents/sceneRegions/shopRegions.mjs";
import { ShopActorSheet } from "../sheets/ShopActorSheet.mjs";
// --- 4. API IMPORTS ---
import { MarketplaceAPI, SR5SystemAPI } from './API/_module.mjs';
import { ItemBuilderApp } from "./apps/ItemBuilderApp.mjs";



// --- HOOKS SECTION ---

// Register helpers and templates
const initializeTemplates = () => {
    console.log("SR5 Marketplace | Registering templates and helpers...");
    registerBasicHelpers();

    foundry.applications.handlebars.loadTemplates([
        "modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shop.html",
        "modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/orderReview.html",
        "modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/marketplaceUserActor.html",
        "modules/sr5-marketplace/templates/documents/items/libraryItem.html",
        "modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shoppingCart.html",
        "modules/sr5-marketplace/templates/apps/marketplace-settings/marketplace-settings.html",
        "modules/sr5-marketplace/templates/apps/marketplace-settings/partials/settings-card.html",
        "modules/sr5-marketplace/templates/documents/actor/partials/shop-header.html",
        "modules/sr5-marketplace/templates/documents/actor/partials/shop-skills.html",
        "modules/sr5-marketplace/templates/documents/actor/partials/shop-inventory.html",
        "modules/sr5-marketplace/templates/documents/actor/partials/shop-management.html",
        "modules/sr5-marketplace/templates/documents/items/itemPreviewApp/item-preview.html",
        "modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/AvailabilityDialog.html",
        "modules/sr5-marketplace/templates/apps/itemBuilder/partials/Builder.html",
        "modules/sr5-marketplace/templates/apps/itemBuilder/partials/ItemDetails.html",
        "modules/sr5-marketplace/templates/apps/itemBuilder/partials/multi-select.html",
        "modules/sr5-marketplace/templates/apps/marketshouter/marketshouter.html"
    ]);
};
// Initialize module settings
const initializeSettings = () => {
    console.log("SR5 Marketplace | Initializing settings...");

    game.settings.register("sr5-marketplace", "resetItemLoad", {
        name: game.i18n.localize("SR5Marketplace.Marketplace.Settings.ResetItemLoad.name"),
        hint: game.i18n.localize("SR5Marketplace.Marketplace.Settings.ResetItemLoad.hint"),
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
        name: game.i18n.localize("SR5Marketplace.Marketplace.Settings.ApprovalWorkflow.name"),
        hint: game.i18n.localize("SR5Marketplace.Marketplace.Settings.ApprovalWorkflow.hint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
        restricted: true,
    });

    game.settings.register("sr5-marketplace", "karmaCostForSpell", {
        name: game.i18n.localize("SR5Marketplace.Marketplace.Settings.KarmaSpell.name"),
        hint: game.i18n.localize("SR5Marketplace.Marketplace.Settings.KarmaSpell.hint"),
        scope: "world",
        config: true,
        type: Number,
        default: 5,
        restricted: true,
    });

    game.settings.register("sr5-marketplace", "karmaCostForComplexForm", {
        name: game.i18n.localize("SR5Marketplace.Marketplace.Settings.KarmaComplexForm.name"),
        hint: game.i18n.localize("SR5Marketplace.Marketplace.Settings.KarmaComplexForm.hint"),
        scope: "world",
        config: true,
        type: Number,
        default: 5,
        restricted: true,
    });
    game.settings.register("sr5-marketplace", "itemTypeBehaviors", {
        name: game.i18n.localize("SR5Marketplace.Marketplace.Settings.ItemTypeBehaviors.name"),
        scope: "world",
        config: false, // Hidden from the default menu
        type: Object,
        default: {}
    });
    game.settings.register("sr5-marketplace", "openSettingsMenu", {
        name: game.i18n.localize("SR5Marketplace.Marketplace.Settings.Menu.name"),
        hint: game.i18n.localize("SR5Marketplace.Marketplace.Settings.Menu.hint"),
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

    game.settings.register("sr5-marketplace", "availabilityTestRule", {
        name: game.i18n.localize("SR5Marketplace.Marketplace.Settings.AvailabilityRule.name"),
        hint: game.i18n.localize("SR5Marketplace.Marketplace.Settings.AvailabilityRule.hint"),
        scope: "world",
        config: true, // This makes it visible in the settings menu
        restricted: true, // Only GMs can change it
        type: String, // The setting will store the key of the chosen option (e.g., "opposed")
        choices: {
            // The keys here are what will be saved in the setting
            "opposed": game.i18n.localize("SR5Marketplace.Marketplace.Settings.AvailabilityRule.choices.opposed"),
            "simple": game.i18n.localize("SR5Marketplace.Marketplace.Settings.AvailabilityRule.choices.simple"),
            "extended": game.i18n.localize("SR5Marketplace.Marketplace.Settings.AvailabilityRule.choices.extended")
        },
        default: "opposed", // The default rule will be the core Opposed Test
    });

    registerShopRegionHooks();
};

/**
 * This hook injects our custom button into the settings menu using standard JavaScript.
 */
Hooks.on("renderSettingsConfig", (app, html, data) => {
    // 'html' is a standard HTMLElement.
    const settingInput = html.querySelector(`[name="sr5-marketplace.openSettingsMenu"]`);
    if (!settingInput) return;

    const settingGroup = settingInput.closest(".form-group");
    if (!settingGroup) return;

    const formFields = settingGroup.querySelector(".form-fields");
    if (!formFields) return;

    // Hide the placeholder's original input element.
    settingInput.style.display = "none";

    // --- Button Injection ---
    const buttonClass = "sr5-marketplace-settings-button";
    if (!formFields.querySelector(`.${buttonClass}`)) {
        const button = document.createElement("button");
        button.type = "button";
        button.classList.add(buttonClass);
        button.innerHTML = `<i class="fas fa-cogs"></i> ${game.i18n.localize("SR5Marketplace.Marketplace.Settings.Menu.buttonLabel")}`;

        button.addEventListener("click", () => {
            new MarketplaceSettingsApp().render(true);
        });

        formFields.appendChild(button);
    }

    // --- CORRECTED Tag Display Logic ---

    // Remove any existing summary to prevent it from duplicating on re-render.
    const existingSummary = settingGroup.parentElement.querySelector('.behavior-summary');
    if (existingSummary) existingSummary.remove();

    // 1. Get ALL types from the indexed item data, just like the settings app does.
    const allItems = game.sr5marketplace.api.itemData.getItems();
    const allTypes = [...new Set(allItems.map(item => item.type))].sort();

    // 2. Get the saved behaviors.
    const behaviors = game.settings.get("sr5-marketplace", "itemTypeBehaviors");

    if (allTypes.length > 0) {
        const summaryContainer = document.createElement("div");
        summaryContainer.classList.add("behavior-summary");

        // 3. Loop through the COMPLETE list of all types.
        for (const type of allTypes) {
            // Filter out internal types that we don't want to show.
            if (["base"].includes(type)) continue;

            const behavior = behaviors[type] || 'single'; // Default to 'single'

            const tag = document.createElement("span");
            tag.classList.add("behavior-tag", behavior);
            tag.textContent = type; // The CSS will handle capitalizing.
            switch (behavior) {
                case "unique":
                    tag.title = game.i18n.localize("SR5Marketplace.Marketplace.Settings.CategoryUnique");
                    break;
                case "stack":
                    tag.title = game.i18n.localize("SR5Marketplace.Marketplace.Settings.StackingItems");
                    break;
                case "single":
                    tag.title = game.i18n.localize("SR5Marketplace.Marketplace.Settings.SingleItems");
                    break;
            }
            summaryContainer.appendChild(tag);
        }

        // Place the summary container after the entire form group for correct layout.
        settingGroup.after(summaryContainer);
    }
});

// Initialize the module on startup
Hooks.once("init", () => {
    console.log("SR5 Marketplace | Initializing module...");
    initializeTemplates();
    initializeSettings();
    // Register the custom ShopActor class
    defineShopActorClass();

    // Register the custom ShopActorSheet
    foundry.documents.collections.Actors.registerSheet("sr5-marketplace", ShopActorSheet, {
        types: [SHOP_ACTOR_TYPE],
        makeDefault: true,
        label: "SR5Marketplace.Marketplace.Shop.SheetName"
    });


    // --- NEW API REGISTRATION ---
    // 1. Instantiate the main API container and assign it to the root
    game.sr5marketplace = new MarketplaceAPI();

    // 2. Nest all other API services under the '.api' property
    game.sr5marketplace.api = {
        system: new SR5SystemAPI(),
        itemData: new ItemDataServices(), // Pulled perfectly from your services barrel!

        // 3. Instantiate your sub-APIs using the static properties
        marketplace: new MarketplaceAPI.Marketplace(),
        itemBuilder: new MarketplaceAPI.ItemBuilder()
    };

    // Register custom tests during setup after system has initialized its globals but before ready
    Hooks.once("setup", async () => {
        const { registerTests } = await import('../utils/tests.mjs');
        registerTests();
    });
});

/**
 * A hook that runs when the game is fully ready and all data is loaded.
 */
Hooks.on("ready", async () => {
    console.log("SR5 Marketplace | Module is ready!");

    // --- REMOVED: await game.sr5marketplace.api.itemData.initialize(); ---
    game.sr5marketplace.api.itemData.buildIndex().then(() => {
        console.log("SR5 Marketplace | Item index successfully cached in memory.");
        MarketShouterApp.initialize();
    });
    if (game.user.isGM) {
        // Automatically run shop actor legacy skills migration
        migrateShopSkills();
    }

});

/**
 * A hook that runs when a user's data is updated.
 * We use this to detect changes to a player's basket and update the GM's UI.
 */
Hooks.on("updateUser", (user, changes) => {

    // Refresh the MarketShouter badge when user baskets or approval requests update
    if (foundry.utils.hasProperty(changes, "flags.sr5-marketplace.basket")) {
        const shouter = foundry.applications.instances.get("marketshouter");
        if (shouter) {
            // Re-render if GM (to show new player requests instantly) OR if the user is modifying their own basket
            if (game.user.isGM || user.id === game.user.id) {
                shouter.render();
            }
        }
    }
});


/**
 * A hook that runs when the canvas is ready.
 * We use this to add a global listener for double-clicking on Shop Actor tokens.
 */
Hooks.on("canvasReady", () => {
    // A flag to prevent attaching the listener multiple times.
    if (canvas.marketplaceListenerAttached) return;

    // Listen for the browser's native 'dblclick' event on the main canvas element.
    canvas.app.view.addEventListener('dblclick', event => {
        // We only care about interactions when the token select tool is active.
        if (game.activeTool !== "select") return;

        // Get the token currently under the user's mouse cursor.
        const hoveredToken = canvas.tokens.hover;

        // If there is a hovered token and its actor is a shop, we take over.
        if (hoveredToken?.actor?.type === "sr5-marketplace.shop") {
            // Stop the event from propagating to prevent Foundry's default behavior.
            event.preventDefault();
            event.stopPropagation();

            console.log(`Marketplace | Intercepted double-click on Shop Actor: ${hoveredToken.name}`);

            // Open the marketplace application, passing the shop's UUID as an option.
            new inGameMarketplace({ shopActorUuid: hoveredToken.actor.uuid }).render(true);
        }
    });

    // Set the flag so this hook only runs once per canvas session.
    canvas.marketplaceListenerAttached = true;
    console.log("Marketplace | Double-click listener for shops is now active.");
});

/**
 * Reactively refresh the MarketShouter widget when the active token selection changes on the canvas.
 */
Hooks.on("controlToken", (token, controlled) => {
    const shouter = foundry.applications.instances.get("marketshouter");
    if (shouter) {
        shouter.render();
    }
});

/**
 * Reactively refresh the MarketShouter widget when a token moves into/out of a shop region.
 */
Hooks.on("updateToken", (token, changes) => {
    if ("x" in changes || "y" in changes) {
        const shouter = foundry.applications.instances.get("marketshouter");
        if (shouter) {
            shouter.render();
        }
    }
});

/**
 * Reactively refresh the MarketShouter widget when the sidebar is collapsed or expanded.
 */
Hooks.on("collapseSidebar", (sidebar, collapsed) => {
    const shouter = foundry.applications.instances.get("marketshouter");
    if (shouter) {
        if (typeof shouter.updatePosition === "function") {
            shouter.updatePosition();
        } else {
            shouter.render();
        }
    }
});

// --- Seed default skills on new Shop Actor creation ---
async function seedDefaultSkills(actor) {
    const SYSTEM_ID = 'shadowrun5e';
    const pack = game.packs.find(p => 
        p.metadata.system === SYSTEM_ID && p.metadata.name === 'sr5e-skills'
    ) || game.packs.find(p => p.metadata.name === 'sr5e-skills');

    if (!pack) {
        console.warn("SR5 Marketplace | Skills compendium ('sr5e-skills') not found. Fallback seeding generic active skills.");
        const defaultSkillKeys = ["negotiation", "instruction", "etiquette", "intimidation", "leadership", "con", "impersonation", "performance"];
        const itemsToCreate = defaultSkillKeys.map(key => {
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            return {
                name: label,
                type: 'skill',
                system: {
                    type: 'skill',
                    skill: {
                        category: 'active',
                        attribute: 'charisma',
                        rating: 0,
                        value: 0
                    }
                }
            };
        });
        await actor.createEmbeddedDocuments('Item', itemsToCreate);
        return;
    }

    try {
        const compendiumSkills = await pack.getDocuments();
        console.log(`SR5 Marketplace | Seeding ${compendiumSkills.length} skills from compendium onto new Shop Actor "${actor.name}"...`);

        const itemsToCreate = compendiumSkills.map(item => {
            const itemData = item.toObject();
            if (itemData.system) {
                if (!itemData.system.skill) itemData.system.skill = {};
                itemData.system.skill.rating = 0;
                itemData.system.skill.value = 0;
                itemData.system.rating = { value: 0 };
                itemData.system.value = 0;
            }
            return itemData;
        });

        if (itemsToCreate.length > 0) {
            await actor.createEmbeddedDocuments('Item', itemsToCreate);
            console.log(`SR5 Marketplace | Successfully seeded ${itemsToCreate.length} skills onto new Shop Actor "${actor.name}".`);
        }
    } catch (err) {
        console.error("SR5 Marketplace | Failed to seed skills from compendium:", err);
    }
}

Hooks.on("createActor", async (actor, options, userId) => {
    if (game.user.id !== userId) return;
    if (actor.type !== "sr5-marketplace.shop") return;
    await seedDefaultSkills(actor);
});

function getShopsForEmployee(actor) {
    if (!game.actors) return [];
    return game.actors.filter(a => a.type === "sr5-marketplace.shop" && a.system.shop?.servingEmployee === actor.uuid);
}

function getShopsForAnyEmployee(actor) {
    if (!game.actors) return [];
    return game.actors.filter(a => a.type === "sr5-marketplace.shop" && (a.system.shop?.employees?.includes(actor.uuid) || a.system.shop?.servingEmployee === actor.uuid));
}

Hooks.on("updateActor", async (actor, changes, options, userId) => {
    if (game.user.id !== userId) return;
    
    // If the Shop Actor itself is updated and its employees/serving employee changed, sync their devices to host
    if (actor.type === "sr5-marketplace.shop") {
        if (foundry.utils.hasProperty(changes, "system.shop.servingEmployee") || foundry.utils.hasProperty(changes, "system.shop.employees")) {
            console.log(`SR5 Marketplace | Shop employees changed on "${actor.name}". Syncing devices to Host.`);
            await actor.syncEmployeeDevicesToHost();
        }
        return;
    }
    
    const shops = getShopsForEmployee(actor);
    if (shops.length > 0) {
        // 1. Sync attributes
        if (foundry.utils.hasProperty(changes, "system.attributes")) {
            for (const shop of shops) {
                const updateData = {};
                let hasChanges = false;
                for (const attrKey of ["body", "agility", "reaction", "strength", "willpower", "logic", "intuition", "charisma", "magic", "resonance", "essence", "edge"]) {
                    const newVal = actor.system.attributes[attrKey]?.base ?? actor.system.attributes[attrKey]?.value ?? 0;
                    const currentVal = shop.system.attributes[attrKey]?.base ?? shop.system.attributes[attrKey]?.value ?? 0;
                    if (newVal !== currentVal) {
                        updateData[`system.attributes.${attrKey}.base`] = newVal;
                        updateData[`system.attributes.${attrKey}.value`] = newVal;
                        hasChanges = true;
                    }
                }
                if (hasChanges) {
                    console.log(`SR5 Marketplace | Automatically syncing serving employee "${actor.name}" attributes to Shop Actor "${shop.name}"`);
                    await shop.update(updateData);
                }
            }
        }

        // 2. Sync legacy skills
        if (foundry.utils.hasProperty(changes, "system.skills")) {
            for (const shop of shops) {
                console.log(`SR5 Marketplace | Automatically syncing serving employee "${actor.name}" legacy skills to Shop Actor "${shop.name}"`);
                await shop.update({
                    "system.skills": foundry.utils.duplicate(actor.system.skills || {})
                });
            }
        }
    }

    // Sync devices to host if employee device equipped/unequipped state is updated via attributes/etc.
    if (foundry.utils.hasProperty(changes, "system.technology.equipped") || foundry.utils.hasProperty(changes, "system.equipped")) {
        const anyShops = getShopsForAnyEmployee(actor);
        for (const shop of anyShops) {
            console.log(`SR5 Marketplace | Employee "${actor.name}" device equipped state updated. Syncing to Host on Shop "${shop.name}"`);
            await shop.syncEmployeeDevicesToHost();
        }
    }
});

Hooks.on("createItem", async (item, options, userId) => {
    if (game.user.id !== userId) return;
    if (!item.parent) return;
    
    const actor = item.parent;
    if (actor.type === "sr5-marketplace.shop" && item.type === "host") {
        console.log(`SR5 Marketplace | Host item "${item.name}" created/dropped on Shop Actor "${actor.name}". Syncing employee devices after delay.`);
        setTimeout(() => {
            if (actor && !actor.destroyed) {
                actor.syncEmployeeDevicesToHost();
            }
        }, 100);
        return;
    }

    if (item.type === "skill") {
        const shops = getShopsForEmployee(actor);
        for (const shop of shops) {
            const alreadyExists = shop.items.some(i => i.type === "skill" && i.name === item.name);
            if (!alreadyExists) {
                console.log(`SR5 Marketplace | Skill item created on serving employee "${actor.name}". Syncing skill "${item.name}" to Shop "${shop.name}"`);
                const itemObj = item.toObject();
                delete itemObj._id;
                await shop.createEmbeddedDocuments("Item", [itemObj]);
            }
        }
    } else if (item.type === "device") {
        const anyShops = getShopsForAnyEmployee(actor);
        for (const shop of anyShops) {
            console.log(`SR5 Marketplace | Device item created on employee "${actor.name}". Syncing devices to Host on Shop "${shop.name}"`);
            await shop.syncEmployeeDevicesToHost();
        }
    }
});

Hooks.on("updateItem", async (item, changes, options, userId) => {
    if (game.user.id !== userId) return;
    if (!item.parent) return;
    
    const actor = item.parent;
    if (actor.type === "sr5-marketplace.shop" && item.type === "host") {
        console.log(`SR5 Marketplace | Host item "${item.name}" updated on Shop Actor "${actor.name}". Syncing employee devices after delay.`);
        setTimeout(() => {
            if (actor && !actor.destroyed) {
                actor.syncEmployeeDevicesToHost();
            }
        }, 100);
        return;
    }

    if (item.type === "skill") {
        const shops = getShopsForEmployee(actor);
        for (const shop of shops) {
            const shopSkill = shop.items.find(i => i.type === "skill" && i.name === item.name);
            if (shopSkill) {
                console.log(`SR5 Marketplace | Skill item updated on serving employee "${actor.name}". Syncing skill "${item.name}" to Shop "${shop.name}"`);
                const itemChanges = foundry.utils.duplicate(changes);
                itemChanges._id = shopSkill.id;
                await shop.updateEmbeddedDocuments("Item", [itemChanges]);
            }
        }
    } else if (item.type === "device") {
        const anyShops = getShopsForAnyEmployee(actor);
        for (const shop of anyShops) {
            console.log(`SR5 Marketplace | Device item "${item.name}" updated on employee "${actor.name}". Syncing devices to Host on Shop "${shop.name}"`);
            await shop.syncEmployeeDevicesToHost();
        }
    }
});

Hooks.on("deleteItem", async (item, options, userId) => {
    if (game.user.id !== userId) return;
    if (!item.parent) return;
    
    const actor = item.parent;
    if (item.type === "skill") {
        const shops = getShopsForEmployee(actor);
        for (const shop of shops) {
            const shopSkill = shop.items.find(i => i.type === "skill" && i.name === item.name);
            if (shopSkill) {
                console.log(`SR5 Marketplace | Skill item deleted on serving employee "${actor.name}". Deleting skill "${item.name}" from Shop "${shop.name}"`);
                await shop.deleteEmbeddedDocuments("Item", [shopSkill.id]);
            }
        }
    } else if (item.type === "device") {
        const anyShops = getShopsForAnyEmployee(actor);
        for (const shop of anyShops) {
            console.log(`SR5 Marketplace | Device item "${item.name}" deleted on employee "${actor.name}". Syncing devices to Host on Shop "${shop.name}"`);
            await shop.syncEmployeeDevicesToHost();
        }
    }
});