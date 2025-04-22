# **App Name**: CycleZen

## Core Features:

- Location Selection: Display a map widget to detect and select a location using GPS or manual input.
- Radius Input: Allow the user to specify a radius (in kilometers) for route generation.
- Route Generation: Fetch cycling routes from OpenRouteService API based on location and radius, ensuring round trips, avoidance of dead ends, and minimal road segment repetition.
- Route Display: List generated routes as cards with distance and a map preview.
- Route Details: On card tap, display the full route on the map with total distance, estimated time, and a button to open the route in Google Maps.

## Style Guidelines:

- Primary color: A calming teal (#008080) to evoke a sense of nature and tranquility.
- Secondary color: A light gray (#F0F0F0) for backgrounds and card containers.
- Accent: A vibrant orange (#FFA500) for interactive elements like buttons and selected routes, providing contrast and highlighting action items.
- Use a card-based layout for displaying routes, making it easy to scan and select.
- Use clear and simple icons to represent route details like distance and estimated time.
- Subtle animations when transitioning between route list and route details view.

## Original User Request:
Create an Android app using Flutter + Firebase that has the following features:
- A homepage with:
  - A map widget that detects current location using GPS (with manual override to pick a point on map)
  - A text input to set radius in kilometers
  - A button labeled “Generate Routes”
- When "Generate Routes" is clicked, send the selected coordinates and radius to OpenRouteService API to fetch 3 to 10 cycling routes:
  - Routes should be round trips starting and ending at the selected location
  - Avoid dead ends unless the road ends at a Google Maps attraction or point of interest
  - Avoid repeating the same road segments more than once in a route
- Show the list of generated routes as cards with distance and a map preview
- On tapping a card, show full route on map with:
  - Total distance, estimated time
  - Button to open route in Google Maps
- Use Firebase Authentication for login (Google Sign-In)
- Save liked routes under the user’s Firestore profile
  