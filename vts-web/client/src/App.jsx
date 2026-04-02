import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OverstayProvider } from './context/OverstayContext';
import Login       from './pages/Login';
import Dashboard   from './pages/Dashboard';
import CheckIn     from './pages/CheckIn';
import Cards       from './pages/Cards';
import Logs        from './pages/Logs';
import Users       from './pages/Users';
import Departments from './pages/Departments';
import Visitors    from './pages/Visitors';
import Layout      from './components/Layout';

function Protected({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <OverstayProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protected><Layout /></Protected>}>
              <Route index              element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard"   element={<Dashboard />} />
              <Route path="checkin"     element={<CheckIn />} />
              <Route path="cards"       element={<Cards />} />
              <Route path="logs"        element={<Logs />} />
              <Route path="visitors"    element={<Visitors />} />
              <Route path="users"       element={<Users />} />
              <Route path="departments" element={<Departments />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </OverstayProvider>
    </AuthProvider>
  );
}