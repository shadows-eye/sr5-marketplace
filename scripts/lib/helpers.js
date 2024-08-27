import ItemData from '../app/itemData.js';
export const registerBasicHelpers = () => {
    Handlebars.registerHelper('hasItemType', function(type, options) {
        const itemData = new ItemData();
        if (itemData.itemsByType[type] && itemData.itemsByType[type].length > 0) {
            return options.fn(this);
        }
        return options.inverse(this);
    });

    // Add other helpers here if needed  
    Handlebars.registerHelper('for', function (from, to, options) {
            let accum = '';
            for (let i = from; i < to; i += 1) {
                accum += options.fn(i);
            }
    
            return accum;
    });   
        
    Handlebars.registerHelper('hasprop', function (obj, prop, options) {
            if (obj.hasOwnProperty(prop)) {
                return options.fn(this);
            } else return options.inverse(this);
        });
    Handlebars.registerHelper('ifin', function (val, arr, options) {
            if (arr.includes(val)) return options.fn(this);
            else return options.inverse(this);
        });
        // if greater than
    Handlebars.registerHelper('ifgt', function (v1, v2, options) {
            if (v1 > v2) return options.fn(this);
            else return options.inverse(this);
        });
        // if less than
    Handlebars.registerHelper('iflt', function (v1, v2, options) {
            if (v1 < v2) return options.fn(this);
            else return options.inverse(this);
        });
        // if less than or equal
    Handlebars.registerHelper('iflte', function (v1, v2, options) {
            if (v1 <= v2) return options.fn(this);
            else return options.inverse(this);
        });
        // if not equal
    Handlebars.registerHelper('ifne', function (v1, v2, options) {
            if (v1 !== v2) return options.fn(this);
            else return options.inverse(this);
        });
        // if equal
    Handlebars.registerHelper('ife', function (v1, v2, options) {
            if (v1 === v2) return options.fn(this);
            else return options.inverse(this);
        });
        // if then
    Handlebars.registerHelper('ift', function (v1, v2) {
            if (v1) return v2;
        });
    
    Handlebars.registerHelper('sum', function (v1, v2) {
            return v1 + v2;
        });
    Handlebars.registerHelper('range', function(from, to, options) {
        let accum = '';
        for (let i = from; i < to; i++) {
                accum += options.fn(i);
        }
            return accum;
    });
    Handlebars.registerHelper('ifeq', function(a, b, options) {
        if (a === b) {
            return options.fn(this);
        }
        return options.inverse(this);
    });
    Handlebars.registerHelper('toLowerCase', function(str) {
        return str ? str.toLowerCase() : '';
    });
    Handlebars.registerHelper('eq', function(a, b) {
        return a === b;
    });
};
