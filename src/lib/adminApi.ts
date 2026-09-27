import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { RootState } from "../app/store";

export type Category = { id: string; name: string; slug: string; description?: string | null; position: number; image?: string | null; banner?: string | null; status: string; createdAt: string };
export type Product = { id: string; categoryId: string; name: string; slug: string; subtitle?: string | null; description?: string | null; status: string; pearlGrade?: string | null; pearlSizeMm?: number | null; setting?: string | null; category?: { id: string; name: string; slug: string }; images?: { url: string }[]; createdAt: string };
type Envelope<T> = { data: T };
export const adminApi = createApi({
  reducerPath: "adminApi",
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000/admin/v1",
    prepareHeaders: (headers, { getState }) => { const token = (getState() as RootState).auth.accessToken; if (token) headers.set("authorization", `Bearer ${token}`); return headers; },
  }),
  tagTypes: ["Category", "Product"],
  endpoints: (builder) => ({
    login: builder.mutation<Envelope<{ accessToken: string; refreshToken: string; admin: { id: string; email: string; role: "OWNER" | "STAFF" } }>, { email: string; password: string }>({ query: (body) => ({ url: "/auth/login", method: "POST", body }) }),
    refresh: builder.mutation<Envelope<{ accessToken: string; refreshToken: string }>, { refreshToken: string }>({ query: (body) => ({ url: "/auth/refresh-token", method: "POST", body }) }),
    logout: builder.mutation<void, { refreshToken: string }>({ query: (body) => ({ url: "/auth/logout", method: "POST", body }) }),
    getCategories: builder.query<Envelope<Category[]>, void>({ query: () => "/categories", providesTags: ["Category"] }),
    createCategory: builder.mutation<Envelope<Category>, { name: string; slug?: string; description?: string; position?: number }>({ query: (body) => ({ url: "/categories", method: "POST", body }), invalidatesTags: ["Category"] }),
    deleteCategory: builder.mutation<void, { id: string }>({ query: ({ id }) => ({ url: `/categories/${id}`, method: "DELETE" }), invalidatesTags: ["Category"] }),
    presignCategoryImage: builder.mutation<Envelope<{ uploadUrl: string; key: string; publicUrl: string; field: "image" | "banner" }>, { id: string; contentType: string; type: "image" | "banner" }>({ query: ({ id, ...body }) => ({ url: `/categories/${id}/image/presign`, method: "POST", body }) }),
    confirmCategoryImage: builder.mutation<Envelope<Category>, { id: string; key: string; type: "image" | "banner" }>({ query: ({ id, ...body }) => ({ url: `/categories/${id}/image/confirm`, method: "POST", body }), invalidatesTags: ["Category"] }),
    getProducts: builder.query<Envelope<Product[]>, { categoryId?: string } | void>({ query: (args) => ({ url: "/products", params: args?.categoryId ? { categoryId: args.categoryId } : undefined }), providesTags: ["Product"] }),
    createProduct: builder.mutation<Envelope<Product>, { categoryId: string; name: string; subtitle?: string; description?: string; pearlGrade?: string; pearlSizeMm?: number; setting?: string }>({ query: (body) => ({ url: "/products", method: "POST", body }), invalidatesTags: ["Product"] }),
    presignProductImage: builder.mutation<Envelope<{ uploadUrl: string; key: string; publicUrl: string }>, { id: string; contentType: string }>({ query: ({ id, ...body }) => ({ url: `/products/${id}/image/presign`, method: "POST", body }) }),
    confirmProductImage: builder.mutation<Envelope<{ id: string; url: string }>, { id: string; key: string; alt?: string }>({ query: ({ id, ...body }) => ({ url: `/products/${id}/image/confirm`, method: "POST", body }), invalidatesTags: ["Product"] }),
  }),
});
export const {
  useLoginMutation,
  useRefreshMutation,
  useLogoutMutation,
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  usePresignCategoryImageMutation,
  useConfirmCategoryImageMutation,
  useGetProductsQuery,
  useCreateProductMutation,
  usePresignProductImageMutation,
  useConfirmProductImageMutation,
} = adminApi;
