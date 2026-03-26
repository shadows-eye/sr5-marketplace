import { ActorItemServices } from './actorItemServices.mjs';
// 1. Rename the imported class to avoid naming collisions
import ItemDataServicesClass from './ItemDataServices.mjs'; 
import { BasketService } from './basketService.mjs';
import { PurchaseService } from './purchaseService.mjs';
import { IndexService } from './IndexService.mjs';
import { BuilderStateService } from './builderStateService.mjs';
import { DeliveryTimeService } from './DeliveryTimeService.mjs';
import { DiceHelperService } from './DiceHelperService.mjs';
import { ThemeService } from './themeService.mjs';
import { SystemDataMapperService } from './SystemDataMapperService.mjs';

// 2. Instantiate and Export the Singletons (Use lowercase for instances!)
export const actorItemServices = new ActorItemServices();
export const itemDataServices = new ItemDataServicesClass(); // Lowercase instance
export const basketService = new BasketService();
export const purchaseService = new PurchaseService();
export const indexService = new IndexService();
export const builderStateService = new BuilderStateService();
export const deliveryTimeService = new DeliveryTimeService();
export const diceHelperService = new DiceHelperService();
export const themeService = new ThemeService();
export const systemDataMapperService = new SystemDataMapperService();

// 3. Re-export classes (Export the class under its original name)
export { 
 ActorItemServices, 
 BasketService, 
 PurchaseService, 
 SystemDataMapperService,
 ItemDataServicesClass as ItemDataServices // Aliased back so marketHooks.js can use `new ItemDataServices()`
};