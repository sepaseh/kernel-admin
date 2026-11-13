export type FileContext = "contents" | "logo";

export type StoredFile = {
  id: string;
  isUsed: boolean;
  size: number;
  url: string;
};
