import MarketplaceDocumentSheetMixin from "../scripts/apps/marketplace-document-sheet-mixin.mjs";
import enrichHTML from '../scripts/services/enricher.mjs';
// We get the base ActorSheet class from Foundry's API.
const { ActorSheet } = foundry.applications.sheets;

/**
 * A custom V13 Actor Sheet for the ShopActor type, using ApplicationV2.
 * It is built by applying our custom mixin to the base ActorSheet.
 * @param {typeof ActorSheet} base The base ActorSheet class to extend.
 * @returns {typeof ShopActorSheet} The extended ShopActorSheet class.
 */
export class ShopActorSheet extends MarketplaceDocumentSheetMixin(ActorSheet) {
    _isEditingBiography = false;

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
            ...super.DEFAULT_OPTIONS.actions
        }
    };

    /**
     * @type {Object.<string, {template: string}>}
     * This defines the parts of the layout that can be reused in different contexts.
     */
    static PARTS = {
        // ADDED: The header is now a defined part of the layout.
        header: {
            template: "modules/sr5-marketplace/templates/actor/partials/shop-header.html"
        },
        // ADDED: The attributes section is also a part.
        attributes: {
            template: "modules/sr5-marketplace/templates/actor/partials/shop-attributes.html"
        },
        // The tab navigation bar.
        tabs: {
            template: "templates/generic/tab-navigation.hbs"
        },
        // The content for the tabs.
        actorShop: {
            template: "modules/sr5-marketplace/templates/actor/actorShop.html",
        },
        biography: {
            template: "modules/sr5-marketplace/templates/actor/partials/shop-biography.html"
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
        switch (partId) {
            case "actorShop":
                const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
                context.shopEmployees = this.document.system.shop?.employees?.join('\n') || "";
                context.modifierTypes = {
                    discount: game.i18n.localize("SR5.Marketplace.Shop.Discount"),
                    fee: game.i18n.localize("SR5.Marketplace.Shop.Fee")
                };
                const skills = this.document.system.skills;
                
                // Prepare Active Skills
                context.activeSkills = Object.entries(skills.active).map(([key, data]) => {
                    const locKey = CONFIG.SR5.activeSkills[key];
                    return {
                        id: key, // Use the skill's key as its ID
                        name: game.i18n.localize(locKey) || key,
                        value: data.value
                    };
                });
                // Prepare Knowledge Skills
                context.knowledgeSkillGroups = Object.entries(skills.knowledge).map(([groupKey, groupData]) => {
                    return {
                        label: game.i18n.localize(`SR5.KnowledgeSkill${capitalize(groupKey)}`),
                        skills: Object.entries(groupData.value).map(([skillId, skillData]) => ({
                            id: skillId, // Use the skill's random key as its ID
                            name: skillData.name,
                            value: skillData.value
                        }))
                    };
                });
                // Prepare Language Skills
                context.languageSkills = Object.entries(skills.language.value).map(([skillId, skillData]) => ({
                    id: skillId, // Use the skill's random key as its ID
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
}