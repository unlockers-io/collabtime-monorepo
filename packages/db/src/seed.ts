import { prisma } from "./index";

const seed = async () => {
  console.log("Seeding database...");
  // Add seed data if needed
  console.log("Database seeded successfully");
};

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
