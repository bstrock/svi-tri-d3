
// define promises as d3 method objects
const promises = [d3.json('data/counties.json'), d3.json('data/states.json'), d3.csv('data/svi-2018.csv'), d3.json('data/tri-2019.json'), d3.json('data/domains.json')];

// pass method objects to Promise constructor
const dataPromises = Promise.all(promises);

var expressed = 'EP_POV'

// allows counties to be highlighted without clipping border
d3.selection.prototype.moveToFront = function() {
  return this.each(function(){
    this.parentNode.appendChild(this);
  });
};

// in place of a proper margins object
var chartVars = {
    width: window.innerWidth * .33,
    height: 250,
    leftPadding: 1,
    rightPadding: 40,
    topBottomPadding: 10
  };

// calcualted values
chartVars.innerWidth = chartVars.width - chartVars.leftPadding - chartVars.rightPadding;
chartVars.innerHeight = chartVars.height - (chartVars.topBottomPadding * 2);
chartVars.translate = "translate(" + chartVars.leftPadding + "," + chartVars.topBottomPadding + ")";

// call promises, construct datasets object, pass to map generation function
dataPromises.then(function(data) {

  const datasets = {
    counties: data[0],
    states: data[1],
    svi: data[2],
    tri: data[3],
    domains: data[4]
  };

  console.log('datasets', datasets);

  let attributes = [];

  const sample = Object.keys(datasets.svi[0])
  for (let i = 0; i < sample.length; i++) {
    if (sample[i].includes('EP_')) {
      attributes.push(sample[i])
    }
  }
  console.log('attributes', attributes)

  generateMap(datasets, attributes);

});

// in case of error
dataPromises.catch(function(){
  console.log("Promises not kept.")
});

var generateMap = function(datasets, attributes) {

  width = window.innerWidth * .8,
  height = window.innerHeight * .7

  const projection = d3.geoAlbers() // because
    .scale(1400) // big number
    .translate([width / 2, (height / 2) - height * .05]); // centers the map w/ 5% vertical offset

  // may not be necessary, but it works, so here it is
  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on('zoom', function(e){
      map.selectAll('path')
        .attr('transform', e.transform);
      map.selectAll('.pin')
        .attr('transform', e.transform)
    });

  const path = d3.geoPath() // define geopath generator
    .projection(projection); // assign projection

  let map = d3.select('#map-container').append('svg') // create svg element
    .attr('class', 'map') // define class
    .attr('width', width) // assign width
    .attr('height', height) // assign height
    .style('background-color', 'rgba(255, 255, 255, .75)');

  map.call(zoom);
  console.log(datasets.states.objects)
  // get data ready
  let counties = topojson.feature(datasets.counties, datasets.counties.objects['us-county-boundaries']).features;
  let triSites = topojson.feature(datasets.tri, datasets.tri.objects['tri-2019']).features;
  let states = topojson.feature(datasets.states, datasets.states.objects['states']).features;
  // add a title
  let mapTitle = map.append("text")
      .attr("x", width / 3)
      .attr("y", 30)
      .classed("mapTitle", true)
      .text("Four Ways of Exploring Spatial Racism");

  console.log('start join')
  dataJoin(counties, datasets.svi, attributes); // get those attributes where they belong
  console.log('end join')

  console.log('start counties')
  addCounties(map, path, counties); // attach counties to svg
  console.log('end counties')

  console.log('start sites')
  addSites(map, triSites, projection)
  console.log('end sites')

  addStates(map, path, states)


  let scales = scaler(datasets.domains, attributes);  // build scale object

  addLegend(map, scales, datasets.domains)

  let county_paths = d3.selectAll('.county')
    .style('fill', 'white')
    .style('stroke-width', 0)

  county_paths.transition('counties')
    .duration(10000)
    .style('fill', (d) => {return choropleth(d.properties, scales)})


  //addRadioButtons(map, attArray, attributes);  // makes buttons change expression

  //chartFactory(map, attributes);  // makes a chart
};

var dataJoin = function(geodata, attributes){

  console.log(attributes);

  // pandas for javascript, anyone? ^_^

  // is it a triple-loop?  it's a triple-loop.  Here we go.

  for (let i = 0; i < geodata.length; i++){  // start with geojson items
    let key = geodata[i].properties.geoid;  // town centre sitename is key
    for (let j = 0; j < attributes.length; j++){ // check against attributes array
      let lock = attributes[j]['FIPS'];  // find matching row name in csv data

      if (key === lock){  // a match!
        let county = geodata[i].properties;  // attribute values will be assigned to this
        const data = attributes[j];  // individual row/col pairs

        for (let att in data){ // loop over attributes
          const val = data[att]; // assign value to check whether text or number

          // this is the join- it's also a type function to separately parse floats to avoid converting strings to NaN
          if (val === '-999') {
            county[att] = null
          } else if (val >= 0) {
            county[att] = parseFloat(val)
          } else {
            county[att] = val;
          }
        }
      }
    }
  }
};

var addCounties = function(map, path, geodata) {

  // this is where the centre paths are created and added.  when they are added, they are also given a colorspace.
  // in converting attribute value to color value via color scale, each areal unit has a possible colorspace of (in
  // this case) 9 values.  In order to provide convenient and efficient color switching, we'll simply use the color
  // scales object created in colorize() to define an object which contains the color value of each attribute
  // for each town centre.  This will be called by .style() when the attribute selector radio button changes state.

  // the thing you point at
  /*let tooltip = d3.select("#chart-box")
                .append("div")
                .classed("toolTip", true);*/

  let counties = map.append('g')
    .attr('id', 'counties')

  counties.selectAll('path')  // create path object placeholders
    .data(geodata)  // feed d3
    .enter()  // enter topology array
    .append('path')  // append path to svg
    .attr('d', path) // assign path data to svg path
    .attr('id', (d) => {
      return d.properties.LOCATION  // tag sitename to path
    })
    .classed('county', true)  // add class
    /*
      .on('mouseenter', function() {  // highlights
      highlighter(this.id)
    })
    .style('fill-opacity', '.75')  // default value
    .on('mouseleave', function() {  // dehighlights
      dehighligher(this.id)
    })
  .on("mousemove", function(event, d){  // tooltip mover
            d3.select(this).raise();
            return d3.select('.toolTip')
              .style("left", d3.pointer(event)[0]-1200 + "px")
              .style("top", d3.pointer(event)[1]-100 + "px")
              .style("display", "inline-block")
              .html("<b><p>" + (d.properties.NAME.replace('-', ' ')) + "</p></b> " + expressed + ": " + (d.properties[expressed]) + '%');
        })
    		.on("mouseout", () => {tooltip.style("display", "none");});  // bye bye tooltip
  */

};

var addStates = function(map, path, geodata) {

  // this is where the centre paths are created and added.  when they are added, they are also given a colorspace.
  // in converting attribute value to color value via color scale, each areal unit has a possible colorspace of (in
  // this case) 9 values.  In order to provide convenient and efficient color switching, we'll simply use the color
  // scales object created in colorize() to define an object which contains the color value of each attribute
  // for each town centre.  This will be called by .style() when the attribute selector radio button changes state.

  // the thing you point at
  let tooltip = d3.select("#chart-box")
    .append("div")
    .classed("toolTip", true);

  let states = map.append('g')
    .attr('id', 'states')

  states.selectAll('path')  // create path object placeholders
    .data(geodata)  // feed d3
    .enter()  // enter topology array
    .append('path')  // append path to svg
    .attr('d', path) // assign path data to svg path
    .attr('id', (d) => {
      return d.properties.name  // tag sitename to path
    })
    .style('fill-opacity', 0)
    .style('stroke', 'black')
    .style('stroke-width', .2)
    .on('mouseenter', function() {  // highlights
    highlighter(this.name)
  })
  .on('mouseleave', function() {  // dehighlights
    dehighlighter(this.name)
  }).classed('state', true)  // add class
}

var addSites = function(map, geodata, projection){
console.log('start sites draw')
console.log(geodata)

let pins = map.append('g')

pins.selectAll('circle')
.data(geodata)
.enter()
.append('circle')
.attr('cx', (d) => { return projection([d.geometry.coordinates[0], d.geometry.coordinates[1]])[0]})
.attr('cy', (d) => {return projection([d.geometry.coordinates[0], d.geometry.coordinates[1]])[1]})
.attr('r', .75)
.style('fill-color', 'rgba(0,0,0,0)')
.style('stroke', ('rgba(0,0,0,0)'))
.classed('pin', true)
}

var addLegend = function(map, scales, domains){

let x = d3.scaleLinear()
.domain(domains[expressed])
.rangeRound([600, 700]);

let g = map.append("g")
.attr("class", "key")
.attr("transform", "translate(0,50)");

console.log(scales)
g.selectAll("rect")
.data(scales.color.range().map(function(d) {
  d = scales.color.invertExtent(d);
  if (d[0] == null) d[0] = x.domain()[0];
  if (d[1] == null) d[1] = x.domain()[1];
  return d;
}))
.enter().append("rect")
.attr("height", 8)
.attr("x", function(d) { return x(d[0]); })
.attr("width", function(d) { return x(d[1]) - x(d[0]); })
.attr("fill", function(d) { return scales.color(d[0]); });

g.append("text")
.attr("class", "caption")
.attr("x", x.range()[0])
.attr("y", -6)
.attr("fill", "#000")
.attr("text-anchor", "start")
.attr("font-weight", "bold")
.text("Percentage of Population Living in Poverty");

g.call(d3.axisBottom(x)
.tickSize(13)
.tickFormat(function(x, i) { return i ? x : x + "%"; })
.tickValues(scales.breaks))
.select(".domain")
.remove();

}
let chartFactory = function (map, attributes) {
// we're going to build a chart

let scales = scaler(datasets.domains, attributes);  // need those scales

// another tooltip
let tooltip = d3.select("#chart-box")
              .append("div")
              .classed("toolTip", true)
              .attr('id', 'chart-tip')
              .style('display', 'none');

let chart = d3.select('#chart-box')  // placeholder container
.append('svg')
.attr('width', chartVars.width)
.attr('height', chartVars.height)
.attr('class', 'chart')
.style('background-color', 'white');

let bars = chart.selectAll('.bar')  // create bars
.data(attributes)  // load data
.enter()  // ILLUSIONS, MICHAEL
.append('rect')  // make a bar
.sort(function (a, b) {  // sort bars by value
  return a[expressed] - b[expressed]
})
.attr('id', function (d) {
  return d.Area;
})
.classed('bar', true)
.attr('width', chartVars.innerWidth / attributes.length - 3)  // separates bars w/padding
.attr('height', function (d, i) {
  return chartVars.height - scales.y(parseFloat(d[expressed]))
})
.attr('x', function (d, i) {
  return i * (chartVars.innerWidth / attributes.length) + chartVars.leftPadding  // place the bar
})
.attr('y', function (d, i) {
  return scales.y(parseFloat(d[expressed]))
})
.style('fill', function (d, i){
  return choropleth(d, scales)  // gives it the proper color
})
.on('mouseenter', function() {  // highlights
  highlighter(this.id)
})
.on("mousemove", function(event, d){  // tooltip mover

        let id = d.Area;
        d3.select('path#' + id + '.borough').raise();

        return d3.select('.toolTip')
          .style("left", d3.pointer(event)[0]-chartVars.rightPadding + "px")
          .style("top", d3.pointer(event)[1]+300 + "px")
          .style("display", "inline-block")
          .html("<b>" + (d.Area.replace('-', ' ')) + "</b><br> " + expressed + ": " + (d[expressed]) + '%');
    })
.on('mouseleave', function() {  // dehighlights
  dehighlighter(this.id);
  d3.select('.toolTip').style('display', 'none')  // hides tooltip
});

let locale = {"currency": ["", "%"]};  // formats scale values with % sign

let x = d3.formatLocale(locale);

// add y axis
let yAxis = d3.axisRight()
    .scale(scales.y)
    .tickFormat(x.format('$'));

//place axis
let axis = chart.append("g")
  .classed('axis', true)
  .attr("transform", 'translate(' + (chartVars.innerWidth + 10) + ', ' + chartVars.topBottomPadding * 2 +')')
  .call(yAxis);

// title for chart
let chartTitle = chart.append("text")
    .attr("x", 20)
    .attr("y", 20)
    .classed("chartTitle", true)
    .text("London Boroughs ranked by % of " + expressed + ", 2018/19");


};

var addRadioButtons = function(map, attArray, attributes) {
// a click switches the radio button, then runs colorizer function on all boroughs for that attribute
console.log(attArray);
d3.selectAll('input')
.on('click', function(){
  expressed = this.value;  // sets current expressed
  changeExpression(attributes); // changes visual elements according to expressed attribute
  changeInfoBox();  // cycles html for associated content
});
};

var scaler = function(domains, attributes){
// makes the scales we need
// yay colorbrewer
const colors = [colorbrewer.OrRd['5'],
                colorbrewer.BuGn['5'],
                colorbrewer.PuBuGn['5'],
                colorbrewer.RdPu['5'],
                colorbrewer.Blues['5'],
                colorbrewer.Oranges['5'],
                colorbrewer.PuRd['5'],
                colorbrewer.YlOrBr['5'],
                colorbrewer.RdBu['5'],
                colorbrewer.BrBG['5'],
                colorbrewer.Greens['5'],
                colorbrewer.YlOrRd['5'],
                colorbrewer.PiYG['5']
]

let place = attributes.indexOf(expressed)

let values = domains[expressed]
console.log(domains)
console.log('values: ', values)

let domain = [d3.min(values), d3.max(values)];  // here's the domain for this attribute
console.log(domain);

// jenks classification
let clusters = ss.ckmeans(values, 5);  // determine attribute value clusters
let breaks = clusters.map(function(d){
    return d3.min(d);
});
console.log(breaks);

// color scale
 let colorScale = d3.scaleQuantile()
                      .range(colors[place])
                      .domain(breaks);
// y scale
 let yScale = d3.scaleLinear()
                  .range([chartVars.innerHeight, chartVars.topBottomPadding])
                  .domain(domain);
// scales object
 let scales = {
   'color': colorScale,
   'y': yScale,
   'breaks': breaks
 };

return scales;

};

let choropleth = function(props, scales){
let val = props[expressed];
return scales.color(val)  // check val, make color
};

var changeExpression = function(attributes){
let scales = scaler(attributes);  // get scales

// change boroughs
let boroughs = d3.selectAll('.borough')
.transition('color_boroughs')  // prevents collisions
.duration(1500)
.delay(100)
.ease(d3.easePolyInOut)  // looks cool
.style('fill', function(d){
  return choropleth(d.properties, scales)  // changes color
});

let bars = d3.selectAll(".bar")
    .sort(function(a, b){
        return a[expressed] - b[expressed];
    })
    .transition('move_bars')
    .ease(d3.easePolyInOut)
    .duration(1500)
    .attr("x", function(d, i){
        return i * (chartVars.innerWidth / attributes.length) + chartVars.leftPadding;
    })
    //resize bars
    .attr("height", function(d, i){
      return chartVars.height - scales.y(parseFloat(d[expressed]))
    })
    .attr("y", function(d, i){
        return scales.y(parseFloat(d[expressed]))

    })
    //recolor bars
    .style("fill", function(d){
        return choropleth(d, scales);
    });

// axis format
let locale = {"currency": ["", "%"]};
let x = d3.formatLocale(locale);

// make axis
let yAxis = d3.axisRight()
    .scale(scales.y)
    .tickFormat(x.format('$'));

// transition it in
let axis = d3.selectAll('.axis')
  .transition('shift_axis')
  .duration(1500)
  .ease(d3.easePolyInOut)
  .call(yAxis)

// change title
let chartTitle = d3.select('.chartTitle')
  .text("London Boroughs ranked by % of " + expressed + ", 2018/19");

};


var highlighter = function (name){
//change stroke

/*let bar = d3.select('#' + id + '.bar')
  .transition('highlight_bars')
  .ease(d3.easePolyInOut)
  .duration(100)
    .style("stroke", "black")
    .style("stroke-width", "2")
    .style('fill-opacity', '1');*/

  let pins = d3.selectAll('.pin').filter((d) => {return d.name === name})

  pins.transition('pins-in')
    .ease(d3.easeBackOut.overshoot(1.7))
    .duration(1000)
    .style('fill', 'rgba(0,0,0,1)')
    .style('stroke', 'white')
    .style('stroke-width', .2)

};

var dehighlighter = function (name){
//change stroke

  let pins = d3.selectAll('.pin').filter((d) => {return d.properties.name == name})

  pins.transition('pins-out')
    .ease(d3.easeBackOut.overshoot(1.7))
    .duration(1000)
    .style('fill', 'rgba(0,0,0,0)')
    .style('stroke', 'rgba(0,0,0,0)')

  /*let bar = d3.selectAll('#' + id + '.bar')
    .transition('dehighlight_bars')
    .ease(d3.easePolyInOut)
    .delay(200)
    .duration(100)
      .style("stroke", "grey")
      .style("stroke-width", "1")
      .style('fill-opacity', '.5');*/

};

var changeInfoBox = function(){

// checks expressed value and changes the text accordingly
switch(expressed) {
case 'Total Incidents':
  d3.select('.info-header')
    .html('Fly Tipping In London');

  d3.select('.info-body')
    .html('Fly tipping, also called illegal dumping, occurs when rubbish, trash, or other refuse is\n' +
      'disposed of improperly in a public environment.  Fly tipping is typically driven by household waste ' +
      'and bulk items, left in surreptitious locations by householders or unlicensed waste collectors.');

  break;

  case 'Change from Five Years Ago':
  d3.select('.info-header')
    .html('Change from Five Years Ago');

  d3.select('.info-body')
    .html('Fly tipping is an increasingly pervasive issue in London.  Last year, over 300,000 incidents of fly tipping' +
      ' were recorded across the city, creating environmental hazards within local communities and racking up costs related to' +
      " mitigation.  Fly tipping disposals cost the city's 33 Councils £18.4m in 2016/17.");
  break;

case 'Total Actions Taken':
  d3.select('.info-header')
    .html('Total Actions Taken');

  d3.select('.info-body')
    .html('In 2018/19, over 157,000 enforcement actions were taken as a result of fly tipping incidents.  \n' +
      'These sanctions range from written warnings to formal prosecution.  Fly tipping sanctions are' +
      ' typically the result of an investigation related to an incident, such as a review of CCTV footage.');
  break;

case 'Warning Letters':
  d3.select('.info-header')
    .html('Warning Letters');

  d3.select('.info-body')
    .html('Warning letters are the mildest form of sanction.  These letters typically inform the recipient that they\'ve been ' +
      "connected to a fly tipping investigation, and how to properly dispose of household waste. In 2019/20, more than 8,500 Warning " +
      "Letters were issued as a result of fly tipping investigations in London.");
  break;

case 'Fixed Penalty Notices':
   d3.select('.info-header')
    .html('Fixed Penalty Notices');

  d3.select('.info-body')
    .html('Since 2016, Councils have been empowered to issue Fixed Penalty Notices in response to fly tipping incidents,' +
      ' which have become the primary enforcement response in many boroughs.  Issuing and enforcing Fixed Penalty Notices ' +
      ' costs the city more than the incoming revenue from the associated fines.');
  break;

case 'Statutory Notices':
   d3.select('.info-header')
    .html('Fixed Penalty Notices');

  d3.select('.info-body')
    .html('As fly tipping has become increasingly problematic, London has innovated new enforcement methods to combat' +
      ' these issues and reduce incidents of fly tipping.  In 2019, Councils were given the authority to fine households'+
      ' up to $400 if their waste is illegally fly tipped by an informal waste collector.');
  break;

case 'Formal Cautions':
   d3.select('.info-header')
    .html('Formal Cautions');

  d3.select('.info-body')
    .html('This shift in strategies for targeted enforcement action against fly tipping is evident in the data- ' +
      'Formal Cautions have largely fallen out of favor due to the availability of Fixed Penalty Notices, which' +
      ' imply the admission of guilt alongside the promise of no further action ones the fine is paid.');
  break;

case 'Prosecutions':
   d3.select('.info-header')
    .html('Prosecutions');

  d3.select('.info-body')
    .html('Prosecutions have also declined dramatically in London, although they remain a focus of enforcement elsewhere' +
      ' in the country.  Prosecutions are costly to pursue, and as such, pursuing a strategy of prosecution for small-scale' +
      ' fly tipping incidents is often inefficient in densely populated areas.');
  break;
}

};
