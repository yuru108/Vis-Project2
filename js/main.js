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
