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
    
            // Prepare the order review data using the new method
            const itemIds = orderData.items.map(item => item.id); // Extract the IDs of the items in the order
            const orderReviewData = itemData.prepareOrderReviewData(itemIds); // Prepare the review data
    
            console.log('Order Review Data Prepared:', orderReviewData); // Log the data we are passing to the template
    
            // Open the PurchaseScreenApp
            const purchaseScreenApp = new PurchaseScreenApp();
            purchaseScreenApp.render(true);
    
            // Wait until the app is fully rendered and then switch to the orderReview tab
            Hooks.once('renderPurchaseScreenApp', (app, html, data) => {
                console.log('PurchaseScreenApp is now open.');
    
                // Manually trigger the tab switch using your app's internal logic
                const orderReviewButton = html.find("#id-orderReview"); // Use the correct selector for the tab switch button
    
                if (orderReviewButton.length) {
                    // Simulate the click or directly call the method responsible for switching tabs
                    orderReviewButton.click(); // Simulate the click on the orderReview tab
                    console.log('Switched to the orderReview tab.');
    
                    // Log that we are rendering the order review template
                    console.log('Rendering orderReview.hbs with data:', orderReviewData);
    
                    // Render the template inside the order-review tab content
                    renderTemplate('modules/sr5-marketplace/templates/orderReview.hbs', orderReviewData).then(htmlContent => {
                        // Assuming you have a container to display the order review inside the app
                        html.find('#order-review-container').html(htmlContent); // Inject the content into the correct container
                        console.log('Order review data injected into the template.');
                    }).catch(err => {
                        console.error('Error rendering the order review template:', err);
                    });
    
                } else {
                    console.warn('OrderReview button not found.');
                }
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
