import MarketplaceDocumentSheetMixin from "../scripts/apps/marketplace-document-sheet-mixin.mjs";
import enrichHTML from '../scripts/services/enricher.mjs';
// We get the base ActorSheet class from Foundry's API.
const { ActorSheet } = foundry.applications.sheets;

/**
 * A custom V13 Actor Sheet for the ShopActor type, using ApplicationV2.
 * It is built by applying our custom mixin to the base ActorSheet.
 */
export class ShopActorSheet extends MarketplaceDocumentSheetMixin(ActorSheet) {
    #editor = null;

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
            editBiography: this.#onEditBiography 
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
     * Handles creating the in-place ProseMirror editor.
     * @param {Event} event     The originating click event.
     * @param {HTMLElement} target The element with the data-action attribute.
     * @private
     */
    static async #onEditBiography(event, target) {
        // In a static action handler, 'this' is the application instance.
        if (this._editor) return;

        // CORRECTED: Use 'target.closest()', which is the clicked link itself.
        const container = target.closest(".prosemirror-container");

        // This check will now pass, but it's good practice to keep it for debugging.
        if (!container) {
            console.error("Could not find '.prosemirror-container' ancestor.", {target});
            ui.notifications.error("Could not find the editor container element.");
            return;
        }

        const editorContent = container.querySelector(".editor-content");
        const fieldName = "system.description.value";
        const content = foundry.utils.getProperty(this.document, fieldName);

        container.classList.add("active");

        this._editor = await ProseMirrorEditor.create(editorContent, content, {
            document: this.document,
            fieldName: fieldName,
            relativeLinks: true,
            plugins: {
                menu: ProseMirror.ProseMirrorMenu.build(ProseMirror.defaultSchema, {
                    onSave: this.#onSaveEditor.bind(this, fieldName)
                }),
                keyMaps: ProseMirror.ProseMirrorKeyMaps.build(ProseMirror.defaultSchema, {
                    onSave: this.#onSaveEditor.bind(this, fieldName)
                })
            }
        });
    }

    /**
     * Handles saving the content from the in-place editor.
     * @private
     */
    static async #onSaveEditor(target) {
        if (!this._editor) return; // Use _editor
        const html = await this._editor.getData(); // Use _editor
        
        this._editor.destroy(); // Use _editor
        this._editor = null; // Use _editor
        this.element.querySelector(".prosemirror-container").classList.remove("active");

        this.document.update({ [target]: html });
    }

    /**
     * @override
     * Prepares the base context for the application, primarily setting up tab data.
     */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.tabs = this._prepareTabs("primary");
        return context;
    }

    /**
     * @override
     * Prepares context data specific to each rendered PART. This is the ideal
     * place for performance-critical logic that should only run for the visible tab.
     */
    async _preparePartContext(partId, context) {
        context.tab = context.tabs[partId]; // Sets which tab is active for the template
        
        switch (partId) {
            case "shop-details":
                context.shopEmployees = this.document.system.shop?.employees?.join('\n') || "";
                context.modifierTypes = {
                    discount: game.i18n.localize("SR5.Marketplace.Shop.Discount"),
                    fee: game.i18n.localize("SR5.Marketplace.Shop.Fee")
                };
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

    /**
     * @override
     * This handler is called when a form within the sheet is submitted. It processes
     * the form data and updates the actor document.
     */
    _processFormData(event, form, formData) {
      const data = formData.object;
      // Convert the employees textarea string back into a clean array.
      if (data.system?.shop?.employees) {
        data.system.shop.employees = data.system.shop.employees
          .split('\n').map(e => e.trim()).filter(e => e);
      }
      this.document.update(data);
      return data;
    }
}