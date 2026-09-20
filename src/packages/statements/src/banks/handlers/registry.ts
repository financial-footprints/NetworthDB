import type { BankHandler } from "@statements/banks/handlers/base";
import { BobDefaultHandler, BobEasyHandler } from "@statements/banks/institutions/bob";
import { CsbDefaultHandler, CsbEdgeHandler } from "@statements/banks/institutions/csb";
import {
  FederalDefaultHandler,
  FederalEdgeHandler,
  FederalSignetHandler,
} from "@statements/banks/institutions/federal";
import {
  HdfcDefaultHandler,
  HdfcDinersHandler,
  HdfcRegaliaGoldHandler,
  HdfcRegaliaHandler,
  HdfcSwiggyHandler,
  HdfcTataNeuInfinityHandler,
} from "@statements/banks/institutions/hdfc";
import {
  IciciAmazonHandler,
  IciciCoralHandler,
  IciciDefaultHandler,
  IciciPlatinumHandler,
} from "@statements/banks/institutions/icici";
import { IdfcDefaultHandler, IdfcWowHandler } from "@statements/banks/institutions/idfc";
import {
  IndusindAmexEpayHandler,
  IndusindAuraedgeHandler,
  IndusindDefaultHandler,
} from "@statements/banks/institutions/indusind";
import { OnecardDefaultHandler } from "@statements/banks/institutions/onecard";
import { PnbHandler, PnbPlatinumHandler } from "@statements/banks/institutions/pnb";
import { YesAceHandler, YesDefaultHandler } from "@statements/banks/institutions/yes";
import { handlerRegistryKey, Registry } from "@statements/banks/shared/registry";

export type BankHandlerKey = {
  bank: string;
  variant: string;
};

const REGISTRY = new Registry<BankHandler>();

function register(bank: string, variant: string, handler: BankHandler): void {
  REGISTRY.register(bank, variant, handler);
}

register("onecard", "default", OnecardDefaultHandler);
register("yes", "default", YesDefaultHandler);
register("yes", "ace", YesAceHandler);
register("bob", "default", BobDefaultHandler);
register("bob", "easy", BobEasyHandler);
register("csb", "default", CsbDefaultHandler);
register("csb", "edge", CsbEdgeHandler);
register("federal", "default", FederalDefaultHandler);
register("federal", "signet", FederalSignetHandler);
register("federal", "edge", FederalEdgeHandler);
register("indusind", "default", IndusindDefaultHandler);
register("indusind", "auraedge", IndusindAuraedgeHandler);
register("indusind", "amex-epay", IndusindAmexEpayHandler);
register("idfc", "default", IdfcDefaultHandler);
register("idfc", "wow", IdfcWowHandler);
register("hdfc", "default", HdfcDefaultHandler);
register("hdfc", "regalia", HdfcRegaliaHandler);
register("hdfc", "regalia-gold", HdfcRegaliaGoldHandler);
register("hdfc", "diners-privilege", HdfcDinersHandler);
register("hdfc", "swiggy", HdfcSwiggyHandler);
register("hdfc", "tata-neu-infinity", HdfcTataNeuInfinityHandler);
register("icici", "default", IciciDefaultHandler);
register("icici", "coral", IciciCoralHandler);
register("icici", "platinum", IciciPlatinumHandler);
register("icici", "amazon", IciciAmazonHandler);
register("pnb", "default", PnbHandler);
register("pnb", "platinum", PnbPlatinumHandler);

export function listHandlers(): BankHandlerKey[] {
  return REGISTRY.keys().map((key) => {
    const [bank, variant] = key.split("/");
    return { bank: bank ?? key, variant: variant ?? "default" };
  });
}

export function getHandler(bank: string, variant?: string | null): BankHandler {
  return REGISTRY.get(bank, variant);
}

export function tryGetHandler(bank: string, variant?: string | null): BankHandler | null {
  try {
    return getHandler(bank, variant);
  } catch {
    return null;
  }
}

export function getMailSubjects(bank: string, variant?: string | null): string[] {
  return tryGetHandler(bank, variant)?.mailSubjects() ?? [];
}

export { handlerRegistryKey };
