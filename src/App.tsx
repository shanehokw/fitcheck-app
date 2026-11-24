import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { InstallBanner } from './components/InstallBanner'
import { CollectionDetail, Collections, NewCollection } from './pages/Collections'
import { LookDetail } from './pages/LookDetail'
import { Looks } from './pages/Looks'
import { NewPiece, PieceDetail, Pieces } from './pages/Pieces'
import { Settings } from './pages/Settings'
import { Stats } from './pages/Stats'

export default function App() {
  return (
    <HashRouter>
      <InstallBanner />
      <Routes>
        <Route path="/" element={<Looks />} />
        <Route path="/look/:id" element={<LookDetail />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/collections/new" element={<NewCollection />} />
        <Route path="/collections/:id" element={<CollectionDetail />} />
        <Route path="/pieces" element={<Pieces />} />
        <Route path="/pieces/new" element={<NewPiece />} />
        <Route path="/pieces/:id" element={<PieceDetail />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      <nav className="tabbar" aria-label="Main">
        <NavLink to="/" end>Looks</NavLink>
        <NavLink to="/collections">Collections</NavLink>
        <NavLink to="/pieces">Pieces</NavLink>
        <NavLink to="/stats">Stats</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>
    </HashRouter>
  )
}
