import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navigation from "@/components/Navigation";
import { ThemeProvider } from "@/components/theme-provider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import RecordSong from "./pages/RecordSong";
import SingerDashboard from "./pages/SingerDashboard";
import PerformanceList from "./pages/PerformanceList";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="bajaw-ui-theme">
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
                    <SingerDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/singer/record" 
                element={
                  <ProtectedRoute allowedRoles={['singer']}>
                    <RecordSong />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/record" 
                element={
                  <ProtectedRoute allowedRoles={['singer']}>
                    <RecordSong />
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
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <Profile />
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
  </ThemeProvider>
  </QueryClientProvider>
);

export default App;
