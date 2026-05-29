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
import { registerShopRegionHooks } from "./apps/documents/sceneRegions/shopRegions.mjs";
import { ShopActorSheet } from "../sheets/ShopActorSheet.mjs";
// --- 4. API IMPORTS ---
import { MarketplaceAPI, SR5SystemAPI } from './API/_module.mjs';
import { ItemBuilderApp } from "./apps/ItemBuilderApp.mjs";

/**
 * Draws the notification badge on the scene control button.
 * This function is called by the 'renderSceneControls' hook.
 * @param {JQuery} html The jQuery object for the scene controls container.
 */
function drawBadge(html) {
    // This guard clause prevents errors if the hook fires at an unexpected time.
    if (!html || !html.length || !game.user.isGM) return;

    // Get the latest count directly from the service every time the controls are rendered.
    const pendingCount = PurchaseService.getPendingRequestCount();

    const controlButton = html.find('[data-tool="sr5-marketplace"]');
    if (!controlButton.length) return;

    let badge = controlButton.find(".notification-badge");
    if (!badge.length) {
        badge = $('<span class="notification-badge"></span>');
        controlButton.append(badge);
    }

    if (pendingCount > 0) {
        badge.text(pendingCount).show();
    } else {
        badge.hide();
    }
}

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
        "modules/sr5-marketplace/templates/apps/itemBuilder/partials/multi-select.html"
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
    });
    if (game.user.isGM) {
        // Automatically run shop actor legacy skills migration
        migrateShopSkills();

        game.socket.on("module.sr5-marketplace", () => {
            // A real-time event was received. Trigger a re-draw after a short delay.
            setTimeout(() => {
                if (ui.controls) ui.controls.render(true);
            }, 250);
        });
        // On first load, render the controls to set the initial badge state.
        setTimeout(() => { if (ui.controls) ui.controls.render(true); }, 1000);
    }

});

/**
 * A hook that runs when a user's data is updated.
 * We use this to detect changes to a player's basket and update the GM's UI.
 */
Hooks.on("updateUser", (user, changes) => {
    // This now correctly checks for changes to the 'basket' flag.
    if (game.user.isGM && foundry.utils.hasProperty(changes, "flags.sr5-marketplace.basket")) {
        // A relevant flag changed, so just ask the UI to redraw the controls.
        setTimeout(() => {
            if (ui.controls) ui.controls.render(true);
        }, 250);
    }
});
// Add control buttons for the Marketplace and Item Builder
Hooks.on("getSceneControlButtons", (controls) => {
    // --- FOUNDRY V13 METHOD (Objects) ---
    if (!Array.isArray(controls)) {
        // Foundry V13 keys the controls object by name (usually "token" or "tokens")
        const tokenGroup = controls.token || controls.tokens;
        if (!tokenGroup || !tokenGroup.tools) return;

        // 1. Marketplace Button (Direct Object Assignment)
        tokenGroup.tools["sr5-marketplace"] = {
            name: "sr5-marketplace",
            title: game.i18n.localize("SR5Marketplace.Marketplace.Title") || "Marketplace",
            icon: "fas fa-shopping-cart",
            visible: true,
            toggle: true,
            active: false, // Default state
            onChange: () => {
                const app = Object.values(ui.windows).find(app => app.id === "inGameMarketplace");
                if (app) {
                    app.close();
                } else {
                    new inGameMarketplace().render(true);
                }

                // Set the toggle back to false and redraw the UI
                tokenGroup.tools["sr5-marketplace"].active = false;
                if (ui.controls) ui.controls.render(true);
            }
        };
        /**
        // 2. Item Builder Button (Direct Object Assignment)
        if (game.user.isGM) {
            tokenGroup.tools["sr5-item-builder"] = {
                name: "sr5-item-builder",
                title: "Item Builder",
                icon: "fas fa-hammer", 
                visible: true,
                toggle: true,
                active: Object.values(ui.windows).some(app => app.id === "ItemBuilderApp"),
                onChange: (toggled) => {
                    const app = Object.values(ui.windows).find(app => app.id === "ItemBuilderApp");
                    if (toggled) {
                        if (!app) new ItemBuilderApp().render(true);
                    } else {
                        if (app) app.close();
                    }
                }
            };
        }*/
        return; // Exit out, we are done with V13!
    }

    // --- FOUNDRY V12 AND OLDER METHOD (Arrays) ---
    const tokenControls = controls.find(c => c.name === "token");
    if (!tokenControls || !Array.isArray(tokenControls.tools)) return;

    if (!tokenControls.tools.find(t => t.name === "sr5-marketplace")) {
        tokenControls.tools.push({
            name: "sr5-marketplace",
            title: game.i18n.localize("SR5Marketplace.Marketplace.Title") || "Marketplace",
            icon: "fas fa-shopping-cart",
            visible: true,
            toggle: true,
            active: Object.values(ui.windows).some(app => app.id === "inGameMarketplace"),
            onClick: (toggled) => {
                const app = Object.values(ui.windows).find(app => app.id === "inGameMarketplace");
                if (toggled) {
                    if (!app) new inGameMarketplace().render(true);
                } else {
                    if (app) app.close();
                }
            }
        });
    }
    /**
    if (game.user.isGM && !tokenControls.tools.find(t => t.name === "sr5-item-builder")) {
        tokenControls.tools.push({
            name: "sr5-item-builder",
            title: "Item Builder",
            icon: "fas fa-hammer", 
            visible: true,
            toggle: true,
            active: Object.values(ui.windows).some(app => app.id === "ItemBuilderApp"),
            onClick: (toggled) => {
                const app = Object.values(ui.windows).find(app => app.id === "ItemBuilderApp");
                if (toggled) {
                    if (!app) new ItemBuilderApp().render(true);
                } else {
                    if (app) app.close();
                }
            }
        });
    }*/
});

Hooks.on("renderSceneControls", (app, html) => {
    drawBadge(html);
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

Hooks.on("updateActor", async (actor, changes, options, userId) => {
    if (game.user.id !== userId) return;
    
    const shops = getShopsForEmployee(actor);
    if (shops.length === 0) return;
    
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
});

Hooks.on("createItem", async (item, options, userId) => {
    if (game.user.id !== userId) return;
    if (item.type !== "skill" || !item.parent) return;
    
    const actor = item.parent;
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
});

Hooks.on("updateItem", async (item, changes, options, userId) => {
    if (game.user.id !== userId) return;
    if (item.type !== "skill" || !item.parent) return;
    
    const actor = item.parent;
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
});

Hooks.on("deleteItem", async (item, options, userId) => {
    if (game.user.id !== userId) return;
    if (item.type !== "skill" || !item.parent) return;
    
    const actor = item.parent;
    const shops = getShopsForEmployee(actor);
    for (const shop of shops) {
        const shopSkill = shop.items.find(i => i.type === "skill" && i.name === item.name);
        if (shopSkill) {
            console.log(`SR5 Marketplace | Skill item deleted on serving employee "${actor.name}". Deleting skill "${item.name}" from Shop "${shop.name}"`);
            await shop.deleteEmbeddedDocuments("Item", [shopSkill.id]);
        }
    }
});