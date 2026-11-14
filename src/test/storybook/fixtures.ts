import type { Account } from "@/features/account";
import type { StoredFile } from "@/features/files";
import type { PermissionGroup, Role } from "@/features/roles";
import type { ApplicationLanguage, Settings } from "@/features/settings/types";
import type { User } from "@/features/users";

export const sampleLanguages = {
  en: {
    calendar: "gregorian",
    code: "en",
    direction: "ltr",
    name: "English",
    nativeName: "English",
  },
  fa: {
    calendar: "jalali",
    code: "fa",
    direction: "rtl",
    name: "Persian",
    nativeName: "فارسی",
  },
} satisfies Record<"en" | "fa", ApplicationLanguage>;

export const sampleSettings: Settings = {
  language: { ...sampleLanguages.en, calendar: "gregory" },
  darkTheme: {
    colorBgBase: "#141414",
    colorBgContainer: "#1f1f1f",
    colorBorder: "#595959",
    colorLink: "#69b1ff",
    colorPrimary: "#1677ff",
    colorTextBase: "#ffffff",
    colorTextDescription: "#bfbfbf",
  },
  lightTheme: {
    colorBgBase: "#ffffff",
    colorBgContainer: "#ffffff",
    colorBorder: "#8c8c8c",
    colorLink: "#0958d9",
    colorPrimary: "#0958d9",
    colorTextBase: "#141414",
    colorTextDescription: "#595959",
  },
  imageSettings: {
    logo: { width: 256, height: 256, size: 1_000_000 },
    contents: { width: 1200, height: 630, size: 2_000_000 },
  },
};

const syntheticImage =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#0958d9"/><text x="600" y="330" text-anchor="middle" fill="white" font-size="48">Synthetic cover</text></svg>',
  );

export const sampleFiles: StoredFile[] = [
  { id: "file-used", url: syntheticImage, size: 2400, isUsed: true },
  { id: "file-unused", url: syntheticImage, size: 1200, isUsed: false },
];

export const sampleAccount: Account = {
  email: "admin@example.com",
  firstName: "Sample",
  id: "storybook-user",
  isSystemAdmin: true,
  lastName: "Admin",
  mobile: "09120000000",
  permissions: [
    "users.create",
    "users.delete",
    "users.update",
    "roles.create",
    "roles.delete",
    "roles.update",
  ],
  status: "active",
  username: "admin",
};

export const roles: Role[] = [
  { id: "role-admin", name: "Administrator", permissions: ["users.read"] },
  { id: "role-editor", name: "Editor", permissions: ["roles.update"] },
];

export const permissions: PermissionGroup[] = [
  {
    name: "users",
    permissions: [
      { name: "users.read", title: "View users" },
      { name: "users.update", title: "Manage users" },
    ],
    title: "Users",
  },
  {
    name: "roles",
    permissions: [
      { name: "roles.read", title: "View roles" },
      { name: "roles.update", title: "Manage roles" },
    ],
    title: "Roles",
  },
];

export const user: User = {
  email: "sara@example.com",
  firstName: "Sara",
  id: "user-1",
  isSystemAdmin: false,
  lastName: "Ahmadi",
  mobile: "09121111111",
  roles: [{ id: "role-admin", name: "Administrator" }],
  status: "active",
  username: "sara",
};

export const users: User[] = [
  user,
  {
    firstName: "Ali",
    id: "user-2",
    isSystemAdmin: true,
    lastName: "Karimi",
    mobile: "09122222222",
    roles: [],
    status: "inactive",
  },
];
