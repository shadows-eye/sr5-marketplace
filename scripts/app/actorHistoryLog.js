import { ActorItemData } from './actorItemData.js';
export class ActorHistoryLog {
    // Ensure the 'market-history' folder exists
    static async ensureHistoryFolder() {
        let folder = game.folders.find(f => f.name === "market-history" && f.type === "JournalEntry");

        if (!folder) {
            folder = await Folder.create({
                name: "market-history",
                type: "JournalEntry",
                parent: null,
                sorting: "a"
            });
            console.log("Created new folder: market-history");
        }
        return folder;
    }

    // Ensure the 'history' journal exists inside the 'market-history' folder
    static async ensureHistoryJournal(folder) {
        let journal = game.journal.find(j => j.name === "history" && j.folder?.id === folder.id);

        if (!journal) {
            journal = await JournalEntry.create({
                name: "{{localize 'SR5.Marketplace.history'}}",
                folder: folder.id,
                pages: []
            });
            console.log("Created new journal: history in market-history folder.");
        }
        return journal;
    }
    /**
     * Provide the actor object to update the actors purchase history journal page
     * @param {object} actor 
     */
    static async createActorHistoryPagesForActor(actor) {
        const folder = await this.ensureHistoryFolder();
        const journal = await this.ensureHistoryJournal(folder);
    
        let historyFlag = actor.getFlag('sr5-marketplace', 'history');
    
        // Ensure historyFlag is an array
        if (!Array.isArray(historyFlag)) {
            console.warn("History flag is not an array. Converting...");
            if (typeof historyFlag === 'object' && historyFlag !== null) {
                historyFlag = Object.keys(historyFlag).map(key => historyFlag[key]);
            } else {
                historyFlag = [];
            }
        }
    
        if (historyFlag.length > 0) {
            let historyByYear = {};
    
            // Group history entries by year
            historyFlag.forEach(entry => {
                const year = new Date(entry.timestamp).getFullYear();
                if (!historyByYear[year]) {
                    historyByYear[year] = [];
                }
                historyByYear[year].push(entry);
            });
    
            const pageTitle = `${actor.name}`;
            let existingPage = journal.pages.contents.find(p => p.name === pageTitle);
    
            const historyData = {
                actorName: actor.name,
                historyEntries: historyFlag
            };
    
            // Render the Handlebars template
            const rawContent = await renderTemplate('modules/sr5-marketplace/templates/historyJournal.hbs', historyData);
            console.log(historyData)
            // Use TextEditor.enrichHTML to enrich @UUID links and make them clickable
            const enrichedContent = await TextEditor.enrichHTML(rawContent, { 
                secrets: false, 
                entities: true, 
                links: true 
            });
    
            if (!existingPage) {
                await journal.createEmbeddedDocuments("JournalEntryPage", [{
                    name: pageTitle,
                    text: {
                        content: enrichedContent  // Use enriched HTML
                    }
                }]);
    
                console.log(`Created new journal page for actor: ${actor.name}`);
            } else {
                await existingPage.update({
                    text: {
                        content: enrichedContent  // Update with enriched HTML
                    }
                });
    
                console.log(`Updated journal page for actor: ${actor.name}`);
            }
        } else {
            console.log(`No purchase history for actor: ${actor.name}`);
        }
    }
}

// Export the function for use in purchase-screen-app.js
export async function logActorHistory(actor = null) {
    if (actor) {
        // Log history for a specific actor
        await ActorHistoryLog.createActorHistoryPagesForActor(actor);
    } else {
        // Log history for all actors (on module load)
        await ActorHistoryLog.createActorHistoryPages();
    }
}