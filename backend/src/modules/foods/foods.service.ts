import { AppError } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';

/** Campos de Food expostos pela API (valores por 100 g). */
export const FOOD_SELECT = {
  id: true, name: true, brand: true, source: true, userId: true,
  calories: true, proteinG: true, carbsG: true, fatG: true,
  fiberG: true, sodiumMg: true, ironMg: true, calciumMg: true, vitCMg: true,
} as const;

/**
 * Garante que TODOS os alimentos referenciados são acessíveis ao usuário:
 * da base pública (userId null) ou criados por ele. Impede que alguém referencie
 * (e assim "descubra") alimentos privados de outro usuário informando o UUID.
 */
export async function assertFoodsAccessible(userId: string, foodIds: string[]): Promise<void> {
  const unique = [...new Set(foodIds)];
  const count = await prisma.food.count({
    where: { id: { in: unique }, OR: [{ userId: null }, { userId }] },
  });
  if (count !== unique.length) throw new AppError(400, 'Alimento inválido', 'INVALID_FOOD');
}
