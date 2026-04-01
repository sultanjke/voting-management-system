import { prisma } from "../lib/prisma";
import { normalizePhone } from "../lib/phone";

function parseTargetPhones(input: string): string[] {
  return [
    ...new Set(
      input
        .split(/[\s,;]+/)
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => normalizePhone(value))
        .filter(Boolean)
    )
  ];
}

async function main() {
  const rawTargets = process.env.RESIDENT_CLEANUP_PHONES ?? "";
  const targetPhones = parseTargetPhones(rawTargets);

  if (targetPhones.length === 0) {
    console.error("RESIDENT_CLEANUP_PHONES is empty.");
    console.error("Example: RESIDENT_CLEANUP_PHONES=\"+77771234561,+77771234562\" npm run prisma:cleanup:residents");
    process.exit(1);
  }

  const residents = await prisma.resident.findMany({
    where: {
      phoneNormalized: {
        in: targetPhones
      }
    },
    include: {
      house: {
        select: {
          code: true
        }
      },
      _count: {
        select: {
          votes: true
        }
      }
    }
  });

  if (residents.length === 0) {
    console.log("No matching residents found.");
    return;
  }

  console.log("Matched residents:");
  for (const resident of residents) {
    console.log(
      `- id=${resident.id} phone=${resident.phoneNormalized} house=${resident.house.code} votes=${resident._count.votes} status=${resident.status}`
    );
  }

  if (process.env.RESIDENT_CLEANUP_CONFIRM !== "DELETE") {
    console.log("");
    console.log("Dry run only. No rows deleted.");
    console.log("Set RESIDENT_CLEANUP_CONFIRM=DELETE to execute.");
    return;
  }

  const residentIds = residents.map((resident) => resident.id);

  const result = await prisma.$transaction(async (tx) => {
    const deletedVotes = await tx.vote.deleteMany({
      where: {
        residentId: {
          in: residentIds
        }
      }
    });

    const deletedResidents = await tx.resident.deleteMany({
      where: {
        id: {
          in: residentIds
        }
      }
    });

    return {
      deletedVotes: deletedVotes.count,
      deletedResidents: deletedResidents.count
    };
  });

  console.log("");
  console.log(`Deleted residents: ${result.deletedResidents}`);
  console.log(`Deleted votes: ${result.deletedVotes}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
