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

export class AvailabilityTest extends SuccessTest {

    constructor(data, documents, options) {
        super(data, documents, options);
    }

    _prepareData(data, options) {
        data = super._prepareData(data, options);
        data.action = data.action || DataDefaults.createData('action_roll');
        data.availabilityStr = data.availabilityStr || (options ? options.availability : "");
        data.selectedSkill = data.action.skill || 'negotiation';
        return data;
    }

    prepareBaseValues() {
        if (this.actor) {
            const skillId = this.data.selectedSkill || 'negotiation';
            const skill = this.actor.system.skills.active[skillId];
            if (!skill) {
                console.error(`Marketplace | Actor is missing the selected skill: ${skillId}`);
                return;
            }

            const charisma = this.actor.system.attributes.charisma.value;
            const modifier = this.data.action.modifier || 0;

            // Set the core test values
            this.data.threshold.base = 0; // Initial test has no threshold
            this.data.limit.base = this.actor.system.limits.social.value;
            this.data.pool.base = charisma + skill.value + modifier;

            // Populate the pool's `.mod` array for display in the dialog
            this.data.pool.mod = [];
            PartsList.AddUniquePart(this.data.pool.mod, skill.label || skillId, skill.value);
            PartsList.AddUniquePart(this.data.pool.mod, 'SR5.Attributes.Charisma.long', charisma);
            if (modifier !== 0) {
                PartsList.AddUniquePart(this.data.pool.mod, 'SR5.Labels.Action.Modifiers', modifier);
            }
        }
        
        super.prepareBaseValues();
    }
    
    get _dialogTemplate() {
        return "modules/sr5-marketplace/templates/tests/availability-test-dialog.html";
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
     * This is the TRANSLATOR. It takes simple inputs and calls the constructor correctly.
     */
    static async run(actorRef, availabilityStr = "") {
        const actor = typeof actorRef === "string" ? await fromUuid(actorRef) : actorRef;
        if (!actor) throw new Error("AvailabilityTest: actor not found");

        // Here we call `new this()` with the arguments in the correct order:
        // 1. data (empty object, will be populated by our overrides)
        // 2. documents (contains the actor)
        // 3. options (contains our custom availability string)
        const test = new this({}, { actor }, { availability: availabilityStr });
        
        return test.execute();
    }
}
