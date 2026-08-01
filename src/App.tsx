import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Journey from './pages/Journey';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/journey/:trainNumber" element={<Journey />} />
      <Route path="/j/:trainNumber" element={<Journey />} />
    </Routes>
  );
}
