import { createContext, useContext, useEffect, useState, useCallback } from "react";
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

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        return null;
      }

      if (data) {
        const userProfile: UserProfile = {
          id: data.id,
          user_id: data.user_id,
          full_name: data.full_name,
          role: (data.role as AppRole) || "staff",
          is_active: data.is_active !== false,
          created_at: data.created_at,
        };

        // If user is deactivated by admin, immediately sign out
        if (userProfile.is_active === false) {
          toast.error("Your account has been deactivated. Please contact the administrator.");
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setProfile(null);
          navigate("/auth");
          return null;
        }

        setProfile(userProfile);
        return userProfile;
      }

      // Fallback: If no profile row yet, create default staff profile
      const defaultProfile: UserProfile = {
        id: userId,
        user_id: userId,
        full_name: null,
        role: "staff",
        is_active: true,
      };
      setProfile(defaultProfile);
      return defaultProfile;
    } catch (err) {
      console.error("Profile fetch error:", err);
      return null;
    }
  }, [navigate]);

  useEffect(() => {
    // 1. Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    // 2. Initial session check
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession);
      const currentUser = initialSession?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // Real-time listener for profile changes (kill-switch & role updates)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload: any) => {
          if (payload.new) {
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
  }, [user]);

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (data?.user) {
      const userProfile = await fetchProfile(data.user.id);
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
    setUser(null);
    setSession(null);
    setProfile(null);
    navigate("/auth");
  };

  const role: AppRole = profile?.role || "staff";
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
