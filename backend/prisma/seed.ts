/**
 * Base inicial de alimentos (valores por 100 g, em geral porções cozidas/prontas para consumo).
 * ATENÇÃO: valores APROXIMADOS, de referência (inspirados em TACO/USDA), só para demonstrar o app.
 * Para uso real, importe a tabela TACO (Unicamp) e/ou a USDA FoodData Central completas e
 * confira os dados — os micronutrientes aqui são parciais (0 = não informado).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Seed = {
  name: string; calories: number; proteinG: number; carbsG: number; fatG: number;
  fiberG?: number; sodiumMg?: number; ironMg?: number; calciumMg?: number; vitCMg?: number;
};

const foods: Seed[] = [
  { name: 'Arroz branco cozido', calories: 128, proteinG: 2.5, carbsG: 28.1, fatG: 0.2, fiberG: 1.6 },
  { name: 'Feijão carioca cozido', calories: 76, proteinG: 4.8, carbsG: 13.6, fatG: 0.5, fiberG: 8.5, ironMg: 1.3 },
  { name: 'Peito de frango grelhado', calories: 159, proteinG: 32, carbsG: 0, fatG: 2.5 },
  { name: 'Ovo de galinha cozido', calories: 146, proteinG: 13.3, carbsG: 0.6, fatG: 9.5, sodiumMg: 124, ironMg: 1.2, calciumMg: 50 },
  { name: 'Banana prata', calories: 98, proteinG: 1.3, carbsG: 26, fatG: 0.1, fiberG: 2 },
  { name: 'Maçã com casca', calories: 56, proteinG: 0.3, carbsG: 15.2, fatG: 0, fiberG: 1.3 },
  { name: 'Laranja', calories: 37, proteinG: 1, carbsG: 8.9, fatG: 0.1, fiberG: 0.8, vitCMg: 53 },
  { name: 'Mamão papaia', calories: 40, proteinG: 0.5, carbsG: 10.4, fatG: 0.1, fiberG: 1, vitCMg: 61 },
  { name: 'Abacate', calories: 96, proteinG: 1.2, carbsG: 6, fatG: 8.4, fiberG: 6.3 },
  { name: 'Pão francês', calories: 300, proteinG: 8, carbsG: 58.6, fatG: 3.1, fiberG: 2.3 },
  { name: 'Leite integral', calories: 61, proteinG: 3.2, carbsG: 4.7, fatG: 3.3, sodiumMg: 43, calciumMg: 113 },
  { name: 'Iogurte natural', calories: 51, proteinG: 4.1, carbsG: 1.9, fatG: 3 },
  { name: 'Queijo minas frescal', calories: 264, proteinG: 17.4, carbsG: 3.2, fatG: 20.2 },
  { name: 'Aveia em flocos', calories: 394, proteinG: 13.9, carbsG: 66.6, fatG: 8.5, fiberG: 9.1, ironMg: 4.7, calciumMg: 54 },
  { name: 'Batata-doce cozida', calories: 77, proteinG: 0.6, carbsG: 18.4, fatG: 0.1, fiberG: 2.2 },
  { name: 'Mandioca cozida', calories: 125, proteinG: 0.6, carbsG: 30.1, fatG: 0.3, fiberG: 1.6 },
  { name: 'Macarrão cozido', calories: 102, proteinG: 3.4, carbsG: 19.9, fatG: 0.5, fiberG: 1.1 },
  { name: 'Carne bovina (patinho) grelhada', calories: 219, proteinG: 35.9, carbsG: 0, fatG: 7.3 },
  { name: 'Tilápia grelhada', calories: 128, proteinG: 26, carbsG: 0, fatG: 2.7 },
  { name: 'Salmão grelhado', calories: 208, proteinG: 22, carbsG: 0, fatG: 13 },
  { name: 'Brócolis cozido', calories: 25, proteinG: 2.1, carbsG: 4.4, fatG: 0.5, fiberG: 3.4, ironMg: 0.7, calciumMg: 40, vitCMg: 65 },
  { name: 'Alface', calories: 11, proteinG: 1.3, carbsG: 1.7, fatG: 0.2, fiberG: 1.8 },
  { name: 'Tomate', calories: 15, proteinG: 1.1, carbsG: 3.1, fatG: 0.2, fiberG: 1.2, vitCMg: 14 },
  { name: 'Cenoura cozida', calories: 30, proteinG: 0.8, carbsG: 6.7, fatG: 0.2, fiberG: 2.6 },
  { name: 'Azeite de oliva', calories: 884, proteinG: 0, carbsG: 0, fatG: 100 },
  { name: 'Pasta de amendoim', calories: 588, proteinG: 25, carbsG: 20, fatG: 50, fiberG: 6 },
  { name: 'Castanha-do-pará', calories: 643, proteinG: 14.5, carbsG: 15.1, fatG: 63.5, fiberG: 7.9 },
  { name: 'Tofu', calories: 76, proteinG: 8, carbsG: 1.9, fatG: 4.8, ironMg: 2.7, calciumMg: 350 },
  { name: 'Lentilha cozida', calories: 116, proteinG: 9, carbsG: 20, fatG: 0.4, fiberG: 7.9, ironMg: 3.3, calciumMg: 19 },
  { name: 'Grão-de-bico cozido', calories: 164, proteinG: 8.9, carbsG: 27.4, fatG: 2.6, fiberG: 7.6, ironMg: 2.9, calciumMg: 49 },
];

async function main() {
  const existing = await prisma.food.count({ where: { userId: null, source: 'seed' } });
  if (existing > 0) {
    console.log(`Seed já aplicado (${existing} alimentos). Nada a fazer.`);
    return;
  }
  await prisma.food.createMany({ data: foods.map((f) => ({ ...f, userId: null, source: 'seed' })) });
  console.log(`${foods.length} alimentos inseridos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
