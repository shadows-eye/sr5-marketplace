// scripts/tests/AvailabilityTest.mjs
// v13 — Use the system's SuccessTest flow (dialog + chat message are handled by the base class).
// We ONLY compute dice pools/limits and feed them into SuccessTest. No ChatMessage.create here.
// Wenn man an das gute Zeug kommt, dann gilt: Je höher der
/** Verfügbarkeitswert, desto schwieriger ist ein Gegenstand zu
beschaffen. Um einen Gegenstand schwarz zu kaufen, wird
eine Verfügbarkeitsprobe abgelegt. Dies ist eine Vergleichende
Probe auf Verhandlung + Charisma [Sozial] gegen
den Verfügbarkeitswert des Gegenstands. Wenn die Probe
gelingt,  ndet man den Gegenstand zum angegebenen Preis
und bekommt ihn innerhalb der Zeitspanne, die in der Tabelle
Lieferzeiten angegeben ist, geteilt durch die erzielten Nettoerfolge.
Wenn bei der Probe ein Patt erzielt wird,  ndet man
den Gegenstand, aber die Lieferzeit beträgt das Doppelte der
in der Tabelle angegebenen Zeit. Wenn die Probe misslingt,
kann man es nach dem Doppelten der in der Tabelle angegebenen
Zeit noch einmal versuchen.
Geld löst alle Probleme, sagt man auf der Straße. Wenn man
bereit ist, mehr Geld auszugeben, erhöhen sich die Chancen, einen
bereitwilligen Verkäufer zu  nden: Für jeweils 25 % des Wertes
des Gegenstands, die man zusätzlich zu zahlen bereit ist, erhält
man einen zusätzlichen Würfel für die Verhandlungsprobe.
Sobald man bei 400 Prozent des Wertes des Gegenstands ist
(12 Extrawürfel), bringt es nichts, mit noch mehr Geld um sich
zu werfen. Es gibt keine zusätzlichen Würfel mehr – selbst wenn
man noch Geld hätte, das man um sich werfen könnte.
Wenn man bei einer Verfügbarkeitsprobe einen Patzer erzielt,
hat die Suche nach dem Gegenstand unerwünschte
Aufmerksamkeit auf sich gezogen. Das könnte eine Undercoveroperation
von Knight Errant sein (kannst du Falle buchstabieren,
Omae?), die örtliche Yakuza, die sich nicht an Abmachungen
halten will, rivalisierende Runner oder Feinde, die
von dem Deal erfahren, oder ähnliches. Die genauen Konsequenzen
bleiben dem Spielleiter überlassen, aber die Sache
läuft nicht so sauber ab wie geplant. Bei einem Kritischen
Patzer geschieht die extremste Iteration der oben genannten
Möglichkeiten, und die Chancen, den entsprechenden Gegenstand
zu erwerben, lösen sich in nichts auf.
CONNECTIONS UND VERFÜGBARKEIT
Vielleicht hat man einen Schieber, Taliskrämer, Deckmeister
oder eine andere Connection an der Hand, die den Gegenstand
 nden kann, nach dem man sucht. Connections sind
meist besser als der Charakter darin, die Ausrüstung zu beschaffen,
auf die sie sich spezialisiert haben. Während Runner
sich Schießereien mit der Konzernsicherheit liefern, böse
Geister bannen, Hosts hacken oder was auch immer auf ihren
Shadowruns tun, verbringen Connections den Großteil ihrer
Zeit damit, ihre Verbindungen zum Rest der Welt aufrechtzuerhalten
und zu p egen, weshalb sie Zeit hatten, ihre Beschaffungsfähigkeiten
zu verbessern. Wenn Connections für einen
Runner nach einem Gegenstand suchen, verwenden sie ihre
Verhandlung und ihr Charisma für die Verfügbarkeitsprobe
und erhalten dafür Bonuswürfel in Höhe ihrer Ein ussstufe.
Wenn die Connection noch nicht viele Geschäfte mit dem
Runner gemacht hat, kann sie eine Provision verlangen. Das
ist allerdings nicht die Art und Weise, wie Connections ihr
Geld mit Wiederverkauf machen. Das meiste davon kommt
vom Verhehlen von Waren an die Geizigen.
**/


import {DialogList} from '../scripts/services/dialogList.mjs';
/**
 * @summary A specialized test for determining item availability in the marketplace.
 * @description
 * This class manages an Availability Test, which typically involves a social skill roll
 * (e.g., Negotiation + Charisma). It is designed to be highly flexible, featuring a
 * dialog that allows the user to change the skill and attribute used for the roll on the fly.
 *
 * The result of this test can be used as the threshold for an opposed `AvailabilityResist` test,
 * creating a complete, two-stage process for acquiring items.
 *
 * @extends {game.shadowrun5e.tests.SuccessTest}
 *
 * @param {object} [data={}] - An optional initial data object for the test. While you can pass an empty object,
 * you can also provide an `action` object to set default test parameters.
 * @param {object} [data.action] - An action object can be passed to set defaults for the test.
 * @param {string} [data.action.skill='negotiation'] - The default skill ID to be used (e.g., 'negotiation', 'etiquette').
 * @param {string} [data.action.attribute='charisma'] - The default attribute ID to be used (e.g., 'charisma').
 *
 * @param {object} documents - An object containing the required actor document.
 * @param {Actor} documents.actor - The actor document for the character performing the availability test.
 *
 * @param {object} [options={}] - An optional options object to pass in specific values.
 * @param {string} [options.availability=""] - The availability string to be tested (e.g., "12R", "8F").
 * This is the primary input for the test.
 *
 * @example
 * // How to call this from an Actor Sheet's click handler:
 * const actor = this.document;
 * const availabilityStr = "12R";
 *
 * // Create an instance of the test.
 * const test = new game.shadowrun5e.tests.AvailabilityTest(
 * {}, // Initial data is empty; the test will calculate it.
 * { actor: actor }, // Pass the actor in the documents object.
 * { availability: availabilityStr } // Pass the availability string in the options.
 * );
 *
 * // Run the test, which will open the dialog and handle the roll.
 * await test.execute();
 */
export class AvailabilityTest extends game.shadowrun5e.tests.SuccessTest {

    constructor(data, documents, options) {
        super(data, documents, options);
    }

    _prepareData(data, options) {
        data = super._prepareData(data, options);
        data.action = data.action || game.shadowrun5e.data.createData('action_roll');
        data.action.categories = ["social"];
        data.action.modifiers = data.action.modifiers || 0;
        data.availabilityStr = data.action.availabilityStr || (options?.availability || ""); // Keep fallback for actor sheet calls
        data.selectedSkill = data.action.skill || 'negotiation';
        data.selectedAttribute = data.action.attribute || 'charisma';
        data.dialogId = data.action.dialogId;
        return data;
    }

    prepareBaseValues() {
    // Call parent first to apply system-wide modifiers
        super.prepareBaseValues();

        if (this.actor) {
            const skillId = this.data.selectedSkill || 'negotiation';
            const attributeId = this.data.selectedAttribute || 'charisma';

            const skill = this.actor.system.skills.active[skillId];         // Your log shows this has skill.value but an empty skill.label
            const attribute = this.actor.system.attributes[attributeId]; // Your log shows this has attribute.value but an empty attribute.label
            const modifiers = this.data.action.modifiers || 0;

            if (!skill || !attribute) {
                console.error(`Marketplace | Actor is missing required skill ('${skillId}') or attribute ('${attributeId}').`);
                return;
            }

            // --- THE FIX ---
            // 1. Since .label is empty, we get the official localization key from the system's configuration.
            const skillLocKey = CONFIG.SR5.activeSkills[skillId]; 
            const attributeLocKey = `FIELDS.attributes.${attributeId}.label`;
            console.log(skillLocKey, attributeLocKey);


            // 2. We localize these keys to get the final, human-readable strings.
            const skillLabel = game.i18n.localize(skillLocKey);
            const attributeLabel = game.i18n.localize(attributeLocKey);
            console.log(skillLabel, attributeLabel);
            const parsed = this.constructor.parseAvailability(this.data.availabilityStr);
            // Set the rest of the test's data
            this.data.threshold.base = 0;
            this.data.limit.base = this.actor.system.limits.social.value;
            
            const pool = new DialogList(this.data.pool.mod);
            pool.clear();
            
            // 3. We use the correctly translated labels when building the pool display.
            pool.addPart(skillLabel, skill.value);
            pool.addPart(attributeLabel, attribute.value);

            if (Array.isArray(modifiers)) {
            for (const mod of modifiers) {
                pool.addPart(mod.label, mod.value);
            }
        }
            
            // Set base to 0 to prevent double-counting.
            this.data.pool.base = 0;
        }
    }
    
    get _dialogTemplate() {
        return "modules/sr5-marketplace/templates/documents/tests/availabilitySimple-test-dialog.html";
    }

    static get label() {
        return "SR5.Marketplace.Tests.AvailabilityTest";
    }

    static parseAvailability(str) {
        const m = String(str ?? "").trim().match(/^(\d+)\s*([A-Za-z]*)$/);
        return {
            rating: m ? Number(m[1]) : 0,
            tag: m && m[2] ? m[2].toUpperCase() : ""
        };
    }

    /**
     * @summary The single, unified entry point for running an Availability Test.
     * @description This method can run the test in two modes based on the options provided:
     * 1. Interactive Mode (default): Shows a dialog for the user to make choices.
     * 2. App Mode (`isAppCall: true`): Runs the test silently with pre-defined parameters.
     *
     * @param {Actor|string} actorRef - The actor or actor's UUID performing the test.
     * @param {object} testParams - An object containing all parameters for the test.
     * @param {string} testParams.availabilityStr - The availability string (e.g., "12R").
     * @param {string} [testParams.skill] - The skill ID to use (for app calls).
     * @param {string} [testParams.attribute] - The attribute ID to use (for app calls).
     * @param {Array}  [testParams.modifiers] objects (for app calls).
     * @param {object} [options={}] - An options object to control execution.
     * @param {boolean} [options.isAppCall=false] - Set to true to run in silent/app mode.
     * @returns {Promise<AvailabilityTest>} The executed test instance, containing the results.
     */
    static async run(actorRef, testParams = {}, options = {}) {
        const actor = typeof actorRef === "string" ? await fromUuid(actorRef) : actorRef;
        if (!actor) throw new Error("AvailabilityTest: actor not found");

        let data = {};
        let finalOptions = { ...options, availability: testParams.availabilityStr };

        // If this is a call from our app, build the full action data and run silently.
        if (options.isAppCall) {
            data.action = {
                skill: testParams.skill,
                attribute: testParams.attribute,
                modifiers: testParams.modifiers,
                categories: ["social"] // Required by the parent class
            };
            finalOptions.showDialog = false;
            finalOptions.showMessage = false;
        } 
        // Otherwise, run interactively (the default for actor sheets).
        else {
            finalOptions.showDialog = true;
            finalOptions.showMessage = true;
        }

        // Create the new test instance. The constructor and _prepareData will handle the rest.
        const test = new this(data, { actor }, finalOptions);
        
        // Execute the test.
        await test.execute();

        // Return the completed test instance.
        return test;
    }

    /**
     * Runs a silent, data-driven test specifically for an external application.
     * It bypasses the standard dialog, uses the provided parameters to build the test,
     * executes it, and returns the complete result.
     * Runs a silent, data-driven test specifically for an external application.
     * @param {string} actorUuid - The UUID of the actor performing the test.
     * @param {object} testParams - An object containing all parameters for the test.
     * @returns {Promise<object|null>} The JSON result of the executed test, or null on failure.
     */
    static async runForApp(actorUuid, testParams = {}) {
        const actor = await fromUuid(actorUuid);
        if (!actor) {
            console.error("AvailabilityTest.runForApp | Actor not found.");
            return null;
        }

        // 1. Describe the test action, INCLUDING the missing 'categories' property.
        const action = {
            test: "AvailabilityTest",
            skill: testParams.skill || 'negotiation',
            attribute: testParams.attribute || 'charisma',
            modifiers: testParams.modifiers || [], // Pass the modifier array
            limit: { attribute: "social" },
            availabilityStr: testParams.availabilityStr || "",
            opposed: { test: "AvailabilityResist" },
            
            // --- THIS FIXES THE TYPEERROR ---
            // The parent SuccessTest class requires this property.
            categories: ["social"] 
        };

        // 2. Set options to run the test silently but show the result in chat.
        const options = {
            showDialog: false,
            showMessage: false
        };

        // 3. Correctly instantiate the test. The 'action' object is the 'data' parameter,
        //    and the 'actor' must be wrapped in a 'documents' object.
        const test = new this(
            { action },      // data
            { actor },       // documents
            options          // options
        );
        if (!test) return null;

        // 4. Execute the test to perform the roll.
        await test.execute();

        // 5. Return the clean result data.
        return test.result.toJSON();
    }

    /**
     * A simple, static runner that acts as a switchboard for the test.
     * It can create a standard test with a dialog or a "silent" test that
     * returns its result, based on the context provided.
     * @param {Actor|string} actorRef - The actor performing the test.
     * @param {string} availabilityStr - The availability string (e.g., "12R").
     * @param {object} [context={}] - An object to provide context for the call.
     * @param {boolean} [context.isAppCall=false] - Set to true if calling from your app.
     * @returns {Promise<AvailabilityTest>} - The executed test instance, containing the results.
     */
    static async run_old(actorRef, availabilityStr = "", context = {}) {
        const actor = typeof actorRef === "string" ? await fromUuid(actorRef) : actorRef;
        if (!actor) throw new Error("AvailabilityTest: actor not found");

        let testOptions = {
            availability: availabilityStr
        };

        // If the test is called from your app, set the options to suppress the UI.
        if (context.isAppCall) {
            testOptions.showDialog = false;
            testOptions.showMessage = false;
        }

        // Create the new test instance, passing the correct arguments.
        const test = new this(
            {},                 // data
            { actor },          // documents
            testOptions         // options
        );
        
        // Execute the test. It will either show the dialog or run silently
        // based on the options we just set.
        await test.execute();

        // Return the completed test instance so the calling app can get the results.
        return test;
    }
}
