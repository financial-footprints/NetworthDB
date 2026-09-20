export type JobScopeJson = {
  account_id?: string;
  financial_year?: string;
  rule_id?: string;
  group_id?: string;
};

export class JobScope {
  constructor(
    public readonly accountId: string | null,
    public readonly financialYear: string | null,
    public readonly ruleId: string | null,
    public readonly groupId: string | null
  ) {}

  static empty(): JobScope {
    return new JobScope(null, null, null, null);
  }

  static create(
    props: {
      accountId?: string | null;
      financialYear?: string | null;
      ruleId?: string | null;
      groupId?: string | null;
    } = {}
  ): JobScope {
    return new JobScope(
      props.accountId ?? null,
      props.financialYear ?? null,
      props.ruleId ?? null,
      props.groupId ?? null
    );
  }

  clone(
    overrides: Partial<{
      accountId: string | null;
      financialYear: string | null;
      ruleId: string | null;
      groupId: string | null;
    }> = {}
  ): JobScope {
    return new JobScope(
      overrides.accountId ?? this.accountId,
      overrides.financialYear ?? this.financialYear,
      overrides.ruleId ?? this.ruleId,
      overrides.groupId ?? this.groupId
    );
  }

  static toScope(data: Record<string, unknown> | null | undefined): JobScope {
    if (!data) {
      return JobScope.empty();
    }

    const accountId =
      typeof data.account_id === "string" && data.account_id.length > 0 ? data.account_id : null;
    const financialYear =
      typeof data.financial_year === "string" && data.financial_year.length > 0
        ? data.financial_year
        : null;
    const ruleId =
      typeof data.rule_id === "string" && data.rule_id.length > 0 ? data.rule_id : null;
    const groupId =
      typeof data.group_id === "string" && data.group_id.length > 0 ? data.group_id : null;

    return new JobScope(accountId, financialYear, ruleId, groupId);
  }

  toJson(): JobScopeJson {
    const result: JobScopeJson = {};
    if (this.accountId) {
      result.account_id = this.accountId;
    }
    if (this.financialYear) {
      result.financial_year = this.financialYear;
    }
    if (this.ruleId) {
      result.rule_id = this.ruleId;
    }
    if (this.groupId) {
      result.group_id = this.groupId;
    }
    return result;
  }

  toCanonicalJson(): string {
    const dict = this.toJson();
    const keys = Object.keys(dict).sort();
    const sorted: JobScopeJson = {};
    for (const key of keys) {
      const value = dict[key as keyof JobScopeJson];
      if (value !== undefined) {
        sorted[key as keyof JobScopeJson] = value;
      }
    }
    return JSON.stringify(sorted);
  }
}
