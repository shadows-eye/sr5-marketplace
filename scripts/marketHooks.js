import ItemData from './app/itemData.js';
import { PurchaseScreenApp } from './app/purchase-screen-app.js';
import { registerBasicHelpers } from './lib/helpers.js';

// Call the function to register helpers
registerBasicHelpers();
Hooks.once('init', async function() {
});
Hooks.once('ready', async function() {
    const itemData = new ItemData();
    await itemData.fetchItems();
    console.log(itemData.itemsByType);
    //Find the review and log the data
    $(document).on('click', '.review-request-button', function(event) {
        event.preventDefault();
    
        const flagId = $(this).data('request-id'); // Get the flag ID from the button's data attribute
        console.log('Clicked review button with flag ID:', flagId);
    
        // Assume ItemData is properly instantiated or use an existing instance
        const itemData = new ItemData(); // Replace this with your actual ItemData instance if needed
        const orderData = itemData.getOrderDataFromFlag(flagId);
    
        if (orderData) {
            console.log('Order Data:', orderData);
    
            const completeItemsArray = [];
    
            // Iterate over each item in the orderData and merge with gameItem data
            orderData.items.forEach(orderItem => {
                const itemId = orderItem.id;
                const gameItem = game.items.get(itemId); // Fetch the game item object using the ID
    
                if (gameItem) {
                    // Merge flag data (orderItem) with the game item data (gameItem)
                    const enrichedItem = {
                        id_Item: itemId,
                        name: orderItem.name || gameItem.name,  // Use name from flag data or fallback to game item name
                        image: orderItem.image || gameItem.img, // Use image from flag or fallback to game item
                        description: orderItem.description || gameItem.system.description?.value || "",
                        type: orderItem.type || gameItem.type,
                        selectedRating: orderItem.rating || gameItem.system.technology?.rating || 1,  // Use rating from flag
                        calculatedCost: orderItem.cost || gameItem.system.technology?.cost || 0, // Use cost from flag
                        calculatedAvailability: orderItem.availability || gameItem.system.technology?.availability || 0, // Availability
                    };
    
                    completeItemsArray.push(enrichedItem); // Add the enriched item to the array
                } else {
                    console.warn(`Item with ID ${itemId} not found in game items.`);
                }
            });
    
            // Log the complete array of items for debugging
            console.log('Complete Items Array with merged flag data:', completeItemsArray);
    
            // Open the PurchaseScreenApp and pass the enriched orderData for rendering
            const purchaseScreenApp = new PurchaseScreenApp({
                orderData: orderData,  // Pass the original order data
                completeItemsArray: completeItemsArray // Pass the merged complete item objects
            });
            purchaseScreenApp.render(true);
    
            // Wait until the app is fully rendered and then switch to the orderReview tab
            Hooks.once('renderPurchaseScreenApp', (app, html, data) => {
                console.log('PurchaseScreenApp is now open.');
    
                // Manually trigger the tab switch using your app's internal logic
                const orderReviewButton = html.find("#id-orderReview"); // Use the correct selector for the tab switch button
    
                if (orderReviewButton.length) {
                    orderReviewButton.click(); // Simulate the click on the orderReview tab
                    console.log('Switched to the orderReview tab.');
                } else {
                    console.warn('OrderReview button not found.');
                }
    
                // Once in the orderReview tab, pass the data to the rendering function
                app._renderOrderReview(html, flagId, completeItemsArray);  // Call the function to render data
            });
    
        } else {
            console.log(`No order review data found for flag ID ${flagId}`);
        }
    }); 
});

Hooks.on('getSceneControlButtons', (controls) => {
    const mainControl = controls.find(c => c.name === 'token'); // Use main control or any existing control
    mainControl.tools.push({
        name: 'sr5-marketplace',
        title: 'Open Marketplace',
        icon: 'fas fa-shopping-cart',
        onClick: () => {
            new PurchaseScreenApp().render(true);
        },
        button: true
    });
});
