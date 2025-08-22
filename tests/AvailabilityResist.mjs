/**
 * Represents the opposed part of an Availability Test.
 * Its dice pool is simply the numeric rating of the item's availability.
 */
export class AvailabilityResist extends OpposedTest {

    constructor(data, documents, options) {
        super(data, documents, options);
    }

    /**
     * Override prepareBaseValues to set this test's unique dice pool.
     */
    prepareBaseValues() {
        // The original AvailabilityTest is available at `this.against`.
        // We can get the availability string from its data.
        const availabilityStr = this.against?.data?.availabilityStr || "";
        const parsed = AvailabilityTest.parseAvailability(availabilityStr);

        // The dice pool for this test is just the item's availability rating.
        this.data.pool.base = parsed.rating;

        // The threshold is automatically set by the OpposedTest parent class
        // to be the net hits of the original test.

        // We don't set a limit for this roll.
        this.data.limit.base = 0;

        // Now, call the parent method to finish standard preparations.
        super.prepareBaseValues();
    }

    /**
     * Set a custom title for this test.
     */
    get title() {
        return `${game.i18n.localize("SR5.Labels.Availability")} ${game.i18n.localize("SR5.Resist")}`;
    }

    get _dialogTemplate() {
        return "modules/sr5-marketplace/templates/documents/tests/availabilitySimple-test-dialog.html";
    }

    static get label() {
        return "SR5.Marketplace.Tests.AvailabilityTest";
    }
}