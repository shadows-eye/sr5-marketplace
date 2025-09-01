import {DialogList} from '../scripts/services/dialogList.mjs';
/**
 * Represents the opposed part of an Availability Test.
 * Its dice pool is simply the numeric rating of the item's availability.
 */
export class AvailabilityResist extends game.shadowrun5e.tests.OpposedTest {

    constructor(data, documents, options) {
        super(data, documents, options);
    }

    /**
     * This static "factory" method is called by the system to create the data for this test.
     * @param {object} againstData       - The complete data from the initial AvailabilityTest.
     * @param {document} item            - The actor performing this resist test (not used here).
     * @param {string} previousMessageId - The UUID of the chat message this test is against.
     * @returns {Promise<object>}        - The fully constructed data object for the new test.
     */
    static async _getOpposedActionTestData(againstData, item, previousMessageId) {
        // The original AvailabilityTest's data is in `againstData`.
        // This gives us access to all its properties, including our custom ones.
        const availabilityStr = againstData.availabilityStr || "";
        const parsed = AvailabilityTest.parseAvailability(availabilityStr);

        // This is the threshold for our resist roll. The OpposedTest parent class
        // uses this to determine success or failure.
        const threshold = againstData.values.netHits.value;

        // This is the dice pool for our resist roll.
        const pool = parsed.rating;

        // Now we build the complete data object for the new OpposedTest.
        const data = {
            // This links our resist test to the original test.
            against: againstData,
            previousMessageId: previousMessageId,

            // Set the pool, limit (none), and threshold.
            pool: DataDefaults.createData('value_field', { base: pool }),
            limit: DataDefaults.createData('value_field', { base: 0 }),
            threshold: DataDefaults.createData('value_field', { base: threshold }),

            // These are needed to prevent errors in the parent class.
            action: game.shadowrun5e.data.createData('action_roll'),
            values: {},
            
            // Set a custom title for the dialog and chat card.
            title: `${game.i18n.localize("SR5.Labels.Availability")} ${game.i18n.localize("SR5.Resist")}`
        };

        // We return the finished data object. The system will then use it to create
        // a new instance of this AvailabilityResist class and execute it.
        return data;
    }

    /**
     * Set a custom title for this test.
     */
    get title() {
        return `${game.i18n.localize("SR5.Labels.Availability")} ${game.i18n.localize("SR5.Resist")}`;
    }

    get _dialogTemplate() {
        return "modules/sr5-marketplace/templates/documents/tests/availabilityResist-test-dialog.html";
    }

    static get label() {
        return "SR5.Marketplace.Tests.AvailabilityTest";
    }
}