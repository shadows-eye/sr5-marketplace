Hooks.once('init', async function() {

});

Hooks.once('ready', async function() {

});

Hooks.on('renderSidebarTab', (app, html) => {
    console.log("renderSidebarTab hook triggered");
    if (app.options.id === "items") {
        const button = $(`
            <button class="sr5-marketplace-btn">
               <i class="fas fa-shopping-cart"></i> Open Marketplace
            </button>
        `);
        button.on('click', () => {
            new PurchaseScreenApp().render(true);
        });
        html.find('.directory-footer').append(button);
    }
});