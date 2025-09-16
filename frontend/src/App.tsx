import QueryProvider from './providers/QueryProvider';
import { AuthProvider } from './contexts/AuthContext';
import AppRouter from './router/AppRouter';
import './styles/globals.css';

function App(): JSX.Element {
  return (
    <QueryProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </QueryProvider>
  );
}

export default App;