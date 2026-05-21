import { getSql, defaultWeights, seriesKey } from './_db.js';

export default async function handler(req, res) {
  try {
    const sql = getSql();

    const vesselRows = await sql`
      SELECT v.vessel_code, v.vessel_name, v.design_capa, v.builder_model, v.design_teu, v.homo14
      FROM vessels v
      WHERE v.is_active = TRUE
        AND EXISTS (
          SELECT 1
          FROM series_scenario_dwt d
          WHERE d.design_capa = v.design_capa
            AND d.builder_model = v.builder_model
        )
      ORDER BY NULLIF(regexp_replace(v.design_capa, '[^0-9]', '', 'g'), '')::INT DESC NULLS LAST,
               v.builder_model,
               v.vessel_name
    `;

    const scenarioRows = await sql`
      SELECT scenario_code, scenario_name, port_code, water_density, default_draft,
             is_fixed_draft, data_note, data_pending_message, display_order
      FROM scenarios
      WHERE is_active = TRUE
      ORDER BY display_order, scenario_code
    `;

    const scenarioSeriesRows = await sql`
      SELECT scenario_code, design_capa, builder_model, default_draft
      FROM scenario_series
      ORDER BY scenario_code, design_capa, builder_model
    `;

    const dwtRows = await sql`
      SELECT design_capa, builder_model, scenario_code, draft_m, dwt_mt
      FROM series_scenario_dwt
      ORDER BY scenario_code, design_capa, builder_model, draft_m
    `;

    const seriesRows = await sql`
      SELECT design_capa, builder_model, default_ballast, default_fresh_water,
             default_fo, default_mgo, default_lube_oil, default_constant, default_other_weight
      FROM series_master
      ORDER BY design_capa, builder_model
    `;

    const capRows = await sql`
      SELECT design_capa, builder_model, scenario_code, max_draft_m, reason
      FROM draft_caps
      WHERE is_active = TRUE
      ORDER BY design_capa, builder_model, scenario_code
    `;

    const supportedByScenario = new Map();
    const defaultDraftByScenario = new Map();
    for (const row of scenarioSeriesRows) {
      if (!supportedByScenario.has(row.scenario_code)) supportedByScenario.set(row.scenario_code, []);
      supportedByScenario.get(row.scenario_code).push({
        designCapa: row.design_capa,
        builderModel: row.builder_model
      });
      if (row.default_draft !== null && row.default_draft !== undefined) {
        if (!defaultDraftByScenario.has(row.scenario_code)) defaultDraftByScenario.set(row.scenario_code, {});
        defaultDraftByScenario.get(row.scenario_code)[seriesKey(row.design_capa, row.builder_model)] = Number(row.default_draft);
      }
    }

    const pointsByScenario = new Map();
    for (const row of dwtRows) {
      if (!pointsByScenario.has(row.scenario_code)) pointsByScenario.set(row.scenario_code, {});
      const obj = pointsByScenario.get(row.scenario_code);
      const key = seriesKey(row.design_capa, row.builder_model);
      if (!obj[key]) obj[key] = [];
      obj[key].push({ draft: Number(row.draft_m), dwt: Number(row.dwt_mt) });
    }

    const scenarios = scenarioRows.map(row => {
      const scenario = {
        scenarioId: row.scenario_code,
        scenarioName: row.scenario_name,
        portCode: row.port_code,
        waterDensity: Number(row.water_density),
        supportedSeries: supportedByScenario.get(row.scenario_code) || [],
        draftPointsBySeries: pointsByScenario.get(row.scenario_code) || {}
      };
      if (row.default_draft !== null && row.default_draft !== undefined) scenario.defaultDraft = Number(row.default_draft);
      const defaultDraftBySeries = defaultDraftByScenario.get(row.scenario_code);
      if (defaultDraftBySeries && Object.keys(defaultDraftBySeries).length) scenario.defaultDraftBySeries = defaultDraftBySeries;
      if (row.is_fixed_draft) scenario.fixedDraft = true;
      if (row.data_note) scenario.dataNote = row.data_note;
      if (row.data_pending_message) scenario.dataPendingMessage = row.data_pending_message;
      return scenario;
    });

    const defaultWeightsBySeries = {};
    for (const row of seriesRows) {
      defaultWeightsBySeries[seriesKey(row.design_capa, row.builder_model)] = {
        ballast: Number(row.default_ballast),
        freshWater: Number(row.default_fresh_water),
        fo: Number(row.default_fo),
        mgo: Number(row.default_mgo),
        lubeOil: Number(row.default_lube_oil),
        constant: Number(row.default_constant),
        otherWeight: Number(row.default_other_weight)
      };
    }

    const draftCapsBySeriesScenario = {};
    for (const row of capRows) {
      draftCapsBySeriesScenario[`${seriesKey(row.design_capa, row.builder_model)}|${row.scenario_code}`] = {
        maxDraft: Number(row.max_draft_m),
        reason: row.reason
      };
    }

    res.status(200).json({
      vessels: vesselRows.map(row => ({
        designCapa: row.design_capa,
        builderModel: row.builder_model,
        vesselName: row.vessel_name,
        vesselCode: row.vessel_code,
        designTeu: row.design_teu,
        homo14: row.homo14
      })),
      scenarios,
      defaultWeights,
      defaultWeightsBySeries,
      draftCapsBySeriesScenario
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
