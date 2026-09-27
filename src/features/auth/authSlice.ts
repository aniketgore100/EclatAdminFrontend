import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type Admin = { id: string; email: string; role: "OWNER" | "STAFF" };
type AuthState = { accessToken: string | null; refreshToken: string | null; admin: Admin | null };
const saved = localStorage.getItem("eclat-admin-session");
const initialState: AuthState = saved ? JSON.parse(saved) : { accessToken: null, refreshToken: null, admin: null };
const persist = (state: AuthState) => localStorage.setItem("eclat-admin-session", JSON.stringify(state));

const authSlice = createSlice({
  name: "auth", initialState,
  reducers: {
    setSession(state, action: PayloadAction<AuthState>) { Object.assign(state, action.payload); persist(state); },
    clearSession(state) { state.accessToken = null; state.refreshToken = null; state.admin = null; localStorage.removeItem("eclat-admin-session"); },
  },
});
export const { setSession, clearSession } = authSlice.actions;
export default authSlice.reducer;
