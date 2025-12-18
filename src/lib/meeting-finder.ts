import type {
  TeamMember,
  MeetingSlot,
  MeetingFinderOptions,
  MeetingFinderResult,
  FlexMember,
  MeetingQuality,
} from "@/types";
import {
  isHourInWorkingRange,
  isHourInFlexRange,
} from "./timezones";

const HOURS_IN_DAY = 24;
const DEFAULT_MIN_DURATION = 1;
const DEFAULT_MAX_DURATION = 4;
const DEFAULT_FLEX_RANGE = 2;
const MAX_RESULTS = 5;
const MIN_ATTENDEES = 2;

type HourAnalysis = {
  hour: number;
  availableMembers: TeamMember[];
  flexingMembers: FlexMember[];
  unavailableMembers: TeamMember[];
  totalAvailable: number;
};

const analyzeHour = (
  hour: number,
  participants: TeamMember[],
  viewerTimezone: string,
  allowFlexHours: boolean,
  flexRange: number
): HourAnalysis => {
  const availableMembers: TeamMember[] = [];
  const flexingMembers: FlexMember[] = [];
  const unavailableMembers: TeamMember[] = [];

  for (const member of participants) {
    const isWorking = isHourInWorkingRange(
      hour,
      member.timezone,
      member.workingHoursStart,
      member.workingHoursEnd,
      viewerTimezone
    );

    if (isWorking) {
      availableMembers.push(member);
    } else if (allowFlexHours) {
      const flexResult = isHourInFlexRange(
        hour,
        member.timezone,
        member.workingHoursStart,
        member.workingHoursEnd,
        viewerTimezone,
        flexRange
      );

      if (flexResult.canFlex && flexResult.direction) {
        flexingMembers.push({
          member,
          direction: flexResult.direction,
          hours: flexResult.hoursNeeded,
        });
      } else {
        unavailableMembers.push(member);
      }
    } else {
      unavailableMembers.push(member);
    }
  }

  return {
    hour,
    availableMembers,
    flexingMembers,
    unavailableMembers,
    totalAvailable: availableMembers.length + flexingMembers.length,
  };
};

const calculateScore = (
  availableCount: number,
  flexingMembers: FlexMember[],
  totalParticipants: number
): number => {
  if (totalParticipants === 0) return 0;

  // Base score: percentage normally available (0-60 points)
  const normalScore = (availableCount / totalParticipants) * 60;

  // Flex score: percentage available via flex (0-30 points, reduced weight)
  const flexCount = flexingMembers.length;
  const flexScore = (flexCount / totalParticipants) * 30;

  // Bonus: everyone can attend (10 points)
  const allAvailableBonus =
    availableCount + flexCount === totalParticipants ? 10 : 0;

  // Penalty: heavy flex requirements (-3 per person flexing 2h)
  const heavyFlexPenalty = flexingMembers.filter((f) => f.hours >= 2).length * 3;

  return Math.max(0, Math.min(100, normalScore + flexScore + allAvailableBonus - heavyFlexPenalty));
};

const determineQuality = (score: number): MeetingQuality => {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
};

const findContiguousSlots = (
  hourAnalyses: HourAnalysis[],
  participants: TeamMember[],
  minDuration: number,
  maxDuration: number
): MeetingSlot[] => {
  const slots: MeetingSlot[] = [];

  for (let startHour = 0; startHour < HOURS_IN_DAY; startHour++) {
    for (let duration = minDuration; duration <= maxDuration; duration++) {
      const endHour = (startHour + duration) % HOURS_IN_DAY;

      // Get all hours in this window
      const windowHours: number[] = [];
      for (let i = 0; i < duration; i++) {
        windowHours.push((startHour + i) % HOURS_IN_DAY);
      }

      // Track flex info for members who need to flex
      const combinedFlexing = new Map<string, FlexMember>();

      for (const hour of windowHours) {
        const analysis = hourAnalyses[hour];
        for (const f of analysis.flexingMembers) {
          // Keep the worst flex requirement
          const existing = combinedFlexing.get(f.member.id);
          if (!existing || f.hours > existing.hours) {
            combinedFlexing.set(f.member.id, f);
          }
        }
      }

      // Someone is only available if they're available for ALL hours
      const firstHourAnalysis = hourAnalyses[startHour];
      const availableForAll = firstHourAnalysis.availableMembers.filter((m) =>
        windowHours.every((h) =>
          hourAnalyses[h].availableMembers.some((am) => am.id === m.id)
        )
      );

      const flexingForAll: FlexMember[] = [];
      for (const [memberId, flexMember] of combinedFlexing) {
        // Check if this person is NOT in availableForAll and CAN attend all hours (either working or flexing)
        if (!availableForAll.some((m) => m.id === memberId)) {
          const canAttendAll = windowHours.every((h) => {
            const analysis = hourAnalyses[h];
            return (
              analysis.availableMembers.some((m) => m.id === memberId) ||
              analysis.flexingMembers.some((f) => f.member.id === memberId)
            );
          });
          if (canAttendAll) {
            flexingForAll.push(flexMember);
          }
        }
      }

      // Compute unavailable from full participants list
      const availableIds = new Set(availableForAll.map((m) => m.id));
      const flexingIds = new Set(flexingForAll.map((f) => f.member.id));
      const unavailableForSlot = participants.filter(
        (m) => !availableIds.has(m.id) && !flexingIds.has(m.id)
      );

      // Only include if at least MIN_ATTENDEES can attend
      const totalCanAttend = availableForAll.length + flexingForAll.length;
      if (totalCanAttend >= MIN_ATTENDEES) {
        const score = calculateScore(
          availableForAll.length,
          flexingForAll,
          participants.length
        );

        slots.push({
          id: `${startHour}-${endHour}-${duration}`,
          startHour,
          endHour,
          duration,
          score,
          quality: determineQuality(score),
          availableMembers: availableForAll,
          flexingMembers: flexingForAll,
          unavailableMembers: unavailableForSlot,
        });
      }
    }
  }

  return slots;
};

const deduplicateSlots = (slots: MeetingSlot[]): MeetingSlot[] => {
  // Sort by score descending
  const sorted = [...slots].sort((a, b) => b.score - a.score);

  // Remove slots that are subsets of higher-ranked slots
  const result: MeetingSlot[] = [];

  for (const slot of sorted) {
    const isSubset = result.some((existing) => {
      // Check if slot is contained within existing
      if (slot.duration < existing.duration) {
        const existingHours: number[] = [];
        for (let i = 0; i < existing.duration; i++) {
          existingHours.push((existing.startHour + i) % HOURS_IN_DAY);
        }
        const slotHours: number[] = [];
        for (let i = 0; i < slot.duration; i++) {
          slotHours.push((slot.startHour + i) % HOURS_IN_DAY);
        }
        return slotHours.every((h) => existingHours.includes(h));
      }
      return false;
    });

    if (!isSubset) {
      result.push(slot);
    }
  }

  return result;
};

const findBestMeetingTimes = (
  options: MeetingFinderOptions
): MeetingFinderResult => {
  const {
    participants,
    viewerTimezone,
    minDuration = DEFAULT_MIN_DURATION,
    maxDuration = DEFAULT_MAX_DURATION,
    allowFlexHours = true,
    flexRange = DEFAULT_FLEX_RANGE,
  } = options;

  if (participants.length < MIN_ATTENDEES) {
    return {
      hasResults: false,
      slots: [],
      suggestion: "Select at least 2 participants to find meeting times",
    };
  }

  // Analyze each hour
  const hourAnalyses: HourAnalysis[] = [];
  for (let hour = 0; hour < HOURS_IN_DAY; hour++) {
    hourAnalyses.push(
      analyzeHour(hour, participants, viewerTimezone, allowFlexHours, flexRange)
    );
  }

  // Find contiguous slots
  const allSlots = findContiguousSlots(
    hourAnalyses,
    participants,
    minDuration,
    maxDuration
  );

  // Deduplicate and rank
  const rankedSlots = deduplicateSlots(allSlots).slice(0, MAX_RESULTS);

  if (rankedSlots.length === 0) {
    return {
      hasResults: false,
      slots: [],
      suggestion: allowFlexHours
        ? "No overlapping availability found. Try selecting fewer participants."
        : "No overlapping availability found. Try enabling flex hours.",
    };
  }

  return {
    hasResults: true,
    slots: rankedSlots,
  };
};

export { findBestMeetingTimes };
