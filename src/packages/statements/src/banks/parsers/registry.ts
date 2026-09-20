import { BobStatementParser } from "@statements/banks/institutions/bob";
import { CsbStatementParser } from "@statements/banks/institutions/csb";
import {
  FederalDefaultParser,
  FederalEdgeParser,
  FederalSignetParser,
} from "@statements/banks/institutions/federal";
import { HdfcStatementParser } from "@statements/banks/institutions/hdfc";
import { IciciStatementParser } from "@statements/banks/institutions/icici";
import { IdfcWowStatementParser } from "@statements/banks/institutions/idfc";
import { IndusindStatementParser } from "@statements/banks/institutions/indusind";
import { OnecardStatementParser } from "@statements/banks/institutions/onecard";
import { PnbStatementParser } from "@statements/banks/institutions/pnb";
import { YesStatementParser } from "@statements/banks/institutions/yes";
import type { StatementParser } from "@statements/banks/parsers/common";
import { Registry } from "@statements/banks/shared/registry";

const REGISTRY = new Registry<StatementParser>();

function register(bank: string, variant: string | null, parser: StatementParser): void {
  REGISTRY.register(bank, variant, parser);
}

register("onecard", "default", OnecardStatementParser);
register("yes", "default", YesStatementParser);
register("yes", "ace", YesStatementParser);
register("bob", "default", BobStatementParser);
register("bob", "easy", BobStatementParser);
register("csb", "default", CsbStatementParser);
register("csb", "edge", CsbStatementParser);
register("federal", "default", FederalDefaultParser);
register("federal", "signet", FederalSignetParser);
register("federal", "edge", FederalEdgeParser);
register("indusind", "default", IndusindStatementParser);
register("indusind", "auraedge", IndusindStatementParser);
register("indusind", "amex-epay", IndusindStatementParser);
register("idfc", "default", IdfcWowStatementParser);
register("idfc", "wow", IdfcWowStatementParser);
register("hdfc", "default", HdfcStatementParser);
register("icici", "default", IciciStatementParser);
register("icici", "coral", IciciStatementParser);
register("icici", "platinum", IciciStatementParser);
register("icici", "amazon", IciciStatementParser);
register("pnb", "default", PnbStatementParser);
register("pnb", "platinum", PnbStatementParser);

export function getParser(bank: string, variant?: string | null): StatementParser {
  return REGISTRY.get(bank, variant);
}

export function listParserKeys(): string[] {
  return REGISTRY.keys();
}
