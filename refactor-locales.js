import fs from 'fs';
import path from 'path';

const SEARCH_DIRS = [
    path.join(process.cwd(), 'templates'),
    path.join(process.cwd(), 'scripts')
];

const KEY_MAP = {
    // UI Generics & Titles
    "SR5Marketplace.PurchaseScreen": "SR5Marketplace.Marketplace.Title",
    "SR5Marketplace.Name": "SR5Marketplace.UI.Name",
    "SR5Marketplace.Rating": "SR5Marketplace.UI.Rating",
    "SR5Marketplace.Cost": "SR5Marketplace.UI.Cost",
    "SR5Marketplace.Availability": "SR5Marketplace.UI.Availability",
    "SR5Marketplace.Karma": "SR5Marketplace.UI.Karma",
    "SR5Marketplace.BaseItem": "SR5Marketplace.UI.BaseItem",
    "SR5Marketplace.Properties": "SR5Marketplace.UI.Properties",
    "SR5Marketplace.Slot": "SR5Marketplace.UI.Slot",
    "SR5Marketplace.LimitPhysical": "SR5Marketplace.UI.LimitPhysical",
    "SR5Marketplace.LimitMental": "SR5Marketplace.UI.LimitMental",
    "SR5Marketplace.SpecialAttributes": "SR5Marketplace.UI.SpecialAttributes",
    "SR5Marketplace.ActiveSkills": "SR5Marketplace.UI.ActiveSkills",
    "SR5Marketplace.Languages": "SR5Marketplace.UI.Languages",
    "SR5Marketplace.Roll": "SR5Marketplace.UI.Roll",

    // Basket & Shop Mappings
    "SR5Marketplace.Marketplace.Basket.Quantity": "SR5Marketplace.UI.Quantity",
    "SR5Marketplace.Marketplace.Basket.Rating": "SR5Marketplace.UI.Rating",
    "SR5Marketplace.Marketplace.Basket.Remove": "SR5Marketplace.UI.Remove",
    "SR5Marketplace.Marketplace.Slots": "SR5Marketplace.UI.Slots",
    "SR5Marketplace.Marketplace.MountPoint": "SR5Marketplace.UI.MountPoint",
    "SR5Marketplace.Marketplace.AddToCart": "SR5Marketplace.Marketplace.Basket.AddToCart",
    "SR5Marketplace.Marketplace.AddToBuilder": "SR5Marketplace.ItemBuilder.AddToBuilder",
    "SR5Marketplace.Marketplace.Items": "SR5Marketplace.Marketplace.OrderReview.YourItems",
    "SR5Marketplace.ItemBuilder.SearchPlaceholder": "SR5Marketplace.UI.SearchPlaceholder",

    // Contacts & Actor Mappings
    "SR5Marketplace.Marketplace.selectAnActor": "SR5Marketplace.Marketplace.Actor.SelectAnActor",
    "SR5Marketplace.Marketplace.selectActorTooltip": "SR5Marketplace.Marketplace.Actor.SelectActorTooltip",
    "SR5Marketplace.Marketplace.SelectContactTooltip": "SR5Marketplace.Marketplace.Contacts.SelectContactTooltip",
    "SR5Marketplace.Marketplace.ToggleDetailsTooltip": "SR5Marketplace.Marketplace.Contacts.ToggleDetailsTooltip",
    "SR5Marketplace.Marketplace.Loyalty": "SR5Marketplace.Marketplace.Contacts.Loyalty",
    "SR5Marketplace.Marketplace.Connection": "SR5Marketplace.Marketplace.Contacts.Connection",

    // Core Tabs
    "Shop": "SR5Marketplace.Marketplace.Tabs.Shop",
    "SR5Marketplace.Marketplace.Tab.Shop": "SR5Marketplace.Marketplace.Tabs.Shop",
    "SR5Marketplace.Marketplace.Tab.OrderReview": "SR5Marketplace.Marketplace.Tabs.OrderReview"
};

function getFiles(dir, extensions) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        if (fs.statSync(file).isDirectory()) results = results.concat(getFiles(file, extensions));
        else if (extensions.some(ext => file.endsWith(ext))) results.push(file);
    });
    return results;
}

function runRefactor() {
    console.log('🛠️  Starting V2 Codebase Refactoring...\n');
    const files = SEARCH_DIRS.flatMap(dir => getFiles(dir, ['.html', '.hbs', '.js', '.mjs']));
    let totalReplacements = 0;

    files.forEach(file => {
        let content = fs.readFileSync(file, 'utf8');
        let fileChanged = false;

        for (const [oldKey, newKey] of Object.entries(KEY_MAP)) {
            // Extremely safe regex: Only matches the exact string inside ' or "
            const regex = new RegExp(`(['"])${oldKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(['"])`, 'g');
            const newContent = content.replace(regex, `$1${newKey}$2`);
            
            if (content !== newContent) {
                totalReplacements += content.match(regex).length;
                fileChanged = true;
                content = newContent;
            }
        }
        if (fileChanged) fs.writeFileSync(file, content, 'utf8');
    });

    console.log(`✅ Refactoring Complete! Made ${totalReplacements} total localization replacements.`);
}
runRefactor();