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

    static get name() {
        return "AvailabilityTest";
    }

    /** @override */
    get type() {
        return "AvailabilityTest";
    }

    /** @override */
    get pool() {
        return this.data.pool;
    }

    /** @override */
    get code() {
        if (!this.data?.pool || !Array.isArray(this.data.pool.mod) || this.data.pool.mod.length === 0) {
            return "";
        }
        const parts = this.data.pool.mod.map(m => `${m.name} ${m.value}`);
        return `(${parts.join(" + ")} = ${this.pool.value})`;
    }

    constructor(data, documents, options) {
        super(data, documents, options);
        this.contactItem = null;
    }

    _prepareData(data, options) {
        const originalModifiers = data?.action?.modifiers;
        data = super._prepareData(data, options);
        
        // Merge with default action_roll data so we don't lose any default system properties
        const defaultAction = game.shadowrun5e.data.createData('action_roll');
        data.action = foundry.utils.mergeObject(defaultAction, data.action || {}, { inplace: false });
        
        data.opposed = data.action.opposed;
        data.action.categories = ["social"];
        if (originalModifiers !== undefined) {
            data.action.modifiers = originalModifiers;
        } else {
            data.action.modifiers = data.action.modifiers || 0;
        }
        data.action.availabilityStr = data.action.availabilityStr || options?.availability || data.availabilityStr || "";
        data.availabilityStr = data.action.availabilityStr;
        data.selectedSkill = data.selectedSkill || data.action.skill || 'negotiation';
        data.selectedAttribute = data.action.attribute || 'charisma';
        data.dialogId = data.action.dialogId;
        data.connectionUuid = data.action.connectionUuid;
        data.maxNegotiation = data.action.maxNegotiation || data.maxNegotiation || 0;
        data.entryId = data.action.entryId || data.entryId || options?.entryId || "";
        data.failPenalty = data.action.failPenalty || data.failPenalty || 0;

        if (!data.manualHits || typeof data.manualHits.value === 'undefined') {
            data.manualHits = game.shadowrun5e.data.createData('value_field', { base: 0, override: { value: null, label: "SR5.ManualOverride" } });
        }
        if (!data.manualGlitches || typeof data.manualGlitches.value === 'undefined') {
            data.manualGlitches = game.shadowrun5e.data.createData('value_field', { base: 0, override: { value: null, label: "SR5.ManualOverride" } });
        }

        return data;
    }

    async populateDocuments() {
        await super.populateDocuments();
        if (this.data.connectionUuid) {
            this.contactItem = await fromUuid(this.data.connectionUuid);
        }
    }

    _rebuildPool() {
        if (!this.actor) return;

        // 1. Get common data
        const rule = game.settings.get("sr5-marketplace", "availabilityTestRule");
        const skillId = this.data.selectedSkill;
        const attributeId = this.data.selectedAttribute;

        console.log("AvailabilityTest prepareBaseValues | this.actor.type:", this.actor.type);
        console.log("AvailabilityTest prepareBaseValues | skillId:", skillId, "attributeId:", attributeId);
        console.log("AvailabilityTest prepareBaseValues | this.data.maxNegotiation:", this.data.maxNegotiation);

        // Dynamic skill lookup: Embedded Item of type skill (new system format) or legacy active skills fallback
        let skill;
        if (this.actor.type === "sr5-marketplace.shop" && skillId === 'negotiation') {
            skill = { value: this.data.maxNegotiation || 0 };
            console.log("AvailabilityTest prepareBaseValues | Matched shop actor + negotiation. skill.value is:", skill.value);
        } else {
            const SKILL_NAME_MAPPINGS = {
                armorer: ["armorer", "armourer", "waffenbau"],
                automotivemechanic: ["automotivemechanic", "fahrzeugmechanik"],
                aeronauticsmechanic: ["aeronauticsmechanic", "luftfahrtmechanik"],
                nauticalmechanic: ["nauticalmechanic", "seefahrtmechanik", "schiffsmechanik"],
                industrialmechanic: ["industrialmechanic", "industriemechanik"],
                negotiation: ["negotiation", "verhandeln"]
            };

            const normK = skillId.toLowerCase().replace(/[^a-z0-9]/g, '');
            const matchNames = SKILL_NAME_MAPPINGS[normK] || [normK];

            let skillItem = this.actor.items.find(i => {
                if (i.type !== "skill") return false;

                const normKey = i.system.key?.toLowerCase()?.replace(/[^a-z0-9]/g, '');
                if (normKey && matchNames.includes(normKey)) return true;

                const normName = i.name?.toLowerCase()?.replace(/[^a-z0-9]/g, '');
                if (normName && matchNames.includes(normName)) return true;

                return false;
            });

            // Generate possible cased keys for legacy active skills fallback
            const possibleKeys = [
                skillId,
                skillId.toLowerCase(),
                skillId.charAt(0).toLowerCase() + skillId.slice(1)
            ];

            let ref;
            for (const k of possibleKeys) {
                if (this.actor.system.skills?.active?.[k] !== undefined) {
                    ref = this.actor.system.skills.active[k];
                    break;
                }
            }

            // If not found by direct key, try normalized snake_case key matching in active skills
            if (!ref && this.actor.system.skills?.active) {
                for (const [key, value] of Object.entries(this.actor.system.skills.active)) {
                    const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (matchNames.includes(normKey)) {
                        ref = value;
                        break;
                    }
                }
            }

            if (ref && !skillItem) {
                let refId = typeof ref === "string" ? ref : (ref.uuid || ref.value || ref.base);
                if (typeof refId === "string") {
                    if (refId.startsWith("Item.")) {
                        refId = refId.substring(5);
                    }
                    skillItem = this.actor.items.get(refId) || this.actor.items.find(i => i.id === refId || i.uuid === refId);
                }
            }

            let skillValue = 0;
            if (skillItem) {
                skillValue = skillItem.system.skill?.rating ?? 
                             skillItem.system.skill?.value ?? 
                             skillItem.system.rating?.value ?? 
                             skillItem.system.value ?? 
                             skillItem.system.rating ?? 
                             0;
            } else if (ref !== undefined && ref !== null) {
                if (typeof ref === "number") {
                    skillValue = ref;
                } else if (typeof ref === "object") {
                    skillValue = ref.value ?? ref.base ?? ref.rating ?? 0;
                }
            }
            skill = { value: skillValue };
            console.log("AvailabilityTest prepareBaseValues | Fallback skill.value is:", skill?.value);
        }

        const attribute = this.actor.system.attributes[attributeId];
        console.log("AvailabilityTest prepareBaseValues | attribute value is:", attribute?.value);

        let modifiers = [];
        if (Array.isArray(this.data.action.modifiers)) {
            modifiers = this.data.action.modifiers;
        } else if (typeof this.data.action.modifiers === "number" && this.data.action.modifiers !== 0) {
            const label = game.i18n.localize("SR5.Labels.Action.Modifiers") || "Modifiers";
            pool.addPart(label, this.data.action.modifiers);
        }

        const parseModifierValue = (val) => {
            if (typeof val === "number") return val;
            if (typeof val === "string") {
                const clean = val.replace(/[()]/g, "").trim();
                const match = clean.match(/^([+-]?\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
            }
            return 0;
        };
        const parsedModifiers = modifiers.map(mod => {
            const labelLocKey = `SR5Marketplace.Marketplace.Modifiers.Labels.${mod.label}`;
            const displayLabel = game.i18n.has(labelLocKey) ? game.i18n.localize(labelLocKey) : (mod.label || "Modifier");
            return {
                label: displayLabel,
                value: parseModifierValue(mod.value)
            };
        });

        const parsed = this.constructor.parseAvailability(this.data.availabilityStr);

        if (!skill || !attribute) {
            console.error(`Marketplace | Actor is missing required skill ('${skillId}') or attribute ('${attributeId}').`);
            return;
        }

        // 2. Prepare dice pool helper
        this.data.pool = this.data.pool || {};
        this.data.pool.mod = Array.isArray(this.data.pool.mod) ? this.data.pool.mod : [];
        const pool = new DialogList(this.data.pool.mod);
        pool.clear();
        const skillLabel = game.i18n.localize(CONFIG.SR5.activeSkills[skillId]);
        const attributeLabel = game.i18n.localize(`FIELDS.attributes.${attributeId}.label`);

        // 3. Set limit (common to all rules)
        this.data.limit.base = this.actor.system.limits.social.value;

        // 4. Configure test and build dice pool based on the active rule
        switch (rule) {
            case "simple":
            case "extended":
                console.log(`Marketplace | Configuring for ${rule.charAt(0).toUpperCase() + rule.slice(1)} Test Rule`);
                this.data.threshold.base = parsed.rating;
                this.data.opposed = undefined;
                this.data.extended = (rule === "extended");

                // Build full dice pool: Skill + Attribute + Modifiers + Contact Stats
                pool.addPart(skillLabel, skill.value);
                pool.addPart(attributeLabel, attribute.value);
                parsedModifiers.forEach(mod => pool.addPart(mod.label, mod.value));
                if (this.contactItem) {
                    pool.addPart(game.i18n.localize("SR5.Connection"), this.contactItem.system.connection);
                    pool.addPart(game.i18n.localize("SR5.Loyalty"), this.contactItem.system.loyalty);
                }
                break;

            case "raw":
            case "opposed":
            default:
                console.log(`Marketplace | Configuring for ${rule} Test Rule`);
                this.data.threshold.base = 0;
                this.data.extended = false;

                // Build opposed dice pool: Skill + Attribute + Modifiers + Connection ONLY
                pool.addPart(skillLabel, skill.value);
                pool.addPart(attributeLabel, attribute.value);
                parsedModifiers.forEach(mod => pool.addPart(mod.label, mod.value));
                if (this.contactItem) {
                    pool.addPart(game.i18n.localize("SR5.Connection"), this.contactItem.system.connection);
                }
                break;
        }
        
        // 5. Finalize the dice pool
        this.data.pool.base = 0;

        // Populate changes so ModifiableValue.calcTotal (used by the core system) works seamlessly - preserve manual pool overrides
        const manualOverrideChange = this.data.pool.changes?.find(c => c.name === 'SR5.ManualOverride');
        this.data.pool.changes = this.data.pool.mod.map(m => ({
            name: m.name,
            value: m.value,
            enabled: true,
            mode: typeof CONST !== 'undefined' ? (CONST.ACTIVE_EFFECT_CHANGE_TYPES?.ADD || CONST.ACTIVE_EFFECT_MODES?.ADD || 2) : 2,
            priority: 0
        }));
        if (manualOverrideChange) {
            this.data.pool.changes.push(manualOverrideChange);
        }

        this.data.pool.value = this.constructor.calcTotal(this.data.pool);
        console.log("AvailabilityTest _rebuildPool | Finalized pool.value:", this.data.pool.value);
        console.log("AvailabilityTest _rebuildPool | Finalized pool.mod:", JSON.stringify(this.data.pool.mod));
    }

    prepareBaseValues() {
        for (const field of ['pool', 'limit', 'threshold', 'manualHits', 'manualGlitches']) {
            let val = this.data[field];
            const currentBase = (field === 'threshold') 
                ? (this.data.thresholdBase || (val && typeof val === 'object' ? val.base : null) || 0)
                : (val && typeof val === 'object' ? val.base : 0);

            if (typeof val === 'number' || (typeof val === 'string' && val.trim() !== '')) {
                const num = Number(val);
                if (!isNaN(num)) {
                    this.data[field] = game.shadowrun5e.data.createData('value_field', {
                        base: currentBase,
                        override: { value: num, label: "SR5.ManualOverride" }
                    });
                } else {
                    this.data[field] = game.shadowrun5e.data.createData('value_field', { base: currentBase, override: { value: null, label: "SR5.ManualOverride" } });
                }
            } else if (!val || val === null || typeof val.value === 'undefined') {
                this.data[field] = game.shadowrun5e.data.createData('value_field', { base: currentBase, override: { value: null, label: "SR5.ManualOverride" } });
            } else if (val && typeof val === 'object' && val.override) {
                if (val.override.value === undefined || val.override.value === null || val.override.value === "") {
                    val.override.value = null;
                }
            }
        }

        const originalModifiers = this.data.action?.modifiers;
        super.prepareBaseValues();
        if (originalModifiers !== undefined && this.data.action) {
            this.data.action.modifiers = originalModifiers;
        }
        this._rebuildPool();
    }

    /** @override */
    calculateBaseValues() {
        const originalModifiers = this.data.action?.modifiers;
        super.calculateBaseValues();
        if (originalModifiers !== undefined && this.data.action) {
            this.data.action.modifiers = originalModifiers;
        }
        this._rebuildPool();
    }

    /** @override */
    calculateHits() {
        const hits = super.calculateHits();
        if (this.data.manualHits && this.data.manualHits.override && this.data.manualHits.override.value !== null && this.data.manualHits.override.value !== undefined) {
            hits.value = this.data.manualHits.override.value;
        }
        return hits;
    }

    /** @override */
    calculateGlitches() {
        const glitches = super.calculateGlitches();
        if (this.data.manualGlitches && this.data.manualGlitches.override && this.data.manualGlitches.override.value !== null && this.data.manualGlitches.override.value !== undefined) {
            glitches.value = this.data.manualGlitches.override.value;
        }
        return glitches;
    }
    /**
     * @override
     * @description Defines success based on the active test rule. This is the key to making
     * our custom extended test work correctly.
     */
    get success() {
        const rule = game.settings.get("sr5-marketplace", "availabilityTestRule");

        // For an extended test, "success" means the CUMULATIVE hits have met the threshold.
        if (rule === "extended") {
            return this.extendedHits.value >= this.threshold.value;
        }

        // For all other tests (simple, opposed), we use the default system behavior.
        return super.success;
    }

    /**
     * @override
     * @description Defines failure based on the active test rule. For an extended test,
     * failure only occurs when the dice pool is exhausted before the threshold is met.
     */
    get failure() {
        const rule = game.settings.get("sr5-marketplace", "availabilityTestRule");

        if (rule === "extended") {
            // It's a failure ONLY if the dice pool has run out AND we haven't succeeded yet.
            return this.pool.value <= 0 && !this.success;
        }

        // For all other tests (simple, opposed), use the default system behavior.
        return super.failure;
    }

    /**
     * @override
     * @description Calculates net hits using the correct hit total and our own local calcTotal method.
     */
    calculateNetHits() {
        const rule = game.settings.get("sr5-marketplace", "availabilityTestRule");
        let hitsToUse;

        if (rule === "extended") {
            hitsToUse = this.extendedHits;
        } else {
            hitsToUse = this.hits;
        }

        const base = this.hasThreshold ? Math.max(hitsToUse.value - this.threshold.value, 0) : hitsToUse.value;
        const netHits = game.shadowrun5e.data.createData('value_field', {
            label: "SR5.NetHits",
            base,
            override: null
        });
        
        // --- THIS IS THE FIX ---
        // Call our new, local static method instead of the system's helper.
        netHits.value = AvailabilityTest.calcTotal(netHits, { min: 0 });

        return netHits;
    }

    /**
     * @summary A self-contained version of the system's `calcTotal` helper.
     * @description Calculates the total value from a modifiable value field,
     * including base, mods, and temp values, and applies optional constraints.
     * @param {object} value - The value field object (e.g., this.data.pool).
     * @param {object} [options={}] - Options like min/max values.
     * @returns {number} The calculated total.
     * @static
     */
    static calcTotal(value, options = {}) {
        // If there's an override, it takes precedence.
        if (value.override && value.override.value !== undefined && value.override.value !== null) {
            let total = value.override.value;
            if (options.min !== undefined) total = Math.max(total, options.min);
            if (options.max !== undefined) total = Math.min(total, options.max);
            return total;
        }

        // Start with the base value.
        let total = value.base || 0;

        // Add the value of each modifier in the 'mod' array.
        if (Array.isArray(value.mod)) {
            total += value.mod.reduce((acc, current) => acc + (current.value || 0), 0);
        }

        // Add the temporary value if it exists.
        total += value.temp || 0;

        // Apply min/max constraints from options.
        if (options.min !== undefined) total = Math.max(total, options.min);
        if (options.max !== undefined) total = Math.min(total, options.max);

        return Math.ceil(total); // Ensure we always deal with integers as per SR5 rules.
    }
    
    /**
     * @override
     * @description We override the parent's afterTestComplete to prevent it from
     * automatically calling the system's default `executeAsExtended` logic. Our application's
     * UI will now have full control over when and how the extended test continues.
     */
    async afterTestComplete() {
        console.debug(`SR5 Marketplace | Test ${this.constructor.name} completed. Custom afterTestComplete is preventing automatic extension.`);

        // Run the essential parts of the parent method.
        if (this.success) {
            await this.processSuccess();
        } else {
            await this.processFailure();
        }

        if (this.autoExecuteFollowupTest) {
            await this.executeFollowUpTest();
        }

        // By INTENTIONALLY OMITTING the `if (this.extended)` block that is present
        // in the parent SuccessTest, we stop the automatic (and incorrect) roll.

        // --- Custom Shop Actor Inventory Update Logic ---
        const entryId = this.data.entryId;
        if (entryId && this.actor && this.actor.type === "sr5-marketplace.shop") {
            const successes = this.hits?.value ?? 0;
            const parsed = this.constructor.parseAvailability(this.data.availabilityStr);
            const availabilityRating = parsed.rating;

            if (successes >= availabilityRating) {
                // SUCCESS: Add 1 to the quantity of the item in the shop inventory!
                const path = `system.shop.inventory.${entryId}.qty`;
                const currentQty = Number(foundry.utils.getProperty(this.actor, path) ?? 0);
                const itemName = foundry.utils.getProperty(this.actor, `system.shop.inventory.${entryId}.name`) || "Item";
                
                await this.actor.update({ [path]: currentQty + 1 });
                
                ui.notifications.info(
                    game.i18n.format("SR5Marketplace.Marketplace.Availability.SuccessMessage", { 
                        actor: this.actor.name, 
                        item: itemName,
                        qty: currentQty + 1
                    }) || `${this.actor.name} successfully procured ${itemName}! Quantity is now ${currentQty + 1}.`
                );
            } else {
                // FAILURE: Ask if they want to try again with a -1 penalty!
                const newPenalty = (this.data.failPenalty || 0) - 1;
                const itemName = foundry.utils.getProperty(this.actor, `system.shop.inventory.${entryId}.name`) || "Item";
                
                const htmlContent = await renderTemplate(
                    "modules/sr5-marketplace/templates/documents/tests/availability-failure-retry-dialog.html", 
                    {
                        itemName,
                        successes,
                        availabilityRating,
                        newPenalty
                    }
                );

                new Dialog({
                    title: game.i18n.localize("SR5Marketplace.UI.Availability") + " " + game.i18n.localize("SR5Marketplace.Marketplace.Acquisition.Failure"),
                    content: htmlContent,
                    buttons: {
                        yes: {
                            label: game.i18n.localize("Yes") || "Yes",
                            callback: async () => {
                                const newTestData = foundry.utils.duplicate(this.data);
                                newTestData.failPenalty = newPenalty;
                                newTestData.evaluated = false;
                                newTestData.rolls = [];
                                
                                // Reset values
                                if (newTestData.values) {
                                    newTestData.values.hits = null;
                                    newTestData.values.extendedHits = null;
                                    newTestData.values.netHits = null;
                                    newTestData.values.glitches = null;
                                }

                                // Recursively purge all null values to prevent system's ModifiableValue.isModifiableValue from crashing
                                const cleanNulls = (obj) => {
                                    if (obj === null || obj === undefined) return;
                                    if (typeof obj !== "object") return;
                                    for (const key of Object.keys(obj)) {
                                        if (obj[key] === null) {
                                            delete obj[key];
                                        } else if (typeof obj[key] === "object") {
                                            cleanNulls(obj[key]);
                                        }
                                    }
                                };
                                cleanNulls(newTestData);
                                
                                // Add a unique modifier for the retry penalty
                                newTestData.action.modifiers = Array.isArray(newTestData.action.modifiers) ? newTestData.action.modifiers : [];
                                newTestData.action.modifiers = newTestData.action.modifiers.filter(m => !m.isRetryPenalty);
                                newTestData.action.modifiers.push({
                                    label: game.i18n.format("SR5Marketplace.Marketplace.Availability.RetryPenalty", { penalty: newPenalty }) || `Retry Penalty (${newPenalty})`,
                                    value: newPenalty,
                                    isRetryPenalty: true
                                });

                                const test = new this.constructor(
                                    newTestData,
                                    { actor: this.actor },
                                    { ...this.data.options, showDialog: true }
                                );
                                await test.execute();
                            }
                        },
                        no: {
                            label: game.i18n.localize("No") || "No"
                        }
                    },
                    default: "yes"
                }, {
                    classes: ["sr5", "form-dialog", "sr5-marketplace-dialog"]
                }).render(true);
            }
        }
    }

    get _dialogTemplate() {
        return "modules/sr5-marketplace/templates/documents/tests/availabilitySimple-test-dialog.html";
    }

    _testDialogListeners() {
        return [
            {
                query: '.add-modifier-row-btn',
                on: 'click',
                callback: function(event, dialog) {
                    event.preventDefault();
                    dialog.applyFormData();
                    const mods = this.data.action.modifiers || [];
                    mods.push({ label: "", value: "" });
                    this.data.action.modifiers = mods;
                    this.prepareBaseValues();
                    this.calculateBaseValues();
                    dialog.render();
                }
            },
            {
                query: '.remove-modifier-row-btn',
                on: 'click',
                callback: function(event, dialog) {
                    event.preventDefault();
                    dialog.applyFormData();
                    const index = parseInt(event.currentTarget.dataset.index, 10);
                    const mods = this.data.action.modifiers || [];
                    if (!isNaN(index) && index >= 0 && index < mods.length) {
                        mods.splice(index, 1);
                    }
                    this.data.action.modifiers = mods;
                    this.prepareBaseValues();
                    this.calculateBaseValues();
                    dialog.render();
                }
            }
        ];
    }

    static get label() {
        return "SR5Marketplace.Marketplace.Tests.AvailabilityTest";
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
        const rawActor = typeof actorRef === "string" ? await fromUuid(actorRef) : actorRef;
        const actor = rawActor instanceof Actor ? rawActor : rawActor?.actor || null;
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
        const doc = await fromUuid(actorUuid);
        const actor = doc instanceof Actor ? doc : doc?.actor || null;
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
}

Object.defineProperty(AvailabilityTest, 'name', { value: 'AvailabilityTest' });
