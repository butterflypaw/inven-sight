import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Scan from "./pages/Scan";
import Inventory from "./pages/Inventory";
import Details from "./pages/Details"; 
import Alerts from "./pages/Alerts";
import Layout from "./components/Layout";
import { Toaster } from "react-hot-toast";

function App() {
  return (
    <Router>
      <Layout>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              fontSize: "14px",
              padding: "12px 16px",
            },
          }}
        />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/details" element={<Details />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
