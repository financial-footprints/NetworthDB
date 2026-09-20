import { useAuth } from "@web/contexts/Auth/Context";
import {
  type E2eeFieldId,
  isE2eeEnabled,
  parseClientSettings,
} from "@web/utils/crypto/client-settings";

export function useE2eeFieldEnabled(field: E2eeFieldId): boolean {
  const { me } = useAuth();
  return isE2eeEnabled(parseClientSettings(me?.clientSettings ?? null), field);
}
