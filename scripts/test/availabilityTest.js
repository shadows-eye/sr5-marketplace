/**
 * Extend the default test implementation for a custom test that
 * - alters the default dialog
 * - extends test behavior
 */
export class AvailabilityTest extends game.shadowrun5e.tests.SuccessTest {
    constructor(actor, options) {
        super(actor, options);
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
     * Calculate the estimated game time for item arrival based on availability.
     * @param {number} availabilityScore - The total availability score.
     * @returns {string} - The estimated time as a readable string.
     */
    calculateGameTime(availabilityScore) {
        if (availabilityScore <= 4) return "1 hour";
        if (availabilityScore <= 10) return "1 day";
        if (availabilityScore <= 18) return "1 week";
        return "1 month";
    }

    /**
     * Open a custom dialog for the Availability Test.
     */
    async openTestDialog() {
        // Get the available connections for the actor
        const connections = await this.getAvailableConnections();

        // Get the default connection UUID from the Purchase Screen App settings
        const defaultConnectionUuid = game.settings.get("sr5-marketplace", "defaultConnectionUuid");

        // Calculate the estimated time for purchase based on availability score
        const items = this.options.items || [];
        const totalAvailability = items.reduce((sum, item) => sum + item.calculatedAvailability, 0);
        const estimatedTime = this.calculateGameTime(totalAvailability);

        // Prepare dialog data
        const dialogData = {
            connections,
            defaultConnectionUuid,
            estimatedTime,
        };

        // Render the template and open the dialog
        const html = await renderTemplate(this._dialogTemplate, dialogData);
        new Dialog({
            title: game.i18n.localize("Marketplace.Tests.Availability"),
            content: html,
            buttons: {
                startTest: {
                    label: "Start Test",
                    callback: async (html) => {
                        const connectionUuid = html.find("select[name='connection']").val();
                        this.logAvailabilityTestSetup(connectionUuid, totalAvailability, estimatedTime);
                    },
                },
            },
            default: "startTest",
        }).render(true);
    }

    /**
     * Log the initial setup for the Availability Test.
     * @param {string} connectionUuid - The UUID of the selected connection.
     * @param {number} totalAvailability - The calculated total availability score.
     * @param {string} estimatedTime - The calculated estimated time for item arrival.
     */
    async logAvailabilityTestSetup(connectionUuid, totalAvailability, estimatedTime) {
        // Retrieve connection details
        const connection = await fromUuid(connectionUuid);
        const connectionValue = connection.system.connectionValue || 1;
        const loyalty = connection.system.loyalty || 1;

        // Log the setup information
        console.log(`Starting Availability Test`);
        console.log(`Connection: ${connection.name} (Connection Value: ${connectionValue}, Loyalty: ${loyalty})`);
        console.log(`Total Availability: ${totalAvailability}`);
        console.log(`Estimated Arrival Time: ${estimatedTime}`);
    }

    /**
     * Fetch available connections for the actor.
     * Placeholder function for retrieving actor connections.
     * @returns {Array} Array of connections with `uuid`, `name`, `value`, and `loyalty`.
     */
    async getAvailableConnections() {
        // Retrieve connections from actor or other game sources as needed
        return [
            { uuid: "Actor.someConnectionUUID1", name: "John Smith", value: 3, loyalty: 4 },
            { uuid: "Actor.someConnectionUUID2", name: "Jane Doe", value: 5, loyalty: 3 },
            // ...other connections
        ];
    }
}