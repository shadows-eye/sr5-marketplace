import {DialogList} from '../scripts/services/dialogList.mjs';
/**
 * Represents the opposed part of an Availability Test.
 * Its dice pool is simply the numeric rating of the item's availability.
 */
export class AvailabilityResist extends game.shadowrun5e.tests.OpposedTest {

    constructor(data, documents, options) {
        super(data, documents, options);
    }
    static prepareData(data, options) {
    // Call parent first to apply system-wide modifiers
        super.prepareData(data, options);
            // The original AvailabilityTest's data is in `againstData`.
        // This gives us access to all its properties, including our custom ones.
        const availabilityStr = againstData.availabilityStr || "";
        const parsed = AvailabilityTest.parseAvailability(availabilityStr);
        console.log(parsed);

        // This is the threshold for our resist roll. The OpposedTest parent class
        // uses this to determine success or failure.
        const threshold = againstData.values.netHits.value;

        // This is the dice pool for our resist roll.
        const pool = parsed.rating;

        // Now we build the complete data object for the new OpposedTest.
        const resistData = {
            // This links our resist test to the original test.
            against: againstData,
            //categories: ["social"],
            previousMessageId: previousMessageId,

            // Set the pool, limit (none), and threshold.
            pool: game.shadowrun5e.data.createData('value_field', { base: pool }),
            limit: game.shadowrun5e.data.createData('value_field', { base: 0 }),
            threshold: game.shadowrun5e.data.createData('value_field', { base: threshold }),

            // These are needed to prevent errors in the parent class.
            action: game.shadowrun5e.data.createData('action_roll'),
            values: {},
            
            // Set a custom title for the dialog and chat card.
            title: `${game.i18n.localize("SR5.Labels.Availability")} ${game.i18n.localize("SR5.Resist")}`
        };

        // We return the finished data object. The system will then use it to create
        // a new instance of this AvailabilityResist class and execute it.
        return resistData;
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