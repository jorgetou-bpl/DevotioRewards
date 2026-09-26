import React from 'react';
import { useAuth } from '../context/AuthContext';
import { CustomerBaseTab } from '../components/dashboard/CustomerBaseTab';

// Was a Home tab (`activeTab === 'clientes'`), now its own route
// (`/clientes`) reachable from AppLayout's sidebar. AdminRoute already
// gates this at the router level, so no role check needed here.
const ClientesPage = () => {
  const { token } = useAuth();

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6" data-testid="clientes-page">
      <div className="mb-6">
        <h2 className="text-heading text-2xl sm:text-3xl" data-testid="clientes-title">
          Clientes
        </h2>
        <p className="text-zinc-500 text-sm mt-1">
          Base de clientes del workspace
        </p>
      </div>
      <CustomerBaseTab token={token} />
    </div>
  );
};

export default ClientesPage;
