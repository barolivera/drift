import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Trips } from './pages/Trips';
import { TripDetail } from './pages/TripDetail';
import { Profile } from './pages/Profile';
import { Book } from './pages/Book';

export default function App() {
  return (
    <Routes>
      {/* Standalone checkout — minimal chrome, no site header */}
      <Route path="trips/:tripId/book/:bookingId?" element={<Book />} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="trips" element={<Trips />} />
        <Route path="trips/:id" element={<TripDetail />} />
        <Route path="profile" element={<Profile />} />
      </Route>
    </Routes>
  );
}
