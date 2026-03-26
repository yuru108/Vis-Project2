function cleanCategoryValue(value) {
  const normalized = (value ?? "").toString().trim();
  return normalized.length ? normalized : "Unknown";
}

function cleanServiceType(value) {
  return (value ?? "UNKNOWN").toString().trim().toUpperCase() || "UNKNOWN";
}

function getCssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function buildServiceTypeColorScale(serviceTypes) {
  const knownMap = {
    PTHOLE: getCssVar("--service-type-pthole", "#d04a39"),
    "MTL-FRN": getCssVar("--service-type-mtl-frn", "#355070"),
    SLPYST: getCssVar("--service-type-slpyst", "#457b9d"),
    "RF-COLLT": getCssVar("--service-type-rf-collt", "#2a9d8f"),
    "BLD-RES": getCssVar("--service-type-bld-res", "#6d597a"),
    "LITR-PRV": getCssVar("--service-type-litr-prv", "#8ab17d"),
    CMDVABDV: getCssVar("--service-type-cmdvabdv", "#f4a261"),
    "TLGR-PRV": getCssVar("--service-type-tlgr-prv", "#2f6690"),
    "311ASSIT": getCssVar("--service-type-311assit", "#bc4749"),
    "YDWSTA-J": getCssVar("--service-type-ydwsta-j", "#9c6644"),
    RWFRNTRT: getCssVar("--service-type-rwfrntrt", "#6c757d"),
    STRSGN: getCssVar("--service-type-strsgn", "#3a86ff"),
    "TRASH-I": getCssVar("--service-type-trash-i", "#ff7f11"),
    RCYCLNG: getCssVar("--service-type-rcyclng", "#588157"),
    "TSIG-MAL": getCssVar("--service-type-tsig-mal", "#277da1"),
    TRSHCRTR: getCssVar("--service-type-trshcrtr", "#7f5539"),
    PLCJUNKV: getCssVar("--service-type-plcjunkv", "#a44a3f"),
    DAPUB1: getCssVar("--service-type-dapub1", "#495057"),
    SVCCMPLT: getCssVar("--service-type-svccmplt", "#4d908e"),
    REPAIR96: getCssVar("--service-type-repair96", "#8d99ae")
  };

  const fallbackPalette = d3.schemeTableau10.concat(d3.schemeSet3);
  const hashColor = (key) => {
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    return fallbackPalette[hash % fallbackPalette.length];
  };

  const colorByType = new Map();
  serviceTypes.forEach((type) => {
    colorByType.set(type, knownMap[type] || hashColor(type));
  });

  return (type) => colorByType.get(type) || "#6c757d";
}

function buildStackData(data, groupAccessor, serviceTypes) {
  const grouped = d3.rollups(
    data,
    (rows) => {
      const row = { total: rows.length };
      serviceTypes.forEach((type) => {
        row[type] = 0;
      });
      rows.forEach((r) => {
        const type = cleanServiceType(r.SR_TYPE);
        if (type in row) {
          row[type] += 1;
        }
      });
      row.__records = rows;
      return row;
    },
    (d) => cleanCategoryValue(groupAccessor(d))
  )
    .map(([label, counts]) => ({ label, ...counts }))
    .sort((a, b) => d3.descending(a.total, b.total));

  return grouped;
}

function renderStackedBarChart({
  selector,
  chartId,
  data,
  groupAccessor,
  serviceTypes,
  colorForType,
  selectedLabel,
  onBarSelect
}) {
  const margin = { top: 10, right: 10, bottom: 95, left: 50 };
  const width = 560;
  const height = 300;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const container = d3.select(selector);
  container.selectAll("*").remove();

  const svg = container
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const stackRows = buildStackData(data, groupAccessor, serviceTypes);
  if (!stackRows.length) {
    return;
  }

  const rowByLabel = new Map(stackRows.map((row) => [row.label, row]));
  const isSelected = (label) => Boolean(selectedLabel) && label === selectedLabel;
  const hasSelection = Boolean(selectedLabel);

  const xScale = d3
    .scaleBand()
    .domain(stackRows.map((d) => d.label))
    .range([0, innerWidth])
    .padding(0.15);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(stackRows, (d) => d.total) || 1])
    .nice()
    .range([innerHeight, 0]);

  const stackedSeries = d3.stack().keys(serviceTypes)(stackRows);

  const bars = g.selectAll(".stack-layer")
    .data(stackedSeries)
    .join("g")
    .attr("class", "stack-layer")
    .attr("fill", (d) => colorForType(d.key))
    .selectAll("rect")
    .data((d) => d.map((segment) => ({
      key: d.key,
      label: segment.data.label,
      value: segment.data[d.key],
      records: segment.data.__records,
      y0: segment[0],
      y1: segment[1]
    })))
    .join("rect")
    .attr("class", "bar-segment")
    .attr("x", (d) => xScale(d.label))
    .attr("y", (d) => yScale(d.y1))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => Math.max(0, yScale(d.y0) - yScale(d.y1)))
    .style("cursor", "pointer")
    .attr("opacity", (d) => (hasSelection && !isSelected(d.label) ? 0.35 : 1))
    .on("click", (_event, d) => {
      if (typeof onBarSelect === "function") {
        onBarSelect({ chartId, label: d.label, records: d.records });
      }
    });

  bars
    .selectAll("title")
    .data((d) => [d])
    .join("title")
    .text((d) => `${d.label}\n${d.key}: ${d.value}`);

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale))
    .selectAll("text")
    .attr("class", "x-axis-label")
    .attr("text-anchor", "end")
    .attr("dx", "-0.5em")
    .attr("dy", "0.15em")
    .attr("transform", "rotate(-40)")
    .style("cursor", "pointer")
    .style("font-weight", (d) => (isSelected(d) ? "700" : "400"))
    .attr("opacity", (d) => (hasSelection && !isSelected(d) ? 0.5 : 1))
    .on("click", (_event, label) => {
      if (typeof onBarSelect !== "function") {
        return;
      }
      const row = rowByLabel.get(label);
      if (!row) {
        return;
      }
      onBarSelect({ chartId, label, records: row.__records });
    });

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(yScale).ticks(6).tickFormat(d3.format("d")));
}

function renderServiceTypeLegend(serviceTypes, colorForType) {
  const legendContainer = d3.select("#service-type-legend");
  if (legendContainer.empty()) {
    return;
  }

  legendContainer.selectAll("*").remove();

  legendContainer
    .selectAll(".service-type-legend-item")
    .data(serviceTypes, (d) => d)
    .join("div")
    .attr("class", "service-type-legend-item")
    .html((type) => `
      <div class="service-type-legend-swatch" style="background-color: ${colorForType(type)}"></div>
      <span>${type}</span>
    `);
}

function renderAllBarCharts(data, onBarSelect, selectedState = {}) {
  const serviceTypes = d3
    .rollups(data, (rows) => rows.length, (d) => cleanServiceType(d.SR_TYPE))
    .sort((a, b) => d3.descending(a[1], b[1]))
    .map(([type]) => type);

  const colorForType = buildServiceTypeColorScale(serviceTypes);
  renderServiceTypeLegend(serviceTypes, colorForType);

  renderStackedBarChart({
    selector: "#chart-neighborhood",
    chartId: "neighborhood",
    data,
    groupAccessor: (d) => d.NEIGHBORHOOD,
    serviceTypes,
    colorForType,
    selectedLabel: selectedState.neighborhood,
    onBarSelect
  });
  renderStackedBarChart({
    selector: "#chart-method",
    chartId: "method",
    data,
    groupAccessor: (d) => d.METHOD_RECEIVED,
    serviceTypes,
    colorForType,
    selectedLabel: selectedState.method,
    onBarSelect
  });
  renderStackedBarChart({
    selector: "#chart-department",
    chartId: "department",
    data,
    groupAccessor: (d) => d.DEPT_NAME,
    serviceTypes,
    colorForType,
    selectedLabel: selectedState.department,
    onBarSelect
  });
  renderStackedBarChart({
    selector: "#chart-priority",
    chartId: "priority",
    data,
    groupAccessor: (d) => d.PRIORITY,
    serviceTypes,
    colorForType,
    selectedLabel: selectedState.priority,
    onBarSelect
  });
}
