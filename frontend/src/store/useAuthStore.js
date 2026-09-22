import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const BASE_URL =
  import.meta.env.MODE === "development"
    ? (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/api$/, "")
    : window.location.origin;

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isCheckingAuth: true,
  isSigningUp: false,
  isLoggingIn: false,
  socket: null,
  onlineUsers: [],

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      get().connectSocket();
    } catch {
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });

      toast.success("Account created successfully!");
      get().connectSocket();
    } catch (error) {
      toast.error(
  error.response?.data?.message ||
  error.message ||
  "Something went wrong"
);
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });

      toast.success("Logged in successfully");

      get().connectSocket();
    } catch (error) {
      toast.error(
  error.response?.data?.message ||
  error.message ||
  "Something went wrong"
);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch {
      toast.error("Error logging out");
    }
  },

  updateProfile: async (data) => {
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      return res.data;
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Something went wrong"
      );
      return null;
    }
  },

  /** Permanently delete the authenticated user's account (with backend auth). */
  deleteAccount: async () => {
    try {
      await axiosInstance.delete("/auth/delete-account");
      set({ authUser: null });
      get().disconnectSocket();
      toast.success("Account deleted");
      return true;
    } catch (error) {
      toast.error(
  error.response?.data?.message ||
  error.message ||
  "Something went wrong"
);
      return false;
    }
  },

  /** Refresh the authenticated user from the backend (single source of truth). */
  refreshUser: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      get().connectSocket();
      return res.data;
    } catch {
      return null;
    }
  },

  /**
   * Start a REAL checkout for Vyntra Pro. This hits the backend subscription
   * flow and NEVER fakes a payment. If a payment gateway is configured it
   * returns a redirect/checkout id; otherwise the backend honestly reports the
   * integration point that still needs wiring.
   */
  createCheckout: async (billingCycle) => {
    try {
      const res = await axiosInstance.post("/subscriptions/checkout", { billingCycle });
      return res.data;
    } catch (error) {
      return {
        error: true,
        message: error.response?.data?.message || error.message || "Couldn't start checkout.",
        status: error.response?.data?.status,
        integrationPoint: error.response?.data?.integrationPoint,
        gateway: error.response?.data?.gateway,
      };
    }
  },

  /**
   * Confirm a completed checkout (the point the payment gateway/webhook calls
   * after charging). The backend marks the subscription active, then we refresh
   * the authenticated user so Pro unlocks automatically.
   */
  confirmSubscription: async (payload) => {
    try {
      const res = await axiosInstance.post("/subscriptions/confirm", payload);
      if (res.data?.user) set({ authUser: res.data.user });
      return res.data;
    } catch (error) {
      return {
        error: true,
        message: error.response?.data?.message || error.message || "Couldn't confirm subscription.",
      };
    }
  },

  /** Cancel an active Vyntra Pro subscription (Manage Pro). */
  cancelSubscription: async () => {
    try {
      const res = await axiosInstance.post("/subscriptions/cancel");
      if (res.data?.user) set({ authUser: res.data.user });
      return res.data;
    } catch (error) {
      return {
        error: true,
        message: error.response?.data?.message || error.message || "Couldn't cancel subscription.",
      };
    }
  },

  /** Live backend check of the current subscription state (on refresh/login). */
  fetchSubscription: async () => {
    try {
      const res = await axiosInstance.get("/subscriptions/me");
      return res.data;
    } catch {
      return null;
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser) return;

    const existing = get().socket;
    if (existing && !existing.connected) {
      existing.disconnect();
    }
    if (existing?.connected) return;

    const socket = io(BASE_URL, {
      withCredentials: true,
    });

    socket.connect();

    set({ socket });

    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });

    // Realtime subscription upgrade — keep UI in sync if plan changes server-side.
    socket.on("userUpgraded", (data) => {
      set((state) => ({
        authUser: state.authUser
          ? { ...state.authUser, ...data }
          : state.authUser,
      }));
    });
  },

  disconnectSocket: () => {
    const sock = get().socket;
    if (sock) {
      sock.off("getOnlineUsers");
      sock.off("userUpgraded");
      sock.disconnect();
    }
    set({ socket: null, onlineUsers: [] });
  },
}));
