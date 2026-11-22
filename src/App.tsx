import Routes_ from './pages/Routes';
import MilkyWay from './pages/MilkyWay';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AircraftProvider } from './context/AircraftContext';
import Layout from './components/Layout';
import Now from './pages/Now';
import Aircraft from './pages/Aircraft';
import Iss from './pages/Iss';
import SettingsPage from './pages/Settings';

document.documentElement.classList.add('dark');

// Sem login — app pessoal, de um só utilizador (decisão tomada na migração para a Netlify).
// O "useAuth()/isLoading/user" da Zite foi removido; as rotas ficam logo acessíveis.
export default function App() {
  return (
    <AppProvider>
      <AircraftProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Now />} />
              <Route path="/avioes" element={<Aircraft />} />
              <Route path="/iss" element={<Iss />} />
              <Route path="/rotas" element={<Routes_ />} />
              <Route path="/via-lactea" element={<MilkyWay />} />
              <Route path="/definicoes" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AircraftProvider>
    </AppProvider>
  );
}
