const dispatcher = d3.dispatch("filterData");

let leafletMap;
let allRecords = [];
let filteredRecords = [];
let timelineBrushedRecords = null;
let mapBrushedRecords = null;
let serviceTypeOptions = [];
let activeServiceTypes = new Set();
let selectedBarState = null;
let selectedBarRecords = [];

const barChartAccessors = {
  neighborhood: (d) => cleanText(d.NEIGHBORHOOD, "Unknown"),
  method: (d) => cleanText(d.METHOD_RECEIVED, "Unknown"),
  department: (d) => cleanText(d.DEPT_NAME, "Unknown"),
  priority: (d) => cleanText(d.PRIORITY, "Unknown")
};

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
      label: cleanText(rows[0].SR_TYPE_DESC, rows[0].SR_TYPE)
    }),
    (d) => d.SR_TYPE
  );

  return grouped
    .map(([key, values]) => ({
      key,
      label: values.label,
      count: values.count
    }))
    .sort((a, b) => d3.descending(a.count, b.count));
}

function getPotholeDefaultKeys() {
  return serviceTypeOptions
    .filter((d) => d.key === "PTHOLE" || d.label.toUpperCase().includes("POTHOLE"))
    .map((d) => d.key);
}

function intersectByReference(source, selected) {
  if (!Array.isArray(selected)) {
    return source;
  }
  const selectedSet = new Set(selected);
  return source.filter((d) => selectedSet.has(d));
}

function getSelectedBarChartState() {
  if (!selectedBarState) {
    return {};
  }
  return { [selectedBarState.chartId]: selectedBarState.label };
}

function syncSelectedBarRecords(baseRecords) {
  if (!selectedBarState) {
    selectedBarRecords = [];
    return;
  }

  const accessor = barChartAccessors[selectedBarState.chartId];
  if (!accessor) {
    selectedBarState = null;
    selectedBarRecords = [];
    return;
  }

  selectedBarRecords = baseRecords.filter(
    (d) => accessor(d) === selectedBarState.label
  );

  if (!selectedBarRecords.length) {
    selectedBarState = null;
  }
}

function getVisibleRecords() {
  return selectedBarState ? selectedBarRecords : filteredRecords;
}

function updateFilterSummary() {
  const summary = d3.select("#filter-summary");
  if (summary.empty()) return;

  const visibleRecords = getVisibleRecords();
  const activeInteractions = [];
  if (Array.isArray(timelineBrushedRecords)) activeInteractions.push("timeline brush");
  if (Array.isArray(mapBrushedRecords)) activeInteractions.push("map brush");
  const interactionSuffix = activeInteractions.length
    ? ` (${activeInteractions.join(" + ")} active)`
    : "";

  summary.text(
    `${visibleRecords.length.toLocaleString()} visible requests from ${activeServiceTypes.size.toLocaleString()} selected service types${interactionSuffix}`
  );
}

function renderViews({ rerenderMap = true, rerenderTimeline = true } = {}) {
  const baseRecords = filteredRecords;
  const visibleRecords = getVisibleRecords();

  if (rerenderMap && leafletMap) {
    leafletMap.setData(visibleRecords);
    leafletMap.setHighlightedRecords(selectedBarState ? selectedBarRecords : []);
  }

  renderAllBarCharts(baseRecords, handleBarSelection, getSelectedBarChartState());

  if (rerenderTimeline && typeof renderTimelineChart === "function") {
    renderTimelineChart(visibleRecords);
  }

  updateFilterSummary();
}

function recomputeFiltersAndRender(options = {}) {
  const rerenderMap = options.rerenderMap !== false;
  const rerenderTimeline = options.rerenderTimeline !== false;

  const serviceTypeFilteredRecords = allRecords.filter((d) => activeServiceTypes.has(d.SR_TYPE));
  const timelineFiltered = intersectByReference(serviceTypeFilteredRecords, timelineBrushedRecords);
  const interactionFiltered = intersectByReference(timelineFiltered, mapBrushedRecords);

  filteredRecords = interactionFiltered;
  syncSelectedBarRecords(filteredRecords);

  renderViews({ rerenderMap, rerenderTimeline });
}

function handleBarSelection(selection) {
  const clickedSameBar =
    selectedBarState &&
    selectedBarState.chartId === selection.chartId &&
    selectedBarState.label === selection.label;

  if (clickedSameBar) {
    selectedBarState = null;
  } else {
    selectedBarState = {
      chartId: selection.chartId,
      label: selection.label
    };
  }

  syncSelectedBarRecords(filteredRecords);
  renderViews({ rerenderMap: true, rerenderTimeline: true });
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
          // Service-type changes reset interaction brushes for a predictable filtered state.
          timelineBrushedRecords = null;
          mapBrushedRecords = null;
          recomputeFiltersAndRender({ rerenderMap: true, rerenderTimeline: true });
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
  if (source === "map_brush") {
    mapBrushedRecords = Array.isArray(filteredData) ? filteredData : null;
  } else {
    timelineBrushedRecords = Array.isArray(filteredData) ? filteredData : null;
  }

  const shouldRerenderMap = source !== "map_brush" || mapBrushedRecords === null;
  const shouldRerenderTimeline = source !== "timeline_brush";

  recomputeFiltersAndRender({
    rerenderMap: shouldRerenderMap,
    rerenderTimeline: shouldRerenderTimeline
  });
});

// Load 311 service requests, normalize fields, and initialize all visual components.
d3.csv("data/Cincinnati311.csv")
  .then((data) => {
    const allowedFields = [
      "SR_TYPE",
      "SR_TYPE_DESC",
      "PRIORITY",
      "DEPT_CODE",
      "DEPT_NAME",
      "DEPT_DIVISION",
      "ADDRESS",
      "LOCATION",
      "NEIGHBORHOOD",
      "ZIPCODE",
      "METHOD_RECEIVED",
      "DATE_CREATED",
      "TIME_RECEIVED",
      "DATE_CLOSED",
      "DATE_STATUS_CHANGE",
      "TIME_STATUS_CHANGE",
      "DATE_LAST_UPDATE",
      "TIME_LAST_UPDATE",
      "PLANNED_RESPONSE_TIME",
      "PLANNED_END_DATE",
      "PLANNED_COMPLETION_DAYS",
      "DATE_DISPATCHED",
      "TIME_DISPATCHED",
      "DATE_REVISED_COMPLETION",
      "DATE_REVISED_COMPLETION_REASON",
      "COLLECTION_SPECIAL_DATE",
      "COLLECTION_DAY",
      "COLLECTION_ROUTE",
      "COLLECTION_DIST",
      "PROPTY_CITY_OWNED_YN",
      "PROPTY_CITY_DEPT_OWNER",
      "STREET_NO",
      "STREET_DIRECTION",
      "STREET_NAME",
      "REQUEST_RETURN_CALL",
      "NUM_POTHOLES",
      "POLICE_DISTRICT",
      "POLICE_RPT_AREA",
      "LATITUDE",
      "LONGITUDE",
      "DATE_TIME_RECEIVED",
      "COMMUNITY_COUNCIL_NEIGHBORHOOD"
    ];

    allRecords = data
      .map((d, i) => {
        const row = {};
        allowedFields.forEach((field) => {
          row[field] = d[field] ?? "";
        });

        row.LATITUDE = +(d.LATITUDE ?? d.latitude);
        row.LONGITUDE = +(d.LONGITUDE ?? d.longitude);
        row.ID = d.ID ?? d.id ?? i;
        row._index = i;
        row.SR_TYPE = normalizeTypeCode(d.SR_TYPE);
        row.SR_TYPE_DESC = cleanText(d.SR_TYPE_DESC, row.SR_TYPE);

        // Calculate response_days from DATE_CREATED and DATE_CLOSED
        if (d.DATE_CREATED && d.DATE_CLOSED) {
          const created = new Date(d.DATE_CREATED);
          const closed = new Date(d.DATE_CLOSED);
          if (!isNaN(created) && !isNaN(closed)) {
            row.response_days = (closed - created) / (1000 * 60 * 60 * 24);
          } else {
            row.response_days = null;
          }
        } else {
          row.response_days = null;
        }

        return row;
      })
      .filter((d) => Number.isFinite(d.LATITUDE) && Number.isFinite(d.LONGITUDE));

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
    leafletMap = new LeafletMap({ parentElement: "#my-map" }, allRecords);
    recomputeFiltersAndRender({ rerenderMap: true, rerenderTimeline: true });
  })
  .catch((error) => console.error(error));
