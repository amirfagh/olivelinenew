import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Catalog from "./pages/Catalog";
import RequireAdmin from "./components/RequireAdmin";
import AdminAddUser from "./pages/AdminAddUser";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
  path="/dashboard"
  element={
    <RequireAdmin>
      <Dashboard />
    </RequireAdmin>
  }
/>
<Route path="/admin-add-user" element={
  <RequireAdmin>
    <AdminAddUser />
  </RequireAdmin>
} />
        <Route path="/catalog" element={<Catalog />} />
      </Routes>
    </Router>
  );
}

export default App;
