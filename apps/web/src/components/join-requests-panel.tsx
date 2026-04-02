"use client";

import { Badge, Button, ScrollArea, Spinner } from "@repo/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { approveJoinRequest, denyJoinRequest, getPendingJoinRequests } from "@/lib/actions";

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
      <div className="gap-2 p-4 flex items-center rounded-xl border border-border bg-card">
        <Spinner />
        <span className="text-sm text-muted-foreground">Loading join requests…</span>
      </div>
    );
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20 rounded-xl border">
      <button
        type="button"
        onClick={handleToggle}
        className="gap-3 p-4 flex w-full items-center justify-between"
        aria-expanded={isExpanded}
        aria-controls="join-requests-list"
      >
        <div className="gap-2.5 flex items-center">
          <div className="h-8 w-8 bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 flex items-center justify-center rounded-full">
            <Bell className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="text-sm font-medium text-foreground">Pending Join Requests</span>
          <Badge className="bg-amber-200 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-transparent">
            {requests.length}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {isExpanded && (
        <div id="join-requests-list" className="border-amber-200 dark:border-amber-900/50 border-t">
          <ScrollArea className="max-h-64">
            <ul className="divide-amber-100 dark:divide-amber-900/30 divide-y">
              {requests.map((request) => {
                const isThisRequest = isPending && pendingAction?.id === request.id;
                const isApproving = isThisRequest && pendingAction?.type === "approve";
                const isDenying = isThisRequest && pendingAction?.type === "deny";

                return (
                  <li key={request.id} className="gap-3 px-4 py-3 flex items-center">
                    <div className="h-9 w-9 text-sm font-semibold flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      {request.userName.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex flex-1 flex-col">
                      <span className="text-sm font-medium truncate text-foreground">
                        {request.userName}
                      </span>
                      <span className="text-xs truncate text-muted-foreground">
                        {request.userEmail}
                      </span>
                    </div>

                    <div className="gap-1.5 flex shrink-0 items-center">
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
