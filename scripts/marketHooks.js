import ItemData from './app/itemData.js';
import { ActorItemData } from './app/actorItemData.js';
import { PurchaseScreenApp } from './app/purchase-screen-app.js';
import { registerBasicHelpers } from './lib/helpers.js';

// Call the function to register helpers
registerBasicHelpers();
Hooks.once('init', async function() {
});
Hooks.on('renderChatMessage', (message, html, data) => {
    // Check if the current user is a GM
    if (game.user.isGM) {
        // Select the button with the 'hide-for-non-gm' class
        const button = html.find('.review-request-button.hide-for-non-gm');
        
        // If the button exists, remove the 'hide-for-non-gm' class
        if (button.length) {
            button.removeClass('hide-for-non-gm');
        }
    }
});
Hooks.once('ready', async function() {
    const itemData = new ItemData();
    await itemData.fetchItems();
    // Check if the user is not a GM
    if (!game.user.isGM) {
        // Select all review-request-button elements
        const buttons = document.querySelectorAll('.review-request-button');
        
        buttons.forEach(button => {
            // Check if the button already has the 'hide-for-non-gm' class
            if (!button.classList.contains('hide-for-non-gm')) {
                // Add the class if it's not already present
                button.classList.add('hide-for-non-gm');
            }
        });
    }
    console.log("Cleaning up unused flags in sr5-marketplace...");
    const currentUser = game.user;  // Get the current user
    const isGM = currentUser.isGM;  // Check if the current user is a GM

    // Define the function to clean flags for a user
    async function cleanFlagsForUser(user) {
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

    // If the current user is a GM, clean flags for all users
    if (isGM) {
        console.log("GM detected, cleaning flags for all users.");
        for (const user of game.users.contents) {
            await cleanFlagsForUser(user);  // Clean flags for each user
        }
    } else {
        // If the user is not a GM, only clean flags for the current user
        console.log(`Cleaning flags for current user: ${currentUser.name}`);
        await cleanFlagsForUser(currentUser);  // Clean flags for the current user only
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
