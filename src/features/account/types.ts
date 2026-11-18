import type { PermissionKey } from "@/features/roles";
import type { User } from "@/features/users";

export type CurrentUser = Omit<User, "roles"> & {
  permissions: PermissionKey[];
};

export type ProfileRequest = Partial<Pick<User, "firstName" | "lastName">>;
