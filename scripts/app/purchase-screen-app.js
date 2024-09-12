import ItemData from './itemData.js';

export class PurchaseScreenApp extends Application {
    constructor(options = {}) {
        super(options);
    
        // Determine if the current user is a GM
        this.isGM = game.user.isGM;
        this.tab = options.tab || "shop"; // Default to "shop" tab
        this.orderData = options.orderData || {};
        this.completeItemsArray = Array.isArray(options.completeItemsArray) ? options.completeItemsArray : [];
        this.itemData = new ItemData();  // Instantiate ItemData here to use its methods
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
        // Ensure itemData is properly instantiated and fetch items
        this.itemData = new ItemData();
        await this.itemData.fetchItems(); // Fetch all items in your system
    
        // Initialize the completeItemsArray if not already set (may come from passed options)
        this.completeItemsArray = this.completeItemsArray || [];
    
        // Restore basket items from flags (if needed)
        const savedBasket = game.user.getFlag('sr5-marketplace', 'basket') || [];
        this.itemData.basketItems = savedBasket;
    
        // Preload the partial templates
        await loadTemplates([
            "modules/sr5-marketplace/templates/libraryItem.hbs",
            "modules/sr5-marketplace/templates/basket.hbs",  // Preload the basket partial
            "modules/sr5-marketplace/templates/shop.hbs",
            "modules/sr5-marketplace/templates/orderReview.hbs"
        ]).then(() => {
            // Register partials after loading them
            Handlebars.registerPartial('shop', 'modules/sr5-marketplace/templates/shop.hbs');
            Handlebars.registerPartial('orderReview', 'modules/sr5-marketplace/templates/orderReview.hbs');
        });
    
        console.log("User role:", game.user.role);
        console.log("Is the current user a GM?", this.isGM);
    
        // Set up review data if needed
        const reviewData = this.reviewData ? this.reviewData : {};
    
        // Return the data to the template for rendering
        return {
            itemsByType: this.itemData.itemsByType, // Pass item types with items
            basketItems: this.itemData.basketItems, // Pass basket items to be rendered
            isGM: this.isGM,
            reviewData: reviewData,
            completeItemsArray: this.completeItemsArray // Ensure the array is available in the template context
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
        //Order Review Change
        html.on('change', '.order-review-rating', event => this._onRatingChangeOrderReview(event, html));
        // Tab Switching Logic
        html.find("#id-shop").click(() => this._handleTabSwitch(html, "shop"));
        html.find("#id-orderReview").click(() => this._handleTabSwitch(html, "orderReview"));
    
        // Initialize by showing the shop tab content
        this._handleTabSwitch(html, "shop");
    
        // Handle the "Send Request to GM" button click
        html.on('click', '#send-request-button', event => this._onSendRequest(event, html));
    
        // Handle the "Review and Confirm" button click
        html.on('click', '.review-request-button', event => this._onReviewRequest(event, html));

        // Event listener for removing items in the order review
        html.on('click', '.remove-item', async event => {
            event.preventDefault();

            // Retrieve the item ID and flag ID from the DOM
            const itemId = $(event.currentTarget).data('itemId');
            const flagId = $(event.currentTarget).closest('#order-review-items').data('flagId');

            // Fetch the flag data associated with the flagId
            const orderData = game.user.getFlag('sr5-marketplace', flagId);
            if (!orderData) {
                console.warn(`No order data found for flag ID ${flagId}`);
                return;
            }

            // Find the index of the item in the flag's items array
            const itemIndex = orderData.items.findIndex(item => item.id === itemId);
            if (itemIndex === -1) {
                console.warn(`Item with ID ${itemId} not found in flag data`);
                return;
            }

            // Remove the item from the array
            orderData.items.splice(itemIndex, 1);

            // Check if only one item was left before deletion, in which case, remove the chat message
            if (orderData.items.length === 0) {
                // Find and delete the chat message with the matching button id (flagId)
                const chatMessage = game.messages.contents.find(msg => {
                    return msg.content.includes(`data-request-id="${flagId}"`);
                });

                if (chatMessage) {
                    await chatMessage.delete();  // Delete the chat message
                }
            }

            // Update the flag data without the removed item
            await game.user.setFlag('sr5-marketplace', flagId, orderData);

            // Fetch the updated flag data after the deletion
            const updatedOrderData = await this.itemData.getOrderDataFromFlag(flagId);

            // Re-render the order review with the updated data
            this._renderOrderReview(html, flagId, updatedOrderData.items);

            // Log the updated flag after it’s saved
            console.log(`Updated Flag Data After Deletion (flagId: ${flagId}):`, JSON.stringify(updatedOrderData, null, 2));
        });

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

    async _onAddToBasket(event, html) {
        event.preventDefault();

        const itemId = $(event.currentTarget).data('itemId');
        await this.itemData.addItemToBasket(itemId); // Add item to the basket

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

    async _onRemoveFromBasket(event, html) {
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
        // Calculate the total cost and availability using itemData's calculation functions
        const totalCost = this.itemData.calculateTotalCost(); 
        const totalAvailability = this.itemData.calculateTotalAvailability(); 
        
        // Update the total cost in the DOM
        html.find("#total-cost").html(`Total: ${totalCost} <i class="fa-duotone fa-solid fa-circle-yen"></i>`);
        
        // Update the total availability in the DOM
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
    
    /**
     * Handle rating change in the order review
     */
    async _onRatingChangeOrderReview(event, html) {
        event.preventDefault();
    
        // Get the item ID and flag ID from the event
        const itemId = $(event.currentTarget).data('itemId');
        const newRating = parseInt(event.currentTarget.value);
        const flagId = $(event.currentTarget).data('flagId');
    
        // Retrieve the order data associated with the flagId
        const orderData = await this.itemData.getOrderDataFromFlag(flagId);
        if (!orderData) {
            console.warn(`Order data with flag ID ${flagId} not found.`);
            return;
        }
    
        // Find the item in the orderData
        const item = orderData.items.find(item => item._id === itemId);
        if (!item) {
            console.warn(`No item with ID ${itemId} found in flag data.`);
            return;
        }
    
        // Update the item's rating and recalculate the cost
        item.rating = newRating;
        item.cost = this.itemData.calculateCost(item); // Recalculate cost based on the new rating
    
        // Update the flag with the new rating and cost
        await game.user.setFlag('sr5-marketplace', flagId, orderData);
    
        // Log the updated flag for debugging
        console.log(`Updated Flag Data After Rating Change (flagId: ${flagId}):`, JSON.stringify(orderData, null, 2));
    
        // Fetch the associated chat message by flag ID
        const chatMessage = game.messages.contents.find(msg => {
            return msg.content.includes(`data-request-id="${flagId}"`);
        });
    
        // If chat message is found, update its DOM elements
        if (chatMessage) {
            // Re-render the shopping basket summary in the chat message
            const updatedHtml = await this._renderShoppingBasketSummary(orderData);
    
            // Update the chat message with the new HTML
            await chatMessage.update({ content: updatedHtml });
    
            console.log(`Updated Chat Message for flagId ${flagId}.`);
        }
    
        // Finally, re-render the order review
        const updatedOrderData = await this.itemData.getOrderDataFromFlag(flagId);
        this._renderOrderReview(html, flagId, updatedOrderData.items);
    }
    _onRemoveFromOrderReview(event, html) {
        event.preventDefault();
        const itemId = $(event.currentTarget).data('itemId');
        this.itemData.removeItemFromOrderReview(itemId);  // Delegate to itemData.js

        // Re-render the review
        this._renderOrderReview(html);
    }
    /**
     * Render the shopping basket summary for the chat message
     * @param {Object} orderData - The updated order data
     * @returns {string} - The rendered HTML content for the chat message
     */
    async _renderShoppingBasketSummary(orderData) {
        const templateData = {
            requester: orderData.requester,
            items: orderData.items,
            totalCost: orderData.items.reduce((sum, item) => sum + item.cost, 0)  // Calculate total cost
        };

        // Render the shopping basket summary template with the updated data
        return await renderTemplate('modules/sr5-marketplace/templates/chatMessageRequest.hbs', templateData);
    }
    /**
     * Render the order review tab with the updated data
     */
    _renderOrderReview(html, flagId, completeItemsArray) {
        // Ensure the items are passed to itemData for further calculations
        this.itemData.orderReviewItems = completeItemsArray;  // Assign the array to itemData

        // Use itemData methods to calculate totals
        const totalCost = this.itemData.calculateOrderReviewTotalCost();
        const totalAvailability = this.itemData.calculateOrderReviewTotalAvailability();

        const templateData = {
            flagId: flagId,
            items: completeItemsArray,  // Pass the enriched item data
            totalCost,
            totalAvailability
        };

        // Log template data for debugging
        console.log('Rendering Order Review with template data:', templateData);

        // Render the order review template with the prepared data
        renderTemplate('modules/sr5-marketplace/templates/orderReview.hbs', templateData).then(htmlContent => {
            html.find(`.tab-content[data-tab-content="orderReview"]`).html(htmlContent);
        }).catch(err => {
            console.error("Error rendering order review:", err);
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
    async _onSendRequest(event, html) {
        event.preventDefault();
    
        // Prepare the data for the chat message
        const basketItems = this.itemData.getBasketItems(); // Get basket items from itemData
        const totalCost = this.itemData.calculateTotalCost(); // Use itemData to calculate total cost
        const totalAvailability = this.itemData.calculateTotalAvailability(); // Use itemData to calculate total availability
        const totalEssenceCost = this.itemData.calculateTotalEssenceCost(); // Calculate total essence cost
    
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
            cost: item.calculatedCost || 0, // Use calculated cost or default to 0
            rating: item.selectedRating || 0, // Use selected rating or default to 0
            essence: this.itemData.calculateEssence(item), // Calculate essence using the selected rating
        }));
    
        // Save the request as a flag on the user with detailed item information
        await requestingUser.setFlag('sr5-marketplace', requestId, {
            id: requestId,
            items: itemDetails, // Store detailed item objects
            requester: isGM ? "GM" : requestingUser.name // Identify the requester
        });
    
        const messageData = {
            items: itemDetails, // Use detailed items in the chat message
            totalCost: totalCost,
            totalAvailability: totalAvailability,
            totalEssenceCost: totalEssenceCost, // Include total essence cost
            requesterName: isGM ? "GM" : requestingUser.name, // Show "GM" if the request is from a GM
            id: requestId // Include the request ID in the data
        };
    
        // Render the message using the chatMessageRequest.hbs template
        const htmlContent = await renderTemplate('modules/sr5-marketplace/templates/chatMessageRequest.hbs', messageData);
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
    }      
}
  