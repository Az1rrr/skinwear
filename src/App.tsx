import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import NavBar from "./components/NavBar";
import WizardPage from "./components/WizardPage";
import CalculatorPage from "./components/CalculatorPage";

export default function App() {
  useEffect(() => {
    invoke("ready_cmd");
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-surface-500 flex flex-col">
        <NavBar />
        <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<WizardPage />} />
            <Route path="/calculator" element={<CalculatorPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
