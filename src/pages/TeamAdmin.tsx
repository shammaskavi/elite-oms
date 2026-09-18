import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, UserProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserPlus,
  Shield,
  UserCheck,
  UserX,
  KeyRound,
  Mail,
  User as UserIcon,
  Crown,
  Users,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useDocumentTitle } from "@/hooks/use-document-title";

export default function TeamAdmin() {
  useDocumentTitle("Team & Staff Access");
  const { user: currentAuthUser, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<"staff" | "admin">("staff");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch all profiles
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["team-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as UserProfile[];
    },
    enabled: isAdmin,
  });

  // Toggle active status (Kill-switch)
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: isActive })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ["team-profiles"] });
      toast.success(isActive ? "Account activated" : "Account suspended. User will be logged out.");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update status");
    },
  });

  // Change role mutation
  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: "admin" | "staff" }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: (_, { newRole }) => {
      queryClient.invalidateQueries({ queryKey: ["team-profiles"] });
      toast.success(`Role updated to ${newRole === "admin" ? "Owner / Admin" : "Staff"}`);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update role");
    },
  });

  // Handle Add New Staff User
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Email and password are required");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Sign up the user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (authError) throw authError;

      const createdUserId = authData.user?.id;
      if (createdUserId) {
        // 2. Ensure profile has desired role and is active
        await supabase
          .from("profiles")
          .upsert({
            user_id: createdUserId,
            full_name: fullName.trim() || email.trim(),
            role: selectedRole,
            is_active: true,
          });
      }

      toast.success(`Staff user created successfully! Credentials: ${email}`);
      setAddDialogOpen(false);
      setFullName("");
      setEmail("");
      setPassword("");
      setSelectedRole("staff");
      queryClient.invalidateQueries({ queryKey: ["team-profiles"] });
    } catch (err: any) {
      console.error("Create staff error:", err);
      toast.error(err?.message || "Failed to create staff account");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trigger Password Reset Email
  const handleSendPasswordReset = async (userEmail: string) => {
    if (!userEmail) {
      toast.error("No email associated with this profile.");
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success(`Password reset email sent to ${userEmail}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send password reset");
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-rose-600 font-semibold">
        Access Denied. Owner/Admin access required.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Team & Staff Access</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage user accounts, roles, permissions, and staff login access.
          </p>
        </div>

        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2 shadow-xs">
              <UserPlus className="h-4 w-4" />
              Add Staff Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Team Member</DialogTitle>
              <DialogDescription>
                Create credentials for a billing, sales, or workshop team member.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateStaff} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="staff_name">Full Name</Label>
                <Input
                  id="staff_name"
                  placeholder="e.g. Rahul Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff_email">Email / Login ID</Label>
                <Input
                  id="staff_email"
                  type="email"
                  placeholder="name@sareepalaceelite.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff_password">Password (min 6 chars)</Label>
                <Input
                  id="staff_password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff_role">Role & Access Level</Label>
                <Select
                  value={selectedRole}
                  onValueChange={(val) => setSelectedRole(val as "staff" | "admin")}
                >
                  <SelectTrigger id="staff_role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">
                      👔 Staff (Invoices, Orders, Customers, Measurements)
                    </SelectItem>
                    <SelectItem value="admin">
                      👑 Owner / Admin (Full Access to Financials & Reports)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Role Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-purple-50/50 border-purple-200">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-purple-900 font-bold">
              <Crown className="h-5 w-5 text-purple-700" />
              <span>Owner / Admin Role</span>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-purple-800 space-y-1">
            <p>• Full visibility into Store Revenue, Cash Inflow, & Reports</p>
            <p>• Master Payments Ledger & Debt Settlement Write-Offs</p>
            <p>• Ability to create/suspend staff accounts & configure layouts</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50/50 border-blue-200">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-blue-900 font-bold">
              <Users className="h-5 w-5 text-blue-700" />
              <span>Staff Role (Billing & Operations)</span>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-blue-800 space-y-1">
            <p>• Create & Print Invoices, Thermal Receipts, Send WhatsApp</p>
            <p>• Manage Kanban Orders, Assign Karigars, Move Stages</p>
            <p>• Lookup Customers & enter Customer Measurements</p>
            <p>• <strong>Blocked:</strong> Financial Reports, Store Turnover, Global Ledger</p>
          </CardContent>
        </Card>
      </div>

      {/* Profiles List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-700" />
            Active Team Members ({profiles.length})
          </CardTitle>
          <CardDescription>
            Toggle the switch to instantly activate or suspend any staff member's access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading team profiles...
            </div>
          ) : profiles.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No team profiles found. Click "Add Staff Member" above to create one.
            </div>
          ) : (
            <div className="divide-y">
              {profiles.map((p) => {
                const isCurrentUser = p.user_id === currentAuthUser?.id;
                const isActive = p.is_active !== false;

                return (
                  <div
                    key={p.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                        p.role === "admin"
                          ? "bg-purple-100 text-purple-800 border border-purple-200"
                          : "bg-blue-100 text-blue-800 border border-blue-200"
                      }`}>
                        {p.full_name ? p.full_name.charAt(0).toUpperCase() : <UserIcon className="h-4 w-4" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-sm">
                            {p.full_name || "Unnamed User"}
                          </span>
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600">
                              You
                            </Badge>
                          )}
                          <Badge
                            className={`text-[10px] uppercase font-bold px-1.5 py-0 h-4 border rounded-sm ${
                              p.role === "admin"
                                ? "bg-purple-50 text-purple-700 border-purple-300"
                                : "bg-blue-50 text-blue-700 border-blue-300"
                            }`}
                          >
                            {p.role === "admin" ? "Owner / Admin" : "Staff"}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                          ID: {p.user_id}
                        </p>
                      </div>
                    </div>

                    {/* Actions & Kill Switch */}
                    <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
                      {/* Role Selector */}
                      {!isCurrentUser && (
                        <Select
                          value={p.role}
                          onValueChange={(newRole: "admin" | "staff") =>
                            changeRoleMutation.mutate({ userId: p.user_id, newRole })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      {/* Kill Switch Toggle */}
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${isActive ? "text-emerald-600" : "text-rose-600"}`}>
                          {isActive ? "Active" : "Suspended"}
                        </span>
                        <Switch
                          checked={isActive}
                          disabled={isCurrentUser}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({ userId: p.user_id, isActive: checked })
                          }
                          aria-label="Toggle user active status"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
