import { neon } from '@neondatabase/serverless';

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set.');
  }
  return neon(process.env.DATABASE_URL);
}

export const defaultWeights = {
  ballast: 8000,
  freshWater: 300,
  fo: 1500,
  mgo: 200,
  lubeOil: 10,
  constant: 3000,
  otherWeight: 0
};

export function seriesKey(designCapa, builderModel) {
  return `${String(designCapa || '').trim().toUpperCase()}|${String(builderModel || '').trim().toUpperCase()}`;
}
