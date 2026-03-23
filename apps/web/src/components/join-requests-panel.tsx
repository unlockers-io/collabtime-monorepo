"use client";

import { Badge, Button, ScrollArea, Spinner } from "@repo/ui";
import { Bell, Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
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

const JoinRequestsPanel = ({ teamId }: JoinRequestsPanelProps) => {
  const [requests, setRequests] = useState<Array<JoinRequest>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    const result = await getPendingJoinRequests(teamId);

    if (result.success) {
      setRequests(result.data);
    } else {
      toast.error(result.error ?? "Failed to load join requests");
    }

    setIsLoading(false);
  }, [teamId]);

  useEffect(() => {
    // oxlint-disable-next-line react-hooks-js/set-state-in-effect
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = (requestId: string) => {
    setPendingAction(requestId);
    startTransition(async () => {
      const result = await approveJoinRequest(requestId);

      if (result.success) {
        toast.success("Request approved");
        await fetchRequests();
      } else {
        toast.error(result.error ?? "Failed to approve request");
      }

      setPendingAction(null);
    });
  };

  const handleDeny = (requestId: string) => {
    setPendingAction(requestId);
    startTransition(async () => {
      const result = await denyJoinRequest(requestId);

      if (result.success) {
        toast.success("Request denied");
        await fetchRequests();
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
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-3 p-4"
        aria-expanded={isExpanded}
        aria-controls="join-requests-list"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
            <Bell className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium text-foreground">Pending Join Requests</span>
          <Badge className="border-transparent bg-amber-200 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
            {requests.length}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div id="join-requests-list" className="border-t border-amber-200 dark:border-amber-900/50">
          <ScrollArea className="max-h-64">
            <ul className="divide-y divide-amber-100 dark:divide-amber-900/30">
              {requests.map((request) => {
                const isActionPending = isPending && pendingAction === request.id;

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
                        disabled={isActionPending}
                        className="text-green-600 hover:bg-green-100 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-900/30 dark:hover:text-green-300"
                        aria-label={`Approve ${request.userName}`}
                      >
                        {isActionPending ? <Spinner /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeny(request.id)}
                        disabled={isActionPending}
                        className="text-red-600 hover:bg-red-100 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300"
                        aria-label={`Deny ${request.userName}`}
                      >
                        {isActionPending ? <Spinner /> : <X className="h-4 w-4" />}
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
