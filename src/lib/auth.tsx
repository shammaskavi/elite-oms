import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export type AppRole = "admin" | "staff";

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  role: AppRole;
  is_active: boolean;
  created_at?: string;
}

const OWNER_EMAILS = ["shammaskavi@gmail.com"];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: AppRole;
  isAdmin: boolean;
  isStaff: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchProfile = useCallback(async (userId: string, userEmail?: string) => {
    try {
      // 3-second safety timeout so slow queries never hang the UI
      const profilePromise = supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error("Profile timeout") }), 3000)
      );

      const { data, error } = await Promise.race([profilePromise, timeoutPromise]);

      if (!mountedRef.current) return null;

      const isOwnerEmail = userEmail && OWNER_EMAILS.includes(userEmail.toLowerCase());

      if (data) {
        const userProfile: UserProfile = {
          id: data.id,
          user_id: data.user_id,
          full_name: data.full_name,
          role: isOwnerEmail ? "admin" : ((data.role as AppRole) || "staff"),
          is_active: data.is_active !== false,
          created_at: data.created_at,
        };

        // If user is deactivated by admin, immediately sign out
        if (userProfile.is_active === false) {
          toast.error("Your account has been deactivated. Please contact the administrator.");
          await supabase.auth.signOut();
          if (mountedRef.current) {
            setUser(null);
            setSession(null);
            setProfile(null);
            navigate("/auth");
          }
          return null;
        }

        setProfile(userProfile);
        return userProfile;
      }

      // Default fallback profile
      const fallback: UserProfile = {
        id: userId,
        user_id: userId,
        full_name: null,
        role: isOwnerEmail ? "admin" : "staff",
        is_active: true,
      };
      setProfile(fallback);
      return fallback;
    } catch (err) {
      console.error("Profile fetch error:", err);
      const isOwnerEmail = userEmail && OWNER_EMAILS.includes(userEmail.toLowerCase());
      const fallback: UserProfile = {
        id: userId,
        user_id: userId,
        full_name: null,
        role: isOwnerEmail ? "admin" : "staff",
        is_active: true,
      };
      if (mountedRef.current) {
        setProfile(fallback);
      }
      return fallback;
    }
  }, [navigate]);

  // 1. Initial auth setup and session listener
  useEffect(() => {
    let isSubscribed = true;

    // Fast resolution: check local stored session first
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isSubscribed) return;
      setSession(initialSession);
      const initialUser = initialSession?.user ?? null;
      setUser(initialUser);
      setLoading(false);

      if (initialUser) {
        fetchProfile(initialUser.id, initialUser.email);
      }
    }).catch(() => {
      if (isSubscribed) setLoading(false);
    });

    // Listen to subsequent auth events (sign in, sign out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!isSubscribed) return;
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // Fire asynchronously outside the auth dispatch lock
        setTimeout(() => {
          if (isSubscribed) {
            fetchProfile(currentUser.id, currentUser.email);
          }
        }, 0);
      } else {
        setProfile(null);
      }
    });

    // Safety timeout: ensure loading is NEVER stuck for more than 2 seconds
    const safetyTimer = setTimeout(() => {
      if (isSubscribed) {
        setLoading(false);
      }
    }, 2000);

    return () => {
      isSubscribed = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // 2. Real-time listener for profile changes (kill-switch & role updates)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`profile-live-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload: any) => {
          if (payload.new && mountedRef.current) {
            const newIsActive = payload.new.is_active !== false;
            if (!newIsActive) {
              toast.error("Your account has been deactivated by the administrator.");
              await signOut();
            } else {
              setProfile((prev) => ({
                ...(prev || ({} as UserProfile)),
                ...payload.new,
                is_active: newIsActive,
                role: payload.new.role || "staff",
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, user.email);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (data?.user) {
      const userProfile = await fetchProfile(data.user.id, data.user.email);
      if (userProfile && !userProfile.is_active) {
        await supabase.auth.signOut();
        return { error: new Error("Your account has been deactivated.") };
      }
    }
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    if (mountedRef.current) {
      setUser(null);
      setSession(null);
      setProfile(null);
      navigate("/auth");
    }
  };

  const isOwner = user?.email && OWNER_EMAILS.includes(user.email.toLowerCase());
  const role: AppRole = isOwner ? "admin" : (profile?.role || "staff");
  const isAdmin = role === "admin";
  const isStaff = role === "staff";

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isAdmin,
        isStaff,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
