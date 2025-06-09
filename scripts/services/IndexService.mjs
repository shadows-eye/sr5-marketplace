export class IndexService {
    /**
     * Performs a full indexing of all world and compendium items.
     * Displays a progress bar and returns an array of plain item data.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of item data.
     */
    async buildIndex() {
        const progressContainer = document.createElement("div");
        progressContainer.id = "sr5-marketplace-progress-container";
        Object.assign(progressContainer.style, {
        position: "fixed",
        top: "80px",
        left: "50%",                     // Position the left edge at the center of the screen
        transform: "translateX(-50%)",    // Translate the element left by half of its own width
        width: "1200px",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        color: "white",
        padding: "10px",
        borderRadius: "5px",
        border: "1px solid #ff6400",
        boxShadow: "0 0 10px #000",
        zIndex: "10001",
        textAlign: "center"
    });
        document.body.appendChild(progressContainer);

        const itemPacks = game.packs.filter(pack => pack.metadata.type === "Item");
        const worldItems = game.items.contents.filter(item => !item.name.includes('#[CF_tempEntity]'));
        let allItems = [...worldItems];
        let packsProcessed = 0;

        for (const pack of itemPacks) {
            const content = await pack.getDocuments();
            allItems.push(...content.filter(item => !item.name.includes('#[CF_tempEntity]')));
            packsProcessed++;
            const progress = Math.round((packsProcessed / itemPacks.length) * 100);
            progressContainer.innerHTML = `<span>Indexing: ${pack.metadata.label} (${packsProcessed}/${itemPacks.length})</span><progress value="${progress}" max="100" style="width: 100%;"></progress>`;
        }
        
        const plainItemData = allItems.map(item => {
            const data = item.toObject(); // Get the plain data object
            data.uuid = item.uuid;        // Manually add the uuid from the document getter
            return data;
        });
        
        progressContainer.remove();
        ui.notifications.info(game.i18n.localize("SR5.Marketplace.Notifications.IndexComplete"));
        console.log(`SR5 Marketplace | Indexed ${plainItemData.length} items for the session.`);
        
        return plainItemData;
    }
}