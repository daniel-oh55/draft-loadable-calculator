import { getSql, defaultWeights, seriesKey } from './_db.js';

function interpolateDwt(draft, points) {
  const sorted = [...points].sort((a, b) => a.draft - b.draft);
  if (!sorted.length) throw new Error('No Draft-DWT data points are registered for this scenario and series.');
  if (sorted.length === 1) return { dwt: sorted[0].dwt, message: `${sorted[0].draft.toFixed(3)}m fixed DWT applied.` };
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (draft < min.draft || draft > max.draft) {
    throw new Error(`Draft ${draft.toFixed(3)}m is outside registered range ${min.draft.toFixed(3)}m ~ ${max.draft.toFixed(3)}m.`);
  }
  for (const p of sorted) {
    if (Math.abs(draft - p.draft) < 0.000001) return { dwt: p.dwt, message: `${p.draft.toFixed(3)}m exact DWT applied.` };
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i];
    const p2 = sorted[i + 1];
    if (draft > p1.draft && draft < p2.draft) {
      const ratio = (draft - p1.draft) / (p2.draft - p1.draft);
      const dwt = p1.dwt + ratio * (p2.dwt - p1.dwt);
      return { dwt, message: `Interpolated between ${p1.draft.toFixed(3)}m and ${p2.draft.toFixed(3)}m.` };
    }
  }
  throw new Error('Interpolation failed.');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { vessel_code, scenario_code } = body;
    if (!vessel_code || !scenario_code) throw new Error('vessel_code and scenario_code are required.');

    const sql = getSql();
    const vesselRows = await sql`SELECT * FROM vessels WHERE vessel_code = ${vessel_code} AND is_active = TRUE`;
    if (!vesselRows.length) throw new Error('Vessel not found.');
    const vessel = vesselRows[0];
    const key = seriesKey(vessel.design_capa, vessel.builder_model);

    const scenarioRows = await sql`SELECT * FROM scenarios WHERE scenario_code = ${scenario_code} AND is_active = TRUE`;
    if (!scenarioRows.length) throw new Error('Scenario not found.');
    const scenario = scenarioRows[0];

    let draft = Number(body.draft_m ?? scenario.default_draft);
    const defaultDraftRows = await sql`
      SELECT default_draft FROM scenario_series
      WHERE scenario_code = ${scenario_code}
        AND design_capa = ${vessel.design_capa}
        AND builder_model = ${vessel.builder_model}
    `;
    if ((body.draft_m === undefined || body.draft_m === null) && defaultDraftRows[0]?.default_draft !== null) {
      draft = Number(defaultDraftRows[0].default_draft);
    }

    const capRows = await sql`
      SELECT max_draft_m, reason FROM draft_caps
      WHERE scenario_code = ${scenario_code}
        AND design_capa = ${vessel.design_capa}
        AND builder_model = ${vessel.builder_model}
        AND is_active = TRUE
    `;
    let draftCapMessage = null;
    if (capRows.length && draft > Number(capRows[0].max_draft_m)) {
      draft = Number(capRows[0].max_draft_m);
      draftCapMessage = capRows[0].reason;
    }

    const pointRows = await sql`
      SELECT draft_m, dwt_mt FROM series_scenario_dwt
      WHERE scenario_code = ${scenario_code}
        AND design_capa = ${vessel.design_capa}
        AND builder_model = ${vessel.builder_model}
      ORDER BY draft_m
    `;
    const points = pointRows.map(row => ({ draft: Number(row.draft_m), dwt: Number(row.dwt_mt) }));
    const interpolated = interpolateDwt(draft, points);

    const seriesRows = await sql`
      SELECT * FROM series_master
      WHERE design_capa = ${vessel.design_capa}
        AND builder_model = ${vessel.builder_model}
    `;
    const series = seriesRows[0];
    const weights = {
      ballast: Number(body.ballast ?? series?.default_ballast ?? defaultWeights.ballast),
      fresh_water: Number(body.fresh_water ?? series?.default_fresh_water ?? defaultWeights.freshWater),
      fo: Number(body.fo ?? series?.default_fo ?? defaultWeights.fo),
      mgo: Number(body.mgo ?? series?.default_mgo ?? defaultWeights.mgo),
      lube_oil: Number(body.lube_oil ?? series?.default_lube_oil ?? defaultWeights.lubeOil),
      constant: Number(body.constant ?? series?.default_constant ?? defaultWeights.constant),
      other_weight: Number(body.other_weight ?? series?.default_other_weight ?? defaultWeights.otherWeight)
    };
    const totalNonCargo = weights.ballast + weights.fresh_water + weights.fo + weights.mgo + weights.lube_oil + weights.constant + weights.other_weight;
    const cargo = interpolated.dwt - totalNonCargo;

    res.status(200).json({
      vessel_code,
      scenario_code,
      draft_m: draft,
      scenario_dwt: interpolated.dwt,
      total_non_cargo_weight: totalNonCargo,
      cargo_loadable_weight: cargo,
      wt14: cargo / 14,
      weights,
      basis: interpolated.message,
      draft_cap_message: draftCapMessage,
      series_key: key
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
}
