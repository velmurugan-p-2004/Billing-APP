/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare namespace google {
    namespace accounts {
        namespace oauth2 {
            function initTokenClient(config: any): any;
        }
    }
}
