import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { RootState } from "../app/store";

export type Category = { id: string; name: string; slug: string; description?: string | null; eyebrow?: string | null; title?: string | null; text?: string | null; caption?: string | null; position: number; image?: string | null; banner?: string | null; status: string; categoryTabId?: string | null; categoryTab?: { id: string; name: string; slug: string } | null; createdAt: string };

// Admin-managed lookups the storefront filter drawer renders by — see the
// /product-types, /polishes, /stones, /pearl-colours endpoints.
export type Facet = { id: string; name: string; slug: string };

// Catalogue view's tab bar (e.g. "Live Collection", "Featured Collection") —
// admin-creatable, not a fixed list. Same shape as the product facets.
export type CategoryTab = Facet;

type FacetRef = { id: string; name: string };
export type ProductAttribute = { label: string; value: string };
export type ProductVariant = { id: string; sku: string; price: number; mrp: number; status: string; inventory?: { onHand: number; reserved: number } | null };
export type Product = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  subtitle?: string | null;
  description?: string | null;
  status: string;
  badges: string[];
  pearlType?: string | null;
  pearlGrade?: string | null;
  pearlSizeMm?: number | null;
  pearlLustre?: string | null;
  setting?: string | null;
  attributes: ProductAttribute[];
  category?: { id: string; name: string; slug: string };
  type?: FacetRef | null;
  polish?: FacetRef | null;
  stone?: FacetRef | null;
  pearlColour?: FacetRef | null;
  images?: { url: string }[];
  variants: ProductVariant[];
  createdAt: string;
};

type Envelope<T> = { data: T };

// Homepage CMS — every section on the storefront homepage (plus site-wide
// chrome: header/announcement bar/footer). `content`/`settings` shapes vary
// per `type`, validated server-side against the matching Zod schema — see
// Eclat-Admin/src/homepage/section-registry.ts for the source of truth.
export type HomepageSectionType =
  | "ANNOUNCEMENT_BAR"
  | "HEADER"
  | "HERO"
  | "TRUST_STRIP"
  | "CATEGORY_NAV"
  | "HIGHLIGHTS"
  | "ECLAT_EDIT"
  | "BANNER"
  | "OCCASIONS"
  | "FEATURED_COLLECTION"
  | "CURATED_EDITS"
  | "PEARL_MOOD"
  | "SHOP_THE_LOOK"
  | "TESTIMONIALS"
  | "JOURNAL"
  | "PEARL_GUIDE"
  | "MOST_SEARCHED"
  | "NEWSLETTER"
  | "FOOTER";

export type HomepageSection = {
  id: string;
  type: HomepageSectionType;
  key: string;
  name: string;
  order: number;
  enabled: boolean;
  content: Record<string, unknown>;
  settings: Record<string, unknown> | null;
  publishedOrder: number | null;
  publishedEnabled: boolean | null;
  publishedContent: Record<string, unknown> | null;
  publishedSettings: Record<string, unknown> | null;
  publishedAt: string | null;
};

export type HomepageStatus = { isLive: boolean; publishedAt: string | null };

export const adminApi = createApi({
  reducerPath: "adminApi",
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000/admin/v1",
    prepareHeaders: (headers, { getState }) => { const token = (getState() as RootState).auth.accessToken; if (token) headers.set("authorization", `Bearer ${token}`); return headers; },
  }),
  tagTypes: ["Category", "Product", "Facet", "HomepageSection", "HomepageStatus"],
  endpoints: (builder) => ({
    login: builder.mutation<Envelope<{ accessToken: string; refreshToken: string; admin: { id: string; email: string; role: "OWNER" | "STAFF" } }>, { email: string; password: string }>({ query: (body) => ({ url: "/auth/login", method: "POST", body }) }),
    refresh: builder.mutation<Envelope<{ accessToken: string; refreshToken: string }>, { refreshToken: string }>({ query: (body) => ({ url: "/auth/refresh-token", method: "POST", body }) }),
    logout: builder.mutation<void, { refreshToken: string }>({ query: (body) => ({ url: "/auth/logout", method: "POST", body }) }),

    getCategories: builder.query<Envelope<Category[]>, void>({ query: () => "/categories", providesTags: ["Category"] }),
    createCategory: builder.mutation<Envelope<Category>, { name: string; slug?: string; description?: string; eyebrow?: string; title?: string; text?: string; caption?: string; position?: number; categoryTabId?: string }>({ query: (body) => ({ url: "/categories", method: "POST", body }), invalidatesTags: ["Category"] }),
    updateCategory: builder.mutation<Envelope<Category>, { id: string; name?: string; slug?: string; description?: string; eyebrow?: string; title?: string; text?: string; caption?: string; position?: number; categoryTabId?: string }>({ query: ({ id, ...body }) => ({ url: `/categories/${id}`, method: "PATCH", body }), invalidatesTags: ["Category"] }),
    deleteCategory: builder.mutation<void, { id: string }>({ query: ({ id }) => ({ url: `/categories/${id}`, method: "DELETE" }), invalidatesTags: ["Category"] }),

    getCategoryTabs: builder.query<Envelope<CategoryTab[]>, void>({ query: () => "/category-tabs", providesTags: ["Facet"] }),
    createCategoryTab: builder.mutation<Envelope<CategoryTab>, { name: string; slug?: string; position?: number }>({ query: (body) => ({ url: "/category-tabs", method: "POST", body }), invalidatesTags: ["Facet"] }),
    presignCategoryImage: builder.mutation<Envelope<{ uploadUrl: string; key: string; publicUrl: string; field: "image" | "banner" }>, { id: string; contentType: string; field: "image" | "banner" }>({ query: ({ id, ...body }) => ({ url: `/categories/${id}/image/presign`, method: "POST", body }) }),
    confirmCategoryImage: builder.mutation<Envelope<Category>, { id: string; key: string; field: "image" | "banner" }>({ query: ({ id, ...body }) => ({ url: `/categories/${id}/image/confirm`, method: "POST", body }), invalidatesTags: ["Category"] }),

    getProductTypes: builder.query<Envelope<Facet[]>, void>({ query: () => "/product-types", providesTags: ["Facet"] }),
    getPolishes: builder.query<Envelope<Facet[]>, void>({ query: () => "/polishes", providesTags: ["Facet"] }),
    getStones: builder.query<Envelope<Facet[]>, void>({ query: () => "/stones", providesTags: ["Facet"] }),
    getPearlColours: builder.query<Envelope<Facet[]>, void>({ query: () => "/pearl-colours", providesTags: ["Facet"] }),

    getProducts: builder.query<Envelope<Product[]>, { categoryId?: string } | void>({ query: (args) => ({ url: "/products", params: args?.categoryId ? { categoryId: args.categoryId } : undefined }), providesTags: ["Product"] }),
    createProduct: builder.mutation<
      Envelope<Product>,
      {
        categoryId: string;
        name: string;
        subtitle?: string;
        description?: string;
        pearlType?: string;
        pearlGrade?: string;
        pearlSizeMm?: number;
        pearlLustre?: string;
        setting?: string;
        attributes?: ProductAttribute[];
        typeId?: string;
        pearlColourId?: string;
        polishId?: string;
        stoneId?: string;
        badges?: string[];
        status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
      }
    >({ query: (body) => ({ url: "/products", method: "POST", body }), invalidatesTags: ["Product"] }),
    updateProduct: builder.mutation<
      Envelope<Product>,
      {
        id: string;
        categoryId?: string;
        name?: string;
        subtitle?: string;
        description?: string;
        pearlType?: string;
        pearlGrade?: string;
        pearlSizeMm?: number;
        pearlLustre?: string;
        setting?: string;
        attributes?: ProductAttribute[];
        typeId?: string;
        pearlColourId?: string;
        polishId?: string;
        stoneId?: string;
        badges?: string[];
        status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
      }
    >({ query: ({ id, ...body }) => ({ url: `/products/${id}`, method: "PATCH", body }), invalidatesTags: ["Product"] }),
    createVariant: builder.mutation<
      Envelope<ProductVariant>,
      { productId: string; sku: string; options: Record<string, string>; price: number; mrp: number; onHand?: number }
    >({ query: ({ productId, ...body }) => ({ url: `/products/${productId}/variants`, method: "POST", body }), invalidatesTags: ["Product"] }),
    updateVariant: builder.mutation<
      Envelope<ProductVariant>,
      { productId: string; variantId: string; price?: number; mrp?: number; onHand?: number }
    >({ query: ({ productId, variantId, ...body }) => ({ url: `/products/${productId}/variants/${variantId}`, method: "PATCH", body }), invalidatesTags: ["Product"] }),
    presignProductImage: builder.mutation<Envelope<{ uploadUrl: string; key: string; publicUrl: string }>, { id: string; contentType: string }>({ query: ({ id, ...body }) => ({ url: `/products/${id}/image/presign`, method: "POST", body }) }),
    confirmProductImage: builder.mutation<Envelope<{ id: string; url: string }>, { id: string; key: string; alt?: string }>({ query: ({ id, ...body }) => ({ url: `/products/${id}/image/confirm`, method: "POST", body }), invalidatesTags: ["Product"] }),

    getHomepageSections: builder.query<Envelope<HomepageSection[]>, void>({
      query: () => "/homepage/sections",
      providesTags: ["HomepageSection"],
    }),
    createHomepageSection: builder.mutation<
      Envelope<HomepageSection>,
      { type: HomepageSectionType; key?: string; name: string; enabled?: boolean; content: unknown; settings?: unknown }
    >({ query: (body) => ({ url: "/homepage/sections", method: "POST", body }), invalidatesTags: ["HomepageSection"] }),
    updateHomepageSection: builder.mutation<
      Envelope<HomepageSection>,
      { id: string; name?: string; enabled?: boolean; content?: unknown; settings?: unknown }
    >({ query: ({ id, ...body }) => ({ url: `/homepage/sections/${id}`, method: "PATCH", body }), invalidatesTags: ["HomepageSection"] }),
    deleteHomepageSection: builder.mutation<void, { id: string }>({
      query: ({ id }) => ({ url: `/homepage/sections/${id}`, method: "DELETE" }),
      invalidatesTags: ["HomepageSection"],
    }),
    duplicateHomepageSection: builder.mutation<Envelope<HomepageSection>, { id: string }>({
      query: ({ id }) => ({ url: `/homepage/sections/${id}/duplicate`, method: "POST" }),
      invalidatesTags: ["HomepageSection"],
    }),
    reorderHomepageSections: builder.mutation<Envelope<HomepageSection[]>, { ids: string[] }>({
      query: (body) => ({ url: "/homepage/sections/reorder", method: "PATCH", body }),
      invalidatesTags: ["HomepageSection"],
    }),
    getHomepageStatus: builder.query<Envelope<HomepageStatus>, void>({
      query: () => "/homepage/status",
      providesTags: ["HomepageStatus"],
    }),
    publishHomepage: builder.mutation<Envelope<HomepageStatus>, void>({
      query: () => ({ url: "/homepage/publish", method: "POST" }),
      invalidatesTags: ["HomepageStatus", "HomepageSection"],
    }),
    unpublishHomepage: builder.mutation<Envelope<HomepageStatus>, void>({
      query: () => ({ url: "/homepage/unpublish", method: "POST" }),
      invalidatesTags: ["HomepageStatus"],
    }),
    createHomepagePreviewToken: builder.mutation<Envelope<{ token: string; expiresAt: string }>, void>({
      query: () => ({ url: "/homepage/preview-token", method: "POST" }),
    }),
    presignHomepageImage: builder.mutation<
      Envelope<{ uploadUrl: string; publicUrl: string }>,
      { sectionId: string; field: string; contentType: string }
    >({ query: (body) => ({ url: "/homepage/images/presign", method: "POST", body }) }),
  }),
});
export const {
  useLoginMutation,
  useRefreshMutation,
  useLogoutMutation,
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useGetCategoryTabsQuery,
  useCreateCategoryTabMutation,
  usePresignCategoryImageMutation,
  useConfirmCategoryImageMutation,
  useGetProductTypesQuery,
  useGetPolishesQuery,
  useGetStonesQuery,
  useGetPearlColoursQuery,
  useGetProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useCreateVariantMutation,
  useUpdateVariantMutation,
  usePresignProductImageMutation,
  useConfirmProductImageMutation,
  useGetHomepageSectionsQuery,
  useCreateHomepageSectionMutation,
  useUpdateHomepageSectionMutation,
  useDeleteHomepageSectionMutation,
  useDuplicateHomepageSectionMutation,
  useReorderHomepageSectionsMutation,
  useGetHomepageStatusQuery,
  usePublishHomepageMutation,
  useUnpublishHomepageMutation,
  useCreateHomepagePreviewTokenMutation,
  usePresignHomepageImageMutation,
} = adminApi;
