export type PermissionKey =
  | "calendar.read"
  | "calendar.update"
  | "faqs.create"
  | "faqs.delete"
  | "faqs.read"
  | "faqs.update"
  | "files.delete"
  | "files.read"
  | "contents.create"
  | "contents.delete"
  | "contents.read"
  | "contents.update"
  | "roles.create"
  | "roles.delete"
  | "roles.read"
  | "roles.update"
  | "settings.update"
  | "content-categories.create"
  | "content-categories.delete"
  | "content-categories.read"
  | "content-categories.update"
  | "users.create"
  | "users.delete"
  | "users.read"
  | "users.update";

export type Role = {
  id: string;
  name: string;
  permissions: PermissionKey[];
};

export type RoleRequest = Pick<Role, "name" | "permissions">;

export type PermissionGroup = {
  name: string;
  permissions: { name: PermissionKey; title: string }[];
  title: string;
};
