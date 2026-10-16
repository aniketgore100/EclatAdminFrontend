import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { RootState } from "../app/store";

export type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  position: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  _count?: { products: number };
};
export type CategoryInput = { name?: string; slug?: string; description?: string; position?: number; status?: Category["status"] };

export type ProductAttribute = { label: string; value: string };
export type ProductVariant = {
  id: string;
  sku: string;
  options: Record<string, string>;
  // Paise — the form works in rupees (see toPaise/toRupees in App.tsx).
  price: number;
  mrp: number;
  status: "ACTIVE" | "ARCHIVED";
  weightG?: number | null;
  dims?: { length: number; breadth: number; height: number } | null;
  inventory?: { onHand: number; reserved: number } | null;
};
export type ImageKind = "model" | "packshot";
export type ProductImage = { id: string; url: string; alt?: string | null; kind: ImageKind; position: number };
export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type Badge = "new" | "bestseller" | "limited";

export type Product = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  subtitle?: string | null;
  description?: string | null;
  status: ProductStatus;
  tags: string[];
  badges: Badge[];
  sortOrder: number;
  material?: string | null;
  care?: string | null;
  seoTitle?: string | null;
  seoMeta?: string | null;
  attributes: ProductAttribute[];
  category?: { id: string; name: string; slug: string };
  images: ProductImage[];
  variants: ProductVariant[];
  createdAt: string;
};

export type ProductInput = {
  categoryId?: string;
  name?: string;
  subtitle?: string;
  description?: string;
  status?: ProductStatus;
  tags?: string[];
  badges?: Badge[];
  sortOrder?: number;
  material?: string;
  care?: string;
  seoTitle?: string;
  seoMeta?: string;
  attributes?: ProductAttribute[];
};

type Envelope<T> = { data: T };

/* ----------------------------------------------------------- website builder */
// Section and chrome content is deliberately loose JSON here; the backend validates every save and the
// form schema in lib/siteSchema.ts describes the fields of each type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;
export type SiteDraft = { home: { seo: { title: string; description: string }; sections: Json[] }; chrome: Json };
export type SiteState = {
  draft: SiteDraft;
  published: SiteDraft | null;
  version: number;
  publishedAt: string | null;
  publishedBy: string | null;
  updatedBy: string | null;
  updatedAt: string;
  hasUnpublishedChanges: boolean;
};
export type SiteRevision = { id: string; publishedAt: string; publishedBy: string | null; note: string | null; isLive: boolean; sections: number };

/* ------------------------------------------------------------------ orders */
// Money in the orders API is paise, like the rest of the admin API.
export type OrderStatus = "PENDING_PAYMENT" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export type PaymentLabel = "cod" | "paid" | "refunded" | "refund_pending" | "failed" | "unpaid" | "pending";
export type DeviceType = "mobile" | "tablet" | "desktop" | "unknown";

export type OrderFilters = {
  from?: string; // YYYY-MM-DD (India time)
  to?: string;
  status?: string; // comma-separated OrderStatus
  paymentStatus?: "paid" | "pending" | "failed" | "refunded" | "cod" | "unpaid";
  method?: "online" | "cod";
  device?: DeviceType;
  shipping?: "to_ship" | "booked" | "in_transit" | "delivered";
  q?: string;
  minTotal?: number; // rupees
  maxTotal?: number;
  sort?: "newest" | "oldest" | "total_desc" | "total_asc";
  page?: number;
  limit?: number;
};

export type OrderRow = {
  number: string;
  createdAt: string;
  status: OrderStatus;
  paymentMethod: "ONLINE" | "COD";
  paymentStatus: PaymentLabel;
  total: number;
  itemsCount: number;
  firstItem: string | null;
  moreItems: number;
  customerName: string | null;
  phone: string;
  email: string;
  city: string | null;
  state: string | null;
  shippingMethod: string;
  device: { type: DeviceType; os: string | null; browser: string | null };
  shipment: { status: ShipmentStatus; awb: string | null; courierName: string | null } | null;
};

export type ShipmentStatus = "CREATED" | "AWB_ASSIGNED" | "PICKUP_SCHEDULED" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "RTO" | "CANCELLED";
export type ShipmentDetail = {
  id: string;
  status: ShipmentStatus;
  rawStatus: string | null;
  awb: string | null;
  courierName: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  etd: string | null;
  pickupScheduledAt: string | null;
  deliveredAt: string | null;
  freightCharge: number | null;
  lastError: string | null;
  weightG: number | null;
  createdAt: string;
  steps: { created: boolean; courier: boolean; pickup: boolean };
  events: { status: string; activity: string | null; location: string | null; at: string }[];
};
export type CourierOption = { id: number; name: string; rate: number | null; etaDays: number | null; etd: string | null; rating: number | null; codAvailable: boolean | null };
export type ShippingConfig = { mode: "off" | "mock" | "live"; maxStage: "create" | "awb" | "pickup"; strategy: "auto" | "cheapest" | "fastest"; pickupLocation: string | null };

export type OrderDetail = OrderRow & {
  id: string;
  subtotal: number;
  shippingFee: number;
  codFee: number;
  giftNote: string | null;
  holdExpiresAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  userAgent: string | null;
  shippingAddress: { name: string | null; line1: string | null; line2: string | null; city: string | null; state: string | null; pincode: string | null };
  customer: { id: string; name: string | null; phone: string; email: string | null; since: string };
  items: { name: string; sku: string; optionsLabel: string; quantity: number; unitPrice: number; lineTotal: number; slug: string; imageUrl: string | null }[];
  payments: { provider: string; providerOrderId: string; providerPaymentId: string | null; status: string; method: string | null; amount: number; refundedAmount: number; failureCode: string | null; failureReason: string | null; createdAt: string; capturedAt: string | null }[];
  timeline: { at: string; event: string }[];
  shippedAt: string | null;
  deliveredAt: string | null;
  shipmentDetail: ShipmentDetail | null;
  cancelledShipments: number;
};

type PeriodStats = {
  totalOrders: number;
  successfulOrders: number;
  successRate: number;
  revenue: number;
  avgOrderValue: number;
  pendingPayment: number;
  cancelled: number;
  failedPayments: number;
  online: { orders: number; revenue: number };
  cod: { orders: number; revenue: number };
};
export type OrderSummary = {
  range: { from: string; to: string; days: number };
  current: PeriodStats;
  previous: PeriodStats;
  change: { totalOrders: number | null; revenue: number | null; avgOrderValue: number | null; successfulOrders: number | null };
  readyToShip: number;
  devices: { device: DeviceType; orders: number }[];
  trend: { unit: "day" | "week"; points: { bucket: string; orders: number; revenue: number }[] };
};

export const adminBaseUrl: string = import.meta.env.VITE_API_URL ?? "http://localhost:4000/admin/v1";
// Drop empty filters so they aren't sent as ?q=&status=
export const cleanParams = <T extends Record<string, unknown>>(p: T) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== "" && v !== null));

export const adminApi = createApi({
  reducerPath: "adminApi",
  baseQuery: fetchBaseQuery({
    baseUrl: adminBaseUrl,
    prepareHeaders: (headers, { getState }) => { const token = (getState() as RootState).auth.accessToken; if (token) headers.set("authorization", `Bearer ${token}`); return headers; },
  }),
  tagTypes: ["Category", "Product", "Order", "Site"],
  endpoints: (builder) => ({
    login: builder.mutation<Envelope<{ accessToken: string; refreshToken: string; admin: { id: string; email: string; role: "OWNER" | "STAFF" } }>, { email: string; password: string }>({ query: (body) => ({ url: "/auth/login", method: "POST", body }) }),
    refresh: builder.mutation<Envelope<{ accessToken: string; refreshToken: string }>, { refreshToken: string }>({ query: (body) => ({ url: "/auth/refresh-token", method: "POST", body }) }),
    logout: builder.mutation<void, { refreshToken: string }>({ query: (body) => ({ url: "/auth/logout", method: "POST", body }) }),

    getSite: builder.query<Envelope<SiteState>, void>({ query: () => "/site", providesTags: ["Site"] }),
    saveSiteDraft: builder.mutation<Envelope<SiteState>, { version: number; draft: SiteDraft }>({ query: (body) => ({ url: "/site/draft", method: "PUT", body }), invalidatesTags: ["Site"] }),
    publishSite: builder.mutation<Envelope<SiteState>, { note?: string } | void>({ query: (body) => ({ url: "/site/publish", method: "POST", body: body ?? {} }), invalidatesTags: ["Site"] }),
    discardSite: builder.mutation<Envelope<SiteState>, void>({ query: () => ({ url: "/site/discard", method: "POST" }), invalidatesTags: ["Site"] }),
    getSiteRevisions: builder.query<Envelope<SiteRevision[]>, void>({ query: () => "/site/revisions", providesTags: ["Site"] }),
    restoreSiteRevision: builder.mutation<Envelope<SiteState>, string>({ query: (id) => ({ url: `/site/revisions/${id}/restore`, method: "POST" }), invalidatesTags: ["Site"] }),
    createSitePreview: builder.mutation<Envelope<{ token: string; expiresAt: string }>, void>({ query: () => ({ url: "/site/preview-token", method: "POST" }) }),
    presignSiteImage: builder.mutation<Envelope<{ uploadUrl: string; publicUrl: string }>, { contentType: string }>({ query: (body) => ({ url: "/site/images/presign", method: "POST", body }) }),

    getOrders: builder.query<Envelope<{ items: OrderRow[]; total: number; page: number; limit: number; pages: number }>, OrderFilters>({ query: (params) => ({ url: "/orders", params: cleanParams(params) }), providesTags: ["Order"] }),
    getOrderSummary: builder.query<Envelope<OrderSummary>, { from?: string; to?: string }>({ query: (params) => ({ url: "/orders/summary", params: cleanParams(params) }), providesTags: ["Order"] }),
    getOrder: builder.query<Envelope<OrderDetail>, string>({ query: (number) => `/orders/${number}`, providesTags: (_r, _e, number) => [{ type: "Order", id: number }] }),
    getShippingConfig: builder.query<Envelope<ShippingConfig>, void>({ query: () => "/shipping/config" }),
    getCouriers: builder.query<Envelope<{ options: CourierOption[]; strategy: string; weightKg: number }>, string>({ query: (number) => `/orders/${number}/couriers` }),
    shipOrder: builder.mutation<Envelope<{ shipment: ShipmentDetail; note: string | null }>, { number: string; courierId?: number }>({ query: ({ number, courierId }) => ({ url: `/orders/${number}/ship`, method: "POST", body: courierId ? { courierId } : {} }), invalidatesTags: ["Order"] }),
    cancelShipment: builder.mutation<Envelope<{ ok: boolean }>, string>({ query: (number) => ({ url: `/orders/${number}/shipment/cancel`, method: "POST" }), invalidatesTags: ["Order"] }),
    getShipmentLabel: builder.mutation<Envelope<{ url: string }>, string>({ query: (number) => ({ url: `/orders/${number}/shipment/label`, method: "GET" }), invalidatesTags: ["Order"] }),

    getCategories: builder.query<Envelope<Category[]>, void>({ query: () => "/categories", providesTags: ["Category"] }),

    createCategory: builder.mutation<Envelope<Category>, CategoryInput & { name: string }>({ query: (body) => ({ url: "/categories", method: "POST", body }), invalidatesTags: ["Category"] }),
    updateCategory: builder.mutation<Envelope<Category>, CategoryInput & { id: string }>({ query: ({ id, ...body }) => ({ url: `/categories/${id}`, method: "PATCH", body }), invalidatesTags: ["Category"] }),
    deleteCategory: builder.mutation<void, { id: string }>({ query: ({ id }) => ({ url: `/categories/${id}`, method: "DELETE" }), invalidatesTags: ["Category"] }),
    presignCategoryImage: builder.mutation<Envelope<{ uploadUrl: string; key: string; publicUrl: string }>, { id: string; contentType: string }>({ query: ({ id, ...body }) => ({ url: `/categories/${id}/image/presign`, method: "POST", body }) }),
    confirmCategoryImage: builder.mutation<Envelope<Category>, { id: string; key: string }>({ query: ({ id, ...body }) => ({ url: `/categories/${id}/image/confirm`, method: "POST", body }), invalidatesTags: ["Category"] }),
    removeCategoryImage: builder.mutation<Envelope<Category>, { id: string }>({ query: ({ id }) => ({ url: `/categories/${id}/image`, method: "DELETE" }), invalidatesTags: ["Category"] }),

    getProducts: builder.query<Envelope<Product[]>, void>({ query: () => "/products", providesTags: ["Product"] }),
    createProduct: builder.mutation<Envelope<Product>, ProductInput & { categoryId: string; name: string }>({ query: (body) => ({ url: "/products", method: "POST", body }), invalidatesTags: ["Product"] }),
    updateProduct: builder.mutation<Envelope<Product>, ProductInput & { id: string }>({ query: ({ id, ...body }) => ({ url: `/products/${id}`, method: "PATCH", body }), invalidatesTags: ["Product"] }),

    createVariant: builder.mutation<
      Envelope<ProductVariant>,
      { productId: string; sku: string; options: Record<string, string>; price: number; mrp: number; onHand?: number; weightG?: number; dims?: { length: number; breadth: number; height: number } }
    >({ query: ({ productId, ...body }) => ({ url: `/products/${productId}/variants`, method: "POST", body }), invalidatesTags: ["Product"] }),
    updateVariant: builder.mutation<
      Envelope<ProductVariant>,
      { productId: string; variantId: string; price?: number; mrp?: number; onHand?: number; status?: "ACTIVE" | "ARCHIVED"; weightG?: number; dims?: { length: number; breadth: number; height: number } }
    >({ query: ({ productId, variantId, ...body }) => ({ url: `/products/${productId}/variants/${variantId}`, method: "PATCH", body }), invalidatesTags: ["Product"] }),

    presignProductImage: builder.mutation<Envelope<{ uploadUrl: string; key: string; publicUrl: string }>, { id: string; contentType: string }>({ query: ({ id, ...body }) => ({ url: `/products/${id}/images/presign`, method: "POST", body }) }),
    confirmProductImage: builder.mutation<Envelope<ProductImage>, { id: string; key: string; alt?: string; kind: ImageKind }>({ query: ({ id, ...body }) => ({ url: `/products/${id}/images/confirm`, method: "POST", body }), invalidatesTags: ["Product"] }),
    updateProductImage: builder.mutation<Envelope<ProductImage>, { id: string; imageId: string; alt?: string; kind?: ImageKind }>({ query: ({ id, imageId, ...body }) => ({ url: `/products/${id}/images/${imageId}`, method: "PATCH", body }), invalidatesTags: ["Product"] }),
    deleteProductImage: builder.mutation<void, { id: string; imageId: string }>({ query: ({ id, imageId }) => ({ url: `/products/${id}/images/${imageId}`, method: "DELETE" }), invalidatesTags: ["Product"] }),
    reorderProductImages: builder.mutation<Envelope<ProductImage[]>, { id: string; imageIds: string[] }>({ query: ({ id, ...body }) => ({ url: `/products/${id}/images/order`, method: "PUT", body }), invalidatesTags: ["Product"] }),
  }),
});
export const {
  useLoginMutation,
  useRefreshMutation,
  useLogoutMutation,
  useGetSiteQuery,
  useSaveSiteDraftMutation,
  usePublishSiteMutation,
  useDiscardSiteMutation,
  useGetSiteRevisionsQuery,
  useRestoreSiteRevisionMutation,
  useCreateSitePreviewMutation,
  usePresignSiteImageMutation,
  useGetOrdersQuery,
  useGetOrderSummaryQuery,
  useGetOrderQuery,
  useGetShippingConfigQuery,
  useLazyGetCouriersQuery,
  useShipOrderMutation,
  useCancelShipmentMutation,
  useGetShipmentLabelMutation,
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  usePresignCategoryImageMutation,
  useConfirmCategoryImageMutation,
  useRemoveCategoryImageMutation,
  useGetProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useCreateVariantMutation,
  useUpdateVariantMutation,
  usePresignProductImageMutation,
  useConfirmProductImageMutation,
  useUpdateProductImageMutation,
  useDeleteProductImageMutation,
  useReorderProductImagesMutation,
} = adminApi;
