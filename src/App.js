import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Catalog from "./pages/Catalog";
import RequireAdmin from "./components/RequireAdmin";
import AdminAddUser from "./pages/AdminAddUser";
import Orders from "./pages/Orders";
import CustomerProfile from "./pages/CustomerProfile";
import AdminCustomers from "./pages/AdminCustomers";
import MyOrders from "./pages/MyOrders";
import AdminOrderApproval from "./pages/AdminOrderApproval";
import CustomerAdd from "./pages/AdminCreateCustomer";
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
<Route
  path="/admin-customers"
  element={
    <RequireAdmin><AdminCustomers /></RequireAdmin>
      
    
  }
/>
<Route
  path="/my-orders"
  element={
    <MyOrders />
      
    
  }
/>
<Route
  path="/Admin-order-approval"
  element={
    <RequireAdmin><AdminOrderApproval /></RequireAdmin>
      
    
  }
/>
<Route
  path="/Cusromer-add"
  element={
    <RequireAdmin><CustomerAdd /></RequireAdmin>
      
    
  }
/>
<Route path="/orders" element={
   <RequireAdmin>
    
    <Orders />
    </RequireAdmin>
    } />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/CustomerProfile" element={<CustomerProfile />} />
      </Routes>
    </Router>
  );
}

export default App;
