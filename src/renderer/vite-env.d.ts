/// <reference types="vite/client" />

declare global {
  interface Window {
    api: {
      getState: () => Promise<any>;
      saveState: (payload: any) => Promise<any>;
      setSimulationMode: (mode: string) => Promise<string>;
      createManualDocument: (doc: any) => Promise<any>;
      generateRandomDocument: (options: any) => Promise<any>;
      generateBatchDocuments: (options: any, count: number) => Promise<any[]>;
      runPrinter: (docId: string) => Promise<any>;
      runPdfOnly: (docId: string) => Promise<any>;
      openFile: (filePath: string) => Promise<string>;
      getPaths: () => Promise<any>;
    };
  }
}

export {};
