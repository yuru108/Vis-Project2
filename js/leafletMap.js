class LeafletMap {

  /**
   * Class constructor with basic configuration
   * @param {Object}
   * @param {Array}
   */
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
    }
    this.data = _data;
    this.initVis();
  }
  
  /**
   * We initialize scales/axes and append static elements, such as axis titles.
   */
  initVis() {
    let vis = this;


    //ESRI
    vis.esriUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    vis.esriAttr = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';

    //TOPO
    vis.topoUrl ='https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
    vis.topoAttr = 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'

    //Thunderforest Outdoors- requires key... so meh... 
    vis.thOutUrl = 'https://{s}.tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey={apikey}';
    vis.thOutAttr = '&copy; <a href="http://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    //Stamen Terrain
    vis.stUrl = 'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.{ext}';
    vis.stAttr = 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    //this is the base map layer, where we are showing the map background
    //**** TO DO - try different backgrounds 
    vis.base_layer = L.tileLayer(vis.esriUrl, {
      id: 'esri-image',
      attribution: vis.esriAttr,
      ext: 'png'
    });

    vis.topo_layer = L.tileLayer(vis.topoUrl, {
      id: 'topo',
      attribution: vis.topoAttr,
      ext: 'png'
    });

    vis.thOut_layer = L.tileLayer(vis.thOutUrl, {
      id: 'thOut',
      attribution: vis.thOutAttr,
      ext: 'png'
    });

    vis.st_layer = L.tileLayer(vis.stUrl, {
      id: 'st',
      attribution: vis.stAttr,
      ext: 'png'
    });

    vis.theMap = L.map('my-map', {
      center: [39.1031, -84.5120],
      zoom: 12,
      minZoom: 10,
      maxZoom: 18,
      layers: [vis.base_layer]
    });

    let baseMaps = {
      "Esri Map": vis.base_layer,
      "Topo Map": vis.topo_layer,
      "Thunderforest": vis.thOut_layer,
      "Stamen Terrain": vis.st_layer
    };
    L.control.layers(baseMaps).addTo(vis.theMap);
    //if you stopped here, you would just have a map

    //initialize svg for d3 to add to map
    L.svg({clickable:true}).addTo(vis.theMap)// we have to make the svg layer clickable
    vis.overlay = d3.select(vis.theMap.getPanes().overlayPane)
    vis.svg = vis.overlay.select('svg').attr("pointer-events", "auto")
    vis.missingGPS = vis.data.filter(d => !d.LATITUDE || !d.LONGITUDE).length; //Count missing GPS coordinates
    d3.select("#missing-data")
      .text(`${vis.missingGPS} requests could not be mapped because they have missing coordinates`);

    //Color Scales

    vis.responseScale = d3.scaleSequential() //Response time
      .domain(d3.extent(vis.data, d => d.response_days))
      .interpolator(d3.interpolateOrRd);
    vis.neighborhoodScale = d3.scaleOrdinal(d3.schemeCategory10);//Neighborhood
    vis.priorityScale = d3.scaleOrdinal()//Priority
      .domain(["LOW","MEDIUM","HIGH"])
      .range(["green","orange","red"]);
    vis.departmentScale = d3.scaleOrdinal(d3.schemeTableau10);//Department

    vis.colorMode = "response";//Default color mode

    //Use the colors
    d3.select("#color-select").on("change", function() {

      vis.colorMode = this.value;

      vis.Dots
        .transition()
        .duration(400)
        .attr("fill", d => vis.getColor(d));

    });
    
    //these are the city locations, displayed as a set of dots 
    vis.Dots = vis.svg.selectAll('circle')
                    .data(vis.data.filter(d => d.LATITUDE && d.LONGITUDE))
                    .join('circle')
                        .attr("fill", "steelblue")  //---- TO DO- color by magnitude 
                        .attr("stroke", "black")
                        //Leaflet has to take control of projecting points. 
                        //Here we are feeding the latitude and longitude coordinates to
                        //leaflet so that it can project them on the coordinates of the view. 
                        //the returned conversion produces an x and y point. 
                        //We have to select the the desired one using .x or .y
                        .style("cursor", "default")
                        .attr("cx", d => vis.theMap.latLngToLayerPoint([d.LATITUDE,d.LONGITUDE]).x)
                        .attr("cy", d => vis.theMap.latLngToLayerPoint([d.LATITUDE,d.LONGITUDE]).y) 
                        .attr("r", d=> 3)  // --- TO DO- want to make radius proportional to earthquake size? 
                        .on('mouseover', function(event,d) { //function to add mouseover event
                            d3.select(this).transition() //D3 selects the object we have moused over in order to perform operations on it
                              .duration('150') //how long we are transitioning between the two states (works like keyframes)
                              .attr("fill", "#ff5733")
                              .attr("r", 6);

                            //create a tool tip
                            d3.select('#tooltip')
                                .style('opacity', 1)
                                .style('z-index', 1000000)
                                  // Format number with million and thousand separator
                                  //***** TO DO- change this tooltip to show useful information about the quakes
                                .html(`
                                  <div class="tooltip-label">
                                    <b>Request:</b> ${d.SR_TYPE_DESC}<br>
                                    <b>Created:</b> ${d.DATE_CREATED}<br>
                                    <b>Closed:</b> ${d.DATE_CLOSED}<br>
                                    <b>Department:</b> ${d.DEPT_NAME}<br>
                                    <b>Priority:</b> ${d.PRIORITY}<br>
                                    <b>Neighborhood:</b> ${d.NEIGHBORHOOD}
                                  </div>
                                `);

                          })
                        .on('mousemove', (event) => {
                            //position the tooltip
                            d3.select('#tooltip')
                             .style('left', (event.pageX + 10) + 'px')   
                              .style('top', (event.pageY + 10) + 'px');
                         })              
                        .on('mouseleave', function() { //function to add mouseover event
                            d3.select(this).transition() //D3 selects the object we have moused over in order to perform operations on it
                              .duration('150') //how long we are transitioning between the two states (works like keyframes)
                              .attr("fill", "steelblue") //change the fill  TO DO- change fill again
                              .attr('r', 3) //change radius

                            d3.select('#tooltip').style('opacity', 0);//turn off the tooltip

                          })
    
    //handler here for updating the map, as you zoom in and out           
    vis.theMap.on("zoomend", function(){
      vis.updateVis();
    });

  }

  updateVis() {
    let vis = this;

    //want to see how zoomed in you are? 
    // console.log(vis.map.getZoom()); //how zoomed am I?
    //----- maybe you want to use the zoom level as a basis for changing the size of the points... ?
    
   
   //redraw based on new zoom- need to recalculate on-screen position
    vis.Dots
      .attr("cx", d => vis.theMap.latLngToLayerPoint([d.LATITUDE,d.LONGITUDE]).x)
      .attr("cy", d => vis.theMap.latLngToLayerPoint([d.LATITUDE,d.LONGITUDE]).y)
      .attr("fill", d => vis.getColor(d))  //---- TO DO- color by magnitude 
      .attr("r", 3) ; 

  }

  getColor(d) {
    let vis = this;

    if (vis.colorMode === "response") {
      if (!d.response_days || isNaN(d.response_days)) {
        return "steelblue";
      }
      return vis.responseScale(d.response_days);
    }

    if (vis.colorMode === "neighborhood") {
      return vis.neighborhoodScale(d.NEIGHBORHOOD);
    }

    if (vis.colorMode === "priority") {
      return vis.priorityScale(d.PRIORITY);
    }

    if (vis.colorMode === "department") {
      return vis.departmentScale(d.DEPT_NAME);
    }

    return "steelblue";
  }

  renderVis() {
    let vis = this;

    //not using right now... 
 
  }
}