"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminUsersResponse, AdminUser } from "@/lib/validations";
import { apiFetch } from "@/lib/api-fetch";

function statusVariant(status: string) {
  switch (status) {
    case "approved":
      return "default" as const;
    case "pending":
      return "secondary" as const;
    case "rejected":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function UserRow({ user }: { user: AdminUser }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: { status?: string; role?: string }) => {
      const res = await apiFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to update user");
      }
    },
    onSuccess: () => {
      toast.success("User updated");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <TableRow>
      <td className="p-3">{user.name}</td>
      <td className="p-3 text-muted-foreground">{user.email}</td>
      <td className="p-3">
        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
          {user.role}
        </Badge>
      </td>
      <td className="p-3">
        <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
      </td>
      <td className="p-3 text-muted-foreground">
        {new Date(user.createdAt).toLocaleDateString()}
      </td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          {user.role === "admin" ? null : (
            <>
              {user.status === "pending" && (
                <>
                  <Button
                    size="sm"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ status: "approved" })}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ status: "rejected" })}
                  >
                    Reject
                  </Button>
                </>
              )}
              {user.status === "approved" && (
                <>
                  <Select
                    value={user.role}
                    onValueChange={(role) => mutation.mutate({ role })}
                    disabled={mutation.isPending}
                  >
                    <SelectTrigger size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ status: "rejected" })}
                  >
                    Reject
                  </Button>
                </>
              )}
              {user.status === "rejected" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ status: "approved" })}
                >
                  Approve
                </Button>
              )}
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </>
          )}
        </div>
      </td>
    </TableRow>
  );
}

export function UserTable() {
  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return (await res.json()) as AdminUsersResponse;
    },
  });

  return (
    <div className="space-y-4">
      {usersQuery.isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {usersQuery.isError && (
        <div className="flex justify-center py-12 text-destructive">
          <p>Failed to load users</p>
        </div>
      )}

      {usersQuery.isSuccess && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQuery.data.users.length === 0 ? (
              <TableRow>
                <td
                  colSpan={6}
                  className="p-8 text-center text-muted-foreground"
                >
                  No users found
                </td>
              </TableRow>
            ) : (
              usersQuery.data.users.map((user) => (
                <UserRow key={user.id} user={user} />
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
