import {prisma} from "@/service/db-service";
import {DtoUser, DtoUserSchema} from "@/schema/db-schema";

export async function findDtoUserByEmail(email: string): Promise<DtoUser | null> {
  const dbUser = await prisma.user.findUnique({
    where: { email },
    include: {
      accounts: true,
    },
  });

  if (!dbUser) {
    return null;
  }

  const dtoUserValidation = DtoUserSchema.safeParse(dbUser);
  if (!dtoUserValidation.success) {
    console.error(`Error validating user data: ${dtoUserValidation.error}`);
    throw new Error("Invalid user data from database");
  }

  return dtoUserValidation.data;
}
