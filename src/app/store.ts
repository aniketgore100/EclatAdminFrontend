import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/auth/authSlice";
import { adminApi } from "../lib/adminApi";

export const store = configureStore({
  reducer: { auth: authReducer, [adminApi.reducerPath]: adminApi.reducer },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(adminApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
