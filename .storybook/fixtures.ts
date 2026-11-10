import type { CurrentUser } from "@/features/account";
import type { Settings } from "@/features/settings";
import type { PermissionGroup, Role } from "@/features/roles";
import type { User } from "@/features/users";
import type { ContentCategory } from "@/features/content-categories";
import type { StoredFile } from "@/features/files";

export const sampleUser: CurrentUser = {
  id: "user-1",
  firstName: "Ada",
  lastName: "Lovelace",
  mobile: "09120000000",
  status: "active",
  isSystemAdmin: true,
  permissions: [],
};

export const sampleSettings: Settings = {
  language: {
    code: "en",
    name: "English",
    nativeName: "English",
    direction: "ltr",
    calendar: "gregory",
  },
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

export const sampleFaqs = [
  {
    id: "faq-1",
    question: "How do I update a record?",
    answer: "Open the edit form, make your changes and submit.",
  },
  {
    id: "faq-2",
    question: "Can I keep my preferred appearance?",
    answer: "Theme and compact mode stay in this browser.",
  },
];

export const sampleRoles: Role[] = [
  {
    id: "role-admin",
    name: "Administrator",
    permissions: ["users.read", "users.update"],
  },
  { id: "role-editor", name: "Editor", permissions: ["users.read"] },
];

export const samplePermissions: PermissionGroup[] = [
  {
    name: "users",
    title: "User management",
    permissions: [
      { name: "users.read", title: "View users" },
      { name: "users.update", title: "Manage users" },
    ],
  },
];

export const sampleUsers: User[] = [
  {
    ...sampleUser,
    roles: [{ id: sampleRoles[0].id, name: sampleRoles[0].name }],
  },
  {
    id: "user-2",
    firstName: "Grace",
    lastName: "Hopper",
    mobile: "09121111111",
    status: "inactive",
    isSystemAdmin: false,
    roles: [{ id: sampleRoles[1].id, name: sampleRoles[1].name }],
  },
];

export const sampleLanguages: Settings["language"][] = [
  sampleSettings.language,
  {
    code: "fa",
    name: "Persian",
    nativeName: "فارسی",
    direction: "rtl",
    calendar: "jalali",
  },
];

export const sampleContentCategories: ContentCategory[] = [
  { id: "category-1", name: "Documentation" },
  { id: "category-2", name: "News" },
];

const syntheticImage =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#0958d9"/><text x="600" y="330" text-anchor="middle" fill="white" font-size="48">Synthetic cover</text></svg>',
  );

export const sampleFiles: StoredFile[] = [
  { id: "file-used", url: syntheticImage, size: 2400, isUsed: true },
  { id: "file-unused", url: syntheticImage, size: 1200, isUsed: false },
];
