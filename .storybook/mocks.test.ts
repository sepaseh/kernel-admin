import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { ContentCategory } from "@/features/content-categories";
import type { Content } from "@/features/contents";
import type { Faq } from "@/features/faqs/types";
import type { StoredFile } from "@/features/files";
import type { Role } from "@/features/roles";
import type { User } from "@/features/users";
import { apiClient } from "@/shared/api";
import { defaultPageSize } from "@/shared/config";

import {
  roles,
  sampleContentCategories,
  sampleContents,
  sampleFaqs,
  sampleFiles,
  users,
} from "./fixtures";
import { assertNoUnexpectedRequests, resetStoryMocks } from "./mocks";

vi.mock("storybook/test", () => ({ mocked: vi.mocked }));
vi.mock("@/shared/api", () => ({
  apiClient: {
    del: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    upload: vi.fn(),
  },
  clearAccessToken: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));

const faqRequest = {
  question: "Created question?",
  answer: "Synthetic answer.",
};
const categoryRequest = { name: "Created category" };
const contentRequest = {
  title: "Created content",
  body: "<p>Synthetic created content.</p>",
  excerpt: "Synthetic excerpt.",
  contentCategoryId: sampleContentCategories[0].id,
  coverImageId: sampleFiles[0].id,
};
const roleRequest = { name: "Created role", permissions: ["users.read"] };
const userRequest = {
  firstName: "Created",
  lastName: "User",
  mobile: "09123334444",
  status: "active",
};
const file = new File(["Synthetic upload"], "logo.png", { type: "image/png" });

beforeEach(() => resetStoryMocks());
afterEach(assertNoUnexpectedRequests);

test("created FAQs keep independent identities through reads, updates and deletion", async () => {
  const first = await apiClient.post<Faq>("/faqs", faqRequest);
  const second = await apiClient.post<Faq>("/faqs", {
    ...faqRequest,
    question: "Second question?",
  });

  expect(first.id).not.toBe(second.id);
  await expect(apiClient.get(`/faqs/${first.id}`)).resolves.toEqual(first);
  await expect(apiClient.get(`/faqs/${second.id}`)).resolves.toEqual(second);
  await expect(
    apiClient.patch(`/faqs/${first.id}`, { answer: "Updated first answer." }),
  ).resolves.toEqual({ ...first, answer: "Updated first answer." });
  await expect(apiClient.get(`/faqs/${second.id}`)).resolves.toEqual(second);

  await apiClient.del(`/faqs/${first.id}`);
  await expect(apiClient.get("/faqs")).resolves.toEqual([
    ...sampleFaqs,
    second,
  ]);
  const third = await apiClient.post<Faq>("/faqs", faqRequest);
  expect(new Set([first.id, second.id, third.id]).size).toBe(3);
  await expect(apiClient.get(`/faqs/${third.id}`)).resolves.toEqual(third);
  await expect(apiClient.get(`/faqs/${second.id}`)).resolves.toEqual(second);
});

test("created categories keep independent identities through changes and ordering", async () => {
  const first = await apiClient.post<ContentCategory>(
    "/content-categories",
    categoryRequest,
  );
  const second = await apiClient.post<ContentCategory>("/content-categories", {
    name: "Second category",
  });

  expect(first.id).not.toBe(second.id);
  await expect(
    apiClient.get(`/content-categories/${first.id}`),
  ).resolves.toEqual(first);
  await expect(
    apiClient.patch(`/content-categories/${first.id}`, {
      name: "Updated first category",
    }),
  ).resolves.toEqual({ ...first, name: "Updated first category" });
  await expect(
    apiClient.get(`/content-categories/${second.id}`),
  ).resolves.toEqual(second);

  await apiClient.del(`/content-categories/${first.id}`);
  await expect(apiClient.get("/content-categories")).resolves.toEqual([
    ...sampleContentCategories,
    second,
  ]);
  const third = await apiClient.post<ContentCategory>(
    "/content-categories",
    categoryRequest,
  );
  expect(new Set([first.id, second.id, third.id]).size).toBe(3);
  const ids = [
    third.id,
    second.id,
    ...sampleContentCategories.map(({ id }) => id),
  ];
  await apiClient.patch("/content-categories/sort", { ids });
  const sorted = await apiClient.get<ContentCategory[]>("/content-categories");
  expect(sorted.map(({ id }) => id)).toEqual(ids);
  await expect(
    apiClient.get(`/content-categories/${second.id}`),
  ).resolves.toEqual(second);
});

test("created contents keep independent identities and linked records through changes", async () => {
  const first = await apiClient.post<Content>("/contents", contentRequest);
  const second = await apiClient.post<Content>("/contents", {
    ...contentRequest,
    title: "Second content",
  });

  expect(first.id).not.toBe(second.id);
  await expect(apiClient.get(`/contents/${first.id}`)).resolves.toEqual(first);
  await expect(apiClient.get(`/contents/${second.id}`)).resolves.toEqual(
    second,
  );
  await expect(
    apiClient.patch(`/contents/${first.id}`, {
      ...contentRequest,
      title: "Updated first content",
      contentCategoryId: sampleContentCategories[1].id,
      coverImageId: sampleFiles[1].id,
    }),
  ).resolves.toEqual({
    ...first,
    title: "Updated first content",
    contentCategory: sampleContentCategories[1],
    coverImage: sampleFiles[1],
  });
  await expect(apiClient.get(`/contents/${second.id}`)).resolves.toEqual(
    second,
  );

  await apiClient.del(`/contents/${first.id}`);
  await expect(apiClient.get("/contents")).resolves.toEqual({
    items: [...sampleContents, second],
    total: sampleContents.length + 1,
  });
  const third = await apiClient.post<Content>("/contents", contentRequest);
  expect(new Set([first.id, second.id, third.id]).size).toBe(3);
  await expect(apiClient.get(`/contents/${third.id}`)).resolves.toEqual(third);
  await expect(apiClient.get(`/contents/${second.id}`)).resolves.toEqual(
    second,
  );
});

test("content collection filters by the requested category", async () => {
  await expect(
    apiClient.get("/contents", {
      params: { content_category_id: sampleContentCategories[1].id },
    }),
  ).resolves.toEqual({ items: [sampleContents[1]], total: 1 });
});

test("content collection filters titles without case sensitivity", async () => {
  await expect(
    apiClient.get("/contents", { params: { title: "STARTED" } }),
  ).resolves.toEqual({ items: [sampleContents[0]], total: 1 });
});

test("content collection applies title and category filters together", async () => {
  await expect(
    apiClient.get("/contents", {
      params: {
        title: "Release",
        content_category_id: sampleContentCategories[0].id,
      },
    }),
  ).resolves.toEqual({ items: [], total: 0 });
});

test("content collection paginates filtered rows while preserving the filtered total", async () => {
  const created: Content[] = [];
  for (let index = 0; index <= defaultPageSize; index += 1) {
    created.push(
      await apiClient.post<Content>("/contents", {
        ...contentRequest,
        title: `Paged record ${index + 1}`,
      }),
    );
  }
  const params = {
    title: "Paged record",
    content_category_id: contentRequest.contentCategoryId,
  };

  await expect(
    apiClient.get("/contents", { params: { ...params, page: "1" } }),
  ).resolves.toEqual({
    items: created.slice(0, defaultPageSize),
    total: defaultPageSize + 1,
  });
  await expect(
    apiClient.get("/contents", { params: { ...params, page: "2" } }),
  ).resolves.toEqual({
    items: [created[defaultPageSize]],
    total: defaultPageSize + 1,
  });

  await apiClient.del(`/contents/${created[defaultPageSize].id}`);
  await expect(
    apiClient.get("/contents", { params: { ...params, page: "2" } }),
  ).resolves.toEqual({ items: [], total: defaultPageSize });
});

test("created roles keep independent identities through reads, updates and deletion", async () => {
  const first = await apiClient.post<Role>("/roles", roleRequest);
  const second = await apiClient.post<Role>("/roles", {
    ...roleRequest,
    name: "Second role",
  });

  expect(first.id).not.toBe(second.id);
  await expect(apiClient.get(`/roles/${first.id}`)).resolves.toEqual(first);
  await expect(apiClient.get(`/roles/${second.id}`)).resolves.toEqual(second);
  await expect(
    apiClient.patch(`/roles/${first.id}`, { name: "Updated first role" }),
  ).resolves.toEqual({ ...first, name: "Updated first role" });
  await expect(apiClient.get(`/roles/${second.id}`)).resolves.toEqual(second);

  await apiClient.del(`/roles/${first.id}`);
  await expect(apiClient.get("/roles")).resolves.toEqual([...roles, second]);
  const third = await apiClient.post<Role>("/roles", roleRequest);
  expect(new Set([first.id, second.id, third.id]).size).toBe(3);
  await expect(apiClient.get(`/roles/${third.id}`)).resolves.toEqual(third);
  await expect(apiClient.get(`/roles/${second.id}`)).resolves.toEqual(second);
});

test("created users keep independent identities through reads, updates and deletion", async () => {
  const first = await apiClient.post<User>("/users", userRequest);
  const second = await apiClient.post<User>("/users", {
    ...userRequest,
    firstName: "Second",
    mobile: "09125556666",
  });

  expect(first.id).not.toBe(second.id);
  await expect(apiClient.get(`/users/${first.id}`)).resolves.toEqual(first);
  await expect(apiClient.get(`/users/${second.id}`)).resolves.toEqual(second);
  await expect(
    apiClient.patch(`/users/${first.id}`, { firstName: "Updated first" }),
  ).resolves.toEqual({ ...first, firstName: "Updated first" });
  await expect(apiClient.get(`/users/${second.id}`)).resolves.toEqual(second);

  await apiClient.del(`/users/${first.id}`);
  await expect(apiClient.get("/users")).resolves.toEqual({
    items: [...users, second],
    total: users.length + 1,
  });
  const third = await apiClient.post<User>("/users", userRequest);
  expect(new Set([first.id, second.id, third.id]).size).toBe(3);
  await expect(apiClient.get(`/users/${third.id}`)).resolves.toEqual(third);
  await expect(apiClient.get(`/users/${second.id}`)).resolves.toEqual(second);
});

test.each([
  [{ mobile: "09121111111" }, [users[0]]],
  [{ first_name: "SAR" }, [users[0]]],
  [{ last_name: "KAR" }, [users[1]]],
  [{ status: "inactive" }, [users[1]]],
  [{ mobile: "09121111111", status: "inactive" }, []],
])(
  "user collection filters its items and total for %j",
  async (params, items) => {
    await expect(apiClient.get("/users", { params })).resolves.toEqual({
      items,
      total: items.length,
    });
  },
);

test("uploads never reuse an identity after another uploaded file is deleted", async () => {
  const first = await apiClient.upload<StoredFile>("/files", { file });
  const second = await apiClient.upload<StoredFile>("/files", { file });
  expect(first.id).not.toBe(second.id);

  await apiClient.del(`/files/${first.id}`);
  const third = await apiClient.upload<StoredFile>("/files", { file });
  expect(new Set([first.id, second.id, third.id]).size).toBe(3);
  await expect(apiClient.get("/files")).resolves.toEqual([
    ...sampleFiles,
    second,
    third,
  ]);

  await apiClient.del(`/files/${third.id}`);
  await expect(apiClient.get("/files")).resolves.toEqual([
    ...sampleFiles,
    second,
  ]);
});

test("reset restores seeded records and resource-local identity sequences", async () => {
  const firstCategory = await apiClient.post<ContentCategory>(
    "/content-categories",
    categoryRequest,
  );
  const firstContent = await apiClient.post<Content>(
    "/contents",
    contentRequest,
  );
  const firstFaq = await apiClient.post<Faq>("/faqs", faqRequest);
  const firstRole = await apiClient.post<Role>("/roles", roleRequest);
  const firstUser = await apiClient.post<User>("/users", userRequest);
  const firstFile = await apiClient.upload<StoredFile>("/files", { file });
  await apiClient.post("/content-categories", categoryRequest);
  await apiClient.post("/contents", contentRequest);
  await apiClient.post("/faqs", faqRequest);
  await apiClient.post("/roles", roleRequest);
  await apiClient.post("/users", userRequest);
  await apiClient.upload("/files", { file });

  resetStoryMocks();
  await expect(apiClient.get("/content-categories")).resolves.toEqual(
    sampleContentCategories,
  );
  await expect(apiClient.get("/contents")).resolves.toEqual({
    items: sampleContents,
    total: sampleContents.length,
  });
  await expect(apiClient.get("/faqs")).resolves.toEqual(sampleFaqs);
  await expect(apiClient.get("/roles")).resolves.toEqual(roles);
  await expect(apiClient.get("/users")).resolves.toEqual({
    items: users,
    total: users.length,
  });
  await expect(apiClient.get("/files")).resolves.toEqual(sampleFiles);

  const resetCategory = await apiClient.post<ContentCategory>(
    "/content-categories",
    categoryRequest,
  );
  const resetContent = await apiClient.post<Content>(
    "/contents",
    contentRequest,
  );
  const resetUser = await apiClient.post<User>("/users", userRequest);
  const resetFile = await apiClient.upload<StoredFile>("/files", { file });
  const resetRole = await apiClient.post<Role>("/roles", roleRequest);
  const resetFaq = await apiClient.post<Faq>("/faqs", faqRequest);
  expect(resetCategory.id).toBe(firstCategory.id);
  expect(resetContent.id).toBe(firstContent.id);
  expect(resetFaq.id).toBe(firstFaq.id);
  expect(resetRole.id).toBe(firstRole.id);
  expect(resetUser.id).toBe(firstUser.id);
  expect(resetFile.id).toBe(firstFile.id);
});
