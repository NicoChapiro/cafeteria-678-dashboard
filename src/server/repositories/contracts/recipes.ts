import type { Recipe, RecipeLine } from '@/src/domain/types';

export interface RecipeRepository {
  list(): Promise<Recipe[]>;
  getById(id: string): Promise<Recipe | null>;
  upsert(recipe: Recipe): Promise<Recipe>;
  delete(id: string): Promise<void>;
  listLines(recipeId: string): Promise<RecipeLine[]>;
  upsertLine(line: RecipeLine): Promise<RecipeLine>;
  deleteLine(id: string): Promise<void>;
}
