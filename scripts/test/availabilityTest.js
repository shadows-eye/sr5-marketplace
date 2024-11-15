
/**
 * Extend the default test implementation for a custom test that
 * - alters the default dialog
 * - extends test behavior
 */
export class AvailabilityTest extends game.shadowrun5e.tests.SuccessTest {
    constructor(actor, options) {
        super(actor, options);
        this.socket = socketlib.registerModule("sr5-marketplace"); // Initialize socketlib
    }

    /**
     * Define the custom template for the test dialog.
     */
    get _dialogTemplate() {
        return "modules/sr5-marketplace/templates/tests/availabilityTest.hbs";
    }

    /**
     * Provide a custom label for the test.
     */
    static get label() {
        return "Marketplace.Tests.Availability";
    }

    /**
     * Open a custom dialog for the Availability Test.
     */
    async openTestDialog() {
        try {
            // Fetch data via socket calls
            const connectionItemUuid = await this.socket.executeAsGM("getConnectionItem");
            const shopActorData = await this.socket.executeAsGM("getGlobalShopActorData");
            const selectedActorData = await this.socket.executeAsGM("getSelectedActor");
            const totalAvailability = await this.socket.executeAsGM("getTotalAvailability");
            const totalCost = await this.socket.executeAsGM("getTotalCost");

            // Retrieve the full item or actor objects using fromUuid
            const connectionItem = connectionItemUuid ? await fromUuid(connectionItemUuid) : null;
            const shopActor = shopActorData ? await fromUuid(shopActorData.uuid) : null;
            const selectedActor = selectedActorData ? await fromUuid(selectedActorData.uuid) : null;

            // Log the fetched data
            console.log("Availability Test Data:");
            console.log("Connection Item:", connectionItem);
            console.log("Shop Actor:", shopActor);
            console.log("Selected Actor:", selectedActor);
            console.log("Total Availability:", totalAvailability);
            console.log("Total Cost:", totalCost);

            // Prepare dialog data for displaying fetched information
            const dialogData = {
                connectionItem,
                shopActor,
                selectedActor,
                totalAvailability,
                totalCost,
            };

            // Render the dialog
            const html = await renderTemplate(this._dialogTemplate, dialogData);
            new Dialog({
                title: game.i18n.localize("Marketplace.Tests.Availability"),
                content: html,
                buttons: {
                    close: {
                        label: game.i18n.localize("Close"),
                    },
                },
            }).render(true);

        } catch (error) {
            console.error("Error in AvailabilityTest:", error);
        }
    }
}