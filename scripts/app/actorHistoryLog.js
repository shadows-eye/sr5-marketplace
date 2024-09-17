import { ActorItemData } from './actorItemData.js';

export class ActorHistoryLog {

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

    static async ensureHistoryJournal(folder) {
        let journal = game.journal.find(j => j.name === "history" && j.folder?.id === folder.id);

        if (!journal) {
            journal = await JournalEntry.create({
                name: "history",
                folder: folder.id,
                pages: []
            });
            console.log("Created new journal: history in market-history folder.");
        }
        return journal;
    }

    static async createActorHistoryPages() {
        const folder = await this.ensureHistoryFolder();
        const journal = await this.ensureHistoryJournal(folder);

        for (let actor of game.actors.contents) {
            const historyFlag = actor.getFlag('sr5-marketplace', 'history');

            if (historyFlag) {
                let historyByYear = {};

                // Group history entries by year
                historyFlag.forEach(entry => {
                    const year = new Date(entry.timestamp).getFullYear();
                    if (!historyByYear[year]) {
                        historyByYear[year] = [];
                    }
                    historyByYear[year].push(entry);
                });

                const pageTitle = `History for ${actor.name}`;
                let existingPage = journal.pages.contents.find(p => p.name === pageTitle);

                if (!existingPage) {
                    // Create the content with headers for each year
                    let content = `<h1>Purchase History for ${actor.name}</h1>`;
                    
                    Object.keys(historyByYear).forEach(year => {
                        content += `<h2>${year}</h2><ul>`;
                        historyByYear[year].forEach(entry => {
                            content += `<li>${entry.name} - Cost: ${entry.calculatedCost}¥</li>`;
                        });
                        content += `</ul>`;
                    });

                    // Create the new page with the content
                    await journal.createEmbeddedDocuments("JournalEntryPage", [{
                        name: pageTitle,
                        text: {
                            content: content
                        }
                    }]);

                    console.log(`Created new journal page for actor: ${actor.name}`);
                } else {
                    console.log(`Journal page for actor: ${actor.name} already exists.`);
                }
            }
        }
    }
}

// Export the function for use in purchase-screen-app.js
export async function logActorHistory() {
    await ActorHistoryLog.createActorHistoryPages();
}