"use client";

import { useEffect } from "react";
import { useCompanyInfo } from "@/context/CompanyInfoContext";
import { getApiUrl } from "@/utils/api";

export function DynamicFavicon() {
  const { companyInfo } = useCompanyInfo();
  
  useEffect(() => {
    if (companyInfo?.logoUrl) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      const API_URL = getApiUrl();
      const src = companyInfo.logoUrl.startsWith("http") 
        ? companyInfo.logoUrl 
        : `${API_URL.replace("/api", "")}${companyInfo.logoUrl}`;
      link.href = src;
    }
  }, [companyInfo?.logoUrl]);
  
  return null;
}
