import { Prisma } from "@prisma/client";

export const userSelect = {
  id: true,
  name: true,
  phone: true,
  avatar: true,
  role: true,
  deleted: true,
  deletedAt: true,
  password: true,
  createdAt: true,
  admin: {
    select: {
      superAdmin: true,
      permissions: true,
    },
  },
  company: {
    select: {
      address: true,
      max: true,
      min: true,
      supscriptionEndDate: true,
      supscriptionStartDate: true,
      deliveryPrecent: true,
      confirmOrders: true,
    },
  },
  delivery: {
    select: {
      online: true,
      worksFroms: true,
      worksTo: true,
      latitude: true,
      longitudes: true,
    },
  },
} satisfies Prisma.UserSelect;

export const userSelectReform = (
  user: Prisma.UserGetPayload<{
    select: typeof userSelect;
  }> | null,
) => {
  if (!user) {
    throw new Error("لم يتم العثور على المستخدم");
  }
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    avatar: user.avatar,
    role: user.role,
    createdAt: user.createdAt,
    permissions: user.admin?.permissions,
    address: user.company?.address,
    supscriptionEndDate: user.company?.supscriptionEndDate,
    supscriptionStartDate: user.company?.supscriptionStartDate,
    confirmOrders: user.company?.confirmOrders,
    max: user.company?.max,
    min: user.company?.min,
    deliveryPrecent: user.company?.deliveryPrecent,
    latitude: user.delivery?.latitude,
    longitudes: user.delivery?.longitudes,
    online: user.delivery?.online,
    worksFroms: user.delivery?.worksFroms,
    worksTo: user.delivery?.worksTo,
  };
};
