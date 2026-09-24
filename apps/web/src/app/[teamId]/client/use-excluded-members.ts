"use client";

import { useSearchParams } from "next/navigation";

const PARAM = "without";

/**
 * People left out of the best window live in `?without=` so a filtered view
 * survives a reload and can be shared. history.replaceState keeps Next's
 * search params in sync without a navigation or refetch.
 */
const setExcludedMemberIds = (memberIds: Array<string>) => {
  const url = new URL(window.location.href);
  if (memberIds.length === 0) {
    url.searchParams.delete(PARAM);
  } else {
    url.searchParams.set(PARAM, memberIds.join(","));
  }
  window.history.replaceState(null, "", url);
};

const useExcludedMembers = () => {
  const searchParams = useSearchParams();
  const raw = searchParams.get(PARAM) ?? "";
  const excludedMemberIds = raw === "" ? [] : raw.split(",").filter((id) => id !== "");

  return { excludedMemberIds, setExcludedMemberIds };
};

export { useExcludedMembers };
