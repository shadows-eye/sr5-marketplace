import MarketplaceDocumentSheetMixin from "../scripts/apps/documents/actors/marketplace-document-sheet-mixin.mjs";
import enrichHTML from '../scripts/services/enricher.mjs';
import { simpleAll, opposedAll, teamworkAll } from "../tests/SR5_Tests.mjs";
import { InventoryRules } from "../scripts/services/_module.mjs";
import { inGameMarketplace } from "../scripts/apps/inGameMarketplace.mjs";
// We get the base ActorSheet class from Foundry's API.
const { ActorSheet } = foundry.applications.sheets;

/**
 * Helper to match an embedded skill item name (e.g. "First Aid" or "Negotiation")
 * to its system-defined underscore key (e.g. "first_aid" or "negotiation").
 * @param {string} itemName
 * @returns {string} The matched system key or normalized key as fallback.
 */
function findSystemSkillKey(itemName) {
    if (!itemName) return "";
    const normName = itemName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Check key or localized labels from CONFIG.SR5.activeSkills
    for (const [key, locKey] of Object.entries(CONFIG.SR5.activeSkills || {})) {
        if (key.toLowerCase().replace(/[^a-z0-9]/g, '') === normName) {
            return key;
        }
        const localized = game.i18n.localize(locKey);
        if (localized && localized.toLowerCase().replace(/[^a-z0-9]/g, '') === normName) {
            return key;
        }
    }
    
    // Fallback to lowercased name with spaces/dashes converted to underscores
    return itemName.toLowerCase().replace(/[\s-]+/g, '_');
}

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
        return this._mode === "play";
    }

    /** A helper getter to check if the sheet is in Edit mode. */
    get isEditMode() {
        return this._mode === "edit";
    }

    /** * @override 
     * Intercept the render call. If a player (non-GM) double clicks the token, 
     * divert them directly to the marketplace interface for this specific shop.
     */
    render(options, _options) {
        if (!game.user.isGM) {
            // Spawn the marketplace specifically targeting this shop's UUID
            new inGameMarketplace({ shopActorUuid: this.document.uuid }).render(true);
            
            // Abort rendering the configuration sheet
            return this;
        }
        return super.render(options, _options);
    }
    /** @override */
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
        classes: ["sr5", "shop", "sr5-marketplace-shop"],
        position: {
            left: 103.5,
            top: 18,
            width: 1080,
            height: 900
        },
        actions: {
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
            rollAvailability: this.#onRollAvailability,
            createSkill: this.#onCreateSkill,
            deleteSkill: this.#onDeleteSkill,
            clickSkillName: this.#onClickSkillName,
                        setServingEmployee: this.#onSetServingEmployee,
            openHostSheet: this.#onOpenHostSheet,
            openMatrixTab: this.#onOpenMatrixTab
        }
    }, { inplace: false });

    /**
     * @type {Object.<string, {template: string}>}
     * This defines the parts of the layout that can be reused in different contexts.
     */
    static PARTS = {
        header: {
            template: "modules/sr5-marketplace/templates/documents/actor/partials/shop-header.html",
            classes: ["marketplace-header"]
        },
        tabs: {
            template: "templates/generic/tab-navigation.hbs",
            classes: ["marketplace-tabs"]
        },
        attributes: {
            template: "modules/sr5-marketplace/templates/documents/actor/partials/shop-attributes.html"
        },
        actorShop: {
            template: "modules/sr5-marketplace/templates/documents/actor/actorShop.html",
        },
        // NEW: Management Tab Part
        management: {
            template: "modules/sr5-marketplace/templates/documents/actor/partials/shop-management.html",
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
                { id: "management", label: "Management" },
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
    
        // Resolve employees and Matrix Host globally so they are available to both attributes and management parts
        const baseEmployees = await this.document.getEmployees();
        const employees = [];
        for (const emp of baseEmployees) {
            if (!employees.some(e => e.uuid === emp.uuid)) {
                employees.push(emp);
            }
            if (typeof emp.getActiveTokens === "function") {
                const tokens = emp.getActiveTokens() || [];
                for (const t of tokens) {
                    if (t.document?.actor) {
                        if (!employees.some(e => e.uuid === t.document.actor.uuid)) {
                            employees.push(t.document.actor);
                        }
                    }
                }
            }
        }
        context.employees = employees;

        const hostItem = this.document.hostItem;
        context.hostItem = hostItem;
        if (hostItem) {
            context.hostASDF = hostItem.ASDF;
            const slavedDevices = [];
            const seen = new Set();
            for (const emp of context.employees || []) {
                const devices = emp.items.filter(i => 
                    i.type === "device" && 
                    ["commlink", "cyberdeck"].includes(i.system.category) &&
                    i.system.technology?.equipped !== false
                );
                for (const d of devices) {
                    const key = `${d.name}-${emp.name}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        slavedDevices.push({
                            id: d.id,
                            uuid: d.uuid,
                            name: d.name,
                            category: d.system.category,
                            ownerName: emp.name,
                            ownerUuid: emp.uuid,
                            img: d.img
                        });
                    }
                }
            }
            context.slavedDevices = slavedDevices;
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
                    discount: game.i18n.localize("SR5Marketplace.Marketplace.Shop.Discount"),
                    fee: game.i18n.localize("SR5Marketplace.Marketplace.Shop.Fee")
                };
                const skills = this.document.system.skills || {};

                // 1. Gather all active skills from embedded items
                const embeddedActiveSkills = this.document.items
                    .filter(i => i.type === "skill" && i.system.skill?.category === "active")
                    .map(i => {
                        const systemKey = findSystemSkillKey(i.name);
                        const locKey = CONFIG.SR5.activeSkills[systemKey];
                        return {
                            id: systemKey,
                            itemId: i.id,
                            name: game.i18n.localize(locKey) || i.name,
                            value: i.system.skill?.rating ?? i.system.rating?.value ?? i.system.value ?? 0
                        };
                    });

                // Gather active skills from legacy fallback (if any exist)
                const legacyActiveSkills = Object.entries(skills.active || {}).map(([key, data]) => {
                    const locKey = CONFIG.SR5.activeSkills[key];
                    return {
                        id: key,
                        name: game.i18n.localize(locKey) || key,
                        value: data?.value ?? 0
                    };
                });

                // Combine and de-duplicate active skills
                const activeSkillsMap = new Map();
                for (const s of [...legacyActiveSkills, ...embeddedActiveSkills]) {
                    if (activeSkillsMap.has(s.id)) {
                        const existing = activeSkillsMap.get(s.id);
                        activeSkillsMap.set(s.id, {
                            ...existing,
                            ...s,
                            itemId: s.itemId || existing.itemId,
                            value: s.itemId ? s.value : (existing.itemId ? existing.value : Math.max(s.value, existing.value))
                        });
                    } else {
                        activeSkillsMap.set(s.id, s);
                    }
                }
                let activeSkillsList = Array.from(activeSkillsMap.values());
                if (!context.isEditMode) {
                    activeSkillsList = activeSkillsList.filter(s => s.value > 0);
                }
                context.activeSkills = activeSkillsList;

                // 2. Gather Knowledge/Hobby skills from embedded items
                const embeddedKnowledge = this.document.items
                    .filter(i => i.type === "skill" && i.system.skill?.category === "knowledge");

                // Legacy fallback for knowledge
                const legacyKnowledge = Object.entries(skills.knowledge || {}).flatMap(([groupKey, groupData]) => {
                    return Object.entries(groupData?.value || {}).map(([skillId, skillData]) => ({
                        id: skillId,
                        name: skillData?.name ?? "",
                        value: skillData?.value ?? 0,
                        knowledgeType: groupKey
                    }));
                });

                // Group knowledge skills by knowledgeType (academic, interests/hobby, professional, street)
                const knowledgeTypes = ["academic", "interests", "professional", "street"];
                context.knowledgeSkillGroups = knowledgeTypes.map(type => {
                    const typeItems = embeddedKnowledge
                        .filter(i => {
                            const kt = i.system.skill?.knowledgeType;
                            if (type === "interests") return kt === "interests" || kt === "interest";
                            return kt === type;
                        })
                        .map(i => ({
                            id: i.system.key || i.name.toLowerCase(),
                            itemId: i.id,
                            name: i.name,
                            value: i.system.skill?.rating ?? i.system.rating?.value ?? i.system.value ?? 0
                        }));

                    const legacyTypeItems = legacyKnowledge
                        .filter(s => {
                            if (type === "interests") return s.knowledgeType === "interests" || s.knowledgeType === "interest";
                            return s.knowledgeType === type;
                        })
                        .map(s => ({
                            id: s.id,
                            name: s.name,
                            value: s.value
                        }));

                    const combinedMap = new Map();
                    for (const s of [...legacyTypeItems, ...typeItems]) {
                        combinedMap.set(s.name.toLowerCase(), s);
                    }

                    let combinedSkills = Array.from(combinedMap.values());
                    if (!context.isEditMode) {
                        combinedSkills = combinedSkills.filter(s => s.value > 0);
                    }

                    return {
                        key: type,
                        label: game.i18n.localize(`SR5Marketplace.UI.KnowledgeSkill${capitalize(type)}`) || capitalize(type),
                        skills: combinedSkills
                    };
                }).filter(g => g.skills.length > 0 || this._mode === "edit");

                // 3. Gather Language skills from embedded items
                const embeddedLanguage = this.document.items
                    .filter(i => i.type === "skill" && i.system.skill?.category === "language")
                    .map(i => ({
                        id: i.system.key || i.name.toLowerCase(),
                        itemId: i.id,
                        name: i.name,
                        value: i.system.skill?.rating ?? i.system.rating?.value ?? i.system.value ?? 0
                    }));

                const legacyLanguage = Object.entries(skills.language?.value || {}).map(([skillId, skillData]) => ({
                    id: skillId,
                    name: skillData?.name ?? "",
                    value: skillData?.value ?? 0
                }));

                const languageMap = new Map();
                for (const s of [...legacyLanguage, ...embeddedLanguage]) {
                    languageMap.set(s.name.toLowerCase(), s);
                }
                
                let languageSkillsList = Array.from(languageMap.values());
                if (!context.isEditMode) {
                    languageSkillsList = languageSkillsList.filter(s => s.value > 0);
                }
                context.languageSkills = languageSkillsList;
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
                        itemPrice: itemData.itemPrice ?? { value: fallbackCost, base: fallbackCost },
                        // Override availability.value with the system's if you want
                        // availability: { value: sourceItem.system.availability, base: itemData.availability.base }
                    };
                }
                context.inventory = preparedInventory;
                break;
            case "management": // Logic routed to the new tab
                context.owner = await this.document.getOwner();
                context.connection = await this.document.getConnection();
                context.shopEmployees = this.document.system.shop?.employees?.join('\n') || "";
                
                // Fetch the serving employee document for layout
                const servingEmployeeUuid = this.document.system.shop?.servingEmployee;
                context.servingEmployeeDoc = servingEmployeeUuid ? await fromUuid(servingEmployeeUuid) : null;
                break;
            case "biography":
                context.biographyHTML = await enrichHTML(this.document.system.description.value, {
                    async: true,
                    relativeTo: this.document
                });
                context.isBiographyEditable = this.isEditable && this.isEditMode;
                break;
        }
        return context;
    }

    /** @override */
    async _processFormData(event, form, formData) {
        const data = formData.object;
        console.log("SR5 Marketplace | _processFormData triggered. Submitted data:", data);

        if (data.system?.shop?.employees) {
            data.system.shop.employees = data.system.shop.employees
                .split('\n').map(e => e.trim()).filter(e => e);
        }

        // Intercept skills ratings updates and save back to embedded items
        const itemUpdates = [];
        const itemsToCreate = [];

        for (const [key, value] of Object.entries(data)) {
            let skillId = null;
            let category = null;

            if (key.startsWith("system.skills.active.")) {
                const parts = key.split("."); // ["system", "skills", "active", "skillId", "value"]
                skillId = parts[3];
                category = "active";
            } else if (key.startsWith("system.skills.knowledge.")) {
                const parts = key.split("."); // ["system", "skills", "knowledge", "academic", "value", "skillId", "value"]
                skillId = parts[5];
                category = "knowledge";
            } else if (key.startsWith("system.skills.language.")) {
                const parts = key.split("."); // ["system", "skills", "language", "value", "skillId", "value"]
                skillId = parts[4];
                category = "language";
            }

            if (skillId && category) {
                console.log(`SR5 Marketplace | Intercepted skill input. key: ${key}, skillId: ${skillId}, value: ${value}`);
                
                // Find matching embedded item by custom key, name, or system mapped key
                const item = this.document.items.find(i => 
                    i.type === "skill" && 
                    i.system.skill?.category === category &&
                    (i.system.key === skillId || 
                     i.name.toLowerCase() === skillId.toLowerCase() ||
                     (category === "active" && findSystemSkillKey(i.name) === skillId))
                );
                
                const skillNumVal = Number(value);

                if (item) {
                    console.log(`SR5 Marketplace | Found matching embedded skill item. ID: ${item.id}, Name: ${item.name}`);
                    itemUpdates.push({
                        _id: item.id,
                        "system.skill.rating": skillNumVal,
                        "system.skill.value": skillNumVal,
                        "system.rating.value": skillNumVal,
                        "system.value": skillNumVal
                    });
                } else if (skillNumVal > 0) {
                    console.log(`SR5 Marketplace | Skill item not found on actor. Creating new embedded item on the fly for: ${skillId}`);
                    // Automatically create missing embedded skill items on-the-fly when edited
                    const label = category === "active" && CONFIG.SR5.activeSkills?.[skillId]
                        ? game.i18n.localize(CONFIG.SR5.activeSkills[skillId])
                        : (skillId.charAt(0).toUpperCase() + skillId.slice(1));

                    let knowledgeType = "";
                    if (category === "knowledge") {
                        const parts = key.split(".");
                        const groupKey = parts[3];
                        knowledgeType = groupKey;
                    }

                    itemsToCreate.push({
                        name: label,
                        type: "skill",
                        system: {
                            type: "skill",
                            key: skillId,
                            rating: { value: skillNumVal },
                            value: skillNumVal,
                            skill: {
                                category: category,
                                knowledgeType: knowledgeType,
                                rating: skillNumVal,
                                value: skillNumVal
                            }
                        }
                    });
                }
                
                delete data[key]; // Remove original field to avoid conflicts
            }
        }

        if (itemUpdates.length > 0) {
            console.log("SR5 Marketplace | Executing updateEmbeddedDocuments with:", itemUpdates);
            await this.document.updateEmbeddedDocuments("Item", itemUpdates);
        }
        if (itemsToCreate.length > 0) {
            console.log("SR5 Marketplace | Executing createEmbeddedDocuments with:", itemsToCreate);
            await this.document.createEmbeddedDocuments("Item", itemsToCreate);
        }

        // Only update the main actor document if there is remaining data to persist (e.g. biography, employees)
        if (Object.keys(data).length > 0) {
            console.log("SR5 Marketplace | Executing main actor update with remaining data:", data);
            await this.document.update(data);
        }

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
     * Handles setting the serving employee of the shop.
     */
    static async #onSetServingEmployee(event, target) {
        const uuid = target.dataset.uuid;
        const current = this.document.system.shop?.servingEmployee;
        // Toggle serving employee off if clicking already active, otherwise set new
        const targetUuid = (current === uuid) ? "" : uuid;
        await this.document.update({ "system.shop.servingEmployee": targetUuid });
        this.render();
    }

    /**
     * Handles opening the embedded Host item sheet for detailed configuration.
     */
    static #onOpenHostSheet(event, target) {
        const hostItem = this.document.hostItem;
        if (hostItem?.sheet) {
            const renderOptions = this.isEditMode ? {} : { editable: false };
            hostItem.sheet.render(true, renderOptions);
        } else {
            ui.notifications.warn("No Matrix Host is configured for this Shop. Drag and drop a Host item to set one up.");
        }
    }

    /**
     * Handles opening an actor's sheet directly to the matrix tab.
     */
    static async #onOpenMatrixTab(event, target) {
        const uuid = target.dataset.uuid;
        if (!uuid) return;
        
        const doc = await fromUuid(uuid);
        if (doc?.sheet) {
            const sheet = doc.sheet;
            const renderOptions = this.isEditMode ? {} : { editable: false };
            await sheet.render(true, renderOptions);
            
            // Allow a tiny delay for rendering, then switch to matrix tab
            setTimeout(() => {
                try {
                    if (typeof sheet.activateTab === "function") {
                        sheet.activateTab("matrix");
                    } else if (sheet._tabs && sheet._tabs[0]) {
                        sheet._tabs[0].activate("matrix");
                    }
                } catch (err) {
                    console.warn("SR5 Marketplace | Could not automatically switch to matrix tab:", err);
                }
            }, 100);
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
            const renderOptions = this.isEditMode ? {} : { editable: false };
            doc.sheet.render(true, renderOptions);
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
     * Action handler to create a new custom skill.
     */
    static async #onCreateSkill(event, target) {
        if (!this.isEditMode) return;

        // Prompt the user for skill details using V2 Dialog
        const content = `
            <div class="form-group" style="display: flex; flex-direction: column; gap: 8px; font-family: sans-serif;">
                <label style="font-weight: bold;">Skill Name:</label>
                <input type="text" name="skillName" placeholder="e.g. Guitar Playing, German..." style="padding: 6px; border: 1px solid #ccc; border-radius: 4px;" required/>
                
                <label style="font-weight: bold; margin-top: 8px;">Category / Type:</label>
                <select name="skillCategory" style="padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                    <option value="active">Active Skill</option>
                    <option value="academic">Knowledge: Academic</option>
                    <option value="interests">Knowledge: Interest / Hobby</option>
                    <option value="professional">Knowledge: Professional</option>
                    <option value="street">Knowledge: Street</option>
                    <option value="language">Language</option>
                </select>
            </div>
        `;

        const choice = await foundry.applications.api.DialogV2.prompt({
            window: { title: "Create Custom Skill" },
            content: content,
            ok: {
                label: "Create",
                callback: (event, button) => {
                    const form = button.form;
                    const name = form.querySelector('[name="skillName"]').value.trim();
                    const type = form.querySelector('[name="skillCategory"]').value;
                    return { name, type };
                }
            },
            rejectClose: false
        });

        if (!choice?.name) return;

        // Map Category & Type to the skill item schema
        let category = "active";
        let knowledgeType = "";

         if (choice.type === "language") {
             category = "language";
         } else if (choice.type !== "active") {
             category = "knowledge";
             knowledgeType = choice.type;
         }

        const initialRating = (category === "knowledge" || category === "language") ? 1 : 0;
        const skillItemData = {
            name: choice.name,
            type: "skill",
            system: {
                type: "skill",
                key: choice.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
                rating: {
                    value: initialRating
                },
                value: initialRating,
                skill: {
                    category: category,
                    knowledgeType: knowledgeType,
                    rating: initialRating,
                    value: initialRating
                }
            }
        };

        // Check duplicates: reject if any skill with the same name already exists on the actor
        const normalizeName = n => String(n ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const alreadyExists = this.document.items.some(i => 
            i.type === "skill" && 
            normalizeName(i.name) === normalizeName(choice.name)
        );

        if (alreadyExists) {
            return ui.notifications.warn(`Skill "${choice.name}" already exists on this actor.`);
        }

        await this.document.createEmbeddedDocuments("Item", [skillItemData]);
        ui.notifications.info(`Created skill "${choice.name}".`);
        this.render();
    }

    /**
     * Action handler to delete an embedded skill.
     */
    static async #onDeleteSkill(event, target) {
        if (!this.isEditMode) return;
        const itemId = target.dataset.itemId;
        if (!itemId) return;

        const skillItem = this.document.items.get(itemId);
        if (!skillItem) return;

        const choice = await foundry.applications.api.DialogV2.confirm({
            window: { title: `Delete ${skillItem.name}` },
            content: `<p>Are you sure you want to delete the skill <strong>${skillItem.name}</strong>?</p>`,
            rejectClose: false
        });

        if (choice) {
            await this.document.deleteEmbeddedDocuments("Item", [itemId]);
            ui.notifications.info(`Deleted skill "${skillItem.name}".`);
            this.render();
        }
    }

    /**
     * Action handler when clicking on a skill's name.
     * - In PLAY mode: triggers a roll for the skill (like on the system actor).
     * - In EDIT mode: opens the skill's embedded Item document sheet (if it has an itemId).
     */
    static async #onClickSkillName(event, target) {
        const skillId = target.dataset.skillId;
        const itemId = target.dataset.itemId;
        
        if (this.isPlayMode) {
            // Trigger a roll using the system actor's rollSkill method
            if (typeof this.document.rollSkill === "function") {
                console.log(`SR5 Marketplace | Triggering rollSkill for: ${skillId}`);
                await this.document.rollSkill(skillId, { event });
            } else if (itemId) {
                // Fallback: roll via item if actor.rollSkill doesn't exist
                const skillItem = this.document.items.get(itemId);
                if (skillItem && typeof skillItem.roll === "function") {
                    await skillItem.roll();
                }
            } else {
                ui.notifications.warn("Roll logic is not supported on this actor.");
            }
        } else if (this.isEditMode) {
            // Open the item sheet for editing
            if (itemId) {
                const skillItem = this.document.items.get(itemId);
                if (skillItem) {
                    skillItem.sheet.render(true);
                }
            } else {
                ui.notifications.warn("This skill is a legacy entry and does not have an associated Item document. Please add it via the '+' button to enable editing.");
            }
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
        this._mode = this.isPlayMode ? "edit" : "play";
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

        // 1. Retrieve linked actors (Owner and Employees) from the shop actor
        const owner = typeof actor.getOwner === "function" ? await actor.getOwner() : null;
        const employees = typeof actor.getEmployees === "function" ? await actor.getEmployees() : [];
        const candidates = [owner, ...employees].filter(Boolean);

        // 2. Find the highest Negotiation skill rating among the candidates
        const getNegotiationRating = (act) => {
            if (!act) return 0;
            
            // Check if the system has getSkill
            if (typeof act.getSkill === "function") {
                const skill = act.getSkill("negotiation");
                if (skill) {
                    const val = Number(skill.value ?? skill.rating ?? skill ?? 0);
                    if (val > 0) return val;
                }
            }
            
            // Check embedded skill items
            const skillItem = act.items?.find(i => i.type === "skill" && (i.system?.key === "negotiation" || i.name?.toLowerCase() === "negotiation"));
            if (skillItem) {
                return Number(skillItem.system?.rating?.value ?? skillItem.system?.value ?? 0);
            }
            
            // Check system skills active fallback
            const systemSkill = act.system?.skills?.active?.negotiation;
            if (systemSkill) {
                return Number(systemSkill.value ?? systemSkill.rating ?? systemSkill ?? 0);
            }
            
            return 0;
        };

        let maxNegotiation = 0;
        for (const candidate of candidates) {
            const rating = getNegotiationRating(candidate);
            if (rating > maxNegotiation) {
                maxNegotiation = rating;
            }
        }

        const entryId = target.dataset.entryId;

        console.log(`Marketplace | Shop Availability Roll: maxNegotiation calculated as ${maxNegotiation} from ${candidates.length} candidates. entryId: ${entryId}`);

        try {
            // 3. Create the test instance matching the advanced options / interactive run mode
            const test = new game.shadowrun5e.tests.AvailabilityTest(
                {
                    availabilityStr: availabilityStr,
                    action: {
                        availabilityStr: availabilityStr,
                        maxNegotiation: maxNegotiation,
                        entryId: entryId
                    },
                    maxNegotiation: maxNegotiation,
                    entryId: entryId
                },
                { actor },
                { availability: availabilityStr, showDialog: true, showMessage: true, entryId: entryId }
            );

            // 4. Execute the test
            await test.execute();

        } catch (e) {
            console.error("Marketplace | AvailabilityTest failed:", e);
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

        let data;
        try { data = JSON.parse(event.dataTransfer.getData('text/plain')); }
        catch (err) { return; }

        if (data.type !== "Item") return;
        const item = await Item.fromDropData(data);
        if (!item) return;

        // If the item is a skill (active, knowledge, or language), add it to the actor directly
        if (item.type === "skill") {
            const category = item.system.skill?.category || "";
            const name = item.name;
            const normalizeName = n => String(n ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            const alreadyExists = this.document.items.some(i => 
                i.type === "skill" && 
                i.system.skill?.category === category && 
                normalizeName(i.name) === normalizeName(name)
            );
            if (alreadyExists) {
                ui.notifications.warn(game.i18n.format('SR5.Errors.SkillAlreadyExists', { name: item.name, actorName: this.document.name, actorUuid: this.document.uuid }));
                return;
            }
            return this.document.createEmbeddedDocuments('Item', [item.toObject()]);
        }

        const dropTarget = event.target.closest(".drop-target");
        if (!dropTarget || !this.isEditMode) return;

        const dropZone = dropTarget.dataset.dropZone;

        // Use a switch to handle different drop zones
        switch (dropZone) {
            case "inventory": {
                if (data.type !== "Item") return;
                const item = await Item.fromDropData(data);
                if (!item) return;

                if (item.type === "contact") {
                    ui.notifications.warn("Contacts cannot be added to inventory. Drop on the 'Connection' field instead.");
                    return;
                }
                
                // 1. Calculate dynamic properties using the Rules Engine
                // (Make sure getCalculatedItemData is accessible on your imported InventoryRules instance/class)
                const calculatedData = await InventoryRules.getCalculatedItemData(this.document, item);
                
                // 2. Pass the calculated data down into the Document's internal handler
                return this.document.addItemToInventory(item, calculatedData);
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

            case "host": {
                if (data.type !== "Item") return;
                const item = await Item.fromDropData(data);
                if (!item) return;

                if (item.type !== "host") {
                    ui.notifications.warn("Only Items of type 'Host' can be dropped on the Host field.");
                    return;
                }

                const existingHostIds = this.document.items.filter(i => i.type === "host").map(i => i.id);
                if (existingHostIds.length > 0) {
                    await this.document.deleteEmbeddedDocuments("Item", existingHostIds);
                }

                const itemObj = item.toObject();
                // Take dropped host's original rating value, otherwise fallback to dynamic connection calculation
                const dynamicRating = item.system.rating || item.system.technology?.rating || this.document.calculateDefaultHostRating();
                foundry.utils.setProperty(itemObj, "system.rating", dynamicRating);
                foundry.utils.setProperty(itemObj, "system.technology.rating", dynamicRating);

                console.log(`SR5 Marketplace | Dropping Host item "${item.name}" onto Shop Actor "${this.document.name}". Calculated dynamic rating: ${dynamicRating}`);
                
                const created = await this.document.createEmbeddedDocuments("Item", [itemObj]);
                if (created.length > 0) {
                    ui.notifications.info(`Successfully initialized Matrix Host "${item.name}" with Rating ${dynamicRating}.`);
                }

                this.render();
                return;
            }
        }
    }
}