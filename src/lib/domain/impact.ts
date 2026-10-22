import { IMPACT } from "../config";

export function impactFor(quantity: number, weightKgPerUnit: number) {
  const kgSaved = round(quantity * weightKgPerUnit);
  return {
    kgSaved,
    meals: round(kgSaved / IMPACT.kgPerMeal),
    co2eKg: round(kgSaved * IMPACT.co2ePerKg),
    waterLitres: Math.round(kgSaved * IMPACT.waterLitresPerKg),
  };
}

const round = (n: number) => Math.round(n * 100) / 100;
