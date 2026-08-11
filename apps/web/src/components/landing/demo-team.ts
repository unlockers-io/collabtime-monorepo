import type { TeamGroup, TeamMember } from "@/types";

const PRODUCT_GROUP_ID = "demo-group-product";
const ENGINEERING_GROUP_ID = "demo-group-engineering";

const DEMO_GROUPS: Array<TeamGroup> = [
  { id: PRODUCT_GROUP_ID, name: "Product", order: 0 },
  { id: ENGINEERING_GROUP_ID, name: "Engineering", order: 1 },
];

const DEMO_MEMBERS: Array<TeamMember> = [
  {
    groupId: PRODUCT_GROUP_ID,
    id: "demo-member-riley",
    name: "Riley Alves",
    order: 0,
    timezone: "America/Los_Angeles",
    title: "Design Lead",
    workingHoursEnd: 16,
    workingHoursStart: 8,
  },
  {
    groupId: PRODUCT_GROUP_ID,
    id: "demo-member-avery",
    name: "Avery Nakamura",
    order: 1,
    timezone: "America/New_York",
    title: "Product Manager",
    workingHoursEnd: 17,
    workingHoursStart: 9,
  },
  {
    groupId: ENGINEERING_GROUP_ID,
    id: "demo-member-jordan",
    name: "Jordan Okafor",
    order: 2,
    timezone: "Europe/Lisbon",
    title: "Staff Engineer",
    workingHoursEnd: 19,
    workingHoursStart: 11,
  },
  {
    groupId: ENGINEERING_GROUP_ID,
    id: "demo-member-sasha",
    name: "Sasha Weber",
    order: 3,
    timezone: "Europe/Berlin",
    title: "Backend Engineer",
    workingHoursEnd: 20,
    workingHoursStart: 12,
  },
  {
    groupId: ENGINEERING_GROUP_ID,
    id: "demo-member-rowan",
    name: "Rowan Lim",
    order: 4,
    timezone: "Asia/Singapore",
    title: "Mobile Engineer",
    workingHoursEnd: 15,
    workingHoursStart: 7,
  },
];

export { DEMO_GROUPS, DEMO_MEMBERS };
