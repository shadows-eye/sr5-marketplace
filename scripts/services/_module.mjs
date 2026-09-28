/**
 * @fileoverview Central services namespace for the SR5 Marketplace module.
 * Provides pre-instantiated service singletons (basketService, buildService, etc.)
 * and service utility classes (SearchService, AppTestFlagService, etc.).
 */

import { ActorItemServices } from './actorItemServices.mjs';
import ItemDataServicesClass from './ItemDataServices.mjs';
import { BasketService } from './basketService.mjs';
import { PurchaseService } from './purchaseService.mjs';
import { IndexService } from './IndexService.mjs';
import { BuilderStateService } from './builderStateService.mjs';
import { DeliveryTimeService } from './DeliveryTimeService.mjs';
import { DiceHelperService } from './DiceHelperService.mjs';
import { ThemeService } from './themeService.mjs';
import { SystemDataMapperService } from './SystemDataMapperService.mjs';
import { ActorSelectionService } from './ActorSelectionService.mjs';
import { FactoryFlow } from './factoryFlow.mjs';
import { BuildService } from './buildService.mjs';
import { SystemDataModel, systemDataModel } from './systemDataModel.mjs';
import { AppTestFlagService } from './AppTestFlagService.mjs';
import { SearchService } from './searchTag.mjs';
import { VehicleSearchService } from './vehicleSearchService.mjs';
import { InventoryRules } from './inventory-rules.mjs';
import { CredstickService, CREDSTICK_TYPES } from './credstickService.mjs';
import { MarketplaceSettingsService } from './MarketplaceSettingsService.mjs';
import { DialogList } from './dialogList.mjs';
import { ActorHistoryLogService } from './actorHistoryLogService.mjs';

// 1. Pre-instantiated Service Singletons (lowercase)
export const actorItemServices = new ActorItemServices();
export const itemDataServices = new ItemDataServicesClass();
export const basketService = new BasketService();
export const purchaseService = new PurchaseService();
export const indexService = new IndexService();
export const builderStateService = new BuilderStateService();
export const deliveryTimeService = new DeliveryTimeService();
export const diceHelperService = new DiceHelperService();
export const themeService = new ThemeService();
export const systemDataMapperService = new SystemDataMapperService();
export { systemDataModel };
export const factoryFlow = new FactoryFlow();
export const buildService = new BuildService();
export const actorSelectionService = new ActorSelectionService();
export const actorHistoryLogService = new ActorHistoryLogService();

// 2. Service Classes, Static Utilities & Constants (PascalCase)
/**
 * @services Folder Export 
 */
export {
    ActorItemServices,
    BasketService,
    PurchaseService,
    SystemDataMapperService,
    SystemDataModel,
    ItemDataServicesClass as ItemDataServices,
    ActorSelectionService,
    FactoryFlow,
    BuildService,
    MarketplaceSettingsService,
    AppTestFlagService,
    SearchService,
    VehicleSearchService,
    InventoryRules,
    CredstickService,
    CREDSTICK_TYPES,
    DialogList,
    ActorHistoryLogService,
    IndexService,
    BuilderStateService,
    DeliveryTimeService,
    DiceHelperService,
    ThemeService
};

/**
 * Central services namespace for the SR5 Marketplace module.
 * Provides pre-instantiated service singletons and service utility classes.
 */
export const services = {
    actorItemServices,
    itemDataServices,
    basketService,
    purchaseService,
    indexService,
    builderStateService,
    deliveryTimeService,
    diceHelperService,
    themeService,
    systemDataMapperService,
    systemDataModel,
    factoryFlow,
    buildService,
    actorSelectionService,
    actorHistoryLogService,
    ActorItemServices,
    BasketService,
    PurchaseService,
    SystemDataMapperService,
    SystemDataModel,
    ItemDataServices: ItemDataServicesClass,
    ActorSelectionService,
    FactoryFlow,
    BuildService,
    MarketplaceSettingsService,
    AppTestFlagService,
    SearchService,
    VehicleSearchService,
    InventoryRules,
    CredstickService,
    CREDSTICK_TYPES,
    DialogList,
    ActorHistoryLogService,
    IndexService,
    BuilderStateService,
    DeliveryTimeService,
    DiceHelperService,
    ThemeService
};

export default services;