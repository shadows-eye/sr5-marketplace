// basket.js
export class BasketItem extends Item {
    prepareData() {
        super.prepareData();
        if (this.type === "basket") {
            const data = this.system;
            data.contents = data.contents || [];
        }
    }

    async addItem(item) {
        const data = this.system;
        data.contents.push(item);
        await this.update({ "system.contents": data.contents });
    }
}  