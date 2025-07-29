import MarketplaceDocumentSheetMixin from "../scripts/apps/marketplace-document-sheet-mixin.mjs";
import enrichHTML from '../scripts/services/enricher.mjs';
// We get the base ActorSheet class from Foundry's API.
const { ActorSheet } = foundry.applications.sheets;

/**
 * A custom V13 Actor Sheet for the ShopActor type, using ApplicationV2.
 * It is built by applying our custom mixin to the base ActorSheet.
 */
export class ShopActorSheet extends MarketplaceDocumentSheetMixin(ActorSheet) {
    _isEditingBiography = false;

    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ["sr5", "shop", "sr5-marketplace-shop"],
        position: {
            width: 900,
            height: 650
        },
        actions: {
            ...super.DEFAULT_OPTIONS.actions,
            // We use a custom action name to call our custom in-place editor logic.
        }
    };

    /**
     * The layout is defined by the order of parts: header, then tabs, then tab content.
     */
    static PARTS = {
        header: {
            template: "modules/sr5-marketplace/templates/actor/partials/shop-header.html"
        },
        tabs: {
            template: "templates/generic/tab-navigation.hbs"
        },
        "shop-details": {
            template: "modules/sr5-marketplace/templates/actor/partials/shop-details.html"
        },
        biography: {
            template: "modules/sr5-marketplace/templates/actor/partials/shop-biography.html"
        }
    };

    /**
     * This configures our tab group. The 'initial' property sets the default tab.
     */
    static TABS = {
        primary: {
            tabs: [
                { id: "shop-details", label: "Shop Details" },
                { id: "biography", label: "Biography" }
            ],
            initial: "shop-details"
        }
    };

    /**
     * @override
     * Prepares the context object for rendering the template.
     */
    async _prepareContext(options) {
    const context = await super._prepareContext(options);
    
    // Add common data useful for all sheets.
    context.actor = this.document;
    context.system = this.document.system;
    context.flags = this.document.flags;
    context.isOwner = this.document.isOwner;
    context.isEditable = this.isEditable;
    
    // ADD THIS LINE: Create a shortcut to the system's data model fields.
    context.systemFields = this.document.system.schema.fields;
    
    return context;
    }

    /** @override */
    async _preparePartContext(partId, context) {
        context.tab = context.tabs[partId];
        switch (partId) {
            case "shop-details":
                context.shopEmployees = this.document.system.shop?.employees?.join('\n') || "";
                context.modifierTypes = {
                    discount: game.i18n.localize("SR5.Marketplace.Shop.Discount"),
                    fee: game.i18n.localize("SR5.Marketplace.Shop.Fee")
                };
                break;
            case "biography":
                // Pass the editing state to the template for the {{#if}} helper
                context.isEditing = this._isEditingBiography;
                // We still need to prepare the enriched HTML for the static display
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
}