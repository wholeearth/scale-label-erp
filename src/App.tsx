import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AdminDashboard from "./pages/AdminDashboard";
import OperatorDashboard from "./pages/OperatorDashboard";
import ProductionManagerDashboard from "./pages/ProductionManagerDashboard";
import CustomerDashboard from "./pages/CustomerDashboard";
import AccountantDashboard from "./pages/AccountantDashboard";
import CommissionAgentDashboard from "./pages/CommissionAgentDashboard";
import TraceabilityPage from "./pages/TraceabilityPage";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/operator" 
            element={
              <ProtectedRoute allowedRoles={['operator']}>
                <OperatorDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/production-manager" 
            element={
              <ProtectedRoute allowedRoles={['production_manager']}>
                <ProductionManagerDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/customer" 
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <CustomerDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/accountant" 
            element={
              <ProtectedRoute allowedRoles={['accountant']}>
                <AccountantDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/commission-agent" 
            element={
              <ProtectedRoute allowedRoles={['commission_agent']}>
                <CommissionAgentDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/traceability" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'operator', 'production_manager', 'accountant']}>
                <TraceabilityPage />
              </ProtectedRoute>
            } 
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
