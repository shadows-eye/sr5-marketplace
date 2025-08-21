import MarketplaceDocumentSheetMixin from "../scripts/apps/documents/actors/marketplace-document-sheet-mixin.mjs";
import enrichHTML from '../scripts/services/enricher.mjs';
import { simpleAll, opposedAll, teamworkAll } from "../tests/SR5_Tests.mjs";
// We get the base ActorSheet class from Foundry's API.
const { ActorSheet } = foundry.applications.sheets;

/**
 * A custom V13 Actor Sheet for the ShopActor type, using ApplicationV2.
 * It is built by applying our custom mixin to the base ActorSheet.
 * @param {typeof ActorSheet} base The base ActorSheet class to extend.
 * @returns {typeof ShopActorSheet} The extended ShopActorSheet class.
 */
export class ShopActorSheet extends MarketplaceDocumentSheetMixin(ActorSheet) {
    /** Define the available sheet modes. */
    static MODES = {
        PLAY: "play",
        EDIT: "edit"
    };

    _isEditingBiography = false;
    _mode = ShopActorSheet.MODES.PLAY; // Default to play mode

    /** A helper getter to check if the sheet is in Play mode. */
    get isPlayMode() {
        return this._mode === this.constructor.MODES.PLAY;
    }

    /** A helper getter to check if the sheet is in Edit mode. */
    get isEditMode() {
        return this._mode === this.constructor.MODES.EDIT;
    }
    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ["sr5", "shop", "sr5-marketplace-shop"],
        position: {
            left: 103.5,
            top: 18,
            width: 1080,
            height: 900
        },
        actions: {
            ...super.DEFAULT_OPTIONS.actions,
            toggleMode: this.#onToggleMode,
            editImage: this.#onEditImage,
            openDocumentLink: this.#onOpenDocumentLink,
            addItem: this.#onAddItem,
            removeItem: this.#onRemoveItem,
            removeOwner: this.#onRemoveOwner,
            removeConnection: this.#onRemoveConnection,
            removeEmployee: this.#onRemoveEmployee,
            // SR5 Actions helper
            runSimpleSocial: this.#onRunSimpleSocial,
            runOpposedSocial: this.#onRunOpposedSocial,
            runTeamworkSocial: this.#onRunTeamworkSocial,
            rollAvailability: this.#onRollAvailability
        }
    };

    /**
     * @type {Object.<string, {template: string}>}
     * This defines the parts of the layout that can be reused in different contexts.
     */
    static PARTS = {
        // ADDED: The header is now a defined part of the layout.
        header: {
            template: "modules/sr5-marketplace/templates/documents/actor/partials/shop-header.html",
            classes: ["marketplace-header"]
        },
        // ADDED: The attributes section is also a part.
        attributes: {
            template: "modules/sr5-marketplace/templates/documents/actor/partials/shop-attributes.html"
        },
        // The tab navigation bar.
        tabs: {
            template: "templates/generic/tab-navigation.hbs",
            classes: ["marketplace-tabs"]
        },
        // The content for the tabs.
        actorShop: {
            template: "modules/sr5-marketplace/templates/documents/actor/actorShop.html",
        },
        biography: {
            template: "modules/sr5-marketplace/templates/documents/actor/partials/shop-biography.html"
        }
    };

    /**
     * @type {Object.<string, {tabs: Array<{id: string, label: string}>, initial: string}>}
     */
    static TABS = {
        primary: {
            tabs: [
                { id: "actorShop", label: "Shop Details" },
                { id: "biography", label: "Biography" }
            ],
            initial: "actorShop"
        }
    };

    /**
     * @override
     * Prepares the context object for rendering the template.
     * @param {object} options The options for preparing the context.
     * @returns {Promise<object>} The prepared context object.
     * @property {object} context.actor The actor being displayed.
     * @property {object} context.system The system data of the actor.
     * @property {object} context.flags The flags of the actor.
     * @property {boolean} context.isOwner Whether the user has ownership of the actor.
     * @property {boolean} context.isEditable Whether the actor is editable by the user.
     * @property {boolean} context.isGM Whether the user is a Game Master.
     * @property {object} context.systemFields A shortcut to the system's data model fields.
     * @property {object} context.system.attributes Grouped attributes for easier access.
     * @property {object} context.tab The current tab context.
     * @property {string} context.biographyHTML The enriched HTML for the biography.
     * @property {boolean} context._isEditingBiography Whether the biography is currently being edited.
     * @protected
     */
    async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.isPlayMode = this.isPlayMode;
    context.isEditMode = this.isEditMode;
    // Add common data useful for all sheets.
    context.actor = this.document;
    context.system = this.document.system;
    context.flags = this.document.flags;
    context.isOwner = this.document.isOwner;
    context.isEditable = this.isEditable;
    context.isGM = game.user.isGM;
    // ADD THIS LINE: Create a shortcut to the system's data model fields.
    context.systemFields = this.document.system.schema.fields;

    // Group attributes for the template
        if ( context.system.attributes ) {
            context.system.attributes.physicalAttributes = {
                body: context.system.attributes.body,
                agility: context.system.attributes.agility,
                reaction: context.system.attributes.reaction,
                strength: context.system.attributes.strength
            };
            context.system.attributes.mentalAttributes = {
                willpower: context.system.attributes.willpower,
                logic: context.system.attributes.logic,
                intuition: context.system.attributes.intuition,
                charisma: context.system.attributes.charisma
            };
            context.system.attributes.specialAttributes = {
                magic: context.system.attributes.magic,
                resonance: context.system.attributes.resonance,
                essence: context.system.attributes.essence,
                edge: context.system.attributes.edge,
                initiation: context.system.attributes.initiation,
                submersion: context.system.attributes.submersion
            };
        }
    
    return context;
    }

    /** 
     * @override 
     * Prepares the context for a specific part of the sheet.
     * @param {string} partId The ID of the part to prepare.
     * @param {object} context The context object to prepare.
     * @return {Promise<object>} The prepared context for the part.
     * @property {object} context.tab The tab context for the part.
     * @property {object} context.shopEmployees The shop employees list.
     * @property {object} context.modifierTypes The types of modifiers available for the shop.
     * @property {boolean} context.isEditing Whether the biography is being edited.
     * @property {string} context.biographyHTML The enriched HTML for the biography.
     * @property {object} context.activeSkills The list of active skills for the shop.
     * @property {object} context.knowledgeSkills The list of knowledge skills for the shop.
     * @property {object} context.languageSkills The list of language skills for the shop.
     * @protected
     */
    async _preparePartContext(partId, context) {
        context.tab = context.tabs[partId];
        context.isEditMode = this._mode === "edit";
        switch (partId) {
            case "actorShop":
                context.owner = await this.document.getOwner();
                context.connection = await this.document.getConnection();
                context.employees = await this.document.getEmployees();
                const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
                context.shopEmployees = this.document.system.shop?.employees?.join('\n') || "";
                context.modifierTypes = {
                    discount: game.i18n.localize("SR5.Marketplace.Shop.Discount"),
                    fee: game.i18n.localize("SR5.Marketplace.Shop.Fee")
                };
                const skills = this.document.system.skills;
                
                // --- UPDATED: Filter Active Skills to show only specific groups and individual skills ---
                const allowedGroups = ["Acting", "Influence"];
                const allowedSkills = ["intimidation", "instruction"];

                context.activeSkills = Object.entries(skills.active)
                    .filter(([key, data]) => {
                        // Keep the skill if its group is in our allowed list OR if the skill key is in our allowed list.
                        return allowedGroups.includes(data.group) || allowedSkills.includes(key);
                    })
                    .map(([key, data]) => {
                        const locKey = CONFIG.SR5.activeSkills[key];
                        return {
                            id: key,
                            name: game.i18n.localize(locKey) || key,
                            value: data.value
                        };
                    });

                // Prepare Knowledge Skills (Unchanged)
                context.knowledgeSkillGroups = Object.entries(skills.knowledge).map(([groupKey, groupData]) => {
                    return {
                        key: groupKey, // Pass the key for the input name attribute
                        label: game.i18n.localize(`SR5.KnowledgeSkill${capitalize(groupKey)}`),
                        skills: Object.entries(groupData.value).map(([skillId, skillData]) => ({
                            id: skillId,
                            name: skillData.name,
                            value: skillData.value
                        }))
                    };
                });
                
                // Prepare Language Skills (Unchanged)
                context.languageSkills = Object.entries(skills.language.value).map(([skillId, skillData]) => ({
                    id: skillId,
                    name: skillData.name,
                    value: skillData.value
                }));
                // --- ADDED: Prepare Inventory Data ---
                const inventory = this.document.system.shop.inventory;
                const preparedInventory = {};

                for (const [entryId, itemData] of Object.entries(inventory)) {
                    // Fetch the full item document from its UUID
                    const sourceItem = await fromUuid(itemData.itemUuid);
                    if (!sourceItem) continue;

                    // Combine system data with your module's shop data
                    preparedInventory[entryId] = {
                        ...itemData, // Includes sellPrice, buyPrice, etc. from your data model
                        img: sourceItem.img,
                        name: sourceItem.name,
                        rating: sourceItem.system.rating || 0,
                        itemPrice: sourceItem.system.cost || 0,
                        // Override availability.value with the system's if you want
                        // availability: { value: sourceItem.system.availability, base: itemData.availability.base }
                    };
                }
                context.inventory = preparedInventory;
                break;
            case "biography":
                context.biographyHTML = await enrichHTML(this.document.system.description.value, {
                    async: true,
                    relativeTo: this.document
                });
                break;
        }
        return context;
    }

    /** @override */
    _processFormData(event, form, formData) {
        const data = formData.object;
        if (data.system?.shop?.employees) {
            data.system.shop.employees = data.system.shop.employees
                .split('\n').map(e => e.trim()).filter(e => e);
        }
        this.document.update(data);
        return data;
    }

    /**
     * Handles removing the owner from the shop.
     */
    static async #onRemoveOwner(event, target) {
        if (!this.isEditMode) return;
        // Call the backend method on the actor document
        await this.document.removeOwner();
    }

    /**
     * Handles removing the connection item from the shop.
     */
    static async #onRemoveConnection(event, target) {
        if (!this.isEditMode) return;
        // Call the backend method on the actor document and then re-render the sheet.
        await this.document.removeConnection();
        this.render();
    }

    /**
     * Handles removing an employee from the shop.
     */
    static async #onRemoveEmployee(event, target) {
        if (!this.isEditMode) return;
        const employeeUuid = target.dataset.uuid;
        if (employeeUuid) {
            await this.document.removeEmployee(employeeUuid);
        }
    }

    /**
     * Handles clicks on document links to open their respective sheets.
     * @param {PointerEvent} event    The originating click event.
     * @param {HTMLElement} target    The capturing HTML element which defined a [data-action].
     * @private
     */
    static async #onOpenDocumentLink(event, target) {
        const uuid = target.dataset.uuid;
        if (!uuid) return;
        
        const doc = await fromUuid(uuid);
        if (doc?.sheet) {
            doc.sheet.render(true);
        }
    }

    /**
     * Handles removing an item from the inventory.
     * @param {PointerEvent} event    The originating click event.
     * @param {HTMLElement} target    The element with the data-action attribute.
     */
    static async #onRemoveItem(event, target) {
        if (!this.isEditMode) return;
        const inventoryEntryId = target.dataset.inventoryEntryId;
        if (!inventoryEntryId) return;

        const item = this.document.shop.inventory[inventoryEntryId];
        const sourceItem = await fromUuid(item.itemUuid);
        const itemName = sourceItem?.name ?? "this item";
        
        const choice = await foundry.applications.api.DialogV2.wait({
            window: { title: `Remove ${itemName}` },
            content: `<p>Are you sure you want to remove <strong>${itemName}</strong> from the inventory?</p>`,
            buttons: [
                { label: "Remove", action: "remove", icon: "fa-solid fa-trash" },
                { label: "Cancel", action: "cancel", icon: "fa-solid fa-times" }
            ],
            default: "cancel"
        });

        if (choice === "remove") {
            // 1. Await the backend data update.
            await this.document.removeItemFromInventory(inventoryEntryId);

            // 2. (As requested) Log the new state of the inventory to confirm the deletion.
            console.log(`Item entry ${inventoryEntryId} removed. Current inventory:`, this.document.shop.inventory);

            // 3. (The Fix) Trigger a re-render of the sheet to update the UI.
            this.render();
        }
    }

    /**
     * Handles the click on the "Add Item" button.
     * For now, it provides a helpful message. A full item browser could be implemented here later.
     */
    static #onAddItem(event, target) {
        if (!this.isEditMode) return;
        ui.notifications.info("Please drag and drop an item from the sidebar or a compendium into the inventory list.");
    }
    /**
     * Toggle Edit vs. Play mode.
     *
     * @this MarketplaceShopActorEditMode
     * @param {PointerEvent} event   The originating click event.
     * @param {HTMLElement} target   The capturing HTML element which defined a [data-action].
     */
    static async #onToggleMode(event, target) {
        // 'this' in a static action handler refers to the sheet instance.
        if (!this.isEditable) {
            ui.notifications.warn("You do not have permission to edit this sheet.");
            return;
        }
        this._mode = this.isPlayMode ? this.constructor.MODES.EDIT : this.constructor.MODES.PLAY;
        this.render();
    }

    /**
     * Handles the click on the profile image to open a FilePicker.
     * @private
     */
    static #onEditImage(event, target) {
        const filePicker = foundry.applications.apps.FilePicker.implementation;
        const fp = new filePicker({
            type: "image",
            current: this.document.img,
            callback: path => {
                // Update the document with the new image path
                this.document.update({img: path});
            },
            top: this.position.top + 40,
            left: this.position.left + 10
        });
        return fp.browse();
    }
    // --- SR5 Tests Start --- //

    /** 
     * Simple tests: all social skills for this actor
     * @TestCaller
     */
    static async #onRunSimpleSocial(event, target) {
    await simpleAll(this.document, { postToChat: true });
    }

    static async #onRunOpposedSocial(event, target) {
    let defenderUuid = target?.dataset?.defenderUuid;
    if (!defenderUuid) {
        // Try a targeted token first, then any controlled token (not this actor)
        const targeted = Array.from(game.user.targets ?? [])[0]?.actor;
        const controlled = canvas.tokens.controlled.find(t => t.actor?.id !== this.document.id)?.actor;
        const fallback = targeted ?? controlled;
        if (!fallback) return ui.notifications.warn("Select/target an opposing actor or set data-defender-uuid.");
        defenderUuid = fallback.uuid;
    }
    await opposedAll(this.document, defenderUuid,
        { postToChat: true });
    }

    static async #onRunTeamworkSocial(event, target) {
    let helpers = [];
    const ds = target?.dataset?.helpers;
    if (ds) {
        helpers = ds.split(",").map(s => s.trim()).filter(Boolean);
    } else {
        helpers = canvas.tokens.controlled
        .map(t => t.actor?.uuid)
        .filter(u => u && u !== this.document.uuid);
        if (!helpers.length) {
        return ui.notifications.warn("Control helper tokens or provide data-helpers on the button.");
        }
    }
    await teamworkAll(this.document, helpers, { 
        capByLeaderRating: true, postToChat: true });
    }

    /**
     * Handles the click on an item's availability by directly instantiating the AvailabilityTest class.
     */
    static async #onRollAvailability(event, target) {
        const availabilityStr = target.dataset.availability;
        if (!availabilityStr) return;

        const actor = this.document;

        // 1. Create a minimal data object. We only need to pass the values that are unique
        //    to this test and cannot be derived from a standard action.
        const testData = {
            // We add our custom availability string here so the test class can use it.
            availabilityStr: availabilityStr,
        };

        try {
            // 2. Create a new instance of our test class. The constructor will automatically
            //    call _prepareData to build the full data structure.
            const test = new game.shadowrun5e.tests.AvailabilityTest(
                testData,
                { actor }
            );

            // 3. Execute the test.
            await test.execute();

        } catch (e) {
            console.error("Marketplace | AvailabilityTest failed:", e);
            ui.notifications.error("Failed to run the Availability Test. See console (F12) for details.");
        }
    }

    // --- SR5 Tests End --- //

    /** @override */
    _configureRenderOptions(options) {
        super._configureRenderOptions(options);
        if (!this.element) return;
        this.element.classList.toggle("play-mode", this._mode === "play");
        this.element.classList.toggle("edit-mode", this._mode === "edit");
    }

    /**
     * @override
     * Force the sheet to re-render when switching tabs.
     * This ensures the context preparation is always run for the active tab.
     * @param {MouseEvent} event    The originating click event.
     * @param {string} group        The tab group name.
     * @param {string} active       The slug of the tab being activated.
     */
    _onSwitchTab(event, group, active) {
        // --- DEBUG LOG ---
        console.log(`Tab switched. Active tab is now: ${active}`);

        super._onSwitchTab(event, group, active);
        
        // --- DEBUG LOG ---
        console.log("Forcing a re-render.");
        this.render();
    }
    /**
     * @override
     * Handle dropped data on the sheet.
     * @param {DragEvent} event The concluding drag-and-drop event.
     */
    async _onDrop(event) {
        event.preventDefault();
        const dropTarget = event.target.closest(".drop-target");
        if (!dropTarget || !this.isEditMode) return;

        let data;
        try { data = JSON.parse(event.dataTransfer.getData('text/plain')); }
        catch (err) { return; }

        const dropZone = dropTarget.dataset.dropZone;

        // Use a switch to handle different drop zones
        switch (dropZone) {
            case "inventory": {
                if (data.type !== "Item") return;
                const item = await Item.fromDropData(data);
                if (!item) return;

                // As requested, reject 'contact' items from the main inventory.
                if (item.type === "contact") {
                    ui.notifications.warn("Contacts cannot be added to inventory. Drop on the 'Connection' field instead.");
                    return;
                }
                return this.document.addItemToInventory(item);
            }

            case "connection": {
                if (data.type !== "Item") return;
                const item = await Item.fromDropData(data);
                if (!item) return;

                // Only allow items of type 'contact' to be dropped here.
                if (item.type !== "contact") {
                    ui.notifications.warn("Only Items of type 'Contact' can be dropped on the Connection field.");
                    return;
                }
                const targetField = dropTarget.dataset.targetField;
                return this.document.update({ [targetField]: data.uuid });
            }

            case "owner":
            case "employees": {
                if (data.type !== "Actor") return;
                const targetField = dropTarget.dataset.targetField;
                if (targetField === "system.shop.employees") {
                    return this.document.addEmployee(data.uuid);
                } else {
                    return this.document.update({ [targetField]: data.uuid });
                }
            }
        }
    }
}