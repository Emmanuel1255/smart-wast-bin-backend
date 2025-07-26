// src/services/googleMapsService.ts
import { env } from '../config/env';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RouteRequest {
  origin: Coordinates;
  destination: Coordinates;
  waypoints?: Coordinates[];
}

export interface RouteResponse {
  distance: number; // in meters
  duration: number; // in seconds
  polyline: string;
  steps?: Array<{
    instruction: string;
    distance: number;
    duration: number;
  }>;
}

export interface DistanceMatrixRequest {
  origins: Coordinates[];
  destinations: Coordinates[];
}

export interface DistanceMatrixResponse {
  distances: number[][]; // distances[i][j] = distance from origin[i] to destination[j]
  durations: number[][]; // durations[i][j] = duration from origin[i] to destination[j]
}

export class GoogleMapsService {
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api';

  constructor() {
    this.apiKey = env.GOOGLE_MAPS_API_KEY;
  }

  /**
   * Get route between two points with optional waypoints
   */
  async getRoute(request: RouteRequest): Promise<RouteResponse> {
    try {
      const { origin, destination, waypoints } = request;
      
      let url = `${this.baseUrl}/directions/json?`;
      url += `origin=${origin.latitude},${origin.longitude}`;
      url += `&destination=${destination.latitude},${destination.longitude}`;
      
      if (waypoints && waypoints.length > 0) {
        const waypointStr = waypoints
          .map(wp => `${wp.latitude},${wp.longitude}`)
          .join('|');
        url += `&waypoints=optimize:true|${waypointStr}`;
      }
      
      url += `&key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json() as any;

      if (data.status !== 'OK') {
        throw new Error(`Google Maps API error: ${data.status} - ${data.error_message}`);
      }

      const route = data.routes[0];
      const leg = route.legs[0];

      return {
        distance: leg.distance.value,
        duration: leg.duration.value,
        polyline: route.overview_polyline.points,
        steps: leg.steps?.map((step: any) => ({
          instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
          distance: step.distance.value,
          duration: step.duration.value
        }))
      };
    } catch (error) {
      console.error('Error getting route from Google Maps:', error);
      throw error;
    }
  }

  /**
   * Get distance matrix for multiple origins and destinations
   */
  async getDistanceMatrix(request: DistanceMatrixRequest): Promise<DistanceMatrixResponse> {
    try {
      const { origins, destinations } = request;
      
      const originsStr = origins
        .map(coord => `${coord.latitude},${coord.longitude}`)
        .join('|');
      
      const destinationsStr = destinations
        .map(coord => `${coord.latitude},${coord.longitude}`)
        .join('|');

      const url = `${this.baseUrl}/distancematrix/json?` +
        `origins=${encodeURIComponent(originsStr)}` +
        `&destinations=${encodeURIComponent(destinationsStr)}` +
        `&key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json() as any;

      if (data.status !== 'OK') {
        throw new Error(`Google Maps API error: ${data.status} - ${data.error_message}`);
      }

      const distances: number[][] = [];
      const durations: number[][] = [];

      data.rows.forEach((row: any, i: number) => {
        distances[i] = [];
        durations[i] = [];
        
        row.elements.forEach((element: any, j: number) => {
          if (element.status === 'OK') {
            distances[i][j] = element.distance.value;
            durations[i][j] = element.duration.value;
          } else {
            distances[i][j] = Infinity;
            durations[i][j] = Infinity;
          }
        });
      });

      return { distances, durations };
    } catch (error) {
      console.error('Error getting distance matrix from Google Maps:', error);
      throw error;
    }
  }

  /**
   * Geocode an address to coordinates
   */
  async geocode(address: string): Promise<Coordinates> {
    try {
      const url = `${this.baseUrl}/geocode/json?` +
        `address=${encodeURIComponent(address)}` +
        `&key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json() as any;

      if (data.status !== 'OK') {
        throw new Error(`Geocoding error: ${data.status} - ${data.error_message}`);
      }

      const location = data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng
      };
    } catch (error) {
      console.error('Error geocoding address:', error);
      throw error;
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(coordinates: Coordinates): Promise<string> {
    try {
      const url = `${this.baseUrl}/geocode/json?` +
        `latlng=${coordinates.latitude},${coordinates.longitude}` +
        `&key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json() as any;

      if (data.status !== 'OK') {
        throw new Error(`Reverse geocoding error: ${data.status} - ${data.error_message}`);
      }

      return data.results[0].formatted_address;
    } catch (error) {
      console.error('Error reverse geocoding coordinates:', error);
      throw error;
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   * (Backup method when Google Maps API is not available)
   */
  calculateHaversineDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Validate API key
   */
  async validateApiKey(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/geocode/json?` +
        `address=1600+Amphitheatre+Parkway,+Mountain+View,+CA` +
        `&key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json() as any;

      return data.status === 'OK';
    } catch (error) {
      console.error('Error validating Google Maps API key:', error);
      return false;
    }
  }
}