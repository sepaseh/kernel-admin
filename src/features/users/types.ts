import type { Role } from "@/features/roles";
import type { PaginationQuery } from "@/shared/api";

import type { userStatuses } from "./constants";

export type User = {
  firstName: string;
  id: string;
  isSystemAdmin: boolean;
  lastName: string;
  mobile: string;
  roles: Array<Pick<Role, "id" | "name">>;
  status: (typeof userStatuses)[number];
};

export type UserPasswordRequest = {
  password: string;
};

export type UserQuery = PaginationQuery &
  Partial<Pick<User, "firstName" | "lastName" | "mobile" | "status">>;

export type UserRequest = Pick<
  User,
  "firstName" | "lastName" | "mobile" | "status"
>;

export type UserRoleRequest = {
  roleIds: Array<Role["id"]>;
};

export type UserStatusRequest = Pick<User, "status">;

export type UserSystemAdminRequest = Pick<User, "isSystemAdmin">;
