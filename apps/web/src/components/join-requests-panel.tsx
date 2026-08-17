"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { toast } from "@repo/ui/components/sonner";
import { Spinner } from "@repo/ui/components/spinner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { useState } from "react";

import {
  approveJoinRequest,
  denyJoinRequest,
  getPendingJoinRequests,
} from "@/lib/actions/join-requests";
import type { ActionResult } from "@/lib/actions/types";

type JoinRequestsPanelProps = {
  teamId: string;
};

type JoinRequest = {
  id: string;
  userEmail: string;
  userName: string;
};

type RowAction = "approve" | "deny" | null;

const joinRequestsQueryKey = (teamId: string) => ["join-requests", teamId] as const;

type JoinRequestRowProps = {
  onSettled: () => void;
  request: JoinRequest;
};

/**
 * Each row owns its action. A panel-level "which request is busy" slot could
 * only describe one row, so starting a second action cleared the first row's
 * spinner and re-enabled its buttons mid-flight, allowing a duplicate submit.
 */
const JoinRequestRow = ({ onSettled, request }: JoinRequestRowProps) => {
  const [action, setAction] = useState<RowAction>(null);

  const run = async (next: Exclude<RowAction, null>) => {
    setAction(next);

    const successMessage = next === "approve" ? "Request approved" : "Request denied";
    const failureMessage =
      next === "approve" ? "Failed to approve request" : "Failed to deny request";

    try {
      const result: ActionResult<unknown> =
        next === "approve"
          ? await approveJoinRequest(request.id)
          : await denyJoinRequest(request.id);

      if (result.success) {
        toast.success(successMessage);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(failureMessage);
    } finally {
      setAction(null);
      onSettled();
    }
  };

  const isBusy = action !== null;

  return (
    <li aria-busy={isBusy} className="flex items-center gap-3 px-4 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {request.userName.charAt(0).toUpperCase()}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{request.userName}</span>
        <span className="truncate text-xs text-muted-foreground">{request.userEmail}</span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          aria-label={`Approve ${request.userName}`}
          className="text-success hover:bg-success/10 hover:text-success"
          disabled={isBusy}
          onClick={() => {
            void run("approve");
          }}
          size="icon-sm"
          variant="ghost"
        >
          {action === "approve" ? <Spinner /> : <Check className="size-4" />}
        </Button>
        <Button
          aria-label={`Deny ${request.userName}`}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={isBusy}
          onClick={() => {
            void run("deny");
          }}
          size="icon-sm"
          variant="ghost"
        >
          {action === "deny" ? <Spinner /> : <X className="size-4" />}
        </Button>
      </div>
    </li>
  );
};

const JoinRequestsPanel = ({ teamId }: JoinRequestsPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryFn: async () => {
      const result = await getPendingJoinRequests(teamId);
      if (!result.success) {
        throw new Error(result.error ?? "Failed to load join requests");
      }
      return result.data;
    },
    queryKey: joinRequestsQueryKey(teamId),
  });

  const invalidateRequests = () => {
    void queryClient.invalidateQueries({ queryKey: joinRequestsQueryKey(teamId) });
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
        aria-controls="join-requests-list"
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-3 p-4"
        onClick={handleToggle}
        type="button"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-full bg-warning/20 text-warning">
            <Bell aria-hidden="true" className="size-4" />
          </div>
          <span className="text-sm font-medium text-foreground">Pending Join Requests</span>
          <Badge className="border-transparent bg-warning/30 text-warning">{requests.length}</Badge>
        </div>
        {isExpanded ? (
          <ChevronUp aria-hidden="true" className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-warning/40" id="join-requests-list">
          <ScrollArea className="max-h-64">
            <ul aria-live="polite" className="divide-y divide-warning/20">
              {requests.map((request) => (
                <JoinRequestRow key={request.id} onSettled={invalidateRequests} request={request} />
              ))}
            </ul>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export { JoinRequestsPanel };
