import bcrypt from "bcrypt";
import { prisma } from "../../db/client";

export const findUserByEmail = (email: string) => {
  return prisma.user.findUnique({
    where: {
      email,
    },
  });
};

export const createUserByEmailAndPassword = async (
  email: string,
  password: string
) => {
  const hashedPassword = await bcrypt.hash(password, 12);

  return prisma.user.create({
    data: {
      email,
      password: hashedPassword,
    },
  });
};

export const findUserById = (id: string) => {
  return prisma.user.findUnique({
    where: {
      id,
    },
  });
};