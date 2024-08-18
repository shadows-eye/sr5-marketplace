import ItemData from './itemData.js';
export class PurchaseScreenApp extends Application {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "purchase-screen",
            title: "Purchase Screen",
            template: "modules/sr5-marketplace/templates/purchase.hbs",
            width: 900,
            height: 700,
            resizable: true,
            classes: ["sr5-market"]
        });
    }

    async getData() {
        this.itemData = new ItemData();
        await this.itemData.fetchItems();

        // Preload the partial template
        await loadTemplates([
            "modules/sr5-marketplace/templates/libraryItem.hbs"
        ]);

        return {
            itemsByType: this.itemData.itemsByType, // Pass item types with items
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
    
        // Listen for changes on any item type selector
        html.find(".item-type-selector").change(event => this._onFilterChange(event, html));
    
        // Trigger the initial render with the first item type
        const firstType = html.find(".item-type-selector option:first").val();
        if (firstType) {
            this._renderItemList(this._getItemsByType(firstType), html);
            html.find(".item-type-selector").val(firstType); // Set the first option as selected
        }
    }
    
    _onFilterChange(event, html) {
        const selectedType = event.target.value;
        const items = this._getItemsByType(selectedType);
        this._renderItemList(items, html);
    }

    _getItemsByType(type) {
        return this.itemData.itemsByType[type] || [];
    }

    async _renderItemList(items, html) {
        const itemListContainer = html.find("#marketplace-items");
        itemListContainer.empty();
    
        // Re-render the marketplace items using Handlebars
        const templateData = { items: items };
        const renderedHtml = await renderTemplate("modules/sr5-marketplace/templates/libraryItem.hbs", templateData);
        itemListContainer.append(renderedHtml);
    } 
}
  