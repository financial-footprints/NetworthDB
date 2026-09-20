export type ExtractAccountResult = {
  bank: string;
  downloadDir: string;
  messagesMatched: number;
  attachmentsSaved: number;
};

export type ExtractStageResult = {
  accounts: ExtractAccountResult[];
};
