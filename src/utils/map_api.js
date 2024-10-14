import L from 'leaflet';
import * as turf from '@turf/turf';

// Create a map instance
export const createMap = (elementId, center = [39.8283, -98.5795], zoom = 4) => {
  return L.map(elementId).setView(center, zoom);
};

// Add a tile layer to the map
export const addTileLayer = (map, url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', options = {}) => {
  L.tileLayer(url, options).addTo(map);
};

// Create a point
export const createPoint = (lat, lng) => {
  return L.latLng(lat, lng);
};

// Create a polyline
export const createPolyline = (points, options = {}) => {
  return L.polyline(points, options);
};

// Create a polygon
export const createPolygon = (points, options = {}) => {
  return L.polygon(points, options);
};

// Calculate distance between two points (in feet by default)
export const calculateDistance = (point1, point2, units = 'feet') => {
  const from = turf.point([point1.lng, point1.lat]);
  const to = turf.point([point2.lng, point2.lat]);
  return turf.distance(from, to, { units });
};

// Convert coordinates from one CRS to another
export const convertCRS = (coords, fromCRS, toCRS) => {
  return fromCRS.unproject(toCRS.project(coords));
};

// Perform a spatial intersection between two geometries
export const intersection = (geom1, geom2) => {
  const poly1 = turf.polygon(geom1.getLatLngs().map(ring => ring.map(latlng => [latlng.lng, latlng.lat])));
  const poly2 = turf.polygon(geom2.getLatLngs().map(ring => ring.map(latlng => [latlng.lng, latlng.lat])));
  return turf.intersect(poly1, poly2);
};

// Add a geometry to the map
export const addToMap = (map, geometry, options = {}) => {
  geometry.addTo(map);
};

// Set the view of the map
export const setMapView = (map, center, zoom) => {
  map.setView(center, zoom);
};

// Create a GeoJSON layer
export const createGeoJSONLayer = (data, options = {}) => {
  return L.geoJSON(data, options);
};

// Get map bounds
export const getMapBounds = (map) => {
  return map.getBounds();
};

// Check if a point is within map bounds
export const isPointInBounds = (map, point) => {
  return map.getBounds().contains(point);
};

// Create a circle (radius in feet by default)
export const createCircle = (center, radius, options = {}) => {
  const radiusInMeters = turf.convertLength(radius, 'feet', 'meters');
  return L.circle(center, { radius: radiusInMeters, ...options });
};

// Create a rectangle
export const createRectangle = (bounds, options = {}) => {
  return L.rectangle(bounds, options);
};

// Get the center of a geometry
export const getCenter = (geometry) => {
  if (geometry.getCenter) {
    return geometry.getCenter();
  } else if (geometry.getLatLng) {
    return geometry.getLatLng();
  }
  console.warn('Unable to get center for this geometry type.');
  return null;
};

// Calculate the area of a polygon (in square feet by default)
export const calculateArea = (polygon, units = 'square feet') => {
  const turfPolygon = turf.polygon(polygon.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]));
  return turf.area(turfPolygon) * (units === 'square feet' ? 10.7639 : 1);
};

// Buffer a geometry (distance in feet by default)
export const buffer = (geometry, distance, units = 'feet') => {
  const turfGeom = turf.polygon(geometry.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]));
  return turf.buffer(turfGeom, distance, { units });
};

// Simplify a geometry
export const simplify = (geometry, tolerance = 0.01) => {
  const turfGeom = turf.polygon(geometry.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]));
  return turf.simplify(turfGeom, { tolerance });
};

// Calculate the bearing between two points
export const calculateBearing = (start, end) => {
  const startPoint = turf.point([start.lng, start.lat]);
  const endPoint = turf.point([end.lng, end.lat]);
  return turf.bearing(startPoint, endPoint);
};

// Create a bounding box
export const createBoundingBox = (geometry) => {
  const turfGeom = turf.polygon(geometry.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]));
  return turf.bboxPolygon(turf.bbox(turfGeom));
};

// Check if a point is within a polygon
export const isPointInPolygon = (point, polygon) => {
  const turfPoint = turf.point([point.lng, point.lat]);
  const turfPolygon = turf.polygon(polygon.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]));
  return turf.booleanPointInPolygon(turfPoint, turfPolygon);
};

// Calculate the centroid of a polygon
export const calculateCentroid = (polygon) => {
  const turfPolygon = turf.polygon(polygon.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]));
  const centroid = turf.centroid(turfPolygon);
  return L.latLng(centroid.geometry.coordinates[1], centroid.geometry.coordinates[0]);
};

// Merge multiple polygons
export const mergePolygons = (polygons) => {
  const turfPolygons = polygons.map(poly => 
    turf.polygon(poly.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]))
  );
  const merged = turf.union(...turfPolygons);
  return L.geoJSON(merged);
};

// Convert between units
export const convertUnits = (value, fromUnit, toUnit) => {
  return turf.convertLength(value, fromUnit, toUnit);
};
