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
    
            // Prepare the order review data using complete item objects
            const orderReviewData = {
                items: orderData.items.map(item => itemData.getCompleteItemObject(item.id)),
                totalCost: orderData.items.reduce((sum, item) => {
                    const completeItem = itemData.getCompleteItemObject(item.id);
                    return sum + (completeItem.cost || 0);
                }, 0),
                requester: orderData.requester
            };
    
            console.log('Order Review Data:', orderReviewData);
    
            // Render the order review using the Handlebars template
            renderTemplate('modules/sr5-marketplace/templates/orderReview.hbs', orderReviewData)
                .then(html => {
                    // Assuming you have a container to display the order review
                    $('#order-review-container').html(html);
                })
                .catch(err => {
                    console.error('Error rendering order review:', err);
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
