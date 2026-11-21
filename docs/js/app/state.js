/* VICTOR app: The single state object of the application and small lookups on it. */
import { RECOMMENDED } from "./config.js";

export var state = {
  sets: [],            // { id, name, raw: clusters, filtered: clusters, selected, overlapping: n, warnings: [] }
  nextId: 1,
  sizeMin: 1,
  sizeMax: 1,
  sizeMaxTouched: false,
  filterMode: "none",
  metrics: RECOMMENDED.slice(),
  tableRows: null,     // "metrics" | "pairs"; null = chosen automatically from the shape of the results
  result: null,        // { names, codes, matrix } of the selected sets
  resultError: "",
  pending: null,       // { seconds } when a large comparison waits for the user's go-ahead
  approvedSeconds: 0,  // largest estimate the user has agreed to run
  inspectId: null,
  inspectStage: "filtered",
  matchA: null,
  matchB: null,
  viz: { kind: "bar", metric: null, threshold: null, layout: "force" },
  network: null,       // parsed edge list
  networkName: "",
  networks: [],        // every loaded network: { id, name, net }; state.network / networkName mirror the active one
  networkId: null,
  gridMeasure: "modularity",
  gridOffSets: {},     // cluster set ids left out of the sets x networks grid
  gridOffNets: {},     // network ids left out of it
  qualityGrid: {},     // "networkId|setId" -> summary of that cluster set on that network
  compareMode: "all",  // "all" pairs, or every set against one "reference"
  referenceId: null,
  qualityId: null,
  qualityStage: "raw",
  quality: null,
  qualitySort: { key: "conductance", dir: 1 }
};

export function selectedSets() { return state.sets.filter(function (s) { return s.selected; }); }

export function setById(id) { return state.sets.filter(function (s) { return s.id === id; })[0] || null; }
