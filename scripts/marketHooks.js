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
    // Check if the user is not a GM
    if (!game.user.isGM) {
        // Select all review-request-button elements and hide them for non-GMs
        const buttons = document.querySelectorAll('.review-request-button');
        buttons.forEach(button => {
            button.classList.add('hide-for-non-gm'); // Add a specific class to hide it
        });
    }
    console.log("Cleaning up unused flags in sr5-marketplace...");
    // Iterate through all users
    for (const user of game.users.contents) {
        const userFlags = user.flags['sr5-marketplace'] || {};

        // For each flag in sr5-marketplace, check if a corresponding chat message exists
        for (const flagId in userFlags) {
            const flagData = userFlags[flagId];

            // Check if there's a chat message with the corresponding flag ID in its content
            const chatMessageExists = game.messages.contents.some(msg => msg.content.includes(`data-request-id="${flagId}"`));

            if (!chatMessageExists) {
                // If no corresponding chat message is found, remove the flag
                console.log(`Removing unused flag: ${flagId} for user: ${user.name}`);
                await user.unsetFlag('sr5-marketplace', flagId);
            }
        }
    }
    console.log("Flag cleanup complete.");
    // Listen for the review-request-button click
    $(document).on('click', '.review-request-button', async function(event) {
        event.preventDefault();
    
        const flagId = $(this).data('request-id');  // Get the flag ID from the button's data attribute
        console.log('Clicked review button with flag ID:', flagId);

        // Retrieve order data from the flag and wait for the asynchronous call to finish
        const orderData = await itemData.getOrderDataFromFlag(flagId);  // Fetch order data from the flag
    
        if (orderData) {
            console.log('Order Data:', orderData);

            // Safeguard: Ensure completeItemsArray is valid or default to an empty array
            const completeItemsArray = orderData.items || [];
    
            // Log the completeItemsArray for debugging
            console.log('Complete Items Array with flag data:', completeItemsArray);
    
            // Open the PurchaseScreenApp and pass the flag data for rendering
            const purchaseScreenApp = new PurchaseScreenApp({
                orderData: orderData,
                completeItemsArray: completeItemsArray  // Pass the complete items array
            });
            purchaseScreenApp.render(true);
    
            Hooks.once('renderPurchaseScreenApp', (app, html, orderdata) => {
                console.log('PurchaseScreenApp is now open.');
                orderdata = orderData;
                const orderReviewButton = html.find("#id-orderReview");
    
                if (orderReviewButton.length) {
                    orderReviewButton.click();  // Switch to the orderReview tab
                    console.log('Switched to the orderReview tab.');
                } else {
                    console.warn('OrderReview button not found.');
                }

                // Render the review tab with the enriched item data
                app._renderOrderReview(html, flagId, completeItemsArray);  // Pass flagId and completeItemsArray
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
