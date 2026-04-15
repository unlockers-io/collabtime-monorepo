"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Spinner } from "@repo/ui/components/spinner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  approveJoinRequest,
  denyJoinRequest,
  getPendingJoinRequests,
} from "@/lib/actions/join-requests";

type JoinRequest = {
  createdAt: Date;
  id: string;
  userEmail: string;
  userId: string;
  userName: string;
};

type JoinRequestsPanelProps = {
  teamId: string;
};

const joinRequestsQueryKey = (teamId: string) => ["join-requests", teamId] as const;

const JoinRequestsPanel = ({ teamId }: JoinRequestsPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    type: "approve" | "deny";
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: joinRequestsQueryKey(teamId),
    queryFn: async () => {
      const result = await getPendingJoinRequests(teamId);
      if (!result.success) {
        throw new Error(result.error ?? "Failed to load join requests");
      }
      return result.data as Array<JoinRequest>;
    },
  });

  const invalidateRequests = () => {
    queryClient.invalidateQueries({ queryKey: joinRequestsQueryKey(teamId) });
  };

  const handleApprove = (requestId: string) => {
    setPendingAction({ id: requestId, type: "approve" });
    startTransition(async () => {
      const result = await approveJoinRequest(requestId);

      if (result.success) {
        toast.success("Request approved");
        invalidateRequests();
      } else {
        toast.error(result.error ?? "Failed to approve request");
      }

      setPendingAction(null);
    });
  };

  const handleDeny = (requestId: string) => {
    setPendingAction({ id: requestId, type: "deny" });
    startTransition(async () => {
      const result = await denyJoinRequest(requestId);

      if (result.success) {
        toast.success("Request denied");
        invalidateRequests();
      } else {
        toast.error(result.error ?? "Failed to deny request");
      }

      setPendingAction(null);
    });
  };

  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-4">
        <Spinner />
        <span className="text-sm text-muted-foreground">Loading join requests…</span>
      </div>
    );
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-warning/40 bg-warning/10">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-3 p-4"
        aria-expanded={isExpanded}
        aria-controls="join-requests-list"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/20 text-warning">
            <Bell className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="text-sm font-medium text-foreground">Pending Join Requests</span>
          <Badge className="border-transparent bg-warning/30 text-warning">{requests.length}</Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {isExpanded && (
        <div id="join-requests-list" className="border-t border-warning/40">
          <ScrollArea className="max-h-64">
            <ul className="divide-y divide-warning/20">
              {requests.map((request) => {
                const isThisRequest = isPending && pendingAction?.id === request.id;
                const isApproving = isThisRequest && pendingAction?.type === "approve";
                const isDenying = isThisRequest && pendingAction?.type === "deny";

                return (
                  <li key={request.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {request.userName.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {request.userName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {request.userEmail}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleApprove(request.id)}
                        disabled={isThisRequest}
                        className="text-green-600 hover:bg-green-100 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-900/30 dark:hover:text-green-300"
                        aria-label={`Approve ${request.userName}`}
                      >
                        {isApproving ? <Spinner /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeny(request.id)}
                        disabled={isThisRequest}
                        className="text-red-600 hover:bg-red-100 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300"
                        aria-label={`Deny ${request.userName}`}
                      >
                        {isDenying ? <Spinner /> : <X className="h-4 w-4" />}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export { JoinRequestsPanel };
