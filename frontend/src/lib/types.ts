export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
export type Sex = 'MALE' | 'FEMALE';
export type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE';
export type Goal = 'LOSE' | 'MAINTAIN' | 'GAIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

export interface Session {
  accessToken: string;
  user: User;
}

export interface Nutrients {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
  ironMg: number;
  calciumMg: number;
  vitCMg: number;
}

export interface Targets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface Food extends Nutrients {
  id: string;
  name: string;
  brand: string | null;
  source: string;
  userId: string | null;
}

export interface MealItem {
  id: string;
  foodId: string;
  foodName: string;
  grams: number;
  nutrients: Nutrients;
}

export interface Meal {
  id: string;
  type: MealType;
  eatenAt: string;
  notes: string | null;
  items: MealItem[];
  totals: Nutrients;
}

export interface Favorite {
  id: string;
  name: string;
  type: MealType;
  items: MealItem[];
  totals: Nutrients;
}

export interface DashboardData {
  target: Targets | null;
  consumed: Nutrients;
  remaining: Targets | null;
  percent: { calories: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null };
  meals: Meal[];
}

export interface Profile {
  birthDate: string;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
}

export interface ProfileBundle {
  profile: Profile | null;
  target: Targets | null;
  estimate: { age: number; bmr: number; tdee: number; suggested: Targets & { bmr: number; tdee: number } } | null;
}

export interface Suggestions {
  remaining: Targets;
  message?: string;
  favorites: { id: string; name: string; type: MealType; totals: Nutrients }[];
  foods: { foodId: string; name: string; grams: number; calories: number; proteinG: number }[];
}

export interface DayPoint {
  date: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  meals: number;
}

export interface ProgressData {
  days: DayPoint[];
  daysLogged: number;
  averages: Targets;
  target: Targets | null;
}

export interface WeightLog {
  id: string;
  weightKg: number;
  loggedAt: string;
}

export const MEAL_LABEL: Record<MealType, string> = {
  BREAKFAST: 'Café da manhã',
  LUNCH: 'Almoço',
  DINNER: 'Jantar',
  SNACK: 'Lanche',
};
