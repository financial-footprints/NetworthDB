import type { Source } from "@ndb/core";
import type { SourceNapi } from "../../native.d.ts";

export const source = {
  fromDomain: (source: Source): SourceNapi => {
    if (source.type === "thunderbird") {
      return {
        id: source.id,
        type: "thunderbird",
        label: source.label,
        profile: source.profile,
        host: null,
        port: null,
        username: null,
        password: null,
        folder: null,
        useSsl: null,
      };
    }

    return {
      id: source.id,
      type: "email",
      label: source.label,
      profile: null,
      host: source.host,
      port: source.port,
      username: source.username,
      password: source.password,
      folder: source.folder,
      useSsl: source.useSsl,
    };
  },
};
