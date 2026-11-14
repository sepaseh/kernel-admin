import type { Account } from "@/features/account";

export type DefaultLayoutContext = {
  clearSession: () => void;
  currentUser: Account;
  fetchCurrentUser: () => Promise<void>;
};
