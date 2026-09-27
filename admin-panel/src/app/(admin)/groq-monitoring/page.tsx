import type { Metadata } from "next";
import GroqMonitoringPage from "@/components/groq-monitoring/GroqMonitoringPage";

export const metadata: Metadata = {
  title: "Groq API Monitoring | RZMedical Admin",
  description: "Surveillance de la consommation des tokens de l API Groq",
};

export default function Page() {
  return <GroqMonitoringPage />;
}
