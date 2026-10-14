import { nutrientsForPortion, sumNutrients, type FoodPer100g, type Nutrients } from './calc.js';

interface ItemWithFood {
  id: string;
  foodId: string;
  grams: number;
  food: FoodPer100g & { name: string };
}

export function formatItems(items: ItemWithFood[]) {
  const out = items.map((i) => ({
    id: i.id,
    foodId: i.foodId,
    foodName: i.food.name,
    grams: i.grams,
    nutrients: nutrientsForPortion(i.food, i.grams),
  }));
  return { items: out, totals: sumNutrients(out.map((i) => i.nutrients)) as Nutrients };
}

export function formatMeal(m: {
  id: string;
  type: string;
  eatenAt: Date;
  notes: string | null;
  items: ItemWithFood[];
}) {
  const { items, totals } = formatItems(m.items);
  return { id: m.id, type: m.type, eatenAt: m.eatenAt.toISOString(), notes: m.notes, items, totals };
}
