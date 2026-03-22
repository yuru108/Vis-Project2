function cleanCategoryValue(value) {
  const normalized = (value ?? "").toString().trim();
  return normalized.length ? normalized : "Unknown";
}

function buildCounts(data, keyAccessor) {
  return d3
    .rollups(
      data,
      (rows) => rows.length,
      (d) => cleanCategoryValue(keyAccessor(d))
    )
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => d3.descending(a.count, b.count));
}

function renderBarChart({ selector, data, color = "#2b7bb9" }) {
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

  const xScale = d3
    .scaleBand()
    .domain(data.map((d) => d.label))
    .range([0, innerWidth])
    .padding(0.15);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.count) || 1])
    .nice()
    .range([innerHeight, 0]);

  g.selectAll(".bar")
    .data(data)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (d) => xScale(d.label))
    .attr("y", (d) => yScale(d.count))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => innerHeight - yScale(d.count))
    .attr("fill", color)
    .append("title")
    .text((d) => `${d.label}: ${d.count}`);

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale))
    .selectAll("text")
    .attr("text-anchor", "end")
    .attr("dx", "-0.5em")
    .attr("dy", "0.15em")
    .attr("transform", "rotate(-40)");

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(yScale).ticks(6).tickFormat(d3.format("d")));
}

function renderAllBarCharts(data) {
  const neighborhoodCounts = buildCounts(data, (d) => d.NEIGHBORHOOD);
  const methodCounts = buildCounts(data, (d) => d.METHOD_RECEIVED);
  const departmentCounts = buildCounts(data, (d) => d.DEPT_NAME);
  const priorityCounts = buildCounts(data, (d) => d.PRIORITY);

  renderBarChart({
    selector: "#chart-neighborhood",
    data: neighborhoodCounts,
    color: "#4c78a8"
  });
  renderBarChart({
    selector: "#chart-method",
    data: methodCounts,
    color: "#f58518"
  });
  renderBarChart({
    selector: "#chart-department",
    data: departmentCounts,
    color: "#54a24b"
  });
  renderBarChart({
    selector: "#chart-priority",
    data: priorityCounts,
    color: "#e45756"
  });
}
