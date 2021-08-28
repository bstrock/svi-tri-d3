<h1>Social Vulnerability and Toxic Waste</h1>
This was my final project for Interactive Geovisualization, which allows for a multilevel exploration of two primary datasources: the US CDC's Social Vulnerability Index, and the EPA's Toxic Release Inventory.  In this visualization, users are presented with a zoomable top-level map which represents social vulnerability characteristics as a choropleth by county, then overlays proportionally-sized hexagon symbols representing number of TRI sites in that county.  
/
When the mouse is moved over a state, the visual changes persona by changing the hexagon symbols into a dot-density map representing individual sites.  In this way, users can identify areas of interest in the small-scale map, then zoom in and reveal additional detail in smaller areas using the large-scale map.

<h2>Link to project page</h2>

[View the project here](https://bstrock.github.io/svi-tri-d3/)

<h2>Project Features</h2>

* Multimodal exploratory visualization offering two different personas to explore the same dataset at multiple scales
* Sidebar selector offers the ability to change underlying data theme for choropleth
* User-friendly color schemes courtesy of ColorBrewer2
* Zoomable vector-based map rendered in D3 using appropriate equal-area projection
* Dynamic, persistent choropleth legend which animates between different datasets to provide data context
* Callouts with additional contextual information

<h2>Tech Stack</h2>

* Javascript
* JQuery
* D3.js
* HTML5
* CSS
* Bootstrap
* GeoJSON
