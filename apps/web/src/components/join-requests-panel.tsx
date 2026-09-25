"use client";

import { Button } from "@repo/ui/components/button";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Spinner } from "@repo/ui/components/spinner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  approveJoinRequest,
  denyJoinRequest,
  getPendingJoinRequests,
} from "@/lib/actions/join-requests";
import type { ActionResult } from "@/lib/actions/types";
import { queryKeys } from "@/lib/query-keys";
import { runWithCleanup } from "@/lib/run-with-cleanup";

type JoinRequestsPanelProps = {
  teamId: string;
};

type JoinRequest = {
  id: string;
  userEmail: string;
  userName: string;
};

type RowAction = "approve" | "deny" | null;

type JoinRequestRowProps = {
  onSettled: () => void;
  request: JoinRequest;
  teamId: string;
};

/**
 * Each row owns its action. A panel-level "which request is busy" slot could
 * only describe one row, so starting a second action cleared the first row's
 * spinner and re-enabled its buttons mid-flight, allowing a duplicate submit.
 */
const JoinRequestRow = ({ onSettled, request, teamId }: JoinRequestRowProps) => {
  const [action, setAction] = useState<RowAction>(null);

  const run = async (next: Exclude<RowAction, null>) => {
    setAction(next);

    const successMessage = next === "approve" ? "Request approved" : "Request denied";
    const failureMessage =
      next === "approve" ? "Failed to approve request" : "Failed to deny request";

    await runWithCleanup(
      async () => {
        try {
          const result: ActionResult<unknown> =
            next === "approve"
              ? await approveJoinRequest(teamId, request.id)
              : await denyJoinRequest(teamId, request.id);

          if (result.success) {
            toast.success(successMessage);
          } else {
            toast.error(result.error);
          }
        } catch {
          toast.error(failureMessage);
        }
      },
      () => {
        setAction(null);
        onSettled();
      },
    );
  };

  const isBusy = action !== null;

  return (
    <li aria-busy={isBusy} className="flex items-center gap-3 py-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center border border-border bg-secondary text-xs font-semibold text-secondary-foreground">
        {request.userName.charAt(0).toUpperCase()}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{request.userName}</span>
        <span className="truncate text-xs text-muted-foreground">{request.userEmail}</span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          aria-label={`Approve ${request.userName}`}
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
        throw new Error(result.error);
      }
      return result.data;
    },
    queryKey: queryKeys.joinRequests(teamId),
  });

  const invalidateRequests = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.joinRequests(teamId) });
  };

  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Spinner />
        <span className="text-sm text-muted-foreground">Loading join requests…</span>
      </div>
    );
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-border">
      <button
        aria-controls="join-requests-list"
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-3 rounded-sm py-2 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={handleToggle}
        type="button"
      >
        <div className="flex items-center gap-2.5">
          <Bell aria-hidden="true" className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Join requests</span>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {requests.length}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp aria-hidden="true" className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-border" id="join-requests-list">
          <ScrollArea className="max-h-64">
            <ul aria-live="polite" className="divide-y divide-border">
              {requests.map((request) => (
                <JoinRequestRow
                  key={request.id}
                  onSettled={invalidateRequests}
                  request={request}
                  teamId={teamId}
                />
              ))}
            </ul>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export { JoinRequestsPanel };
