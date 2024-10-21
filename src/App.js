import React from 'react';
import ArcGISRESTTreeMap from './components/ArcGISRESTTreeMap';
import { DarkModeProvider } from './contexts/DarkModeContext';
import { MapProvider } from './contexts/MapContext';

function App() {
  return (
    <DarkModeProvider>
      <MapProvider>
        <ArcGISRESTTreeMap />
      </MapProvider>
    </DarkModeProvider>
  );
}

export default App;
