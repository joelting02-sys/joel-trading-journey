import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import Trades from "@/pages/Trades";
import NewTrade from "@/pages/NewTrade";
import Analytics from "@/pages/Analytics";
import Accounts from "@/pages/Accounts";
import Settings from "@/pages/Settings";
import Assistant from "@/pages/Assistant";
import Sop from "@/pages/Sop";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/trades" element={<Trades />} />
        <Route path="/new-trade" element={<NewTrade />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/sop" element={<Sop />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Router>
  );
}
