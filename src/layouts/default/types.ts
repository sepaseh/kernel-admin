import type { CurrentUser } from "@/features/account";

export type DefaultLayoutContext = {
  clearSession: () => void;
  currentUser: CurrentUser;
  fetchCurrentUser: () => Promise<void>;
};
