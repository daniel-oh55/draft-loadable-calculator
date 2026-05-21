import { getSql } from './_db.js';

export default async function handler(req, res) {
  try {
    const sql = getSql();
    const rows = await sql`SELECT NOW() AS now`;
    res.status(200).json({ ok: true, now: rows[0].now });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
}
