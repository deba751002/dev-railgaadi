import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Journey from './pages/Journey';
import BetweenStations from './pages/BetweenStations';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/journey/:trainNumber" element={<Journey />} />
      <Route path="/j/:trainNumber" element={<Journey />} />
      <Route path="/between" element={<BetweenStations />} />
    </Routes>
  );
}
