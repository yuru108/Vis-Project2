const width = 900;
const height = 480;

const svg = d3
  .select("#viz")
  .append("svg")
  .attr("viewBox", `0 0 ${width} ${height}`)
  .attr("role", "img")
  .attr("aria-label", "D3 placeholder graphic");

const data = d3.range(18).map(() => ({
  x: Math.random() * width,
  y: Math.random() * height,
  r: 12 + Math.random() * 36,
}));

const dispatcher = d3.dispatch("filterData");

svg
  .append("rect")
  .attr("width", width)
  .attr("height", height)
  .attr("fill", "url(#bg)");

const defs = svg.append("defs");

const gradient = defs
  .append("linearGradient")
  .attr("id", "bg")
  .attr("x1", "0%")
  .attr("y1", "0%")
  .attr("x2", "100%")
  .attr("y2", "100%");

gradient.append("stop").attr("offset", "0%").attr("stop-color", "#fde2e4");
gradient.append("stop").attr("offset", "100%").attr("stop-color", "#cfe1f5");

svg
  .selectAll("circle")
  .data(data)
  .join("circle")
  .attr("cx", (d) => d.x)
  .attr("cy", (d) => d.y)
  .attr("r", (d) => d.r)
  .attr("fill", "rgba(239, 71, 111, 0.55)")
  .attr("stroke", "#ef476f")
  .attr("stroke-width", 1.5);

svg
  .append("text")
  .attr("x", width / 2)
  .attr("y", height / 2)
  .attr("text-anchor", "middle")
  .attr("dominant-baseline", "middle")
  .attr("fill", "#1b1b1b")
  .attr("font-size", 28)
  .attr("font-family", "'Noto Serif TC', 'Source Serif 4', serif")
  .text("D3 已就緒");


let leafletMap;
let allRecords = [];
let filteredRecords = [];
let interactionFilteredRecords = null;
let serviceTypeOptions = [];
let activeServiceTypes = new Set();

function cleanText(value, fallback = "") {
  const text = (value ?? "").toString().trim();
  return text || fallback;
}

function normalizeTypeCode(value) {
  return cleanText(value, "UNKNOWN").toUpperCase();
}

function isPotholeRecord(record) {
  const code = normalizeTypeCode(record.SR_TYPE);
  const desc = cleanText(record.SR_TYPE_DESC).toUpperCase();
  return code === "PTHOLE" || desc.includes("POTHOLE");
}

function buildServiceTypeOptions(data) {
  const grouped = d3.rollups(
    data,
    (rows) => ({
      count: rows.length,
      label: cleanText(rows[0].SR_TYPE_DESC, rows[0].SR_TYPE),
    }),
    (d) => d.SR_TYPE
  );

  return grouped
    .map(([key, values]) => ({
      key,
      label: values.label,
      count: values.count,
    }))
    .sort((a, b) => d3.descending(a.count, b.count));
}

function getPotholeDefaultKeys() {
  return serviceTypeOptions
    .filter((d) => d.key === "PTHOLE" || d.label.toUpperCase().includes("POTHOLE"))
    .map((d) => d.key);
}

function updateFilterSummary() {
  const summary = d3.select("#filter-summary");
  if (summary.empty()) return;

  const visibleRecords = getVisibleRecords();
  const interactionSuffix = interactionFilteredRecords ? " (brush filter active)" : "";
  summary.text(
    `${visibleRecords.length.toLocaleString()} visible requests from ${activeServiceTypes.size.toLocaleString()} selected service types${interactionSuffix}`
  );
}

function getVisibleRecords() {
  return interactionFilteredRecords || filteredRecords;
}

function renderViews({ rerenderMap = true, rerenderTimeline = false, timelineData = null } = {}) {
  const visibleRecords = getVisibleRecords();

  if (rerenderMap && leafletMap) {
    leafletMap.setData(visibleRecords);
  }
  renderAllBarCharts(visibleRecords);

  if (rerenderTimeline && typeof renderTimelineChart === "function") {
    renderTimelineChart(Array.isArray(timelineData) ? timelineData : filteredRecords);
  }

  updateFilterSummary();
}

function applyFiltersAndRender() {
  filteredRecords = allRecords.filter((d) => activeServiceTypes.has(d.SR_TYPE));
  interactionFilteredRecords = null;
  renderViews({ rerenderMap: true, rerenderTimeline: true, timelineData: filteredRecords });
}

function applySearchVisibility(searchValue) {
  const query = cleanText(searchValue).toUpperCase();
  d3.select("#service-type-list")
    .selectAll(".service-type-item")
    .classed("is-hidden", (d) => {
      if (!query) return false;
      const haystack = `${d.key} ${d.label}`.toUpperCase();
      return !haystack.includes(query);
    });
}

function updateTypeListVisualState() {
  d3.select("#service-type-list")
    .selectAll(".service-type-item")
    .classed("is-inactive", (d) => !activeServiceTypes.has(d.key))
    .select("input")
    .property("checked", (d) => activeServiceTypes.has(d.key));
}

function renderServiceTypeList() {
  const list = d3.select("#service-type-list");
  if (list.empty()) {
    return;
  }

  const rows = list
    .selectAll("div.service-type-item")
    .data(serviceTypeOptions, (d) => d.key)
    .join((enter) => {
      const row = enter.append("div").attr("class", "service-type-item");
      const label = row.append("label");

      label
        .append("input")
        .attr("type", "checkbox")
        .on("change", function (event, d) {
          if (this.checked) {
            activeServiceTypes.add(d.key);
          } else {
            activeServiceTypes.delete(d.key);
          }
          updateTypeListVisualState();
          applyFiltersAndRender();
        });

      label.append("span").attr("class", "service-type-name");
      row.append("span").attr("class", "service-type-count");
      return row;
    });

  rows.select(".service-type-name").text((d) => `${d.label} [${d.key}]`);
  rows.select(".service-type-count").text((d) => d.count.toLocaleString());

  updateTypeListVisualState();
  applySearchVisibility(d3.select("#service-type-search").property("value"));

  d3.select("#service-type-search").on("input", function () {
    applySearchVisibility(this.value);
  });
}

dispatcher.on("filterData.main", function (filteredData, source) {
  interactionFilteredRecords = Array.isArray(filteredData) ? filteredData : null;
  const shouldRerenderMap = source !== "map_brush" || interactionFilteredRecords === null;
  renderViews({
    rerenderMap: shouldRerenderMap,
    rerenderTimeline: source !== "timeline_brush",
    timelineData: getVisibleRecords()
  });
});

// **This Needs To Be Moved To A Separate File**

// Load 311 service requests, then normalize and filter records before mapping.
// Reason: raw CSV fields can vary in naming/casing and may include invalid coordinates,
// which can break or clutter the map. This step standardizes latitude/longitude and
// the Leaflet layer renders accurate, focused points.

d3.csv('data/Cincinnati311.csv')
  .then(data => {
    console.log("number of items: " + data.length);

    const allowedFields = [
      'SR_TYPE',
      'SR_TYPE_DESC',
      'PRIORITY',
      'DEPT_CODE',
      'DEPT_NAME',
      'DEPT_DIVISION',
      'ADDRESS',
      'LOCATION',
      'NEIGHBORHOOD',
      'ZIPCODE',
      'METHOD_RECEIVED',
      'DATE_CREATED',
      'TIME_RECEIVED',
      'DATE_CLOSED',
      'DATE_STATUS_CHANGE',
      'TIME_STATUS_CHANGE',
      'DATE_LAST_UPDATE',
      'TIME_LAST_UPDATE',
      'PLANNED_RESPONSE_TIME',
      'PLANNED_END_DATE',
      'PLANNED_COMPLETION_DAYS',
      'DATE_DISPATCHED',
      'TIME_DISPATCHED',
      'DATE_REVISED_COMPLETION',
      'DATE_REVISED_COMPLETION_REASON',
      'COLLECTION_SPECIAL_DATE',
      'COLLECTION_DAY',
      'COLLECTION_ROUTE',
      'COLLECTION_DIST',
      'PROPTY_CITY_OWNED_YN',
      'PROPTY_CITY_DEPT_OWNER',
      'STREET_NO',
      'STREET_DIRECTION',
      'STREET_NAME',
      'REQUEST_RETURN_CALL',
      'NUM_POTHOLES',
      'POLICE_DISTRICT',
      'POLICE_RPT_AREA',
      'LATITUDE',
      'LONGITUDE',
      'DATE_TIME_RECEIVED',
      'COMMUNITY_COUNCIL_NEIGHBORHOOD'
    ];

    allRecords = data
      .map((d, i) => {
        const row = {};
        allowedFields.forEach(field => {
          row[field] = d[field] ?? '';
        });

        row.LATITUDE = +(d.LATITUDE ?? d.latitude);
        row.LONGITUDE = +(d.LONGITUDE ?? d.longitude);
        row.ID = d.ID ?? d.id ?? i;
        row._index = i;
        row.SR_TYPE = normalizeTypeCode(d.SR_TYPE);
        row.SR_TYPE_DESC = cleanText(d.SR_TYPE_DESC, row.SR_TYPE);

        return row;
      })
      .filter(d => Number.isFinite(d.LATITUDE) && Number.isFinite(d.LONGITUDE));

    serviceTypeOptions = buildServiceTypeOptions(allRecords);

    const potholeDefaults = getPotholeDefaultKeys();
    activeServiceTypes = new Set(potholeDefaults);
    if (!activeServiceTypes.size) {
      allRecords.forEach((d) => {
        if (isPotholeRecord(d)) {
          activeServiceTypes.add(d.SR_TYPE);
        }
      });
    }

    renderServiceTypeList();
    leafletMap = new LeafletMap({ parentElement: '#my-map' }, allRecords);
    applyFiltersAndRender();

  })
  .catch(error => console.error(error));
