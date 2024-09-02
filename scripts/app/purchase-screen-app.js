import ItemData from './itemData.js';

export class PurchaseScreenApp extends Application {
    constructor(options = {}) {
        super(options);
    
        // Determine if the current user is a GM
        this.isGM = game.user.isGM;
        this.tab = options.tab || "shop"; // Default to "shop" tab
        this.reviewData = options.reviewData || null; // Store the review data if provided
      }
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

        // Restore basket items from flags
        const savedBasket = game.user.getFlag('sr5-marketplace', 'basket') || [];
        this.itemData.basketItems = savedBasket;

        // Preload the partial templates
        await loadTemplates([
            "modules/sr5-marketplace/templates/libraryItem.hbs",
            "modules/sr5-marketplace/templates/basket.hbs",  // Preload the basket partial
            "modules/sr5-marketplace/templates/shop.hbs",
            "modules/sr5-marketplace/templates/orderReview.hbs"]
        ).then(() => {
            // Register partials after loading them
        Handlebars.registerPartial('shop', 'modules/sr5-marketplace/templates/shop.hbs');
        Handlebars.registerPartial('orderReview', 'modules/sr5-marketplace/templates/orderReview.hbs');
        });
        console.log("User role:", game.user.role);
        console.log("Is the current user a GM?", this.isGM);
        const reviewData = this.reviewData ? this.reviewData : {};
        return {
            itemsByType: this.itemData.itemsByType, // Pass item types with items
            basketItems: this.itemData.basketItems, // Pass basket items to be rendered
            isGM: this.isGM,
            reviewData: reviewData
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Existing listeners for search, selection, basket, etc.
        html.find(".item-type-selector").change(event => this._onFilterChange(event, html));
        const firstType = html.find(".item-type-selector option:first").val();
        if (firstType) {
            this._renderItemList(this._getItemsByType(firstType), html);
            html.find(".item-type-selector").val(firstType);
        }
        html.find(".marketplace-search").on("input", event => this._onSearchInput(event, html));
        if (this.itemData.basketItems.length > 0) {
            this._renderBasket(html);
        }
        html.on('change', '.item-rating', event => this._onRatingChange(event, html));
        html.on('click', '.add-to-cart', event => this._onAddToBasket(event, html));
        html.on('click', '.remove-item', event => this._onRemoveFromBasket(event, html));

        // Tab Switching Logic
        html.find("#id-shop").click(() => this._handleTabSwitch(html, "shop"));
        html.find("#id-orderReview").click(() => this._handleTabSwitch(html, "orderReview"));
    
        // Initialize by showing the shop tab content
        this._handleTabSwitch(html, "shop");
    
        // Handle the "Send Request to GM" button click
        html.on('click', '#send-request-button', event => this._onSendRequest(event, html));
    
        // Handle the "Review and Confirm" button click
        html.on('click', '.review-request-button', event => this._onReviewRequest(event, html));
    }

    _onSearchInput(event, html) {
        const searchText = event.target.value.toLowerCase();
        const items = html.find(".marketplace-item");
    
        items.each((index, item) => {
            const itemName = $(item).find("h4").text().toLowerCase();
            if (itemName.includes(searchText)) {
                $(item).css("display", "flex"); // Show matching item
            } else {
                $(item).css("display", "none"); // Hide non-matching item
            }
        });
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

    async _saveBasketState() {
        await game.user.setFlag('sr5-marketplace', 'basket', this.itemData.getBasketItems());
    }

    _onAddToBasket(event, html) {
        event.preventDefault();

        const itemId = $(event.currentTarget).data('itemId');
        this.itemData.addItemToBasket(itemId); // Add item to the basket

        this._renderBasket(html); // Re-render the basket with updated items
    }

    async close(options = {}) {
        if (this.itemData.basketItems.length > 0) {
            const confirmed = await Dialog.confirm({
                title: "Save Changes",
                content: "Do you want to save your basket before closing?",
            });
            if (confirmed) {
                await this._saveBasketState();
            }
        } else {
            await game.user.unsetFlag('sr5-marketplace', 'basket'); // Clear the basket flag if empty
        }
        return super.close(options);
    }

    _onRemoveFromBasket(event, html) {
        event.preventDefault();

        const basketId = $(event.currentTarget).data('basketId');
        this.itemData.removeItemFromBasket(basketId); // Remove item using the unique basketId

        this._renderBasket(html); // Re-render the basket with updated items

        this._saveBasketState(); // Save the updated basket state
    }

    _onRatingChange(event, html) {
        const basketId = $(event.currentTarget).data('basketId');
        const selectedRating = parseInt(event.currentTarget.value);

        this.itemData.updateBasketItem(basketId, selectedRating);
        this._renderBasket(html);
    }

    _updateTotalCost(html) {
        const totalCost = this.itemData.calculateTotalCost();
        const totalAvailability = this.itemData.calculateTotalAvailability();
        html.find("#total-cost").html(`Total: ${totalCost} <i class="fa-duotone fa-solid fa-circle-yen"></i>`);
        html.find("#total-availability").text(`Total Availability: ${totalAvailability}`);
    }

    _renderBasket(html) {
        const basketItems = this.itemData.getBasketItems();
        const templateData = { items: basketItems };
        renderTemplate("modules/sr5-marketplace/templates/basket.hbs", templateData).then(renderedHtml => {
            html.find("#basket-items").html(renderedHtml);
            this._updateTotalCost(html);
        });
    }
    _handleTabSwitch(html, selectedTab) {
        console.log(`Switching to tab: ${selectedTab}`); // Debugging output
    
        // Hide all tab content by removing 'active' class
        html.find(".tab-content").removeClass("active");
    
        // Show the selected tab content by adding 'active' class
        html.find(`.tab-content[data-tab-content="${selectedTab}"]`).addClass("active");
    
        // Update active tab state
        html.find(".marketplace-tab").removeClass("active");
        html.find(`#id-${selectedTab}`).addClass("active");
    }
    /// send basket to GM
    _onSendRequest(event, html) {
        event.preventDefault();
    
        // Prepare the data for the chat message
        const basketItems = this.itemData.getBasketItems(); // Assuming itemData is accessible
        const totalCost = this.itemData.calculateTotalCost();
        const totalAvailability = this.itemData.calculateTotalAvailability();
    
        const requestingUser = game.user; // The user who clicked the button
        const isGM = requestingUser.isGM;
        const requestId = foundry.utils.randomID(); // Generate a unique request ID
    
        // Get an array of detailed item objects from the basket items
        const itemDetails = basketItems.map(item => ({
            id: item.id_Item || item._id, // Use id_Item if available, otherwise fallback to _id
            name: item.name, // Item name
            image: item.img || "icons/svg/item-bag.svg", // Use the item image or default icon
            description: item.system.description?.value || "", // Safely access description text
            type: item.type, // Item type
            cost: item.calculatedCost || 0 // Use calculated cost or default to 0
        }));
    
        // Save the request as a flag on the user with detailed item information
        requestingUser.setFlag('sr5-marketplace', requestId, {
            id: requestId,
            items: itemDetails, // Store detailed item objects
            requester: isGM ? "GM" : requestingUser.name // Identify the requester
        }).then(() => {
            console.log(`Flag set for request ${requestId} with items:`, itemDetails);
        }).catch(err => {
            console.error(`Failed to set flag for request ${requestId}:`, err);
        });
    
        const messageData = {
            items: itemDetails, // Use detailed items in the chat message
            totalCost: totalCost,
            totalAvailability: totalAvailability,
            requesterName: isGM ? "GM" : requestingUser.name, // Show "GM" if the request is from a GM
            id: requestId // Include the request ID in the data
        };
    
        // Render the message using the chatMessageRequest.hbs template
        renderTemplate('modules/sr5-marketplace/templates/chatMessageRequest.hbs', messageData).then(htmlContent => {
            ChatMessage.create({
                user: requestingUser.id, // Use the requesting user's ID
                content: htmlContent,
                style: CONST.CHAT_MESSAGE_STYLES.IC, // Corrected from type to style
                whisper: isGM ? [] : game.users.filter(u => u.isGM).map(u => u.id) // Whisper to GM(s) if not GM
            });
    
            // Empty the basket
            this.itemData.basketItems = [];
    
            // Render the empty basket
            this._renderBasket(html); // Update the UI to reflect the empty basket
        });
    }  

    _onReviewRequest(event, html) {
        event.preventDefault();
    
        // Get the request ID from the button's data attribute
        const requestId = $(event.currentTarget).data('request-id');
    
        // Retrieve the flag that matches this request ID (if necessary)
        // const user = game.user; // Adjust to target specific users or GM
        // const requestFlag = user.getFlag('sr5-marketplace', `request-${requestId}`);
    
        // Create a new instance or use existing instance of PurchaseScreenApp
        if (!this.purchaseScreenApp) {
            this.purchaseScreenApp = new PurchaseScreenApp({
                defaultTab: "orderReview", // Pass option to open in orderReview tab
                requestId: requestId // Store the requestId to be used later for loading data
            });
        }
    
        // Set the tab to "orderReview"
        this.purchaseScreenApp.defaultTab = "orderReview"; // Ensure it opens to the order review tab
        this.purchaseScreenApp.requestId = requestId; // Pass the requestId for future use
    
        // Open the app
        this.purchaseScreenApp.render(true);
    
        // Manually switch to the orderReview tab (in case already opened)
        this._handleTabSwitch($("body"), "orderReview"); // Use a global selector if the tab is already rendered
    }
}
  