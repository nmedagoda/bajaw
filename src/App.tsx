import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navigation from "@/components/Navigation";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import PerformanceList from "./pages/PerformanceList";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen bg-background">
            <Navigation />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route 
                path="/performances" 
                element={
                  <ProtectedRoute>
                    <PerformanceList />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/singer/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['singer']}>
                    <div className="p-8 text-center">
                      <h1 className="text-3xl font-bold mb-4">Singer Dashboard</h1>
                      <p className="text-muted-foreground">Coming soon: Your performance analytics and recording studio</p>
                    </div>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/singer/record" 
                element={
                  <ProtectedRoute allowedRoles={['singer']}>
                    <div className="p-8 text-center">
                      <h1 className="text-3xl font-bold mb-4">Record New Song</h1>
                      <p className="text-muted-foreground">Coming soon: Song search and recording studio</p>
                    </div>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/judge/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['judge']}>
                    <div className="p-8 text-center">
                      <h1 className="text-3xl font-bold mb-4">Judge Dashboard</h1>
                      <p className="text-muted-foreground">Coming soon: Performance evaluation tools and analytics</p>
                    </div>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/audience/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['audience']}>
                    <div className="p-8 text-center">
                      <h1 className="text-3xl font-bold mb-4">Audience Dashboard</h1>
                      <p className="text-muted-foreground">Coming soon: Your voting history and favorite performances</p>
                    </div>
                  </ProtectedRoute>
                } 
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
